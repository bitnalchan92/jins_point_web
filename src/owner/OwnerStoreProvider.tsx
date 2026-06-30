import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import {
  applyReward as apiApplyReward,
  createCustomer as apiCreateCustomer,
  fetchOwnerBootstrap,
  updateRate as apiUpdateRate,
} from './ownerApi'
import type { OwnerBootstrap, RewardResult } from '../lib/contracts'
import { useOwnerRealtime } from './useOwnerRealtime'

export interface OwnerStoreState {
  status: 'loading' | 'ready' | 'error'
  data?: OwnerBootstrap
}

export interface OwnerStoreValue {
  state: OwnerStoreState
  refresh: () => Promise<void>
  addCustomer: (phone: string, name: string) => Promise<void>
  applyReward: (
    customerId: string,
    type: 'earn' | 'use',
    amount: number,
    idempotencyKey: string,
  ) => Promise<RewardResult>
  updateRate: (rate: number) => Promise<void>
}

const OwnerStoreContext = createContext<OwnerStoreValue | null>(null)

// Owner operating state is sourced exclusively from the authoritative server
// bootstrap. The provider holds no demo data and never mutates points locally —
// after every successful write it refetches the bootstrap so the UI reflects
// the server-computed truth.
export function OwnerStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OwnerStoreState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    // Keep already-rendered data on a background refetch (e.g. post-mutation);
    // only fall back to a blocking loading state before the first success.
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
    try {
      const data = await fetchOwnerBootstrap()
      setState({ status: 'ready', data })
    } catch {
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Subscribe to owner-only private Realtime only once authenticated as the aal2
  // owner (status 'ready'). A broadcast is a signal, never data — it debounces
  // into the authoritative refetch above. The provider is mounted exclusively
  // under the authenticated /admin subtree, so the customer route opens no
  // socket; the `ready` gate additionally avoids a subscribe before/without auth.
  useOwnerRealtime(state.status === 'ready', refresh)

  const addCustomer = useCallback(
    async (phone: string, name: string) => {
      await apiCreateCustomer(phone, name)
      await refresh()
    },
    [refresh],
  )

  const applyReward = useCallback(
    async (
      customerId: string,
      type: 'earn' | 'use',
      amount: number,
      idempotencyKey: string,
    ): Promise<RewardResult> => {
      const result = await apiApplyReward(customerId, type, amount, idempotencyKey)
      await refresh()
      return result
    },
    [refresh],
  )

  const updateRate = useCallback(
    async (rate: number) => {
      await apiUpdateRate(rate)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<OwnerStoreValue>(
    () => ({ state, refresh, addCustomer, applyReward, updateRate }),
    [state, refresh, addCustomer, applyReward, updateRate],
  )

  return <OwnerStoreContext.Provider value={value}>{children}</OwnerStoreContext.Provider>
}

export function useOwnerStore(): OwnerStoreValue {
  const ctx = useContext(OwnerStoreContext)
  if (!ctx) throw new Error('useOwnerStore must be used within an OwnerStoreProvider')
  return ctx
}
