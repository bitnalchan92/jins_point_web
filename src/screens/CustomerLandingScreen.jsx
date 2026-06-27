import { useState } from 'react'
import { STORE_NAME, formatPhone } from '../lib/format'

const SAMPLE_NUMBERS = [
  { label: '단골 손님', phone: '010-2345-7788', hint: '3,420P 보유' },
  { label: '신규 손님', phone: '010-5555-1111', hint: '첫 방문' },
]

export default function CustomerLandingScreen({ onSubmit }) {
  const [phone, setPhone] = useState('')
  const digits = phone.replace(/\D/g, '')
  const isValid = digits.length === 10 || digits.length === 11

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    onSubmit(formatPhone(phone))
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-20 pt-6">
      <Hero />

      <form onSubmit={handleSubmit} className="mt-7">
        <div className="text-center">
          <h2 className="font-display text-[22px] font-bold leading-tight text-coffee-900">
            안녕하세요!
          </h2>
          <p className="mt-1.5 text-sm text-coffee-600">
            전화번호를 입력하면 내 포인트를 바로 보여드려요
          </p>
        </div>

        <label className="mt-5 block rounded-2xl bg-white px-5 py-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-coffee-600">
              전화번호
            </span>
            {isValid && (
              <span className="text-[11px] font-medium text-leaf-500">확인됨</span>
            )}
          </div>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            autoFocus
            className="mt-1 w-full bg-transparent text-2xl font-bold tracking-wide text-coffee-900 placeholder:font-medium placeholder:text-coffee-400 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={!isValid}
          className={[
            'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-lg font-bold transition-all',
            isValid
              ? 'bg-caramel-500 text-white shadow-[var(--shadow-lift)] hover:bg-caramel-600 active:scale-[0.99]'
              : 'cursor-not-allowed bg-cream-200 text-coffee-400',
          ].join(' ')}
        >
          내 포인트 보기
          <span aria-hidden>→</span>
        </button>
      </form>

      <InfoCard />

      <DemoQuickFill onPick={(p) => setPhone(p)} />
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
          ☕
        </div>
        <div className="mt-3 font-display text-[26px] font-bold leading-tight text-cream-50">
          {STORE_NAME}
        </div>
        <div className="mt-0.5 text-xs tracking-wide text-cream-200/80">
          단골 포인트 적립
        </div>
      </div>
    </section>
  )
}

function InfoCard() {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-caramel-500/15 text-base">
        💡
      </div>
      <div className="text-[13px] leading-snug text-coffee-700">
        결제 금액의 <b className="text-coffee-900">5%</b>가 적립돼요.
        <br />
        <b className="text-caramel-600">5,000P</b>가 모이면 음료 한 잔 무료 ☕
      </div>
    </div>
  )
}

function DemoQuickFill({ onPick }) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-coffee-900/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coffee-700">
          DEMO
        </span>
        <span className="text-[11px] text-coffee-600">
          예시 번호로 빠르게 입력해보기
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {SAMPLE_NUMBERS.map((s) => (
          <button
            key={s.phone}
            type="button"
            onClick={() => onPick(s.phone)}
            className="flex flex-col items-start rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-left transition-all hover:border-caramel-400 hover:shadow-[var(--shadow-soft)] active:scale-[0.98]"
          >
            <span className="text-[11px] font-semibold text-coffee-600">
              {s.label}
            </span>
            <span className="mt-0.5 text-[13px] font-bold tabular-nums text-coffee-900">
              {s.phone}
            </span>
            <span className="text-[10px] text-coffee-600">{s.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
