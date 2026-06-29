import { useEffect, useState } from 'react'
import { STORE_NAME, STORE_TAGLINE } from '../lib/data'
import type { BalanceResponse } from '../lib/contracts'
import { formatPhone, isValidPhone } from '../lib/format'
import { useBalanceLookup } from '../customer/useBalanceLookup'
import TurnstileWidget from '../customer/TurnstileWidget'
import Logo from '../ui/Logo'

interface CustomerLandingScreenProps {
  onSuccess: (balance: BalanceResponse) => void
}

type ErrorCode = 'INVALID_REQUEST' | 'RATE_LIMITED' | 'UNAVAILABLE'

const ERROR_COPY: Record<ErrorCode, { title: string; body: string }> = {
  INVALID_REQUEST: {
    title: '조회할 수 없어요',
    body: '전화번호를 다시 확인한 뒤 시도해 주세요.',
  },
  RATE_LIMITED: {
    title: '잠시 후 다시 시도해 주세요',
    body: '조회 요청이 많아 잠시 제한되었어요. 잠시 후 다시 시도해 주세요.',
  },
  UNAVAILABLE: {
    title: '일시적으로 연결이 어려워요',
    body: '서비스 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
  },
}

export default function CustomerLandingScreen({ onSuccess }: CustomerLandingScreenProps) {
  const { state, lookup, reset } = useBalanceLookup()
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState<string | null>(null)
  // Bumping this remounts the Turnstile widget to force a fresh, single-use token.
  const [widgetKey, setWidgetKey] = useState(0)

  const validPhone = isValidPhone(phone)
  const loading = state.status === 'loading'
  const error = state.status === 'error' ? state.code : null
  const canSubmit = validPhone && token !== null && !loading

  useEffect(() => {
    if (state.status === 'success') {
      onSuccess(state.data)
    }
  }, [state, onSuccess])

  const submit = () => {
    if (!canSubmit || token === null) return
    void lookup(phone, token)
  }

  // Editing the number invalidates a captured single-use token and clears any
  // previous error/result so each phone number starts a clean lookup.
  const handlePhoneChange = (raw: string) => {
    setPhone(formatPhone(raw))
    if (token !== null) {
      setToken(null)
      setWidgetKey((key) => key + 1)
    }
    if (state.status !== 'idle') reset()
  }

  const handleRetry = () => {
    reset()
    setToken(null)
    setWidgetKey((key) => key + 1)
  }

  return (
    <div className="animate-fade px-6 pb-9 pt-[30px]">
      <header className="flex flex-col items-center px-0 pb-[26px] pt-[18px] text-center">
        <Logo size="xl" />
        <div className="mt-[18px] text-[13px] font-bold tracking-wide text-brand-dark">
          {STORE_TAGLINE}
        </div>
        <h1 className="mt-1.5 text-[27px] font-extrabold tracking-tight">{STORE_NAME}</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="rounded-[22px] border border-line bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <label
          htmlFor="cust-phone"
          className="text-[12.5px] font-extrabold tracking-wide text-ink-soft"
        >
          전화번호
        </label>
        <input
          id="cust-phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="010-0000-0000"
          autoFocus
          disabled={loading}
          className="mt-2.5 w-full rounded-[14px] border-[1.5px] border-line bg-pale-soft px-4 py-[15px] text-center text-[21px] font-bold tracking-wide tabular-nums text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
        />

        <div className="mt-3.5 flex justify-center">
          <TurnstileWidget
            key={widgetKey}
            onToken={setToken}
            onExpire={() => setToken(null)}
            onError={() => setToken(null)}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={loading}
          className={[
            'mt-3.5 w-full rounded-[14px] py-[15px] text-[15.5px] font-extrabold transition active:scale-[0.99]',
            canSubmit
              ? 'bg-ink text-white shadow-[0_12px_24px_-12px_rgba(36,27,18,.5)]'
              : 'cursor-not-allowed bg-[#e7dcc8] text-[#b4a48e]',
          ].join(' ')}
        >
          {loading ? '조회 중…' : '내 포인트 보기'}
        </button>

        {loading && (
          <div
            role="status"
            className="mt-3 text-center text-[12.5px] font-bold text-ink-soft"
          >
            포인트를 불러오는 중이에요…
          </div>
        )}
      </form>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-[18px] border border-danger/30 bg-danger/5 p-[18px] text-center"
        >
          <div className="text-[14px] font-extrabold text-danger">{ERROR_COPY[error].title}</div>
          <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-ink-soft">
            {ERROR_COPY[error].body}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3.5 rounded-full border border-line bg-card px-5 py-2 text-[13px] font-extrabold text-ink transition hover:border-brand"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}
