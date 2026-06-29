import { useCallback, useRef, useState } from 'react'
import { ApiError, lookupBalance } from '../lib/api'
import type { BalanceResponse } from '../lib/contracts'

export type BalanceLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: BalanceResponse }
  | { status: 'error'; code: 'INVALID_REQUEST' | 'RATE_LIMITED' | 'UNAVAILABLE' }

export interface UseBalanceLookup {
  state: BalanceLookupState
  lookup: (phone: string, turnstileToken: string) => Promise<void>
  reset: () => void
}

export function useBalanceLookup(): UseBalanceLookup {
  const [state, setState] = useState<BalanceLookupState>({ status: 'idle' })
  const inFlight = useRef(false)

  const lookup = useCallback(async (phone: string, turnstileToken: string) => {
    // Block re-submission while a lookup is already running.
    if (inFlight.current) return
    inFlight.current = true
    setState({ status: 'loading' })
    try {
      const data = await lookupBalance(phone, turnstileToken)
      setState({ status: 'success', data })
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'UNAVAILABLE'
      setState({ status: 'error', code })
    } finally {
      inFlight.current = false
    }
  }, [])

  const reset = useCallback(() => {
    inFlight.current = false
    setState({ status: 'idle' })
  }, [])

  return { state, lookup, reset }
}
