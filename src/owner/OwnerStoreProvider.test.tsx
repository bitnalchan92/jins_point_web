import type { PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnerBootstrap } from '../lib/contracts'

// The provider talks to the server only through ./ownerApi. Mock that module so
// these tests assert the provider's orchestration (load → mutate → refetch),
// never a real network/Supabase call.
vi.mock('./ownerApi', () => ({
  fetchOwnerBootstrap: vi.fn(),
  createCustomer: vi.fn(),
  applyReward: vi.fn(),
  updateRate: vi.fn(),
}))

import {
  applyReward,
  createCustomer,
  fetchOwnerBootstrap,
  updateRate,
} from './ownerApi'
import { OwnerStoreProvider, useOwnerStore } from './OwnerStoreProvider'

const baseBootstrap: OwnerBootstrap = {
  customers: [
    {
      id: 'c1',
      name: '김서연',
      phoneE164: '+821023457788',
      points: 3420,
      visits: 18,
      lastVisitedAt: '2026-06-26T00:00:00.000Z',
    },
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

const withSecondCustomer: OwnerBootstrap = {
  ...baseBootstrap,
  customers: [
    ...baseBootstrap.customers,
    {
      id: 'c2',
      name: '홍길동',
      phoneE164: '+821000001234',
      points: 0,
      visits: 0,
      lastVisitedAt: null,
    },
  ],
}

function wrapper({ children }: PropsWithChildren) {
  return <OwnerStoreProvider>{children}</OwnerStoreProvider>
}

beforeEach(() => {
  vi.mocked(fetchOwnerBootstrap).mockReset()
  vi.mocked(createCustomer).mockReset()
  vi.mocked(applyReward).mockReset()
  vi.mocked(updateRate).mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('OwnerStoreProvider', () => {
  it('loads the authoritative bootstrap on mount', async () => {
    vi.mocked(fetchOwnerBootstrap).mockResolvedValue(baseBootstrap)

    const { result } = renderHook(() => useOwnerStore(), { wrapper })
    expect(result.current.state.status).toBe('loading')

    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.state.data).toEqual(baseBootstrap)
  })

  it('surfaces an error state and recovers on retry', async () => {
    vi.mocked(fetchOwnerBootstrap)
      .mockRejectedValueOnce(new Error('boot failed'))
      .mockResolvedValueOnce(baseBootstrap)

    const { result } = renderHook(() => useOwnerStore(), { wrapper })
    await waitFor(() => expect(result.current.state.status).toBe('error'))

    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.state.status).toBe('ready')
    expect(result.current.state.data).toEqual(baseBootstrap)
  })

  it('refetches the bootstrap after adding a customer', async () => {
    vi.mocked(fetchOwnerBootstrap)
      .mockResolvedValueOnce(baseBootstrap)
      .mockResolvedValueOnce(withSecondCustomer)
    vi.mocked(createCustomer).mockResolvedValue(undefined)

    const { result } = renderHook(() => useOwnerStore(), { wrapper })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.addCustomer('010-0000-1234', '홍길동')
    })

    expect(createCustomer).toHaveBeenCalledWith('010-0000-1234', '홍길동')
    expect(result.current.state.data).toEqual(withSecondCustomer)
  })

  it('returns the server-computed reward result and then refetches', async () => {
    vi.mocked(fetchOwnerBootstrap).mockResolvedValue(baseBootstrap)
    // Deliberately NOT what a client 5% calc would produce — proves the value is
    // taken from the server, not recomputed locally.
    vi.mocked(applyReward).mockResolvedValue({ pointsDelta: 777, balanceAfter: 4197 })

    const { result } = renderHook(() => useOwnerStore(), { wrapper })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    let resolved: { pointsDelta: number; balanceAfter: number } | undefined
    await act(async () => {
      resolved = await result.current.applyReward('c1', 'earn', 10000, 'key-1')
    })

    expect(applyReward).toHaveBeenCalledWith('c1', 'earn', 10000, 'key-1')
    expect(resolved).toEqual({ pointsDelta: 777, balanceAfter: 4197 })
    expect(fetchOwnerBootstrap).toHaveBeenCalledTimes(2)
  })

  it('refetches after saving a new reward rate', async () => {
    vi.mocked(fetchOwnerBootstrap).mockResolvedValue(baseBootstrap)
    vi.mocked(updateRate).mockResolvedValue(undefined)

    const { result } = renderHook(() => useOwnerStore(), { wrapper })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    await act(async () => {
      await result.current.updateRate(0.07)
    })

    expect(updateRate).toHaveBeenCalledWith(0.07)
    expect(fetchOwnerBootstrap).toHaveBeenCalledTimes(2)
  })
})
