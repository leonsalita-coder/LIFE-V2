/**
 * Post-session note — the "noticer" role from the mentor, automated for
 * Train specifically. Takes a compact digest of the just-finished session
 * plus recent per-exercise trends and returns ONE short, concrete
 * observation (never a generic "great job!").
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

  const prompt = `You are an athletic coach reviewing your athlete's just-finished session. Their overall goal: ${goal}.

Session digest:
${digest}

Write ONE short sentence (max about 30 words) noticing something real and useful from this data — a trend, a warning sign, or genuine specific encouragement. Never generic ("great job!", "keep it up!"). If there truly isn't enough data yet to say anything meaningful, say something short and honest about that instead.

Return ONLY a valid JSON object: {"note":"your one sentence"}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
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
