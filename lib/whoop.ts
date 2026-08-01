/**
 * WHOOP OAuth 2.0 connector — server-side only (never touches the browser).
 *
 * A tile is a sealed, network-less iframe, so Vitals can't talk to WHOOP
 * itself. The flow: the "Connect WHOOP" button asks the host to navigate the
 * whole tab to /api/whoop/authorize -> WHOOP's own sign-in ->
 * /api/whoop/callback exchanges the code for tokens and stores them in the
 * owner's own Supabase (the SAME tile_data table every tile already uses,
 * under the reserved row id 'whoop_tokens' — no new table needed). From then
 * on, Vitals calls window.Vitality.whoopSync() on load; this module refreshes
 * the access token if it's stale and merges real recovery scores into the
 * 'vitals' row by date, under the whoopRecovery key vitals.html already
 * knows how to prefer (see tiles-library/vitals.html's estRecovery()).
 *
 * Requires the owner's OWN free WHOOP developer app (WHOOP_CLIENT_ID +
 * WHOOP_CLIENT_SECRET in .env.local) and their own Supabase project (the
 * token storage needs somewhere server-side to live). No credentials are
 * ever shared between users.
 */
import { createClient } from '@supabase/supabase-js'

const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const API_BASE = 'https://api.prod.whoop.com/developer'
const SCOPES = 'offline read:recovery read:sleep read:cycles read:profile'
const TOKEN_ROW = 'whoop_tokens'

interface WhoopTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  scope: string
}

function serverSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export function whoopConfigured(): boolean {
  return !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET)
}

export function whoopAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID || '',
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  })
  return AUTH_URL + '?' + p.toString()
}

export async function exchangeCode(code: string, redirectUri: string): Promise<WhoopTokens | null> {
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.WHOOP_CLIENT_ID || '',
        client_secret: process.env.WHOOP_CLIENT_SECRET || '',
      }),
    })
    if (!r.ok) return null
    const j = await r.json()
    if (!j?.access_token || !j?.refresh_token) return null
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000,
      scope: String(j.scope || ''),
    }
  } catch {
    return null
  }
}

async function getTokens(): Promise<WhoopTokens | null> {
  const c = serverSupa()
  if (!c) return null
  try {
    const { data, error } = await c.from('tile_data').select('data').eq('tile_id', TOKEN_ROW).maybeSingle()
    if (error || !data?.data) return null
    const t = data.data as WhoopTokens
    if (!t?.access_token || !t?.refresh_token) return null
    return t
  } catch {
    return null
  }
}

async function saveTokens(t: WhoopTokens): Promise<boolean> {
  const c = serverSupa()
  if (!c) return false
  try {
    const { error } = await c
      .from('tile_data')
      .upsert({ tile_id: TOKEN_ROW, data: t, updated_at: new Date().toISOString() }, { onConflict: 'tile_id' })
    return !error
  } catch {
    return false
  }
}

export async function storeInitialTokens(t: WhoopTokens): Promise<boolean> {
  return saveTokens(t)
}

async function refreshTokens(t: WhoopTokens): Promise<WhoopTokens | null> {
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID || '',
        client_secret: process.env.WHOOP_CLIENT_SECRET || '',
        scope: 'offline',
      }),
    })
    if (!r.ok) return null
    const j = await r.json()
    if (!j?.access_token) return null
    // WHOOP rotates the refresh token on every use — always persist the new one.
    const next: WhoopTokens = {
      access_token: j.access_token,
      refresh_token: j.refresh_token || t.refresh_token,
      expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000,
      scope: String(j.scope || t.scope || ''),
    }
    await saveTokens(next)
    return next
  } catch {
    return null
  }
}

async function validTokens(): Promise<WhoopTokens | null> {
  const t = await getTokens()
  if (!t) return null
  if (Date.now() > t.expires_at - 60_000) return refreshTokens(t)
  return t
}

export async function whoopIsConnected(): Promise<boolean> {
  return (await getTokens()) != null
}

interface RecoveryRecord {
  created_at?: string
  score_state?: string
  score?: { recovery_score?: number }
}

/**
 * Pull the athlete's recent WHOOP recovery scores and merge them into the
 * 'vitals' tile_data row by date, under whoopRecovery — the exact field
 * vitals.html's estRecovery() already prefers over the manual sleep/feel
 * inputs. Never touches sleepHours/feel; those stay the athlete's own words.
 */
export async function syncRecovery(): Promise<{ connected: boolean; synced: number; todayRecovery: number | null }> {
  const t = await validTokens()
  if (!t) return { connected: false, synced: 0, todayRecovery: null }
  const c = serverSupa()
  if (!c) return { connected: false, synced: 0, todayRecovery: null }

  let records: RecoveryRecord[] = []
  try {
    const r = await fetch(API_BASE + '/v2/recovery?limit=25', {
      headers: { authorization: 'Bearer ' + t.access_token },
    })
    if (r.ok) {
      const j = await r.json()
      if (Array.isArray(j?.records)) records = j.records
    }
  } catch {
    /* WHOOP unreachable this pass — still report connected, just nothing synced */
  }

  const { data: row } = await c.from('tile_data').select('data').eq('tile_id', 'vitals').maybeSingle()
  const vitals: Record<string, unknown> =
    row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...(row.data as Record<string, unknown>) } : {}

  const todayKey = new Date().toISOString().slice(0, 10)
  let synced = 0
  let todayRecovery: number | null = null

  for (const rec of records) {
    if (rec.score_state !== 'SCORED' || typeof rec.score?.recovery_score !== 'number') continue
    const dateKey = String(rec.created_at || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    const day: Record<string, unknown> =
      vitals[dateKey] && typeof vitals[dateKey] === 'object' ? { ...(vitals[dateKey] as Record<string, unknown>) } : {}
    day.whoopRecovery = Math.round(rec.score.recovery_score)
    vitals[dateKey] = day
    synced++
    if (dateKey === todayKey) todayRecovery = day.whoopRecovery as number
  }

  if (synced > 0) {
    await c.from('tile_data').upsert({ tile_id: 'vitals', data: vitals, updated_at: new Date().toISOString() }, { onConflict: 'tile_id' })
  }
  return { connected: true, synced, todayRecovery }
}
