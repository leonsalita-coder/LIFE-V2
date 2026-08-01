/**
 * Post-session note — the "noticer" role from the mentor, automated for
 * Train specifically. Takes a compact digest of the just-finished session
 * (including deterministic plateau flags computed client-side, and a
 * cross-tile Vitals recovery signal when available) and returns ONE short,
 * concrete, prioritized observation — never a generic "great job!".
 *
 * Deliberately runs on Sonnet, not Haiku (unlike the higher-frequency
 * classify/generate routes): this fires once per finished session, so the
 * cost difference is negligible, and the reasoning here — weighing a
 * plateau against recovery data, picking the single most important thing
 * to say — benefits from the stronger model.
 *
 * Server-side so the Anthropic key never reaches the browser. No key →
 * { error: 'no_key' }. The train tile calls this through the host bridge
 * (window.Vitality.getInsight) — a sealed tile can't fetch, and this is a
 * real paid call, so the tile only fires it once per finished session and
 * caches the result.
 */
export async function POST(req: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Response.json({ error: 'no_key' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad_request' })
  }
  const b = body as { goal?: unknown; digest?: unknown }
  const goal = String(b?.goal || 'general fitness').trim().slice(0, 200)
  const digest = String(b?.digest || '').trim().slice(0, 2000)
  if (!digest) return Response.json({ error: 'no_digest' })

  const prompt = `You are an elite strength & conditioning coach who ALSO specializes in combat-sports (taekwondo) and soccer performance. You are reviewing your athlete's just-finished training session. Your job is to notice ONE real thing in the data below and say it in one sentence — the way a coach who has trained this specific athlete for years would, not a chatbot skimming a log.

ATHLETE'S GOAL: ${goal}

SESSION DIGEST:
${digest}

HOW TO READ THE DATA:
- A line marked "PLATEAU" means weight AND reps have both been flat or dropping for that many consecutive REAL sessions — this was computed with real arithmetic, not eyeballed, so treat it as a genuine signal, never noise.
- "Recovery (Vitals, N-day avg)" is a 0-100 score built from sleep and how the athlete says they feel (or a wearable, if connected). Below ~55 is meaningfully compromised; below ~40 is a real red flag. If this line is absent, no recovery data exists yet — do not guess at it or mention its absence.
- A line marked "AUTO-DELOAD APPLIED" means the SYSTEM has already, automatically, reduced that lift's weight — this already happened, it is not something to suggest.
- One missed set, or a single session with no change, is NOT a plateau and NOT worth mentioning. Never manufacture concern from noise, and never invent a trend, number, or data point that is not literally present in the digest above.

PRIORITY — exactly one of these applies; find the highest-priority one that is TRUE and speak only to that:
1. An "AUTO-DELOAD APPLIED" line is present → report it as a fact that already happened, never as a recommendation. Name the lift and the old and new weight, and say plainly why: the plateau plus low recovery meant this was fatigue, not weak programming — for an athlete training taekwondo and soccer on top of lifting, protecting recovery right now IS the training plan, not a setback.
2. A plateau with NO auto-deload applied (meaning recovery was fine or unknown) → this is a genuine training-variable stall, not a fatigue issue. Recommend exactly ONE concrete fix, chosen for what's actually likely to work for that specific lift: climbing reps at the current weight before adding more load (double progression), swapping the exercise for a fresh variation that hits the same muscles differently, or a technique check. Do not default to "take a deload" for every plateau — that is lazy, generic coaching and you are not a lazy, generic coach.
3. A PR today → name the specific lift and the number, and connect it forward to the athlete's actual sport performance (how that strength shows up in a sprint, a kick, a tackle) rather than just "nice lift."
4. A real, sustained upward trend across many sessions with nothing more urgent going on → say plainly what's working and why it matters for reaching their goal.
5. Nothing notable yet (too little history, or everything is genuinely flat but unremarkable and not yet a real plateau) → say so honestly and briefly. Do not manufacture a trend, a concern, or praise that the data doesn't support.

NON-NEGOTIABLE RULES:
- Exactly one sentence, under 35 words.
- Always cite at least one real number straight from the digest (a weight, a session count, a recovery score, a rep count) — a claim with no number attached is not acceptable.
- Never generic praise with no substance ("great job", "keep it up", "nice work", "way to go").
- Never lecture, scold, or moralize. Blunt, specific, and respectful — the way you'd actually talk to an athlete you take seriously.
- Never reference any data source, device, or fact that is not literally present in the digest above.

Return ONLY a valid JSON object, nothing else, no markdown fences, no commentary: {"note":"your one sentence"}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) return Response.json({ error: 'anthropic_error' })
    const j = await r.json()
    const text: string = j?.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return Response.json({ error: 'bad_response' })
    const parsed = JSON.parse(match[0])
    if (typeof parsed?.note === 'string' && parsed.note.trim()) return Response.json({ note: parsed.note.trim() })
    return Response.json({ error: 'bad_response' })
  } catch {
    return Response.json({ error: 'fetch_failed' })
  }
}
