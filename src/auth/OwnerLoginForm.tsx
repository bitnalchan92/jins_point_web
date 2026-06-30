import { useState } from 'react'
import type { FormEvent } from 'react'
import { STORE_NAME } from '../lib/data'
import Logo from '../ui/Logo'
import { useOwnerAuth } from './OwnerAuthProvider'

// Owner email + password sign-in. No public signup, no demo PIN, no auto-fill —
// production owners authenticate with real credentials and then a required TOTP
// second factor. Failures use one generic message so we never disclose whether
// an email exists or which field was wrong.
export default function OwnerLoginForm() {
  const { signIn } = useOwnerAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(false)
    try {
      await signIn(email.trim(), password)
      // On success the provider advances to the MFA step; this form unmounts.
    } catch {
      setError(true)
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex justify-center px-4 py-[30px]">
      <div className="w-full max-w-[400px] animate-fade">
        <div className="mb-[22px] text-center">
          <Logo size="lg" emoji="🧑‍🍳" className="inline-grid" />
          <h1 className="mb-1 mt-4 text-[23px] font-extrabold tracking-tight">사장님 로그인</h1>
          <p className="text-[13.5px] font-semibold text-ink-soft">{STORE_NAME} · 포인트 관리</p>
        </div>

        <form
          onSubmit={onSubmit}
          className={[
            'rounded-[24px] border border-line bg-card px-6 py-[26px] shadow-[var(--shadow-card)]',
            error && 'animate-shake',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <label htmlFor="owner-email" className="mb-1.5 block text-[12.5px] font-extrabold text-ink-soft">
            이메일
          </label>
          <input
            id="owner-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setError(false)
              setEmail(e.target.value)
            }}
            disabled={submitting}
            className="mb-4 w-full rounded-[14px] border border-line bg-pale-soft px-4 py-[13px] text-[15px] font-semibold outline-none focus:border-brand-dark disabled:opacity-60"
            placeholder="owner@example.com"
          />

          <label
            htmlFor="owner-password"
            className="mb-1.5 block text-[12.5px] font-extrabold text-ink-soft"
          >
            비밀번호
          </label>
          <input
            id="owner-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setError(false)
              setPassword(e.target.value)
            }}
            disabled={submitting}
            className="w-full rounded-[14px] border border-line bg-pale-soft px-4 py-[13px] text-[15px] font-semibold outline-none focus:border-brand-dark disabled:opacity-60"
            placeholder="••••••••"
          />

          {error && (
            <div className="mt-3.5 text-center text-[12.5px] font-bold text-danger">
              로그인에 실패했어요. 이메일과 비밀번호를 다시 확인해 주세요.
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
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
