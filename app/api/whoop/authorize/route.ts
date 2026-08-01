/**
 * Step 1 of the WHOOP OAuth flow. The host navigates the WHOLE tab here
 * (never a popup — sealed tiles can't call window.open, and a popup opened
 * from an async postMessage handler gets blocked by most browsers anyway).
 * If the owner hasn't created their own WHOOP developer app yet, show them
 * exactly what to do instead of a broken redirect.
 */
import { cookies } from 'next/headers'
import { whoopAuthUrl, whoopConfigured } from '@/lib/whoop'

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin
  const redirectUri = origin + '/api/whoop/callback'

  if (!whoopConfigured()) {
    return new Response(setupHtml(redirectUri), { headers: { 'content-type': 'text/html' } })
  }

  const state = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  cookies().set('whoop_state', state, { httpOnly: true, maxAge: 600, sameSite: 'lax', path: '/' })
  return Response.redirect(whoopAuthUrl(redirectUri, state), 302)
}

function setupHtml(redirectUri: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#050506;color:#ededf0;padding:40px 24px;max-width:640px;margin:0 auto;line-height:1.65">
<h1 style="color:#00E5A0;font-size:26px">Connect your WHOOP</h1>
<p>Your own WHOOP developer app isn't set up yet — free, and it's <b>yours</b>, not shared. Takes about two minutes:</p>
<ol style="padding-left:20px">
  <li>Go to <a style="color:#6EE7B7" href="https://developer.whoop.com" target="_blank" rel="noopener">developer.whoop.com</a> and sign in with your WHOOP account.</li>
  <li>Create a new app (any name works).</li>
  <li>Set its <b>Redirect URI</b> to exactly:<br><code style="background:#141418;padding:4px 8px;border-radius:6px;display:inline-block;margin-top:6px;word-break:break-all">${redirectUri}</code></li>
  <li>Copy the <b>Client ID</b> and <b>Client Secret</b> it gives you.</li>
  <li>Paste both back to your mentor in Claude Code — it writes them in for you and this button will work.</li>
</ol>
<p><a style="color:#84848c" href="/">&larr; back to your dashboard</a></p>
</body></html>`
}
