import { useState } from 'react'
import { STORE_NAME } from '../lib/format'

const DEMO_PIN = '1234'

export default function OwnerLoginScreen({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const isFull = pin.length === 4

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isFull) return
    if (pin !== DEMO_PIN) {
      setError('PIN이 일치하지 않아요')
      setPin('')
      return
    }
    onLogin()
  }

  const handleChange = (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(next)
    if (error) setError('')
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-20 pt-6">
      <Hero />

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="text-center">
          <h2 className="font-display text-[22px] font-bold leading-tight text-coffee-900">
            사장님 로그인
          </h2>
          <p className="mt-1.5 text-sm text-coffee-600">
            매장에 설정된 4자리 PIN을 입력해주세요
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-white px-5 py-7 shadow-[var(--shadow-soft)]">
          <PinDisplay length={pin.length} />
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={handleChange}
            maxLength={4}
            autoFocus
            aria-label="PIN"
            className="mt-4 w-full bg-transparent text-center text-3xl font-bold tracking-[0.6em] tabular-nums text-coffee-900 placeholder:text-coffee-300 focus:outline-none"
            placeholder="••••"
          />
          {error && (
            <p className="mt-3 text-center text-xs font-semibold text-caramel-600">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!isFull}
          className={[
            'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-lg font-bold transition-all',
            isFull
              ? 'bg-coffee-900 text-cream-50 shadow-[var(--shadow-lift)] hover:bg-coffee-700 active:scale-[0.99]'
              : 'cursor-not-allowed bg-cream-200 text-coffee-400',
          ].join(' ')}
        >
          로그인
        </button>
      </form>

      <DemoHint onFill={() => setPin(DEMO_PIN)} />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative mt-2 overflow-hidden rounded-3xl bg-gradient-to-br from-coffee-700 to-coffee-900 p-7 text-center text-cream-100 shadow-[var(--shadow-lift)]">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-caramel-400/25 blur-2xl" aria-hidden />
      <div className="absolute -bottom-14 -left-12 h-40 w-40 rounded-full bg-caramel-500/15 blur-2xl" aria-hidden />

      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cream-100 text-3xl shadow-[0_4px_14px_-2px_rgba(0,0,0,0.25)]">
          🧑‍🍳
        </div>
        <div className="mt-3 font-display text-[22px] font-bold leading-tight text-cream-50">
          {STORE_NAME}
        </div>
        <div className="mt-0.5 text-xs tracking-wide text-cream-200/80">
          사장님 모드
        </div>
      </div>
    </section>
  )
}

function PinDisplay({ length }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2, 3].map((i) => {
        const filled = i < length
        return (
          <div
            key={i}
            className={[
              'h-4 w-4 rounded-full transition-all',
              filled ? 'bg-caramel-500 shadow-[0_2px_6px_-1px_rgba(217,115,56,0.6)] scale-110' : 'bg-cream-300',
            ].join(' ')}
            aria-hidden
          />
        )
      })}
    </div>
  )
}

function DemoHint({ onFill }) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-coffee-900/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coffee-700">
          DEMO
        </span>
        <span className="text-[11px] text-coffee-600">
          데모 PIN으로 바로 로그인하기
        </span>
      </div>
      <button
        type="button"
        onClick={onFill}
        className="mt-2.5 flex w-full items-center justify-between rounded-xl border border-cream-300 bg-white px-4 py-3 text-left transition-all hover:border-caramel-400 hover:shadow-[var(--shadow-soft)] active:scale-[0.99]"
      >
        <div className="leading-tight">
          <div className="text-[11px] font-semibold text-coffee-600">데모 PIN</div>
          <div className="mt-0.5 text-base font-bold tracking-[0.3em] tabular-nums text-coffee-900">
            1234
          </div>
        </div>
        <span className="text-xs font-semibold text-caramel-600">자동 입력 →</span>
      </button>
    </section>
  )
}
