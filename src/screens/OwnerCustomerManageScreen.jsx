import { useMemo, useRef, useState } from 'react'
import { REWARD_THRESHOLD } from '../lib/data'
import { comma, formatPhone, onlyDigits } from '../lib/format'
import { useStore } from '../store'
import Toast from '../ui/Toast'

export default function OwnerCustomerManageScreen() {
  const { customers, addCustomer } = useStore()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const showToast = (config) => {
    setToast(config)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2600)
  }

  const results = useMemo(() => {
    const q = query.trim()
    const qDigits = onlyDigits(q)
    const filtered = customers.filter((c) => {
      if (q === '') return true
      if (qDigits.length > 0 && c.phone.includes(qDigits)) return true
      if (c.name.includes(q)) return true
      return false
    })
    return [...filtered].sort((a, b) => b.points - a.points)
  }, [customers, query])

  return (
    <div className="mt-[18px] animate-fade">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2.5 rounded-[18px] border border-line bg-card px-2 py-1.5">
          <span className="pl-2.5 text-lg text-ink-soft">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 또는 전화번호로 검색"
            className="flex-1 bg-transparent px-2 py-3 text-base font-semibold outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className={[
            'flex-none rounded-[14px] px-5 py-[13px] text-[13.5px] font-extrabold transition',
            showAddForm
              ? 'bg-[#e7dcc8] text-ink-soft'
              : 'bg-ink text-white shadow-[0_10px_22px_-12px_rgba(36,27,18,.5)]',
          ].join(' ')}
        >
          {showAddForm ? '취소' : '+ 신규 손님'}
        </button>
      </div>

      {showAddForm && (
        <AddCustomerForm
          addCustomer={addCustomer}
          onDone={(name) => {
            setShowAddForm(false)
            showToast({ icon: '🌱', title: `${name} 님 등록 완료`, sub: '신규 손님으로 추가되었어요' })
          }}
        />
      )}

      <div className="mt-4 flex items-center justify-between px-1">
        <div className="text-sm font-extrabold">
          단골 손님 <span className="text-brand-dark">{results.length}</span>명
        </div>
        <div className="text-[11.5px] font-bold text-ink-soft">카드를 누르면 상세보기</div>
      </div>

      {results.length === 0 ? (
        <div className="px-5 py-[50px] text-center text-ink-soft">
          <div className="text-[40px]">🔍</div>
          <div className="mt-2.5 text-sm font-bold">"{query}"에 해당하는 손님이 없어요</div>
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

      {toast && <Toast icon={toast.icon} title={toast.title} sub={toast.sub} />}
    </div>
  )
}

function AddCustomerForm({ onDone, addCustomer }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef(null)

  const formatPhoneInput = (val) => {
    const d = onlyDigits(val).slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }

  const handleSubmit = () => {
    const trimName = name.trim()
    const digits = onlyDigits(phone)
    if (!trimName) return setError('이름을 입력해주세요')
    if (digits.length < 10) return setError('올바른 전화번호를 입력해주세요')

    const result = addCustomer(phone, trimName)
    if (!result.success) {
      if (result.error === 'duplicate') setError('이미 등록된 전화번호예요')
      else setError('올바른 전화번호를 입력해주세요')
      return
    }

    onDone(trimName)
  }

  return (
    <div className="mt-4 rounded-[20px] border border-brand bg-card p-5 shadow-[0_14px_30px_-18px_rgba(240,169,26,.4)]">
      <div className="mb-4 text-[15px] font-extrabold">신규 손님 등록</div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-extrabold text-ink-soft">이름</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder="홍길동"
            className="w-full rounded-[12px] border border-line bg-pale-soft px-4 py-3 text-[15px] font-bold outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-extrabold text-ink-soft">전화번호</label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setError('') }}
            placeholder="010-0000-0000"
            className="w-full rounded-[12px] border border-line bg-pale-soft px-4 py-3 text-[15px] font-bold tabular-nums outline-none focus:border-brand"
          />
        </div>

        {error && (
          <div className="rounded-[10px] bg-[#fdeae5] px-3.5 py-2.5 text-[12.5px] font-extrabold text-danger">
            ⚠️ {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-1 w-full rounded-[14px] bg-ink py-3.5 text-[14px] font-extrabold text-white transition hover:opacity-90"
        >
          등록하기
        </button>
      </div>
    </div>
  )
}

function CustomerCard({ customer, open, onToggle }) {
  const within = customer.points % REWARD_THRESHOLD
  const remain = within === 0 && customer.points > 0 ? 0 : REWARD_THRESHOLD - within

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
          {customer.history.length === 0 ? (
            <div className="py-2 text-[12px] text-ink-soft">내역이 없어요</div>
          ) : (
            customer.history.slice(0, 3).map((h, i) => (
              <div key={i} className="flex items-center justify-between border-t border-line py-[9px] first:border-t-0">
                <span className="text-[12.5px] font-semibold text-ink-soft">{h.date}</span>
                <span
                  className={[
                    'text-[13px] font-extrabold tabular-nums',
                    h.type === 'use' ? 'text-danger' : 'text-leaf',
                  ].join(' ')}
                >
                  {h.type === 'use' ? '' : '+'}
                  {comma(h.amount)}P
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
