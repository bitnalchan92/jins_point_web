import { assert, assertEquals, assertFalse, assertRejects } from '@std/assert'
import { normalizeKoreanPhone } from '../_shared/phone.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'
import {
  defaultQueryBalance,
  handleLookup,
  type LookupDeps,
} from '../lookup-balance/index.ts'

// ---------------------------------------------------------------------------
// Step 1: pure phone helper
// ---------------------------------------------------------------------------

Deno.test('normalizes a Korean mobile number to E.164', () => {
  assertEquals(normalizeKoreanPhone('010-2345-7788'), '+821023457788')
})

Deno.test('rejects a non-mobile number', async () => {
  await assertRejects(
    async () => normalizeKoreanPhone('02-123-4567'),
    Error,
    'invalid_phone',
  )
})

// ---------------------------------------------------------------------------
// Step 3: Turnstile server verification (fetch stubbed)
// ---------------------------------------------------------------------------

function withTurnstileEnv(): () => void {
  const prev = {
    secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
    hostname: Deno.env.get('TURNSTILE_EXPECTED_HOSTNAME'),
    action: Deno.env.get('TURNSTILE_EXPECTED_ACTION'),
  }
  Deno.env.set('TURNSTILE_SECRET_KEY', 'test-secret')
  Deno.env.set('TURNSTILE_EXPECTED_HOSTNAME', 'localhost')
  Deno.env.set('TURNSTILE_EXPECTED_ACTION', 'lookup_balance')
  return () => {
    for (const [key, value] of Object.entries({
      TURNSTILE_SECRET_KEY: prev.secret,
      TURNSTILE_EXPECTED_HOSTNAME: prev.hostname,
      TURNSTILE_EXPECTED_ACTION: prev.action,
    })) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

function stubFetch(impl: typeof fetch): () => void {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return () => {
    globalThis.fetch = original
  }
}

function turnstileResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500 })
}

Deno.test('verifyTurnstile resolves on success with matching hostname/action', async () => {
  const restoreEnv = withTurnstileEnv()
  const restoreFetch = stubFetch(() =>
    Promise.resolve(
      turnstileResponse({ success: true, hostname: 'localhost', action: 'lookup_balance' }),
    )
  )
  try {
    await verifyTurnstile('token', '1.2.3.4')
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

Deno.test('verifyTurnstile rejects when success is false', async () => {
  const restoreEnv = withTurnstileEnv()
  const restoreFetch = stubFetch(() =>
    Promise.resolve(turnstileResponse({ success: false, 'error-codes': ['invalid-input'] }))
  )
  try {
    await assertRejects(() => verifyTurnstile('token', '1.2.3.4'), Error, 'turnstile_rejected')
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

Deno.test('verifyTurnstile rejects on wrong hostname or action', async () => {
  const restoreEnv = withTurnstileEnv()
  const restoreFetch = stubFetch(() =>
    Promise.resolve(
      turnstileResponse({ success: true, hostname: 'evil.example', action: 'lookup_balance' }),
    )
  )
  try {
    await assertRejects(() => verifyTurnstile('token', '1.2.3.4'), Error, 'turnstile_rejected')
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

Deno.test('verifyTurnstile does not allow a network/timeout failure', async () => {
  const restoreEnv = withTurnstileEnv()
  const restoreFetch = stubFetch(() => Promise.reject(new Error('network down')))
  try {
    await assertRejects(() => verifyTurnstile('token', '1.2.3.4'))
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

Deno.test('verifyTurnstile rejects on a non-ok HTTP response', async () => {
  const restoreEnv = withTurnstileEnv()
  const restoreFetch = stubFetch(() =>
    Promise.resolve(turnstileResponse({ success: true }, false))
  )
  try {
    await assertRejects(() => verifyTurnstile('token', '1.2.3.4'), Error, 'turnstile_unavailable')
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

// ---------------------------------------------------------------------------
// Step 6: handler unit tests (external services mocked via DI)
// ---------------------------------------------------------------------------

const STORE_CONFIG = { store_name: '달콤한 진스쿡', reward_threshold: 5000 }

function postRequest(body: unknown): Request {
  return new Request('http://127.0.0.1:54321/functions/v1/lookup-balance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

interface Spy {
  deps: LookupDeps
  calls: { pre: number; turnstile: number; phone: number; query: number }
}

function makeDeps(overrides: Partial<LookupDeps> = {}): Spy {
  const calls = { pre: 0, turnstile: 0, phone: 0, query: 0 }
  const deps: LookupDeps = {
    enforcePreVerificationLimits: async () => {
      calls.pre++
    },
    verifyTurnstile: async () => {
      calls.turnstile++
    },
    enforcePhoneLimit: async () => {
      calls.phone++
    },
    queryBalance: async () => {
      calls.query++
      return { customer: { points: 3420 }, config: STORE_CONFIG }
    },
    ...overrides,
  }
  return { deps, calls }
}

function withHmacSecret(): () => void {
  const prev = Deno.env.get('PHONE_RATE_LIMIT_HMAC_SECRET')
  Deno.env.set('PHONE_RATE_LIMIT_HMAC_SECRET', 'unit-test-hmac-secret')
  return () => {
    if (prev === undefined) Deno.env.delete('PHONE_RATE_LIMIT_HMAC_SECRET')
    else Deno.env.set('PHONE_RATE_LIMIT_HMAC_SECRET', prev)
  }
}

const NO_PII_KEYS = ['name', 'phone', 'customerId', 'history', 'visitCount']

Deno.test('registered customer returns the minimal balance DTO with no PII', async () => {
  const restore = withHmacSecret()
  try {
    const { deps } = makeDeps()
    const response = await handleLookup(postRequest({ phone: '010-2345-7788', turnstileToken: 't' }), deps)
    assertEquals(response.status, 200)
    assertEquals(response.headers.get('cache-control'), 'no-store')
    const body = await response.json()
    assertEquals(body, {
      points: 3420,
      rewardThreshold: 5000,
      pointsToNextReward: 5000 - (3420 % 5000),
      storeName: '달콤한 진스쿡',
      asOf: body.asOf,
    })
    for (const key of NO_PII_KEYS) assertFalse(key in body)
  } finally {
    restore()
  }
})

Deno.test('unregistered customer returns the same response shape as a registered one', async () => {
  const restore = withHmacSecret()
  try {
    const registered = makeDeps()
    const unregistered = makeDeps({
      queryBalance: async () => ({ customer: null, config: STORE_CONFIG }),
    })
    const regBody = await (await handleLookup(
      postRequest({ phone: '010-2345-7788', turnstileToken: 't' }),
      registered.deps,
    )).json()
    const unregResponse = await handleLookup(
      postRequest({ phone: '010-0000-0000', turnstileToken: 't' }),
      unregistered.deps,
    )
    const unregBody = await unregResponse.json()

    assertEquals(unregResponse.status, 200)
    assertEquals(Object.keys(regBody).sort(), Object.keys(unregBody).sort())
    assertEquals(unregBody.points, 0)
    assertEquals(unregBody.pointsToNextReward, 5000)
    for (const key of NO_PII_KEYS) assertFalse(key in unregBody)
  } finally {
    restore()
  }
})

Deno.test('Turnstile rejection returns 400 and never touches the database', async () => {
  const restore = withHmacSecret()
  try {
    const { deps, calls } = makeDeps({
      verifyTurnstile: async () => {
        throw new Error('turnstile_rejected')
      },
    })
    const response = await handleLookup(postRequest({ phone: '010-2345-7788', turnstileToken: 't' }), deps)
    assertEquals(response.status, 400)
    assertEquals(response.headers.get('cache-control'), 'no-store')
    assertEquals((await response.json()).error.code, 'INVALID_REQUEST')
    assertEquals(calls.query, 0)
    assertEquals(calls.phone, 0)
  } finally {
    restore()
  }
})

Deno.test('rate limiting returns 429 before Turnstile and the database', async () => {
  const restore = withHmacSecret()
  try {
    const { deps, calls } = makeDeps({
      enforcePreVerificationLimits: async () => {
        throw new Error('rate_limited')
      },
    })
    const response = await handleLookup(postRequest({ phone: '010-2345-7788', turnstileToken: 't' }), deps)
    assertEquals(response.status, 429)
    assertEquals(response.headers.get('cache-control'), 'no-store')
    assertEquals((await response.json()).error.code, 'RATE_LIMITED')
    assertEquals(calls.turnstile, 0)
    assertEquals(calls.query, 0)
  } finally {
    restore()
  }
})

Deno.test('per-phone rate limit returns 429', async () => {
  const restore = withHmacSecret()
  try {
    const { deps, calls } = makeDeps({
      enforcePhoneLimit: async () => {
        throw new Error('rate_limited')
      },
    })
    const response = await handleLookup(postRequest({ phone: '010-2345-7788', turnstileToken: 't' }), deps)
    assertEquals(response.status, 429)
    assertEquals(calls.query, 0)
  } finally {
    restore()
  }
})

Deno.test('an external API failure maps to 503', async () => {
  const restore = withHmacSecret()
  try {
    const { deps } = makeDeps({
      verifyTurnstile: async () => {
        throw new Error('turnstile_unavailable')
      },
    })
    const response = await handleLookup(postRequest({ phone: '010-2345-7788', turnstileToken: 't' }), deps)
    assertEquals(response.status, 503)
    assertEquals(response.headers.get('cache-control'), 'no-store')
    assertEquals((await response.json()).error.code, 'UNAVAILABLE')
  } finally {
    restore()
  }
})

Deno.test('a missing HMAC secret maps to 503', async () => {
  const prev = Deno.env.get('PHONE_RATE_LIMIT_HMAC_SECRET')
  Deno.env.delete('PHONE_RATE_LIMIT_HMAC_SECRET')
  try {
    const { deps } = makeDeps()
    const response = await handleLookup(postRequest({ phone: '010-2345-7788', turnstileToken: 't' }), deps)
    assertEquals(response.status, 503)
    assertEquals((await response.json()).error.code, 'UNAVAILABLE')
  } finally {
    if (prev !== undefined) Deno.env.set('PHONE_RATE_LIMIT_HMAC_SECRET', prev)
  }
})

Deno.test('an invalid request body maps to 400', async () => {
  const restore = withHmacSecret()
  try {
    const { deps, calls } = makeDeps()
    const response = await handleLookup(postRequest({ phone: '', turnstileToken: '' }), deps)
    assertEquals(response.status, 400)
    assertEquals((await response.json()).error.code, 'INVALID_REQUEST')
    assertEquals(calls.turnstile, 0)
  } finally {
    restore()
  }
})

Deno.test('a non-POST method is rejected', async () => {
  const request = new Request('http://127.0.0.1:54321/functions/v1/lookup-balance', { method: 'GET' })
  const response = await handleLookup(request, makeDeps().deps)
  assertEquals(response.status, 405)
  assertEquals(response.headers.get('cache-control'), 'no-store')
})

// ---------------------------------------------------------------------------
// Step 6: only the secret-scoped client is used (no anon table endpoint hit)
// ---------------------------------------------------------------------------

const SECRET_KEY = 'sb_secret_unit_test_key'
const ANON_KEY = 'sb_publishable_unit_test_key'

function withSecretClientEnv(secret: string | undefined): () => void {
  const prevUrl = Deno.env.get('SUPABASE_URL')
  const prevSecret = Deno.env.get('SUPABASE_SECRET_KEY')
  const prevHmac = Deno.env.get('PHONE_RATE_LIMIT_HMAC_SECRET')
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321')
  if (secret === undefined) Deno.env.delete('SUPABASE_SECRET_KEY')
  else Deno.env.set('SUPABASE_SECRET_KEY', secret)
  Deno.env.set('PHONE_RATE_LIMIT_HMAC_SECRET', 'unit-test-hmac-secret')
  return () => {
    if (prevUrl === undefined) Deno.env.delete('SUPABASE_URL')
    else Deno.env.set('SUPABASE_URL', prevUrl)
    if (prevSecret === undefined) Deno.env.delete('SUPABASE_SECRET_KEY')
    else Deno.env.set('SUPABASE_SECRET_KEY', prevSecret)
    if (prevHmac === undefined) Deno.env.delete('PHONE_RATE_LIMIT_HMAC_SECRET')
    else Deno.env.set('PHONE_RATE_LIMIT_HMAC_SECRET', prevHmac)
  }
}

Deno.test('the real query path uses only the secret-scoped client (no anon table endpoint)', async () => {
  const restoreEnv = withSecretClientEnv(SECRET_KEY)
  const restEndpoints: string[] = []
  const usedKeys = new Set<string>()

  const restoreFetch = stubFetch((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    const apikey = headers.get('apikey')
    const authorization = headers.get('authorization')
    if (apikey) usedKeys.add(apikey)
    if (authorization) usedKeys.add(authorization.replace(/^Bearer\s+/i, ''))

    const path = new URL(url).pathname
    if (path.startsWith('/rest/v1/')) {
      restEndpoints.push(path)
      const body = path.includes('store_config')
        ? JSON.stringify(STORE_CONFIG)
        : JSON.stringify({ points: 3420 })
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    return Promise.reject(new Error(`unexpected fetch to ${url}`))
  })

  try {
    const { deps } = makeDeps({ queryBalance: defaultQueryBalance })
    const response = await handleLookup(
      postRequest({ phone: '010-2345-7788', turnstileToken: 't' }),
      deps,
    )
    assertEquals(response.status, 200)

    // Both intended tables were queried via the REST endpoint.
    assert(restEndpoints.some((p) => p.includes('/rest/v1/customers')), 'customers queried')
    assert(restEndpoints.some((p) => p.includes('/rest/v1/store_config')), 'store_config queried')
    // Every authenticated key seen was the secret key; the anon key was never used.
    assert(usedKeys.has(SECRET_KEY), 'secret key used')
    assertFalse(usedKeys.has(ANON_KEY), 'anon key never used')
    for (const key of usedKeys) assertEquals(key, SECRET_KEY)
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

Deno.test('a missing Supabase secret in the real query path maps to 503', async () => {
  const restoreEnv = withSecretClientEnv(undefined)
  try {
    const { deps } = makeDeps({ queryBalance: defaultQueryBalance })
    const response = await handleLookup(
      postRequest({ phone: '010-2345-7788', turnstileToken: 't' }),
      deps,
    )
    assertEquals(response.status, 503)
    assertEquals((await response.json()).error.code, 'UNAVAILABLE')
  } finally {
    restoreEnv()
  }
})
