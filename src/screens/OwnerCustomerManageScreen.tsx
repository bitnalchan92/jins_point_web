import { useMemo, useRef, useState } from 'react'
import type { OwnerBootstrap, OwnerCustomer } from '../lib/contracts'
import { comma, onlyDigits } from '../lib/format'
import { displayKoreanPhone } from '../lib/phone'
import { OwnerApiError } from '../owner/ownerApi'
import { useOwnerStore } from '../owner/OwnerStoreProvider'
import type { OwnerStoreValue } from '../owner/OwnerStoreProvider'
import Toast from '../ui/Toast'
import type { ToastConfig } from '../ui/Toast'
import { OwnerLoading, OwnerRetry } from './ownerShared'

interface AddCustomerFormProps {
  onDone: (name: string) => void
  addCustomer: OwnerStoreValue['addCustomer']
}

interface CustomerCardProps {
  customer: OwnerCustomer
  rewardThreshold: number
  open: boolean
  onToggle: () => void
}

export default function OwnerCustomerManageScreen() {
  const { state, refresh, addCustomer } = useOwnerStore()
  if (state.status === 'loading') return <OwnerLoading />
  if (state.status === 'error' || !state.data) return <OwnerRetry onRetry={() => void refresh()} />
  return <CustomerManageScreen data={state.data} addCustomer={addCustomer} />
}

function CustomerManageScreen({
  data,
  addCustomer,
}: {
  data: OwnerBootstrap
  addCustomer: OwnerStoreValue['addCustomer']
}) {
  const customers = data.customers
  const rewardThreshold = data.store.rewardThreshold

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (config: ToastConfig) => {
    setToast(config)
    clearTimeout(timer.current!)
    timer.current = setTimeout(() => setToast(null), 2600)
  }

  const results = useMemo(() => {
    const q = query.trim()
    const qDigits = onlyDigits(q)
    const filtered = customers.filter((c) => {
      if (q === '') return true
      if (qDigits.length > 0 && c.phoneE164.includes(qDigits)) return true
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
              key={c.id}
              customer={c}
              rewardThreshold={rewardThreshold}
              open={expanded === c.id}
              onToggle={() => setExpanded((e) => (e === c.id ? null : c.id))}
            />
          ))}
        </div>
      )}

      {toast && <Toast icon={toast.icon} title={toast.title} sub={toast.sub} />}
    </div>
  )
}

function AddCustomerForm({ onDone, addCustomer }: AddCustomerFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const nameRef = useRef<HTMLInputElement | null>(null)

  const formatPhoneInput = (val: string) => {
    const d = onlyDigits(val).slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }

  const handleSubmit = async () => {
    if (pending) return
    const trimName = name.trim()
    const digits = onlyDigits(phone)
    if (!trimName) return setError('이름을 입력해주세요')
    if (digits.length < 10) return setError('올바른 전화번호를 입력해주세요')

    setError('')
    setPending(true)
    try {
      await addCustomer(phone, trimName)
      onDone(trimName)
    } catch (e) {
      const code = e instanceof OwnerApiError ? e.code : 'INTERNAL'
      if (code === 'DUPLICATE_CUSTOMER') setError('이미 등록된 전화번호예요')
      else if (code === 'INVALID_PHONE' || code === 'INVALID_REQUEST')
        setError('올바른 전화번호를 입력해주세요')
      else if (code === 'UNAUTHORIZED') setError('세션이 만료되었어요. 다시 로그인해 주세요')
      else setError('등록하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setPending(false)
    }
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
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
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
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value))
              setError('')
            }}
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
          onClick={() => void handleSubmit()}
          disabled={pending}
          className="mt-1 w-full rounded-[14px] bg-ink py-3.5 text-[14px] font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? '등록 중…' : '등록하기'}
        </button>
      </div>
    </div>
  )
}

function CustomerCard({ customer, rewardThreshold, open, onToggle }: CustomerCardProps) {
  const within = customer.points % rewardThreshold
  const remain = within === 0 && customer.points > 0 ? 0 : rewardThreshold - within
  const lastVisit = customer.lastVisitedAt
    ? new Date(customer.lastVisitedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '방문 기록 없음'

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
          <div className="text-xs font-semibold text-ink-soft">
            {displayKoreanPhone(customer.phoneE164)}
          </div>
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
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-xl bg-pale-soft px-3 py-2.5">
              <div className="text-[11px] font-bold text-ink-soft">무료 메뉴까지</div>
              <div className="mt-0.5 text-[15px] font-extrabold tabular-nums">{comma(remain)}P</div>
            </div>
            <div className="flex-1 rounded-xl bg-pale-soft px-3 py-2.5">
              <div className="text-[11px] font-bold text-ink-soft">최근 방문</div>
              <div className="mt-0.5 text-[15px] font-extrabold">{lastVisit}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
