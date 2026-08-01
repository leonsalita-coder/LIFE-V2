/**
 * Smart workout generator — goal + equipment + time + day type in, a full
 * session out, in the exact per-exercise shape /api/coach/exercise uses
 * (tier, muscles, form, starting sets/reps/weight) so Train can drop the
 * result straight into a day's exercise list and reuse the same custom-
 * library caching path.
 *
 * Server-side so the Anthropic key never reaches the browser (same pattern
 * as the other coach/keyed routes). No key → { error: 'no_key' }. The train
 * tile calls this through the host bridge (window.Vitality.generateWorkout)
 * — a sealed tile can't fetch.
 */
export async function GET(req: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Response.json({ error: 'no_key' })

  const url = new URL(req.url)
  const goal = (url.searchParams.get('goal') || 'general fitness').trim().slice(0, 200)
  const dayType = (url.searchParams.get('dayType') || 'full body').trim().slice(0, 40)
  const equipment = (url.searchParams.get('equipment') || 'bodyweight').trim().slice(0, 200)
  const minutes = Math.max(10, Math.min(120, Number(url.searchParams.get('minutes')) || 45))

  const prompt = `You are a strength & conditioning coach building ONE workout session. Return ONLY a valid JSON array (no markdown fences, no commentary) of 4 to 7 exercises, each shaped exactly like this:
{
  "name": "Barbell back squat",
  "tier": 1,
  "equipment": "Barbell",
  "primary": ["Quads"],
  "secondary": ["Glutes"],
  "gist": "One sentence on what this lift is for.",
  "steps": ["Setup step", "Execution step", "Finish step"],
  "cues": ["Coaching cue one", "Coaching cue two"],
  "startingSets": 3,
  "startingReps": 10,
  "startingKg": 20,
  "restSeconds": 90
}
Rules: "tier" is 1 for a primary compound/heavy lift, 2 for secondary, 3 for isolation/accessory. Order the array by tier (1s first). Total session should realistically fit in about ${minutes} minutes including rest. Only use equipment from this list: ${equipment}. "startingKg" is a reasonable STARTING weight in kg for an intermediate athlete (0 if bodyweight-only).

Athlete's goal: ${goal}
Today's focus: ${dayType}

Return ONLY the JSON array.`

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) return Response.json({ error: 'anthropic_error' })
    const j = await r.json()
    const text: string = j?.content?.[0]?.text || ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return Response.json({ error: 'bad_response' })
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed) || !parsed.length) return Response.json({ error: 'empty' })
    return Response.json({ exercises: parsed })
  } catch {
    return Response.json({ error: 'fetch_failed' })
  }
}
