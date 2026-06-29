import { useState } from 'react'
import { OWNER_PIN, STORE_NAME } from '../lib/data'
import Logo from '../ui/Logo'
import Keypad, { pinKeys } from '../ui/Keypad'

interface OwnerLoginScreenProps {
  onLogin: () => void
}

export default function OwnerLoginScreen({ onLogin }: OwnerLoginScreenProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const press = (value: string) => {
    setError(false)
    if (value === 'back') return setPin((p) => p.slice(0, -1))
    if (value === 'clear') return setPin('')
    setPin((p) => (p.length >= 4 ? p : p + value))
  }

  const submit = () => {
    if (pin === OWNER_PIN) onLogin()
    else {
      setError(true)
      setPin('')
    }
  }

  const full = pin.length === 4

  return (
    <div className="flex justify-center px-4 py-[30px]">
      <div className="w-full max-w-[400px] animate-fade">
        <div className="mb-[22px] text-center">
          <Logo size="lg" emoji="🧑‍🍳" className="inline-grid" />
          <h1 className="mb-1 mt-4 text-[23px] font-extrabold tracking-tight">사장님 로그인</h1>
          <p className="text-[13.5px] font-semibold text-ink-soft">{STORE_NAME} · 포인트 관리</p>
        </div>

        <div
          className={[
            'rounded-[24px] border border-line bg-card px-6 py-[26px] shadow-[var(--shadow-card)]',
            error && 'animate-shake',
          ].join(' ')}
        >
          <div className="text-center text-[12.5px] font-extrabold text-ink-soft">
            4자리 PIN을 입력하세요
          </div>
          <div className="my-[18px] flex justify-center gap-[13px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={[
                  'h-[15px] w-[15px] rounded-full border-2 transition-all',
                  i < pin.length ? 'border-brand-dark bg-brand-dark' : 'border-line bg-transparent',
                ].join(' ')}
              />
            ))}
          </div>
          {error && (
            <div className="mb-1 text-center text-[12.5px] font-bold text-danger">
              PIN이 올바르지 않아요. 다시 입력해 주세요.
            </div>
          )}

          <div className="mt-[18px]">
            <Keypad keys={pinKeys} onPress={press} />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!full}
            className={[
              'mt-4 w-full rounded-[14px] py-[15px] text-[15.5px] font-extrabold transition',
              full ? 'bg-ink text-white' : 'cursor-default bg-[#e7dcc8] text-[#b4a48e]',
            ].join(' ')}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setError(false)
              setPin(OWNER_PIN)
            }}
            className="mx-auto mt-3.5 block rounded-full border border-line bg-pale-soft px-4 py-2 text-xs font-bold text-brand-dark transition hover:bg-pale"
          >
            DEMO · PIN 1234 자동 입력
          </button>
        </div>
      </div>
    </div>
  )
}
