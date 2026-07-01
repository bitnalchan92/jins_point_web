import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'

// Owner reward E2E. These run only against a deployed staging environment and a
// dedicated CI owner account; they are NOT meant to run locally. The owner UI
// flow drives the staging web app (`E2E_BASE_URL`), while the concurrency and
// idempotency invariants are exercised directly against the staging owner-api
// edge function with an aal2 session minted in-process. When the required env
// is absent every test is skipped instead of failing.
//
// Required env (staging):
//   E2E_BASE_URL                  deployed owner web app (used by config.baseURL)
//   E2E_SUPABASE_URL              staging Supabase project URL
//   E2E_SUPABASE_PUBLISHABLE_KEY  staging anon/publishable key
//   E2E_SUPABASE_SERVICE_ROLE_KEY service-role key for afterAll cleanup
//   E2E_OWNER_EMAIL               CI-only owner account email
//   E2E_OWNER_PASSWORD            CI-only owner account password
//   E2E_OWNER_TOTP_SECRET         the owner's enrolled TOTP secret (base32).
//                                 Used with otpauth to mint live 6-digit codes;
//                                 never written to a test artifact.

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? ''
const PUBLISHABLE_KEY = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? ''
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? ''
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''
const TOTP_SECRET = process.env.E2E_OWNER_TOTP_SECRET ?? ''

const HAS_ENV =
  Boolean(SUPABASE_URL) &&
  Boolean(PUBLISHABLE_KEY) &&
  Boolean(OWNER_EMAIL) &&
  Boolean(OWNER_PASSWORD) &&
  Boolean(TOTP_SECRET)

const OWNER_API = `${SUPABASE_URL}/functions/v1/owner-api`

// Generate the current 6-digit code from the enrolled secret at call time.
function totpCode(): string {
  return new OTPAuth.TOTP({ secret: TOTP_SECRET }).generate()
}

// A unique, well-formed phone per run so repeated staging runs never collide on
// the duplicate-customer guard.
function uniquePhone(): string {
  return `010${String(Date.now()).slice(-8)}`
}

interface ApiCustomer {
  id: string
  phoneE164: string
  points: number
}

interface StoreConfig {
  rewardRate: number
  redeemUnit: number
}

interface RewardResult {
  pointsDelta: number
  balanceAfter: number
}

// ─── aal2 token cache ────────────────────────────────────────────────────────
// Playwright runs each project (chromium, mobile) in its own worker process, so
// this module-level cache is per-project. Within one project's sequential tests,
// the first call mints one aal2 token; all subsequent calls reuse it. This cuts
// per-run Supabase Auth API calls from ~20 (5 flows × 4 calls) to ~8 (2 × 4),
// staying well below per-account rate limits.

interface Aal2Session {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  user: unknown
}

let _aal2Cache: Aal2Session | null = null
let _aal2CachedAt = 0

async function mintAal2(): Promise<Aal2Session> {
  // Reuse the cached token for up to 50 minutes (tokens expire at 60 min).
  if (_aal2Cache && Date.now() - _aal2CachedAt < 50 * 60 * 1000) {
    return _aal2Cache
  }

  const authBase = `${SUPABASE_URL}/auth/v1`
  const headers = { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' }

  const signInRes = await fetch(`${authBase}/token?grant_type=password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  })
  if (!signInRes.ok) throw new Error(`signIn failed: ${signInRes.status}`)
  const { access_token: aal1Token } = (await signInRes.json()) as { access_token: string }
  const authHeaders = { ...headers, Authorization: `Bearer ${aal1Token}` }

  const userRes = await fetch(`${authBase}/user`, { headers: authHeaders })
  if (!userRes.ok) throw new Error(`getUser failed: ${userRes.status}`)
  const userData = (await userRes.json()) as { factors?: Array<{ id: string; factor_type: string }> }
  const factor = (userData.factors ?? []).find((f) => f.factor_type === 'totp')
  if (!factor) throw new Error('no TOTP factor enrolled')

  const challengeRes = await fetch(`${authBase}/factors/${factor.id}/challenge`, {
    method: 'POST',
    headers: authHeaders,
  })
  if (!challengeRes.ok) throw new Error(`challenge failed: ${challengeRes.status}`)
  const { id: challengeId } = (await challengeRes.json()) as { id: string }

  const verifyRes = await fetch(`${authBase}/factors/${factor.id}/verify`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ challenge_id: challengeId, code: totpCode() }),
  })
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status}`)
  const aal2 = (await verifyRes.json()) as Aal2Session

  _aal2Cache = aal2
  _aal2CachedAt = Date.now()
  return aal2
}

// Return a thin owner-api client bound to the current cached aal2 access token.
async function ownerApiSession() {
  const { access_token: token } = await mintAal2()

  const call = (init: RequestInit) =>
    fetch(OWNER_API, {
      ...init,
      headers: {
        'content-type': 'application/json',
        apikey: PUBLISHABLE_KEY,
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    })

  const bootstrap = async () => {
    const res = await call({ method: 'GET' })
    if (!res.ok) throw new Error(`bootstrap failed: ${res.status}`)
    return (await res.json()) as { customers: ApiCustomer[]; store: StoreConfig }
  }

  const createCustomer = async (phone: string, name: string) => {
    const res = await call({
      method: 'POST',
      body: JSON.stringify({ action: 'create_customer', name, phone }),
    })
    if (!res.ok) throw new Error(`create_customer failed: ${res.status}`)
  }

  const applyReward = (
    customerId: string,
    type: 'earn' | 'use',
    amount: number,
    idempotencyKey: string,
  ) =>
    call({
      method: 'POST',
      body: JSON.stringify({ action: 'apply_reward', customerId, type, amount, idempotencyKey }),
    })

  const findByPhone = async (phone: string) => {
    const data = await bootstrap()
    const digits = phone.replace(/\D/g, '')
    const e164 = `+82${digits.slice(1)}`
    const found = data.customers.find((c) => c.phoneE164 === e164)
    if (!found) throw new Error(`customer ${phone} not found in bootstrap`)
    return found
  }

  return { bootstrap, createCustomer, applyReward, findByPhone }
}

// Inject the cached aal2 session into the browser's localStorage before
// navigating, bypassing the browser login + MFA form entirely.
// addInitScript runs before the page's own scripts on every navigation so the
// Supabase auth client picks up the session on init.
async function ownerLogin(page: Page): Promise<void> {
  const aal2 = await mintAal2()
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`
  const storageValue = JSON.stringify({
    access_token: aal2.access_token,
    refresh_token: aal2.refresh_token,
    expires_at: aal2.expires_at,
    expires_in: aal2.expires_in,
    token_type: 'bearer',
    user: aal2.user,
  })
  await page.addInitScript({ content: `localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(storageValue)})` })
  await page.goto('/admin')
  await expect(page.getByText('사장님 모드 · 포인트 관리')).toBeVisible({ timeout: 15_000 })
}

// Track the phone created in the UI test so afterAll can clean it up by exact
// phone number instead of name-pattern — avoids a cross-project race where
// chromium's afterAll could delete mobile's customer mid-test.
let _uiTestPhone: string | null = null

test.describe('owner reward flows', () => {
  test.skip(!HAS_ENV, 'requires staging env + CI owner account')

  test('login, create a customer, earn, persist across reload, then log out', async ({ page }) => {
    test.setTimeout(90_000)
    await ownerLogin(page)

    const phone = uniquePhone()
    _uiTestPhone = phone
    const name = `테스트손님${String(Date.now()).slice(-5)}`

    // Create a customer.
    await page.getByRole('button', { name: '👥 손님 관리' }).click()
    await page.getByRole('button', { name: '+ 신규 손님' }).click()
    // Use pressSequentially instead of fill: on Pixel 5 mobile viewport
    // (hasTouch: true), fill() may not trigger React's synthetic onChange for
    // tel/numeric inputs, leaving state empty and blocking form submission.
    await page.getByPlaceholder('홍길동').pressSequentially(name)
    await page.getByPlaceholder('010-0000-0000').pressSequentially(phone)
    await page.getByRole('button', { name: '등록하기' }).click()
    await expect(page.getByText(`${name} 님 등록 완료`)).toBeVisible({ timeout: 10_000 })

    // Earn points on them via the reward keypad.
    await page.getByRole('button', { name: '☕ 포인트' }).click()
    for (const digit of phone.slice(-4)) {
      await page.getByRole('button', { name: digit, exact: true }).click()
    }
    await page.getByRole('button', { name: '손님 조회' }).click()
    await page.getByRole('button', { name: '+5,000', exact: true }).click()
    await page.getByRole('button', { name: '포인트 적립하기' }).click()
    await expect(page.getByText(/적립 완료/)).toBeVisible()

    // Read the persisted balance from the customer card, then reload to force a
    // fresh server bootstrap and confirm the balance survived.
    await page.getByRole('button', { name: '👥 손님 관리' }).click()
    await page.getByPlaceholder('이름 또는 전화번호로 검색').pressSequentially(name)
    // Target the card div: must contain both the customer name AND a points badge
    // (.last() on plain hasText finds the innermost name-only div, not the card).
    const card = page.locator('div').filter({ hasText: name }).filter({ hasText: /\d+P/ }).first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    const before = (await card.innerText()).match(/([\d,]+)P/)?.[1]
    expect(before).toBeTruthy()

    await page.reload()
    await expect(page.getByText('사장님 모드 · 포인트 관리')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: '👥 손님 관리' }).click()
    await page.getByPlaceholder('이름 또는 전화번호로 검색').pressSequentially(name)
    await expect(page.getByText(`${before}P`).first()).toBeVisible({ timeout: 10_000 })

    // Log out and confirm the owner data is gone — /admin returns to login.
    await page.getByRole('button', { name: '📊 대시보드' }).click()
    await page.getByRole('button', { name: /로그아웃/ }).click()
    await expect(page.getByText('사장님 로그인')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(name)).toHaveCount(0)
  })

  // API-only tests: no browser needed; skip in mobile to avoid hitting Supabase's
  // per-user MFA challenge rate limit when chromium and mobile run them in parallel.
  test('resending the same idempotency key applies the reward exactly once', async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'API tests run in chromium only')
    const api = await ownerApiSession()
    const phone = uniquePhone()
    await api.createCustomer(phone, `멱등${String(Date.now()).slice(-5)}`)
    const customer = await api.findByPhone(phone)
    expect(customer.points).toBe(0)

    const key = crypto.randomUUID()
    const first = await api.applyReward(customer.id, 'earn', 5000, key)
    expect(first.ok).toBe(true)
    const r1 = (await first.json()) as RewardResult

    // Replay the identical request with the same key. Whether the server replays
    // the stored result or rejects the duplicate, the balance must not double.
    await api.applyReward(customer.id, 'earn', 5000, key)

    const finalCustomer = await api.findByPhone(phone)
    expect(finalCustomer.points).toBe(r1.balanceAfter)
    expect(finalCustomer.points).toBe(0 + r1.pointsDelta)
  })

  test('10 parallel distinct-key earns sum to the final balance', async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'API tests run in chromium only')
    const api = await ownerApiSession()
    const phone = uniquePhone()
    await api.createCustomer(phone, `동시${String(Date.now()).slice(-5)}`)
    const customer = await api.findByPhone(phone)
    const start = customer.points

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        api.applyReward(customer.id, 'earn', 1000, crypto.randomUUID()),
      ),
    )
    for (const res of responses) expect(res.ok).toBe(true)
    const results = (await Promise.all(responses.map((r) => r.json()))) as RewardResult[]
    const deltaSum = results.reduce((sum, r) => sum + r.pointsDelta, 0)

    const finalCustomer = await api.findByPhone(phone)
    // 최종 잔액 = 시작 잔액 + reward_log delta 합계.
    expect(finalCustomer.points).toBe(start + deltaSum)
  })

  test('bad redeem unit and insufficient balance are rejected server-side', async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'API tests run in chromium only')
    const api = await ownerApiSession()
    const { store } = await api.bootstrap()
    const phone = uniquePhone()
    await api.createCustomer(phone, `오류${String(Date.now()).slice(-5)}`)
    const customer = await api.findByPhone(phone)

    // Insufficient balance: a brand-new customer has 0 points; any valid-unit use
    // must be rejected.
    const insufficient = await api.applyReward(customer.id, 'use', store.redeemUnit, crypto.randomUUID())
    expect(insufficient.ok).toBe(false)
    const insufficientBody = (await insufficient.json()) as { error?: { code?: string } }
    expect(insufficientBody.error?.code).toBe('UNPROCESSABLE')

    // Give them enough points, then use a non-multiple of the redeem unit.
    await api.applyReward(customer.id, 'earn', 100000, crypto.randomUUID())
    const funded = await api.findByPhone(phone)
    const badUnit = store.redeemUnit > 1 ? 1 : funded.points + store.redeemUnit
    const rejected = await api.applyReward(customer.id, 'use', badUnit, crypto.randomUUID())
    expect(rejected.ok).toBe(false)
    const rejectedBody = (await rejected.json()) as { error?: { code?: string } }
    expect(rejectedBody.error?.code).toBe('UNPROCESSABLE')
  })

  // Delete all customers created during this test run. reward_log has ON DELETE
  // RESTRICT so logs must be removed first, then the customer rows.
  //
  // Cleanup strategy avoids cross-project races:
  //   - UI test customer: each project tracks its own phone via _uiTestPhone and
  //     deletes by exact phone — runs in BOTH projects after their own test finishes.
  //   - API test customers: only created in chromium (mobile skips those tests),
  //     so only chromium deletes them by name pattern.
  test.afterAll(async ({}, testInfo) => {
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const idsToDelete: string[] = []

    // Each project cleans up the UI test customer it created (by exact phone).
    if (_uiTestPhone) {
      const digits = _uiTestPhone.replace(/\D/g, '')
      const e164 = `+82${digits.slice(1)}`
      const { data } = await admin.from('customers').select('id').eq('phone_e164', e164)
      if (data?.length) idsToDelete.push(...data.map((c) => c.id))
    }

    // API test customers are only created in chromium (skipped in mobile).
    if (testInfo.project.name === 'chromium') {
      const orFilter = ['멱등', '동시', '오류'].map((p) => `name.like.${p}%`).join(',')
      const { data } = await admin.from('customers').select('id').or(orFilter)
      if (data?.length) idsToDelete.push(...data.map((c) => c.id))
    }

    if (!idsToDelete.length) return
    const ids = [...new Set(idsToDelete)]
    await admin.from('reward_log').delete().in('customer_id', ids)
    await admin.from('customers').delete().in('id', ids)
  })
})
