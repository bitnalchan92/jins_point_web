import { useMemo, useState } from 'react'

const POINT_RATE = 0.05
const STORE_NAME = '진의 카페'

const initialHistory = [
  { id: 1, phone: '010-2345-7788', amount: 5400, point: 270, when: '5분 전', isNew: false },
  { id: 2, phone: '010-9821-4412', amount: 14000, point: 700, when: '12분 전', isNew: true },
  { id: 3, phone: '010-3344-1290', amount: 8200, point: 410, when: '38분 전', isNew: false },
]

const knownCustomers = new Set([
  '01023457788',
  '01033441290',
  '01088884444',
  '01077771234',
])

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function formatAmount(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 7)
  if (!d) return ''
  return Number(d).toLocaleString('ko-KR')
}

function maskPhone(phone) {
  const d = phone.replace(/\D/g, '')
  if (d.length < 8) return phone
  return `${d.slice(0, 3)}-****-${d.slice(7)}`
}

export default function App() {
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [history, setHistory] = useState(initialHistory)
  const [toast, setToast] = useState(null)

  const phoneDigits = phone.replace(/\D/g, '')
  const amountNumber = Number(amount.replace(/\D/g, '')) || 0
  const previewPoint = Math.floor(amountNumber * POINT_RATE)

  const phoneOk = phoneDigits.length === 10 || phoneDigits.length === 11
  const amountOk = amountNumber >= 1000
  const canSubmit = phoneOk && amountOk

  const isNewCustomer = useMemo(
    () => phoneOk && !knownCustomers.has(phoneDigits),
    [phoneDigits, phoneOk],
  )

  const handleSubmit = () => {
    if (!canSubmit) return
    const entry = {
      id: Date.now(),
      phone: formatPhone(phone),
      amount: amountNumber,
      point: previewPoint,
      when: '방금',
      isNew: isNewCustomer,
    }
    setHistory([entry, ...history].slice(0, 6))
    setToast({ point: previewPoint, isNew: isNewCustomer })
    setPhone('')
    setAmount('')
    setTimeout(() => setToast(null), 2400)
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-md px-5 pb-32 pt-6">
        <Header />

        <main className="mt-6">
          <h1 className="font-display text-[28px] font-bold leading-tight text-coffee-900">
            포인트 적립
          </h1>
          <p className="mt-1 text-sm text-coffee-600">
            손님의 전화번호와 결제 금액을 입력해주세요
          </p>

          <div className="mt-6 space-y-3">
            <Field label="전화번호" hint={phoneOk ? '확인됨' : ''}>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-1234-5678"
                className="w-full bg-transparent text-xl font-semibold tracking-wide text-coffee-900 placeholder:font-normal placeholder:text-coffee-400 focus:outline-none"
              />
            </Field>

            <Field label="결제 금액" hint={amountOk ? '확인됨' : '1,000원 이상'}>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold text-coffee-600">₩</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatAmount(e.target.value))}
                  placeholder="12,500"
                  className="w-full bg-transparent text-xl font-semibold tracking-wide text-coffee-900 placeholder:font-normal placeholder:text-coffee-400 focus:outline-none"
                />
              </div>
            </Field>
          </div>

          <PreviewCard
            point={previewPoint}
            ready={canSubmit}
            isNew={isNewCustomer && phoneOk}
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'mt-5 w-full rounded-2xl py-5 text-lg font-bold transition-all',
              canSubmit
                ? 'bg-caramel-500 text-white shadow-[var(--shadow-lift)] hover:bg-caramel-600 active:scale-[0.99]'
                : 'cursor-not-allowed bg-cream-200 text-coffee-400',
            ].join(' ')}
          >
            {canSubmit ? '☕ 포인트 적립하기' : '정보를 입력해주세요'}
          </button>

          <RecentList history={history} />
        </main>
      </div>

      {toast && <SuccessToast point={toast.point} isNew={toast.isNew} />}
    </div>
  )
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-coffee-900 text-cream-100">
          <span className="text-base">☕</span>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-coffee-900">{STORE_NAME}</div>
          <div className="text-[11px] text-coffee-600">사장님 모드</div>
        </div>
      </div>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full bg-white text-coffee-600 shadow-[var(--shadow-soft)]"
        aria-label="설정"
      >
        ⚙
      </button>
    </header>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block rounded-2xl bg-white px-5 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-coffee-600">
          {label}
        </span>
        {hint && (
          <span className="text-[11px] font-medium text-leaf-500">{hint}</span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function PreviewCard({ point, ready, isNew }) {
  return (
    <div
      className={[
        'mt-5 rounded-2xl border p-5 transition-all',
        ready
          ? 'border-caramel-400/40 bg-gradient-to-br from-caramel-400/10 to-cream-200/60'
          : 'border-cream-300 bg-cream-50',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-sm font-medium text-coffee-700">
            적립될 포인트
          </span>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-coffee-600">
          적립률 {POINT_RATE * 100}%
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span
            className={[
              'font-display font-bold tabular-nums transition-all',
              ready ? 'text-5xl text-caramel-600' : 'text-5xl text-coffee-400',
            ].join(' ')}
          >
            {point.toLocaleString('ko-KR')}
          </span>
          <span
            className={[
              'text-xl font-bold',
              ready ? 'text-caramel-600' : 'text-coffee-400',
            ].join(' ')}
          >
            P
          </span>
        </div>

        {isNew && (
          <span className="rounded-full bg-leaf-500/15 px-2.5 py-1 text-[11px] font-semibold text-leaf-500">
            🌱 신규 손님
          </span>
        )}
      </div>
    </div>
  )
}

function RecentList({ history }) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-coffee-900">최근 적립</h2>
        <button type="button" className="text-xs text-coffee-600 underline-offset-2 hover:underline">
          전체 보기
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {history.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-soft)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-coffee-900 tabular-nums">
                  {maskPhone(h.phone)}
                </span>
                {h.isNew && (
                  <span className="rounded-full bg-leaf-500/15 px-1.5 py-0.5 text-[9px] font-bold text-leaf-500">
                    NEW
                  </span>
                )}
              </div>
              <div className="text-[11px] text-coffee-600">
                {h.amount.toLocaleString('ko-KR')}원 · {h.when}
              </div>
            </div>
            <div className="text-sm font-bold tabular-nums text-caramel-600">
              +{h.point.toLocaleString('ko-KR')}P
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SuccessToast({ point, isNew }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 grid place-items-center px-5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-coffee-900 px-5 py-4 text-cream-100 shadow-[var(--shadow-lift)] animate-[toast_2.4s_ease]">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-caramel-500 text-xl">
          ☕
        </div>
        <div className="leading-tight">
          <div className="text-[11px] uppercase tracking-wide text-cream-200/70">
            {isNew ? '신규 손님 첫 적립' : '적립 완료'}
          </div>
          <div className="text-base font-bold">
            +{point.toLocaleString('ko-KR')}P
          </div>
        </div>
      </div>

      <style>{`
        @keyframes toast {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          85% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(10px) scale(0.98); }
        }
      `}</style>
    </div>
  )
}
