import { useState } from 'react'
import { STORE_NAME, STORE_TAGLINE, demoChips } from '../lib/data'
import { formatPhone, isValidPhone, onlyDigits } from '../lib/format'
import Logo from '../ui/Logo'

interface CustomerLandingScreenProps {
  onSubmit: (phone: string) => void
}

export default function CustomerLandingScreen({ onSubmit }: CustomerLandingScreenProps) {
  const [phone, setPhone] = useState('')
  const valid = isValidPhone(phone)

  const submit = () => {
    if (valid) onSubmit(onlyDigits(phone))
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
        <label htmlFor="cust-phone" className="text-[12.5px] font-extrabold tracking-wide text-ink-soft">
          전화번호
        </label>
        <input
          id="cust-phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-0000-0000"
          autoFocus
          className="mt-2.5 w-full rounded-[14px] border-[1.5px] border-line bg-pale-soft px-4 py-[15px] text-center text-[21px] font-bold tracking-wide tabular-nums text-ink outline-none transition-colors focus:border-brand"
        />
        <button
          type="submit"
          disabled={!valid}
          className={[
            'mt-3.5 w-full rounded-[14px] py-[15px] text-[15.5px] font-extrabold transition active:scale-[0.99]',
            valid
              ? 'bg-ink text-white shadow-[0_12px_24px_-12px_rgba(36,27,18,.5)]'
              : 'cursor-not-allowed bg-[#e7dcc8] text-[#b4a48e]',
          ].join(' ')}
        >
          내 포인트 보기
        </button>
      </form>

      <section className="mt-6">
        <div className="text-center text-[11px] font-extrabold tracking-[0.14em] text-ink-soft">
          DEMO 빠른 입력
        </div>
        <div className="mt-3 flex flex-col gap-[9px]">
          {demoChips.map((chip) => {
            const isRegular = chip.tag === '단골'
            return (
              <button
                key={chip.phone}
                type="button"
                onClick={() => setPhone(formatPhone(chip.phone))}
                className="flex w-full items-center justify-between rounded-[14px] border border-line bg-card px-4 py-[13px] text-left transition hover:border-brand hover:bg-pale-soft"
              >
                <span className="text-[15px] font-bold tracking-wide tabular-nums">
                  {formatPhone(chip.phone)}
                </span>
                <span
                  className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                    isRegular ? 'bg-pale text-brand-dark' : 'bg-leaf-bg text-leaf',
                  ].join(' ')}
                >
                  {chip.tag}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
