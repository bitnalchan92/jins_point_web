import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { PropsWithChildren } from 'react'
import { supabase } from '../lib/supabase'

export type OwnerAuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'needs_enrollment'; email: string }
  | { status: 'needs_challenge'; email: string }
  | { status: 'ready'; email: string }
  | { status: 'error'; message: string }

export interface OwnerAuthValue {
  state: OwnerAuthState
  signIn: (email: string, password: string) => Promise<void>
  enrollTotp: () => Promise<{ factorId: string; qrCode: string; secret: string }>
  verifyTotp: (factorId: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

const OwnerAuthContext = createContext<OwnerAuthValue | null>(null)

// Derive the owner auth state from the live Supabase session. `ready` is granted
// only when the assurance level is `aal2`; the UI never trusts a verified factor
// alone. API and RLS independently re-check role and aal on every request.
async function evaluateState(): Promise<OwnerAuthState> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { status: 'error', message: sessionError.message }

  const session = sessionData.session
  if (!session) return { status: 'signed_out' }

  const email = session.user.email ?? ''

  const { data: aalData, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalError) return { status: 'error', message: aalError.message }

  if (aalData?.currentLevel === 'aal2') return { status: 'ready', email }

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
  if (factorsError) return { status: 'error', message: factorsError.message }

  const hasVerifiedTotp = (factorsData?.all ?? []).some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  )

  return hasVerifiedTotp
    ? { status: 'needs_challenge', email }
    : { status: 'needs_enrollment', email }
}

export function OwnerAuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<OwnerAuthState>({ status: 'loading' })

  // Generation guard so a slower in-flight evaluation can never overwrite the
  // result of a newer one (e.g. an auth event firing during sign-in).
  const generationRef = useRef(0)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current
    let next: OwnerAuthState
    try {
      next = await evaluateState()
    } catch (error) {
      next = {
        status: 'error',
        message: error instanceof Error ? error.message : '인증 상태를 확인할 수 없습니다.',
      }
    }
    if (mountedRef.current && generation === generationRef.current) {
      setState(next)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })
    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [refresh])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const enrollTotp = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) throw error
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    }
  }, [])

  const verifyTotp = useCallback(
    async (factorId: string, code: string) => {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      })
      if (verifyError) throw verifyError

      await refresh()
    },
    [refresh],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await refresh()
  }, [refresh])

  const value: OwnerAuthValue = {
    state,
    signIn,
    enrollTotp,
    verifyTotp,
    signOut,
  }

  return <OwnerAuthContext.Provider value={value}>{children}</OwnerAuthContext.Provider>
}

export function useOwnerAuth(): OwnerAuthValue {
  const value = useContext(OwnerAuthContext)
  if (!value) {
    throw new Error('useOwnerAuth must be used within an OwnerAuthProvider')
  }
  return value
}
