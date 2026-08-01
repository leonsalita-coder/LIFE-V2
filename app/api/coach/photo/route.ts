/**
 * Progress-photo analysis — one professional, training-relevant observation
 * per photo (posture, visible composition/definition trend, symmetry cues),
 * tied to the athlete's actual goal. Deliberately clinical in tone, never
 * commentary beyond athletic relevance.
 *
 * Server-side so the Anthropic key never reaches the browser. No key →
 * { error: 'no_key' }. The train tile calls this through the host bridge
 * (window.Vitality.addProgressPhoto) — a sealed tile can't fetch, and this
 * is a real paid call, so it only fires once per uploaded photo.
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
  const b = body as { base64?: unknown; mime?: unknown; goal?: unknown }
  const base64 = String(b?.base64 || '')
  const mime = String(b?.mime || 'image/jpeg')
  const goal = String(b?.goal || 'general fitness').trim().slice(0, 200)
  if (!base64) return Response.json({ error: 'no_image' })
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
    return Response.json({ error: 'bad_mime' })
  }

  const prompt = `You are a strength & conditioning coach reviewing a progress photo from your athlete, strictly for training purposes. Their goal: ${goal}.

Give ONE short, professional, clinical observation (2-3 sentences, under 60 words) about anything visibly relevant to their training: posture, visible muscle definition or body composition, or symmetry/stance cues relevant to athletic performance. Stay strictly professional and clinical, the way a physical therapist or strength coach documents an assessment — never casual commentary on appearance. If the image is unclear or nothing meaningful can be assessed, say so plainly and briefly instead of guessing.

Return ONLY a valid JSON object, nothing else, no markdown fences: {"analysis":"your observation"}`

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
        max_tokens: 1024,
        thinking: { type: 'adaptive' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
    if (!r.ok) return Response.json({ error: 'anthropic_error' })
    const j = await r.json()
    const textBlock = Array.isArray(j?.content)
      ? j.content.find((c: { type?: string }) => c?.type === 'text')
      : null
    const text: string = textBlock?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return Response.json({ error: 'bad_response' })
    const parsed = JSON.parse(match[0])
    if (typeof parsed?.analysis === 'string' && parsed.analysis.trim()) {
      return Response.json({ analysis: parsed.analysis.trim() })
    }
    return Response.json({ error: 'bad_response' })
  } catch {
    return Response.json({ error: 'fetch_failed' })
  }
}
