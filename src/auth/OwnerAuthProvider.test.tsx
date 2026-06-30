import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type {
  AuthChangeEvent,
  Factor,
  Session,
} from '@supabase/supabase-js'

// Mock the Supabase browser client so the provider's state machine is exercised
// against a controllable Auth surface, with no real network or session.
// `vi.hoisted` keeps the mock object available to the hoisted `vi.mock` factory.
const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: authMock },
}))

import { OwnerAuthProvider, useOwnerAuth } from './OwnerAuthProvider'

// Captured so tests can fire Supabase auth events and assert re-evaluation.
let authCallback:
  | ((event: AuthChangeEvent, session: Session | null) => void | Promise<void>)
  | undefined

const OWNER_EMAIL = 'owner@jinscook.test'

function makeSession(): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: OWNER_EMAIL,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    },
  } as Session
}

function verifiedTotpFactor(): Factor {
  return {
    id: 'factor-1',
    friendly_name: 'authenticator',
    factor_type: 'totp',
    status: 'verified',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as Factor
}

function setNoSession() {
  authMock.getSession.mockResolvedValue({ data: { session: null }, error: null })
}
function setSession(session: Session) {
  authMock.getSession.mockResolvedValue({ data: { session }, error: null })
}
function setAal(level: 'aal1' | 'aal2') {
  authMock.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: level, nextLevel: 'aal2', currentAuthenticationMethods: [] },
    error: null,
  })
}
function setFactors(factors: Factor[]) {
  authMock.mfa.listFactors.mockResolvedValue({
    data: {
      all: factors,
      totp: factors.filter((f) => f.factor_type === 'totp' && f.status === 'verified'),
      phone: [],
    },
    error: null,
  })
}

function Harness() {
  const { state, signIn, signOut } = useOwnerAuth()
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="email">
        {state.status === 'needs_enrollment' ||
        state.status === 'needs_challenge' ||
        state.status === 'ready'
          ? state.email
          : ''}
      </span>
      <button type="button" onClick={() => void signIn(OWNER_EMAIL, 'pw').catch(() => {})}>
        signin
      </button>
      <button type="button" onClick={() => void signOut()}>
        signout
      </button>
    </div>
  )
}

function renderProvider(ui: ReactNode = <Harness />) {
  return render(<OwnerAuthProvider>{ui}</OwnerAuthProvider>)
}

function status() {
  return screen.getByTestId('status').textContent
}

beforeEach(() => {
  authCallback = undefined
  authMock.onAuthStateChange.mockImplementation((cb) => {
    authCallback = cb
    return { data: { subscription: { id: 's', callback: cb, unsubscribe: vi.fn() } } }
  })
  // Sensible defaults; individual tests override as needed.
  setNoSession()
  setAal('aal1')
  setFactors([])
  authMock.signInWithPassword.mockResolvedValue({ data: { session: makeSession() }, error: null })
  authMock.signOut.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('OwnerAuthProvider state machine', () => {
  it('resolves to signed_out when there is no session', async () => {
    renderProvider()
    await waitFor(() => expect(status()).toBe('signed_out'))
  })

  it('moves to needs_enrollment after password login when no factor exists', async () => {
    setNoSession()
    renderProvider()
    await waitFor(() => expect(status()).toBe('signed_out'))

    // Password succeeds and a session now exists, but no TOTP factor is enrolled.
    setSession(makeSession())
    setAal('aal1')
    setFactors([])

    await userEvent.click(screen.getByRole('button', { name: 'signin' }))
    await waitFor(() => expect(status()).toBe('needs_enrollment'))
    expect(screen.getByTestId('email').textContent).toBe(OWNER_EMAIL)
  })

  it('moves to needs_challenge with a verified TOTP factor still at aal1', async () => {
    setSession(makeSession())
    setAal('aal1')
    setFactors([verifiedTotpFactor()])

    renderProvider()
    await waitFor(() => expect(status()).toBe('needs_challenge'))
    expect(screen.getByTestId('email').textContent).toBe(OWNER_EMAIL)
  })

  it('is ready only when the assurance level is aal2', async () => {
    setSession(makeSession())
    setAal('aal2')
    setFactors([verifiedTotpFactor()])

    renderProvider()
    await waitFor(() => expect(status()).toBe('ready'))
    expect(screen.getByTestId('email').textContent).toBe(OWNER_EMAIL)
  })

  it('does not reach ready while still at aal1 even with a verified factor', async () => {
    setSession(makeSession())
    setAal('aal1')
    setFactors([verifiedTotpFactor()])

    renderProvider()
    await waitFor(() => expect(status()).toBe('needs_challenge'))
    // Never momentarily "ready" at aal1.
    expect(status()).not.toBe('ready')
  })

  it('returns to signed_out after sign out', async () => {
    setSession(makeSession())
    setAal('aal2')
    setFactors([verifiedTotpFactor()])

    renderProvider()
    await waitFor(() => expect(status()).toBe('ready'))

    setNoSession()
    await userEvent.click(screen.getByRole('button', { name: 'signout' }))
    await waitFor(() => expect(status()).toBe('signed_out'))
  })

  it('re-evaluates state when a Supabase auth event fires', async () => {
    setNoSession()
    renderProvider()
    await waitFor(() => expect(status()).toBe('signed_out'))
    expect(authCallback).toBeTypeOf('function')

    // Simulate the SDK signalling a new authenticated session at aal2.
    setSession(makeSession())
    setAal('aal2')
    setFactors([verifiedTotpFactor()])
    await act(async () => {
      await authCallback?.('SIGNED_IN', makeSession())
    })
    await waitFor(() => expect(status()).toBe('ready'))
  })

  it('subscribes to auth changes once and unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    authMock.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb
      return { data: { subscription: { id: 's', callback: cb, unsubscribe } } }
    })
    setNoSession()
    const { unmount } = renderProvider()
    await waitFor(() => expect(status()).toBe('signed_out'))
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
