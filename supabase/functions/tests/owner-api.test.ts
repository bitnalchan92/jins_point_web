import { assert, assertEquals, assertFalse, assertRejects } from '@std/assert'
import {
  authenticateOwner,
  HttpError,
  type OwnerContext,
} from '../_shared/auth.ts'
import { handleOwnerApi } from '../owner-api/index.ts'

// ---------------------------------------------------------------------------
// A small configurable fake of the user-scoped supabase client.
//
// It supports the chainable query-builder surface the handler uses:
//   from(table).select(...).eq(...).maybeSingle()
//   from(table).insert(...).select(...).single()
//   from(table).update(...).eq(...)
//   from(table).select(...).order(...).limit(...)
//   from(table).select(...).eq(...).single()
//   rpc(fn, args)
//   auth.getUser(token)
// Each awaited builder resolves to a { data, error } result resolved by a
// per-table resolver keyed on the recorded builder state.
// ---------------------------------------------------------------------------

interface BuilderState {
  table: string
  op: 'select' | 'insert' | 'update'
  row?: Record<string, unknown>
  eqs: Array<[string, unknown]>
  single: boolean
  maybeSingle: boolean
}

type DbResult = { data: unknown; error: unknown }
type TableResolver = (state: BuilderState) => DbResult

class FakeBuilder implements PromiseLike<DbResult> {
  constructor(
    private readonly resolve: () => DbResult,
    public readonly state: BuilderState,
  ) {}

  select(_cols?: string): this {
    return this
  }
  insert(row: Record<string, unknown>): this {
    this.state.op = 'insert'
    this.state.row = row
    return this
  }
  update(row: Record<string, unknown>): this {
    this.state.op = 'update'
    this.state.row = row
    return this
  }
  eq(col: string, val: unknown): this {
    this.state.eqs.push([col, val])
    return this
  }
  order(_col: string, _opts?: unknown): this {
    return this
  }
  limit(_n: number): this {
    return this
  }
  single(): this {
    this.state.single = true
    return this
  }
  maybeSingle(): this {
    this.state.maybeSingle = true
    return this
  }
  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected)
  }
}

interface FakeOpts {
  user?: { id: string } | null
  userError?: unknown
  resolvers?: Record<string, TableResolver>
  rpcResult?: DbResult
}

class FakeClient {
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  builders: FakeBuilder[] = []

  constructor(private readonly opts: FakeOpts = {}) {}

  auth = {
    getUser: (_token: string): Promise<DbResult> => {
      if (this.opts.user) {
        return Promise.resolve({ data: { user: this.opts.user }, error: null })
      }
      return Promise.resolve({
        data: { user: null },
        error: this.opts.userError ?? new Error('invalid jwt'),
      })
    },
  }

  from(table: string): FakeBuilder {
    const state: BuilderState = {
      table,
      op: 'select',
      eqs: [],
      single: false,
      maybeSingle: false,
    }
    const builder = new FakeBuilder(() => {
      const resolver = this.opts.resolvers?.[table]
      if (!resolver) return { data: null, error: null }
      return resolver(state)
    }, state)
    this.builders.push(builder)
    return builder
  }

  rpc(fn: string, args: Record<string, unknown>): Promise<DbResult> {
    this.rpcCalls.push({ fn, args })
    return Promise.resolve(this.opts.rpcResult ?? { data: null, error: null })
  }
}

// deno-lint-ignore no-explicit-any
function asContext(client: FakeClient): OwnerContext {
  return { client: client as any, userId: 'owner-uid' }
}

function ownerRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { authorization: 'Bearer t.t.t' } }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { ...init.headers, 'content-type': 'application/json' }
  }
  return new Request('http://127.0.0.1:54321/functions/v1/owner-api', init)
}

const ROLE_ROW: TableResolver = () => ({ data: { role: 'owner', user_id: 'owner-uid' }, error: null })
const NO_ROLE: TableResolver = () => ({ data: null, error: null })

// ===========================================================================
// auth.ts — the 401 / 403 ladder
// ===========================================================================

Deno.test('auth: missing Authorization header -> 401', async () => {
  const request = new Request('http://127.0.0.1:54321/functions/v1/owner-api', { method: 'GET' })
  const error = await assertRejects(
    () => authenticateOwner(request, () => new FakeClient() as never),
    HttpError,
  )
  assertEquals(error.status, 401)
  assertEquals(error.code, 'UNAUTHORIZED')
})

Deno.test('auth: malformed JWT (cannot decode sub) -> 401', async () => {
  const error = await assertRejects(
    () => authenticateOwner(ownerRequest('GET'), () => new FakeClient() as never),
    HttpError,
  )
  assertEquals(error.status, 401)
  assertEquals(error.code, 'UNAUTHORIZED')
})

Deno.test('auth: valid JWT but PostgREST rejects it (role query error) -> 401', async () => {
  const client = new FakeClient({
    resolvers: {
      app_user_roles: () => ({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } }),
    },
  })
  const error = await assertRejects(
    () => authenticateOwner(ownerJwtRequest('GET'), () => client as never),
    HttpError,
  )
  assertEquals(error.status, 401)
  assertEquals(error.code, 'UNAUTHORIZED')
})

Deno.test('auth: valid aal1 owner (no role row from RLS) -> 403', async () => {
  // aal1 owner: JWT decodes fine but owner_read_roles RLS hides the row.
  const client = new FakeClient({ resolvers: { app_user_roles: NO_ROLE } })
  const error = await assertRejects(
    () => authenticateOwner(ownerJwtRequest('GET'), () => client as never),
    HttpError,
  )
  assertEquals(error.status, 403)
  assertEquals(error.code, 'OWNER_AAL2_REQUIRED')
})

Deno.test('auth: non-owner aal2 (no role row from RLS) -> 403', async () => {
  const client = new FakeClient({ resolvers: { app_user_roles: NO_ROLE } })
  const error = await assertRejects(
    () => authenticateOwner(ownerJwtRequest('GET'), () => client as never),
    HttpError,
  )
  assertEquals(error.status, 403)
  assertEquals(error.code, 'OWNER_AAL2_REQUIRED')
})

// A minimal valid-shaped JWT with sub = 'owner-uid' and aal = 'aal2'.
// Decoded payload: { sub: 'owner-uid', aal: 'aal2' }
// (PostgREST does the real signature check; we only need a decodable payload)
const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiJ9.' + // header
  btoa(JSON.stringify({ sub: 'owner-uid', aal: 'aal2' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') + // payload
  '.fakesig' // signature (PostgREST verifies; the fake client does not)

function ownerJwtRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { authorization: `Bearer ${FAKE_JWT}` } }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { ...init.headers, 'content-type': 'application/json' }
  }
  return new Request('http://127.0.0.1:54321/functions/v1/owner-api', init)
}

Deno.test('auth: owner aal2 (role row visible) -> resolves context, filters by decoded user_id', async () => {
  const client = new FakeClient({ resolvers: { app_user_roles: ROLE_ROW } })
  const ctx = await authenticateOwner(ownerJwtRequest('GET'), () => client as never)
  assertEquals(ctx.userId, 'owner-uid')
  // The role SELECT must be filtered by both user_id (from JWT sub) and role.
  const roleState = client.builders.find((b) => b.state.table === 'app_user_roles')?.state
  assert(roleState, 'app_user_roles was queried')
  assert(roleState!.maybeSingle, 'used maybeSingle')
  assert(
    roleState!.eqs.some(([c, v]) => c === 'user_id' && v === 'owner-uid'),
    'filtered by user_id from JWT sub',
  )
  assert(roleState!.eqs.some(([c, v]) => c === 'role' && v === 'owner'), 'filtered by owner role')
})

// ===========================================================================
// owner-api handler — bootstrap (GET)
// ===========================================================================

const BOOTSTRAP_RESOLVERS: Record<string, TableResolver> = {
  customers: () => ({
    data: [
      {
        id: 'c1',
        name: '홍길동',
        phone_e164: '+821023457788',
        points: 3420,
        visit_count: 7,
        last_visited_at: '2026-06-20T00:00:00Z',
      },
    ],
    error: null,
  }),
  reward_log: () => ({
    data: [
      {
        id: 'r1',
        customer_id: 'c1',
        type: 'earn',
        amount: 10000,
        points_delta: 500,
        balance_after: 3420,
        created_at: '2026-06-20T00:00:00Z',
        customers: { name: '홍길동' },
      },
    ],
    error: null,
  }),
  store_config: () => ({
    data: {
      store_name: '달콤한 진스쿡',
      tagline: '오늘도 달콤하게',
      reward_rate: 0.05,
      reward_threshold: 5000,
      redeem_unit: 1000,
    },
    error: null,
  }),
}

Deno.test('bootstrap: aal2 owner receives the OwnerBootstrap DTO', async () => {
  const client = new FakeClient({ resolvers: BOOTSTRAP_RESOLVERS })
  const response = await handleOwnerApi(ownerRequest('GET'), {
    authenticate: async () => asContext(client),
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assertEquals(body.customers, [
    {
      id: 'c1',
      name: '홍길동',
      phoneE164: '+821023457788',
      points: 3420,
      visits: 7,
      lastVisitedAt: '2026-06-20T00:00:00Z',
    },
  ])
  assertEquals(body.recentRewards, [
    {
      id: 'r1',
      customerId: 'c1',
      customerName: '홍길동',
      type: 'earn',
      amount: 10000,
      pointsDelta: 500,
      balanceAfter: 3420,
      createdAt: '2026-06-20T00:00:00Z',
    },
  ])
  assertEquals(body.store, {
    name: '달콤한 진스쿡',
    tagline: '오늘도 달콤하게',
    rewardRate: 0.05,
    rewardThreshold: 5000,
    redeemUnit: 1000,
  })
})

Deno.test('bootstrap: a non-owner is rejected (403) and no data is returned', async () => {
  const response = await handleOwnerApi(ownerRequest('GET'), {
    authenticate: async () => {
      throw new HttpError(403, 'OWNER_AAL2_REQUIRED')
    },
  })
  assertEquals(response.status, 403)
  const body = await response.json()
  assertEquals(body.error.code, 'OWNER_AAL2_REQUIRED')
  assertFalse('customers' in body)
})

Deno.test('handler: missing auth surfaces the 401 from authenticate', async () => {
  const response = await handleOwnerApi(ownerRequest('GET'), {
    authenticate: async () => {
      throw new HttpError(401, 'UNAUTHORIZED')
    },
  })
  assertEquals(response.status, 401)
  assertEquals((await response.json()).error.code, 'UNAUTHORIZED')
})

// ===========================================================================
// create_customer — phone normalization + duplicate 409
// ===========================================================================

Deno.test('create_customer: normalizes the phone to E.164 before insert', async () => {
  const client = new FakeClient({
    resolvers: {
      customers: (state) => ({
        data: {
          id: 'c9',
          name: state.row?.name,
          phone_e164: state.row?.phone_e164,
          points: 0,
          visit_count: 0,
          last_visited_at: null,
        },
        error: null,
      }),
    },
  })
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'create_customer', name: '김철수', phone: '010-2345-7788' }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 201)
  const body = await response.json()
  assertEquals(body.phoneE164, '+821023457788')
  // The value handed to the DB insert is the normalized E.164 string.
  const insertState = client.builders.find((b) => b.state.op === 'insert')?.state
  assert(insertState, 'an insert occurred')
  assertEquals(insertState!.row?.phone_e164, '+821023457788')
})

Deno.test('create_customer: a duplicate phone (unique violation) -> 409', async () => {
  const client = new FakeClient({
    resolvers: {
      customers: () => ({ data: null, error: { code: '23505', message: 'duplicate key' } }),
    },
  })
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'create_customer', name: '김철수', phone: '010-2345-7788' }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 409)
  const body = await response.json()
  assertEquals(body.error.code, 'DUPLICATE_CUSTOMER')
  // No SQL detail leaks.
  assertFalse(JSON.stringify(body).includes('duplicate key'))
})

Deno.test('create_customer: an unparseable phone -> 400 and no insert', async () => {
  const client = new FakeClient({ resolvers: { customers: () => ({ data: {}, error: null }) } })
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'create_customer', name: '김철수', phone: '02-123-4567' }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 400)
  assertEquals(client.builders.length, 0)
})

// ===========================================================================
// update_store — only 0 < rate <= 1
// ===========================================================================

function updateStoreClient(): FakeClient {
  return new FakeClient({
    resolvers: { store_config: () => ({ data: null, error: null }) },
  })
}

Deno.test('update_store: accepts a rate of 0.05 and writes reward_rate', async () => {
  const client = updateStoreClient()
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'update_store', rewardRate: 0.05 }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 200)
  const updateState = client.builders.find((b) => b.state.op === 'update')?.state
  assert(updateState, 'an update occurred')
  assertEquals(updateState!.row?.reward_rate, 0.05)
})

Deno.test('update_store: accepts a rate of exactly 1', async () => {
  const client = updateStoreClient()
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'update_store', rewardRate: 1 }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 200)
})

Deno.test('update_store: rejects a rate of 0 -> 400 and no write', async () => {
  const client = updateStoreClient()
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'update_store', rewardRate: 0 }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 400)
  assertEquals(client.builders.length, 0)
})

Deno.test('update_store: rejects a rate above 1 -> 400 and no write', async () => {
  const client = updateStoreClient()
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'update_store', rewardRate: 1.5 }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 400)
  assertEquals(client.builders.length, 0)
})

// ===========================================================================
// apply_reward — server-authoritative; no client points/rate/final-balance
// ===========================================================================

const REWARD_ROW = { reward_log_id: 'r42', points_delta: 500, balance_after: 9999 }

Deno.test('apply_reward: calls the RPC with exactly the 4 server params, ignoring client-supplied points/rate/balance', async () => {
  const client = new FakeClient({ rpcResult: { data: [REWARD_ROW], error: null } })
  const response = await handleOwnerApi(
    ownerRequest('POST', {
      action: 'apply_reward',
      customerId: '11111111-1111-4111-8111-111111111111',
      type: 'earn',
      amount: 10000,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      // Hostile client-supplied fields that MUST be ignored:
      pointsDelta: 999999,
      rewardRate: 1,
      finalBalance: 999999,
      points: 999999,
    }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 200)
  assertEquals(client.rpcCalls.length, 1)
  assertEquals(client.rpcCalls[0].fn, 'apply_reward_transaction')
  assertEquals(Object.keys(client.rpcCalls[0].args).sort(), [
    'p_amount',
    'p_customer_id',
    'p_idempotency_key',
    'p_type',
  ])
  assertEquals(client.rpcCalls[0].args, {
    p_customer_id: '11111111-1111-4111-8111-111111111111',
    p_type: 'earn',
    p_amount: 10000,
    p_idempotency_key: '22222222-2222-4222-8222-222222222222',
  })
  // The response reflects the server-computed values, not the client's.
  const body = await response.json()
  assertEquals(body.pointsDelta, 500)
  assertEquals(body.balanceAfter, 9999)
})

Deno.test('apply_reward: retrying with the same idempotency key yields the same result', async () => {
  const client = new FakeClient({ rpcResult: { data: [REWARD_ROW], error: null } })
  const payload = {
    action: 'apply_reward',
    customerId: '11111111-1111-4111-8111-111111111111',
    type: 'earn' as const,
    amount: 10000,
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
  }
  const first = await (await handleOwnerApi(ownerRequest('POST', payload), {
    authenticate: async () => asContext(client),
  })).json()
  const second = await (await handleOwnerApi(ownerRequest('POST', payload), {
    authenticate: async () => asContext(client),
  })).json()
  assertEquals(first, second)
  // Both calls forwarded the identical idempotency key to the RPC.
  assertEquals(client.rpcCalls[0].args.p_idempotency_key, client.rpcCalls[1].args.p_idempotency_key)
})

Deno.test('apply_reward: PT409 idempotency conflict -> 409', async () => {
  const client = new FakeClient({
    rpcResult: { data: null, error: { code: 'PT409', message: 'idempotency conflict' } },
  })
  const response = await handleOwnerApi(
    ownerRequest('POST', {
      action: 'apply_reward',
      customerId: '11111111-1111-4111-8111-111111111111',
      type: 'earn',
      amount: 10000,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 409)
  assertEquals((await response.json()).error.code, 'IDEMPOTENCY_CONFLICT')
})

Deno.test('apply_reward: PT422 insufficient balance -> 422 with no SQL leak', async () => {
  const client = new FakeClient({
    rpcResult: { data: null, error: { code: 'PT422', message: 'insufficient balance' } },
  })
  const response = await handleOwnerApi(
    ownerRequest('POST', {
      action: 'apply_reward',
      customerId: '11111111-1111-4111-8111-111111111111',
      type: 'use',
      amount: 10000,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 422)
  const body = await response.json()
  assertEquals(body.error.code, 'UNPROCESSABLE')
  assertFalse(JSON.stringify(body).includes('insufficient balance'))
})

Deno.test('apply_reward: PT403 owner aal2 required -> 403', async () => {
  const client = new FakeClient({
    rpcResult: { data: null, error: { code: 'PT403', message: 'owner aal2 required' } },
  })
  const response = await handleOwnerApi(
    ownerRequest('POST', {
      action: 'apply_reward',
      customerId: '11111111-1111-4111-8111-111111111111',
      type: 'earn',
      amount: 10000,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 403)
  assertEquals((await response.json()).error.code, 'OWNER_AAL2_REQUIRED')
})

Deno.test('apply_reward: an unexpected DB error -> generic 500 with no SQL leak', async () => {
  const client = new FakeClient({
    rpcResult: {
      data: null,
      error: { code: '08006', message: 'connection refused at pg backend' },
    },
  })
  const response = await handleOwnerApi(
    ownerRequest('POST', {
      action: 'apply_reward',
      customerId: '11111111-1111-4111-8111-111111111111',
      type: 'earn',
      amount: 10000,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 500)
  const body = await response.json()
  assertEquals(body.error.code, 'INTERNAL')
  assertFalse(JSON.stringify(body).includes('connection refused'))
  assertFalse(JSON.stringify(body).includes('08006'))
})

// ===========================================================================
// request validation
// ===========================================================================

Deno.test('handler: an unknown action -> 400', async () => {
  const client = new FakeClient()
  const response = await handleOwnerApi(
    ownerRequest('POST', { action: 'delete_everything' }),
    { authenticate: async () => asContext(client) },
  )
  assertEquals(response.status, 400)
  assertEquals((await response.json()).error.code, 'INVALID_REQUEST')
})

Deno.test('handler: a non-JSON body -> 400', async () => {
  const client = new FakeClient()
  const request = new Request('http://127.0.0.1:54321/functions/v1/owner-api', {
    method: 'POST',
    headers: { authorization: 'Bearer t.t.t', 'content-type': 'application/json' },
    body: 'not json',
  })
  const response = await handleOwnerApi(request, { authenticate: async () => asContext(client) })
  assertEquals(response.status, 400)
})

Deno.test('handler: OPTIONS preflight -> 204', async () => {
  const response = await handleOwnerApi(ownerRequest('OPTIONS'), {
    authenticate: async () => {
      throw new Error('authenticate should not run for OPTIONS')
    },
  })
  assertEquals(response.status, 204)
})
