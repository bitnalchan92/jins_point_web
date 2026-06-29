import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { corsHeaders } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { hmacDigest, normalizeKoreanPhone } from '../_shared/phone.ts'
import { verifyTurnstile as defaultVerifyTurnstile } from '../_shared/turnstile.ts'
import {
  enforcePhoneLimit as defaultEnforcePhoneLimit,
  enforcePreVerificationLimits as defaultEnforcePreVerificationLimits,
} from '../_shared/rate-limit.ts'

const ERROR_MESSAGE = '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'

const requestSchema = z.object({
  phone: z.string().min(1),
  turnstileToken: z.string().min(1),
})

interface CustomerRow {
  points: number
}

interface StoreConfigRow {
  store_name: string
  reward_threshold: number
}

export interface LookupDeps {
  enforcePreVerificationLimits: (ip: string) => Promise<void>
  verifyTurnstile: (token: string, ip: string) => Promise<void>
  enforcePhoneLimit: (phoneDigest: string) => Promise<void>
  queryBalance: (phoneE164: string) => Promise<{
    customer: CustomerRow | null
    config: StoreConfigRow
  }>
}

function createSecretClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY')
  if (!url || !secret) throw new Error('supabase_not_configured')
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function defaultQueryBalance(phoneE164: string): Promise<{
  customer: CustomerRow | null
  config: StoreConfigRow
}> {
  const client = createSecretClient()
  const [customerResult, configResult] = await Promise.all([
    client.from('customers').select('points').eq('phone_e164', phoneE164).maybeSingle(),
    client.from('store_config').select('store_name, reward_threshold').eq('id', 1).single(),
  ])
  if (customerResult.error) throw new Error('db_unavailable')
  if (configResult.error || !configResult.data) throw new Error('db_unavailable')
  return {
    customer: (customerResult.data as CustomerRow | null) ?? null,
    config: configResult.data as StoreConfigRow,
  }
}

const defaultDeps: LookupDeps = {
  enforcePreVerificationLimits: defaultEnforcePreVerificationLimits,
  verifyTurnstile: defaultVerifyTurnstile,
  enforcePhoneLimit: defaultEnforcePhoneLimit,
  queryBalance: defaultQueryBalance,
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  const first = forwarded.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return allowed.includes(origin)
}

export async function handleLookup(
  request: Request,
  deps: LookupDeps = defaultDeps,
): Promise<Response> {
  const cors = corsHeaders(request)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // 1. POST and allowed-origin check.
  if (request.method !== 'POST') {
    return json({ error: { code: 'INVALID_REQUEST', message: ERROR_MESSAGE } }, 405, cors)
  }
  if (!isOriginAllowed(request)) {
    return json({ error: { code: 'FORBIDDEN', message: ERROR_MESSAGE } }, 403, cors)
  }

  try {
    const ip = clientIp(request)

    // 2. Pre-verification rate limits (global + IP).
    await deps.enforcePreVerificationLimits(ip)

    // 3. Parse and validate the JSON body with Zod.
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new Error('invalid_request')
    }
    const parsed = requestSchema.safeParse(raw)
    if (!parsed.success) throw new Error('invalid_request')

    // 4. Normalize the phone to E.164 and compute the HMAC digest.
    const phoneE164 = normalizeKoreanPhone(parsed.data.phone)
    const hmacSecret = Deno.env.get('PHONE_RATE_LIMIT_HMAC_SECRET')
    if (!hmacSecret) throw new Error('hmac_not_configured')
    const phoneDigest = await hmacDigest(phoneE164, hmacSecret)

    // 5. Turnstile server-side verification.
    await deps.verifyTurnstile(parsed.data.turnstileToken, ip)

    // 6. Per-phone rate limit (keyed by digest, never the raw phone).
    await deps.enforcePhoneLimit(phoneDigest)

    // 7. Secret-scoped client: read customers.points and store_config only.
    const { customer, config } = await deps.queryBalance(phoneE164)

    // 8. Unregistered and zero-point customers share the same 200 response.
    const points = customer?.points ?? 0
    const within = points % config.reward_threshold
    const pointsToNextReward = points === 0
      ? config.reward_threshold
      : within === 0
      ? 0
      : config.reward_threshold - within

    return json(
      {
        points,
        rewardThreshold: config.reward_threshold,
        pointsToNextReward,
        storeName: config.store_name,
        asOf: new Date().toISOString(),
      },
      200,
      cors,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    const status = message === 'rate_limited'
      ? 429
      : message === 'invalid_phone' || message === 'turnstile_rejected' ||
          message === 'invalid_request'
      ? 400
      : 503
    const code = status === 429 ? 'RATE_LIMITED' : status === 400 ? 'INVALID_REQUEST' : 'UNAVAILABLE'
    return json({ error: { code, message: ERROR_MESSAGE } }, status, cors)
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleLookup(request))
}
