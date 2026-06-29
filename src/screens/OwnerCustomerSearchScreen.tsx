import { useMemo, useState } from 'react'
import { REWARD_THRESHOLD } from '../lib/data'
import type { Customer } from '../lib/data'
import { comma, formatPhone, onlyDigits } from '../lib/format'
import { useStore } from '../store'

interface CustomerCardProps {
  customer: Customer
  open: boolean
  onToggle: () => void
}

export default function OwnerCustomerSearchScreen() {
  const { customers } = useStore()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const queryDigits = onlyDigits(query)

  const results = useMemo(() => {
    const filtered = customers.filter((c) => queryDigits === '' || c.phone.includes(queryDigits))
    return [...filtered].sort((a, b) => b.points - a.points)
  }, [customers, queryDigits])

  return (
    <div className="mt-[18px] animate-fade">
      <div className="flex max-w-[520px] items-center gap-2.5 rounded-[18px] border border-line bg-card px-2 py-1.5">
        <span className="pl-2.5 text-lg text-ink-soft">🔍</span>
        <input
          type="tel"
          inputMode="numeric"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="전화번호로 손님 검색"
          className="flex-1 bg-transparent px-2 py-3 text-base font-semibold outline-none"
        />
      </div>

      <div className="mt-4 flex items-center justify-between px-1">
        <div className="text-sm font-extrabold">
          단골 손님 <span className="text-brand-dark">{results.length}</span>명
        </div>
        <div className="text-[11.5px] font-bold text-ink-soft">카드를 누르면 상세보기</div>
      </div>

      {results.length === 0 ? (
        <div className="px-5 py-[50px] text-center text-ink-soft">
          <div className="text-[40px]">🔍</div>
          <div className="mt-2.5 text-sm font-bold">"{query}" 에 해당하는 손님이 없어요</div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {results.map((c) => (
            <CustomerCard
              key={c.phone}
              customer={c}
              open={expanded === c.phone}
              onToggle={() => setExpanded((e) => (e === c.phone ? null : c.phone))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerCard({ customer, open, onToggle }: CustomerCardProps) {
  const within = customer.points % REWARD_THRESHOLD
  const remain = within === 0 ? 0 : REWARD_THRESHOLD - within

  return (
    <div
      onClick={onToggle}
      className={[
        'cursor-pointer rounded-2xl border bg-card px-[18px] py-4 transition-all',
        open
          ? 'border-brand shadow-[0_14px_30px_-18px_rgba(240,169,26,.6)]'
          : 'border-line shadow-[var(--shadow-soft)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-[13px]">
        <div className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] bg-[linear-gradient(150deg,var(--color-brand),var(--color-brand-dark))] text-lg font-extrabold text-ink">
          {customer.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] font-extrabold">{customer.name}</div>
          <div className="text-xs font-semibold text-ink-soft">{formatPhone(customer.phone)}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold tracking-tight tabular-nums text-brand-dark">
            {comma(customer.points)}P
          </div>
          <div className="text-[11px] font-bold text-ink-soft">{customer.visits}회 방문</div>
        </div>
      </div>

      {open && (
        <div className="mt-3.5 border-t border-line pt-3.5">
          <div className="mb-3 flex gap-2.5">
            <div className="flex-1 rounded-xl bg-pale-soft px-3 py-2.5">
              <div className="text-[11px] font-bold text-ink-soft">무료 메뉴까지</div>
              <div className="mt-0.5 text-[15px] font-extrabold tabular-nums">{comma(remain)}P</div>
            </div>
            <div className="flex-1 rounded-xl bg-pale-soft px-3 py-2.5">
              <div className="text-[11px] font-bold text-ink-soft">최근 방문</div>
              <div className="mt-0.5 text-[15px] font-extrabold">{customer.lastVisit}</div>
            </div>
          </div>
          <div className="mb-1.5 text-[11.5px] font-extrabold text-ink-soft">최근 내역</div>
          {customer.history.slice(0, 3).map((h, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-[13px] font-semibold">
                {h.label} · <span className="text-ink-soft">{h.date}</span>
              </span>
              <span
                className={['text-[13px] font-extrabold tabular-nums', h.amount > 0 ? 'text-ink' : 'text-leaf'].join(
                  ' ',
                )}
              >
                {h.amount > 0 ? '+' : ''}
                {comma(h.amount)}P
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
