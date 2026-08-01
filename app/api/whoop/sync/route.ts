/**
 * Called from Vitals via the host bridge (window.Vitality.whoopSync()) on
 * every mount — cheap and safe to call repeatedly: if WHOOP was never
 * connected it just reports {connected:false} without hitting WHOOP at all.
 */
import { syncRecovery } from '@/lib/whoop'

export async function POST(): Promise<Response> {
  const result = await syncRecovery()
  return Response.json(result)
}
