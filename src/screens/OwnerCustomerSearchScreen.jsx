import { useMemo, useState } from 'react'
import { STORE_NAME, formatPhone, maskPhone } from '../lib/format'

const allCustomers = [
  { phone: '010-2345-7788', balance: 3420, totalSpent: 68400, visits: 14, lastVisit: '오늘' },
  { phone: '010-8888-4444', balance: 8120, totalSpent: 162400, visits: 32, lastVisit: '어제' },
  { phone: '010-3344-1290', balance: 1850, totalSpent: 37000, visits: 8, lastVisit: '3일 전' },
  { phone: '010-7777-1234', balance: 5200, totalSpent: 104000, visits: 21, lastVisit: '5일 전' },
  { phone: '010-9821-4412', balance: 700, totalSpent: 14000, visits: 1, lastVisit: '오늘', isNew: true },
  { phone: '010-1212-3434', balance: 12400, totalSpent: 248000, visits: 47, lastVisit: '2주 전' },
]

export default function OwnerCustomerSearchScreen() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const queryDigits = query.replace(/\D/g, '')

  const filtered = useMemo(() => {
    if (!queryDigits) {
      return [...allCustomers].sort((a, b) => b.balance - a.balance)
    }
    return allCustomers.filter((c) =>
      c.phone.replace(/\D/g, '').includes(queryDigits),
    )
  }, [queryDigits])

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-6">
      <Header />

      <main className="mt-6">
        <h1 className="font-display text-[28px] font-bold leading-tight text-coffee-900">
          손님 조회
        </h1>
        <p className="mt-1 text-sm text-coffee-600">
          전화번호를 입력해서 손님을 찾아보세요
        </p>

        <label className="mt-5 block rounded-2xl bg-white px-5 py-3 shadow-[var(--shadow-soft)]">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-coffee-600">
              검색
            </span>
            {queryDigits && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[11px] font-medium text-coffee-600 underline-offset-2 hover:underline"
              >
                지우기
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-base text-coffee-600">🔍</span>
            <input
              type="tel"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(formatPhone(e.target.value))}
              placeholder="010-1234-5678"
              className="w-full bg-transparent text-lg font-semibold tracking-wide text-coffee-900 placeholder:font-normal placeholder:text-coffee-400 focus:outline-none"
            />
          </div>
        </label>

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-coffee-900">
            {queryDigits ? `검색 결과 ${filtered.length}건` : '단골 손님'}
          </h2>
          {!queryDigits && (
            <span className="text-[11px] text-coffee-600">잔액 높은 순</span>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <ul className="mt-3 space-y-2">
            {filtered.map((c) => (
              <CustomerCard
                key={c.phone}
                customer={c}
                isOpen={selected === c.phone}
                onToggle={() =>
                  setSelected(selected === c.phone ? null : c.phone)
                }
              />
            ))}
          </ul>
        )}
      </main>
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
    </header>
  )
}

function CustomerCard({ customer, isOpen, onToggle }) {
  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-soft)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tabular-nums text-coffee-900">
              {maskPhone(customer.phone)}
            </span>
            {customer.isNew && (
              <span className="rounded-full bg-leaf-500/15 px-1.5 py-0.5 text-[9px] font-bold text-leaf-500">
                NEW
              </span>
            )}
          </div>
          <div className="text-[11px] text-coffee-600">
            방문 {customer.visits}회 · 마지막 {customer.lastVisit}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-caramel-600">
            {customer.balance.toLocaleString('ko-KR')}P
          </div>
          <div className="text-[10px] text-coffee-600">
            {isOpen ? '접기 ▲' : '상세 ▼'}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-cream-300 bg-cream-50/60 px-4 py-3">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="현재 포인트" value={`${customer.balance.toLocaleString('ko-KR')}P`} />
            <Stat label="누적 결제" value={`${(customer.totalSpent / 10000).toFixed(1)}만원`} />
            <Stat label="방문 횟수" value={`${customer.visits}회`} />
          </dl>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl bg-coffee-900 px-3 py-2.5 text-xs font-bold text-cream-50 transition-all hover:bg-coffee-700 active:scale-[0.98]"
            >
              ☕ 적립하기
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-coffee-700 ring-1 ring-cream-300 transition-all hover:bg-cream-50 active:scale-[0.98]"
            >
              🎁 포인트 사용
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-coffee-600">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold tabular-nums text-coffee-900">
        {value}
      </div>
    </div>
  )
}

function EmptyState({ query }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-cream-300 bg-cream-50 px-5 py-10 text-center">
      <div className="text-3xl">🔍</div>
      <div className="mt-2 text-sm font-semibold text-coffee-900">
        일치하는 손님이 없어요
      </div>
      <div className="mt-1 text-[12px] text-coffee-600">
        "{query}" 번호로 등록된 손님을 찾지 못했어요.
        <br />
        새 손님은 적립 화면에서 자동 등록돼요.
      </div>
    </div>
  )
}
