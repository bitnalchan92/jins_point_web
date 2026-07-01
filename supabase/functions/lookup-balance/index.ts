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
  id: string
  name: string
  points: number
}

interface HistoryItem {
  type: 'earn' | 'use'
  amount: number
  pointsAfter: number
  createdAt: string
}

interface StoreConfigRow {
  store_name: string
  reward_threshold: number
}

function maskName(name: string): string {
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

export interface LookupDeps {
  enforcePreVerificationLimits: (ip: string) => Promise<void>
  verifyTurnstile: (token: string, ip: string) => Promise<void>
  enforcePhoneLimit: (phoneDigest: string) => Promise<void>
  queryBalance: (phoneE164: string) => Promise<{
    customer: CustomerRow | null
    config: StoreConfigRow
    history: HistoryItem[]
  }>
}

function createSecretClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) throw new Error('supabase_not_configured')
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function defaultQueryBalance(phoneE164: string): Promise<{
  customer: CustomerRow | null
  config: StoreConfigRow
  history: HistoryItem[]
}> {
  const client = createSecretClient()
  const [customerResult, configResult] = await Promise.all([
    client.from('customers').select('id, name, points').eq('phone_e164', phoneE164).maybeSingle(),
    client.from('store_config').select('store_name, reward_threshold').eq('id', 1).single(),
  ])
  if (customerResult.error) throw new Error('db_unavailable')
  if (configResult.error || !configResult.data) throw new Error('db_unavailable')

  const customerData = (customerResult.data as CustomerRow | null) ?? null

  let history: HistoryItem[] = []
  if (customerData) {
    type RawLog = { type: string; points_delta: number; balance_after: number; created_at: string }
    const { data: logData } = await client
      .from('reward_log')
      .select('type, points_delta, balance_after, created_at')
      .eq('customer_id', customerData.id)
      .order('created_at', { ascending: false })
      .limit(10)
    history = ((logData ?? []) as RawLog[]).map((row) => ({
      type: row.type as 'earn' | 'use',
      amount: Math.abs(row.points_delta),
      pointsAfter: row.balance_after,
      createdAt: row.created_at,
    }))
  }

  return {
    customer: customerData,
    config: configResult.data as StoreConfigRow,
    history,
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

    // 2. Parse and validate the JSON body with Zod (done early so the bypass
    //    token can be checked before rate limits are enforced).
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new Error('invalid_request')
    }
    const parsed = requestSchema.safeParse(raw)
    if (!parsed.success) throw new Error('invalid_request')

    // 3. E2E bypass: when the Turnstile token equals the pre-shared bypass
    //    secret, skip all rate limits and Turnstile verification so CI can
    //    run repeated lookups against the same phone without hitting limits.
    const bypassToken = Deno.env.get('TURNSTILE_E2E_BYPASS_TOKEN')
    const isE2EBypass = Boolean(bypassToken && parsed.data.turnstileToken === bypassToken)

    // 4. Normalize the phone to E.164 and compute the HMAC digest.
    const phoneE164 = normalizeKoreanPhone(parsed.data.phone)
    const hmacSecret = Deno.env.get('PHONE_RATE_LIMIT_HMAC_SECRET')
    if (!hmacSecret) throw new Error('hmac_not_configured')
    const phoneDigest = await hmacDigest(phoneE164, hmacSecret)

    if (!isE2EBypass) {
      // 5. Pre-verification rate limits (global + IP).
      await deps.enforcePreVerificationLimits(ip)

      // 6. Turnstile server-side verification.
      await deps.verifyTurnstile(parsed.data.turnstileToken, ip)

      // 7. Per-phone rate limit (keyed by digest, never the raw phone).
      await deps.enforcePhoneLimit(phoneDigest)
    }

    // 7. Secret-scoped client: read customers + recent reward_log, store_config.
    const { customer, config, history } = await deps.queryBalance(phoneE164)

    // 8. Unregistered and zero-point customers share the same 200 response shape.
    const points = customer?.points ?? 0
    const maskedName = customer ? maskName(customer.name) : null
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
        maskedName,
        history,
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
