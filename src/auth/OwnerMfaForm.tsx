import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { STORE_NAME } from '../lib/data'
import { supabase } from '../lib/supabase'
import Logo from '../ui/Logo'
import { useOwnerAuth } from './OwnerAuthProvider'

type MfaMode = 'needs_enrollment' | 'needs_challenge'

interface OwnerMfaFormProps {
  mode: MfaMode
}

interface Enrollment {
  factorId: string
  qrCode: string
  secret: string
}

type VerifyErrorKind = 'wrong_code' | 'expired' | 'network' | 'unknown'

// Distinguish the failure classes the spec calls out so the operator gets an
// actionable message instead of a generic error.
function classifyVerifyError(error: unknown): VerifyErrorKind {
  if (isAuthRetryableFetchError(error)) return 'network'
  if (isAuthApiError(error)) {
    const code = error.code
    if (code === 'mfa_verification_failed' || code === 'mfa_verification_rejected') {
      return 'wrong_code'
    }
    if (
      code === 'mfa_challenge_expired' ||
      code === 'session_expired' ||
      code === 'session_not_found' ||
      code === 'bad_jwt'
    ) {
      return 'expired'
    }
    return 'unknown'
  }
  return 'unknown'
}

const VERIFY_MESSAGES: Record<VerifyErrorKind, string> = {
  wrong_code: '인증 코드가 올바르지 않아요. 앱의 최신 6자리 코드를 입력해 주세요.',
  expired: '인증 세션이 만료됐어요. 다시 로그인해 주세요.',
  network: '네트워크 오류로 인증을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  unknown: '인증에 실패했어요. 잠시 후 다시 시도해 주세요.',
}

// Supabase returns the QR as raw SVG markup; turn it into an inline data URI.
function qrDataUri(svg: string): string {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`
}

export default function OwnerMfaForm({ mode }: OwnerMfaFormProps) {
  const { enrollTotp, verifyTotp, signOut } = useOwnerAuth()

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verifyError, setVerifyError] = useState<VerifyErrorKind | null>(null)

  // Guard against React StrictMode double-invoking the effect, which would
  // otherwise enroll two factors / issue two lookups.
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    let active = true

    async function setup() {
      try {
        if (mode === 'needs_enrollment') {
          const result = await enrollTotp()
          if (!active) return
          setEnrollment(result)
          setFactorId(result.factorId)
        } else {
          // Already-enrolled owner: find the verified TOTP factor to challenge.
          const { data, error } = await supabase.auth.mfa.listFactors()
          if (error) throw error
          const verified = (data?.all ?? []).find(
            (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
          )
          if (!active) return
          if (!verified) {
            setSetupError('등록된 인증 수단을 찾지 못했어요. 다시 로그인해 주세요.')
            return
          }
          setFactorId(verified.id)
        }
      } catch {
        if (!active) return
        setSetupError('MFA 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    }

    void setup()
    return () => {
      active = false
    }
  }, [mode, enrollTotp])

  const canSubmit = code.length === 6 && factorId !== null && !submitting

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !factorId) return
    setSubmitting(true)
    setVerifyError(null)
    try {
      await verifyTotp(factorId, code)
      // The provider re-reads auth state; once aal2 the gate renders the app and
      // this form unmounts. Nothing else to do here.
    } catch (error) {
      setVerifyError(classifyVerifyError(error))
      setCode('')
      setSubmitting(false)
    }
  }

  const heading = mode === 'needs_enrollment' ? '인증 앱 등록' : '인증 코드 입력'
  const subtitle =
    mode === 'needs_enrollment'
      ? '인증 앱으로 QR을 스캔한 뒤 6자리 코드를 입력하세요.'
      : '인증 앱에 표시된 6자리 코드를 입력하세요.'

  return (
    <div className="flex justify-center px-4 py-[30px]">
      <div className="w-full max-w-[400px] animate-fade">
        <div className="mb-[22px] text-center">
          <Logo size="lg" emoji="🔐" className="inline-grid" />
          <h1 className="mb-1 mt-4 text-[23px] font-extrabold tracking-tight">{heading}</h1>
          <p className="text-[13.5px] font-semibold text-ink-soft">{STORE_NAME} · 2단계 인증</p>
        </div>

        <form
          onSubmit={onSubmit}
          className={[
            'rounded-[24px] border border-line bg-card px-6 py-[26px] shadow-[var(--shadow-card)]',
            verifyError && 'animate-shake',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <p className="mb-4 text-center text-[12.5px] font-extrabold text-ink-soft">{subtitle}</p>

          {setupError && (
            <div className="mb-4 text-center text-[12.5px] font-bold text-danger">{setupError}</div>
          )}

          {mode === 'needs_enrollment' && enrollment && (
            <div className="mb-5 flex flex-col items-center gap-3">
              <img
                src={qrDataUri(enrollment.qrCode)}
                alt="인증 앱 등록용 QR 코드"
                className="h-44 w-44 rounded-[14px] border border-line bg-white p-2"
              />
              <div className="w-full rounded-[12px] border border-line bg-pale-soft px-3 py-2.5 text-center">
                <div className="text-[11px] font-bold text-ink-soft">QR을 못 쓰면 이 키를 직접 입력</div>
                <code className="mt-1 block break-all font-mono text-[13px] font-bold tracking-wide text-ink">
                  {enrollment.secret}
                </code>
              </div>
            </div>
          )}

          <label htmlFor="totp-code" className="mb-1.5 block text-[12.5px] font-extrabold text-ink-soft">
            인증 코드
          </label>
          <input
            id="totp-code"
            name="one-time-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setVerifyError(null)
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }}
            disabled={submitting}
            placeholder="000000"
            className="w-full rounded-[14px] border border-line bg-pale-soft px-4 py-[13px] text-center font-mono text-[22px] font-extrabold tracking-[0.4em] outline-none focus:border-brand-dark disabled:opacity-60"
          />

          {verifyError && (
            <div className="mt-3.5 text-center text-[12.5px] font-bold text-danger">
              {VERIFY_MESSAGES[verifyError]}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              'mt-[18px] w-full rounded-[14px] py-[15px] text-[15.5px] font-extrabold transition',
              canSubmit ? 'bg-ink text-white' : 'cursor-default bg-[#e7dcc8] text-[#b4a48e]',
            ].join(' ')}
          >
            {submitting ? '확인 중…' : '인증하기'}
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mx-auto mt-3.5 block rounded-full border border-line bg-pale-soft px-4 py-2 text-xs font-bold text-brand-dark transition hover:bg-pale"
          >
            다른 계정으로 로그인
          </button>
        </form>
      </div>
    </div>
  )
}
