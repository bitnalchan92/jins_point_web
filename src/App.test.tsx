import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnerBootstrap } from './lib/contracts'

// A controllable owner-auth store so the test can flip ready → signed_out the
// way a real logout does, and watch the owner subtree (and its data) unmount.
const authStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  let state: { status: string; email?: string } = { status: 'ready', email: 'owner@test' }
  return {
    get: () => state,
    set(next: { status: string; email?: string }) {
      state = next
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
})

vi.mock('./auth/OwnerAuthProvider', async () => {
  const React = await import('react')
  const useOwnerAuth = () => {
    const state = React.useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get)
    return {
      state,
      signIn: async () => {},
      enrollTotp: async () => ({ factorId: '', qrCode: '', secret: '' }),
      verifyTotp: async () => {},
      signOut: async () => {
        authStore.set({ status: 'signed_out' })
      },
    }
  }
  const OwnerAuthProvider = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  return { OwnerAuthProvider, useOwnerAuth }
})

vi.mock('./owner/ownerApi', () => ({
  OwnerApiError: class extends Error {},
  fetchOwnerBootstrap: vi.fn(),
  createCustomer: vi.fn(),
  applyReward: vi.fn(),
  updateRate: vi.fn(),
}))

import { fetchOwnerBootstrap } from './owner/ownerApi'
import App from './App'

const bootstrap: OwnerBootstrap = {
  customers: [
    { id: 'c1', name: '김서연', phoneE164: '+821023457788', points: 3420, visits: 18, lastVisitedAt: null },
    { id: 'c2', name: '이준호', phoneE164: '+821098765432', points: 5180, visits: 24, lastVisitedAt: null },
  ],
  recentRewards: [],
  store: {
    name: '달콤한 진스쿡',
    tagline: '김밥 · 샌드위치 전문점',
    rewardRate: 0.05,
    rewardThreshold: 5000,
    redeemUnit: 1000,
  },
}

beforeEach(() => {
  authStore.set({ status: 'ready', email: 'owner@test' })
  vi.mocked(fetchOwnerBootstrap).mockReset().mockResolvedValue(bootstrap)
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('App /admin owner flow', () => {
  it('mounts the owner store for a ready owner and clears its data on logout', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    // Dashboard tab renders the bootstrap customers (server-sourced data).
    await user.click(await screen.findByRole('button', { name: '📊 대시보드' }))
    expect(await screen.findByText('이준호')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    // After logout the owner subtree unmounts: login screen shown, data gone.
    expect(await screen.findByText('사장님 로그인')).toBeInTheDocument()
    expect(screen.queryByText('이준호')).not.toBeInTheDocument()
  })
})
