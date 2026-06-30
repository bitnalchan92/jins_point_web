import { z } from 'zod'
import { corsHeaders } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { normalizeKoreanPhone } from '../_shared/phone.ts'
import {
  authenticateOwner,
  HttpError,
  type OwnerContext,
  type UserClient,
} from '../_shared/auth.ts'

const ERROR_MESSAGE = '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'

// ---------------------------------------------------------------------------
// Request contract (Zod discriminated union). Unknown keys on each branch are
// stripped, so a hostile client cannot smuggle points/rate/final-balance.
// ---------------------------------------------------------------------------

const createCustomerSchema = z.object({
  action: z.literal('create_customer'),
  name: z.string().trim().min(1).max(80),
  phone: z.string().min(10).max(20),
})

const applyRewardSchema = z.object({
  action: z.literal('apply_reward'),
  customerId: z.string().uuid(),
  type: z.enum(['earn', 'use']),
  amount: z.number().int().positive().max(9_999_999),
  idempotencyKey: z.string().uuid(),
})

const updateStoreSchema = z.object({
  action: z.literal('update_store'),
  rewardRate: z.number().positive().max(1),
})

const requestSchema = z.discriminatedUnion('action', [
  createCustomerSchema,
  applyRewardSchema,
  updateStoreSchema,
])

type CreateCustomerInput = z.infer<typeof createCustomerSchema>
type ApplyRewardInput = z.infer<typeof applyRewardSchema>
type UpdateStoreInput = z.infer<typeof updateStoreSchema>

// ---------------------------------------------------------------------------
// Bootstrap DTO (GET).
// ---------------------------------------------------------------------------

export interface OwnerBootstrap {
  customers: Array<{
    id: string
    name: string
    phoneE164: string
    points: number
    visits: number
    lastVisitedAt: string | null
  }>
  recentRewards: Array<{
    id: string
    customerId: string
    customerName: string
    type: 'earn' | 'use'
    amount: number
    pointsDelta: number
    balanceAfter: number
    createdAt: string
  }>
  store: {
    name: string
    tagline: string
    rewardRate: number
    rewardThreshold: number
    redeemUnit: number
  }
}

// ---------------------------------------------------------------------------
// Error mapping. Postgres SQLSTATEs raised by the RPC become stable HTTP codes.
// Anything unrecognised collapses to a generic 500 — SQL text/stack never leak.
// ---------------------------------------------------------------------------

interface DbError {
  code?: string | null
  message?: string | null
}

function mapDbError(error: DbError | null | undefined): HttpError {
  switch (error?.code) {
    case 'PT403':
      return new HttpError(403, 'OWNER_AAL2_REQUIRED')
    case 'PT409':
      return new HttpError(409, 'IDEMPOTENCY_CONFLICT')
    case 'PT422':
      return new HttpError(422, 'UNPROCESSABLE')
    case 'PT404':
      return new HttpError(404, 'CUSTOMER_NOT_FOUND')
    case '23505':
      return new HttpError(409, 'DUPLICATE_CUSTOMER')
    default:
      return new HttpError(500, 'INTERNAL')
  }
}

function toE164(phone: string): string {
  try {
    return normalizeKoreanPhone(phone)
  } catch {
    throw new HttpError(400, 'INVALID_PHONE')
  }
}

// ---------------------------------------------------------------------------
// Data operations — all run through the user-scoped client so RLS applies.
// ---------------------------------------------------------------------------

interface CustomerRow {
  id: string
  name: string
  phone_e164: string
  points: number
  visit_count: number
  last_visited_at: string | null
}

async function loadBootstrap(client: UserClient): Promise<OwnerBootstrap> {
  const [customersRes, rewardsRes, storeRes] = await Promise.all([
    client
      .from('customers')
      .select('id, name, phone_e164, points, visit_count, last_visited_at')
      .order('name', { ascending: true }),
    client
      .from('reward_log')
      .select(
        'id, customer_id, type, amount, points_delta, balance_after, created_at, customers(name)',
      )
      .order('created_at', { ascending: false })
      .limit(20),
    client
      .from('store_config')
      .select('store_name, tagline, reward_rate, reward_threshold, redeem_unit')
      .eq('id', 1)
      .single(),
  ])

  if (customersRes.error) throw mapDbError(customersRes.error)
  if (rewardsRes.error) throw mapDbError(rewardsRes.error)
  if (storeRes.error || !storeRes.data) throw mapDbError(storeRes.error)

  const customers = (customersRes.data ?? []) as CustomerRow[]
  // deno-lint-ignore no-explicit-any
  const rewards = (rewardsRes.data ?? []) as any[]
  // deno-lint-ignore no-explicit-any
  const store = storeRes.data as any

  return {
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phoneE164: c.phone_e164,
      points: c.points,
      visits: c.visit_count,
      lastVisitedAt: c.last_visited_at,
    })),
    recentRewards: rewards.map((r) => {
      const joined = Array.isArray(r.customers) ? r.customers[0] : r.customers
      return {
        id: r.id,
        customerId: r.customer_id,
        customerName: joined?.name ?? '',
        type: r.type,
        amount: r.amount,
        pointsDelta: r.points_delta,
        balanceAfter: r.balance_after,
        createdAt: r.created_at,
      }
    }),
    store: {
      name: store.store_name,
      tagline: store.tagline,
      rewardRate: store.reward_rate,
      rewardThreshold: store.reward_threshold,
      redeemUnit: store.redeem_unit,
    },
  }
}

async function createCustomer(client: UserClient, input: CreateCustomerInput) {
  const phoneE164 = toE164(input.phone)
  const { data, error } = await client
    .from('customers')
    .insert({ name: input.name, phone_e164: phoneE164 })
    .select('id, name, phone_e164, points, visit_count, last_visited_at')
    .single()

  if (error || !data) throw mapDbError(error)
  const row = data as CustomerRow
  return {
    id: row.id,
    name: row.name,
    phoneE164: row.phone_e164,
    points: row.points,
    visits: row.visit_count,
    lastVisitedAt: row.last_visited_at,
  }
}

async function applyReward(client: UserClient, input: ApplyRewardInput) {
  // The edge layer NEVER computes points/rate/final balance. It forwards only
  // the four authoritative parameters; the RPC derives everything else.
  const { data, error } = await client.rpc('apply_reward_transaction', {
    p_customer_id: input.customerId,
    p_type: input.type,
    p_amount: input.amount,
    p_idempotency_key: input.idempotencyKey,
  })

  if (error) throw mapDbError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new HttpError(500, 'INTERNAL')
  return {
    rewardLogId: row.reward_log_id,
    pointsDelta: row.points_delta,
    balanceAfter: row.balance_after,
  }
}

async function updateStore(client: UserClient, input: UpdateStoreInput) {
  const { error } = await client
    .from('store_config')
    .update({ reward_rate: input.rewardRate })
    .eq('id', 1)
  if (error) throw mapDbError(error)
}

// ---------------------------------------------------------------------------
// Handler.
// ---------------------------------------------------------------------------

export interface OwnerDeps {
  authenticate: (request: Request) => Promise<OwnerContext>
}

const defaultDeps: OwnerDeps = {
  authenticate: (request) => authenticateOwner(request),
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

export async function handleOwnerApi(
  request: Request,
  deps: OwnerDeps = defaultDeps,
): Promise<Response> {
  const cors = corsHeaders(request)

  // 1. CORS allowlist.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (!isOriginAllowed(request)) {
    return json({ error: { code: 'FORBIDDEN', message: ERROR_MESSAGE } }, 403, cors)
  }

  try {
    // 2 + 3. Bearer verification and owner+aal2 authorization.
    const ctx = await deps.authenticate(request)

    if (request.method === 'GET') {
      // 5. User-scoped RLS reads.
      const bootstrap = await loadBootstrap(ctx.client)
      return json(bootstrap, 200, cors)
    }

    if (request.method === 'POST') {
      let raw: unknown
      try {
        raw = await request.json()
      } catch {
        throw new HttpError(400, 'INVALID_REQUEST')
      }

      // 4. Zod discriminated validation.
      const parsed = requestSchema.safeParse(raw)
      if (!parsed.success) throw new HttpError(400, 'INVALID_REQUEST')
      const input = parsed.data

      switch (input.action) {
        case 'create_customer':
          return json(await createCustomer(ctx.client, input), 201, cors)
        case 'apply_reward':
          return json(await applyReward(ctx.client, input), 200, cors)
        case 'update_store':
          await updateStore(ctx.client, input)
          return json({ ok: true }, 200, cors)
      }
    }

    throw new HttpError(405, 'INVALID_REQUEST')
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: { code: error.code, message: ERROR_MESSAGE } }, error.status, cors)
    }
    // Never leak internal detail.
    return json({ error: { code: 'INTERNAL', message: ERROR_MESSAGE } }, 500, cors)
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleOwnerApi(request))
}
