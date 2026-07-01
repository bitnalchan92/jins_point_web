import { z } from 'zod'

const resultSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
})

export async function verifyTurnstile(token: string, ip: string): Promise<void> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  const hostname = Deno.env.get('TURNSTILE_EXPECTED_HOSTNAME')
  const action = Deno.env.get('TURNSTILE_EXPECTED_ACTION')
  if (!secret || !hostname || !action) throw new Error('turnstile_not_configured')

  // CI E2E bypass: Playwright injects this pre-shared token instead of solving
  // the real widget. Only works when TURNSTILE_E2E_BYPASS_TOKEN is set in secrets.
  const bypassToken = Deno.env.get('TURNSTILE_E2E_BYPASS_TOKEN')
  if (bypassToken && token === bypassToken) return

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('turnstile_unavailable')

  const result = resultSchema.parse(await response.json())
  if (!result.success || result.hostname !== hostname || result.action !== action) {
    throw new Error('turnstile_rejected')
  }
}
