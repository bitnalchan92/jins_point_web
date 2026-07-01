import { test, expect } from '@playwright/test'

// Customer balance E2E. These target the production URL (`E2E_BASE_URL`) and are
// NOT meant to run locally. Cloudflare Turnstile is bypassed in CI via a
// pre-shared token: Playwright intercepts the Turnstile script and immediately
// fires the bypass token as the widget callback; the Edge Function skips
// Cloudflare verification when the token matches `TURNSTILE_E2E_BYPASS_TOKEN`.
// When any required env is absent every test is skipped rather than failing.
//
// Required env:
//   E2E_BASE_URL               deployed customer web app
//   E2E_CUSTOMER_PHONE         a phone seeded with a non-zero balance
//   E2E_CUSTOMER_NAME          that customer's name — asserted never to appear in UI
//   E2E_TURNSTILE_BYPASS_TOKEN pre-shared token (must match TURNSTILE_E2E_BYPASS_TOKEN
//                              Supabase secret — set with `npx supabase secrets set`)

const CUSTOMER_PHONE = process.env.E2E_CUSTOMER_PHONE ?? ''
const CUSTOMER_NAME = process.env.E2E_CUSTOMER_NAME ?? ''
const TURNSTILE_BYPASS_TOKEN = process.env.E2E_TURNSTILE_BYPASS_TOKEN ?? ''
// A well-formed but (by construction) unregistered number. Unregistered numbers
// must yield the same minimal state as registered ones — no enumeration.
const UNREGISTERED_PHONE = '01099990000'
const LOOKUP_ROUTE = '**/functions/v1/lookup-balance'

// Intercept the Cloudflare Turnstile script and replace it with a stub that
// immediately fires the bypass token as the widget callback.
async function mockTurnstile(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/turnstile/v0/api.js**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:function(el,opts){opts.callback(${JSON.stringify(TURNSTILE_BYPASS_TOKEN)})},remove:function(){},reset:function(){}}`,
    }),
  )
}

// Type a phone number, wait for the mocked Turnstile to fire (enabling the
// submit button), then submit the lookup.
async function lookup(page: import('@playwright/test').Page, phone: string): Promise<void> {
  await mockTurnstile(page)
  await page.goto('/')
  await page.locator('#cust-phone').fill(phone)
  const submit = page.getByRole('button', { name: '내 포인트 보기' })
  await expect(submit).toBeEnabled({ timeout: 15_000 })
  await submit.click()
}

test.describe('customer balance lookup', () => {
  test.skip(!CUSTOMER_PHONE || !TURNSTILE_BYPASS_TOKEN, 'requires staging env (E2E_CUSTOMER_PHONE, E2E_TURNSTILE_BYPASS_TOKEN)')

  test('valid number shows only the minimal balance', async ({ page }) => {
    await lookup(page, CUSTOMER_PHONE)

    // The point screen renders: available points + next-reward guidance + as-of
    // time. That is the entire surface the customer is allowed to see.
    await expect(page.getByText('사용 가능 포인트')).toBeVisible()
    await expect(page.getByText(/기준 시각/)).toBeVisible()
  })

  test('unregistered number yields the same minimal state', async ({ page }) => {
    await lookup(page, UNREGISTERED_PHONE)

    // Identical layout — no "not found" path that would leak whether a number is
    // registered. Points simply render (as 0 for an unknown number).
    await expect(page.getByText('사용 가능 포인트')).toBeVisible()
    await expect(page.getByText(/기준 시각/)).toBeVisible()
  })

  test('never discloses name, phone, or transaction history', async ({ page }) => {
    await lookup(page, CUSTOMER_PHONE)
    await expect(page.getByText('사용 가능 포인트')).toBeVisible()

    const body = (await page.locator('body').innerText()).replace(/\s+/g, '')
    // The customer's own name must never be rendered.
    if (CUSTOMER_NAME) expect(body).not.toContain(CUSTOMER_NAME.replace(/\s+/g, ''))
    // No full phone number (formatted or raw) is echoed back.
    const digits = CUSTOMER_PHONE.replace(/\D/g, '')
    expect(body).not.toContain(digits)
    // No per-transaction history / ledger is exposed to the customer.
    await expect(page.getByText('내역')).toHaveCount(0)
  })

  test('rate-limited lookup shows the retry guidance', async ({ page }) => {
    // Mock the lookup edge function as rate-limited (429) so we exercise the
    // client retry affordance deterministically, without hammering staging.
    await page.route(LOOKUP_ROUTE, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'RATE_LIMITED' } }),
      }),
    )

    await lookup(page, CUSTOMER_PHONE)

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('잠시 후 다시 시도해 주세요')
    await expect(alert.getByRole('button', { name: '다시 시도' })).toBeVisible()
  })
})
