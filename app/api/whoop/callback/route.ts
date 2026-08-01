/**
 * Step 2 of the WHOOP OAuth flow. WHOOP redirects here with ?code=&state=
 * after the athlete signs in and approves. Verifies state (set as an
 * httpOnly cookie by /api/whoop/authorize) to block a forged callback,
 * exchanges the code for tokens, stores them, runs one sync immediately so
 * the dashboard shows real data the moment they land back on it, then sends
 * them home.
 */
import { cookies } from 'next/headers'
import { exchangeCode, storeInitialTokens, syncRecovery } from '@/lib/whoop'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const origin = url.origin
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  const cookieStore = cookies()
  const savedState = cookieStore.get('whoop_state')?.value
  cookieStore.delete('whoop_state')

  if (err) return html(errorPage('WHOOP sign-in was cancelled.', origin))
  if (!code || !state || !savedState || state !== savedState) {
    return html(errorPage('That sign-in link expired or was invalid — try connecting again.', origin))
  }

  const tokens = await exchangeCode(code, origin + '/api/whoop/callback')
  if (!tokens) {
    return html(errorPage('WHOOP rejected the connection. Double-check the Client ID/Secret and that the Redirect URI matches exactly.', origin))
  }

  await storeInitialTokens(tokens)
  await syncRecovery()
  return html(successPage(origin))
}

function html(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/html' } })
}

function successPage(origin: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#050506;color:#ededf0;padding:60px 24px;max-width:520px;margin:0 auto;text-align:center">
<h1 style="color:#00E5A0">WHOOP connected</h1>
<p style="color:#a8a8b0">Your recovery is syncing in now — Vitals will show your real number.</p>
<a href="${origin}/" style="display:inline-block;margin-top:24px;padding:13px 26px;border-radius:999px;background:#6EE7B7;color:#04140d;font-weight:700;text-decoration:none">Back to dashboard</a>
</body></html>`
}

function errorPage(msg: string, origin: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#050506;color:#ededf0;padding:60px 24px;max-width:520px;margin:0 auto;text-align:center">
<h1 style="color:#ff8b8b">Connection failed</h1>
<p style="color:#a8a8b0">${msg}</p>
<a href="${origin}/" style="color:#84848c;display:inline-block;margin-top:20px">&larr; back to your dashboard</a>
</body></html>`
}
