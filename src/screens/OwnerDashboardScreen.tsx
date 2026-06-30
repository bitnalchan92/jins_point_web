import { useState } from 'react'
import type { OwnerBootstrap } from '../lib/contracts'
import { comma } from '../lib/format'
import { useOwnerStore } from '../owner/OwnerStoreProvider'
import type { OwnerStoreValue } from '../owner/OwnerStoreProvider'
import { OwnerLoading, OwnerRetry } from './ownerShared'

interface OwnerDashboardScreenProps {
  onLogout: () => void
}

interface KpiCardProps {
  icon: string
  label: string
  value: string
  tone: 'brand' | 'leaf'
}

interface InfoRowProps {
  label: string
  value: string
}

interface RateRowProps {
  rate: number
  onSave: (rate: number) => Promise<void>
}

export default function OwnerDashboardScreen({ onLogout }: OwnerDashboardScreenProps) {
  const { state, refresh, updateRate } = useOwnerStore()
  if (state.status === 'loading') return <OwnerLoading />
  if (state.status === 'error' || !state.data)
    return <OwnerRetry onRetry={() => void refresh()} />
  return (
    <DashboardScreen data={state.data} updateRate={updateRate} onLogout={onLogout} />
  )
}

function DashboardScreen({
  data,
  updateRate,
  onLogout,
}: {
  data: OwnerBootstrap
  updateRate: OwnerStoreValue['updateRate']
  onLogout: () => void
}) {
  const { customers, recentRewards, store } = data

  const todayEarn = recentRewards.filter((r) => r.type === 'earn').length
  const totalPoints = customers.reduce((sum, c) => sum + c.points, 0)
  const top = [...customers].sort((a, b) => b.points - a.points).slice(0, 3)

  return (
    <div className="mt-[18px] animate-fade">
      {/* KPI 3개 */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        <KpiCard icon="☕" label="최근 적립" value={`${todayEarn}건`} tone="brand" />
        <KpiCard icon="👥" label="손님 수" value={`${customers.length}명`} tone="brand" />
        <KpiCard icon="⭐" label="총 사용가능 포인트" value={`${comma(totalPoints)}P`} tone="leaf" />
      </div>

      {/* 가게 정보 + 단골 TOP 3 */}
      <div className="mt-3.5 flex flex-wrap items-stretch gap-3.5">
        <div className="flex-[2_1_340px] rounded-[20px] border border-line bg-card px-6 py-[22px] shadow-[var(--shadow-soft)]">
          <h3 className="mb-4 text-base font-extrabold">가게 정보</h3>
          <div className="flex flex-col gap-3">
            <InfoRow label="가게명" value={store.name} />
            <InfoRow label="업종" value={store.tagline} />
            <RateRow rate={store.rewardRate} onSave={updateRate} />
            <InfoRow label="무료 메뉴 기준" value={`${comma(store.rewardThreshold)}P`} />
            <InfoRow label="누적 단골" value={`${customers.length}명`} />
          </div>
        </div>

        <div className="flex-[1_1_240px] rounded-[20px] border border-line bg-card px-6 py-[22px] shadow-[var(--shadow-soft)]">
          <h3 className="mb-4 text-base font-extrabold">단골 TOP 3</h3>
          {top.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-ink-soft">아직 손님이 없어요</div>
          ) : (
            <div className="flex flex-col gap-4">
              {top.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div
                    className={[
                      'grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] text-sm font-extrabold',
                      i === 0 ? 'bg-brand text-ink' : 'bg-pale-soft text-ink-soft',
                    ].join(' ')}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-extrabold">{c.name}</div>
                    <div className="text-[11.5px] font-semibold text-ink-soft">{c.visits}회 방문</div>
                  </div>
                  <div className="text-[15px] font-extrabold text-brand-dark">{comma(c.points)}P</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 로그아웃 */}
      <div className="mt-3.5">
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-[18px] border-[1.5px] border-[#f0c5bc] bg-[#fff5f3] py-[18px] text-[15px] font-extrabold text-danger shadow-[0_6px_18px_-10px_rgba(216,85,58,.25)] transition hover:bg-[#fdeae5] hover:shadow-[0_8px_22px_-10px_rgba(216,85,58,.35)]"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  return (
    <div className="rounded-[18px] border border-line bg-card px-[22px] py-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2.5">
        <div
          className={[
            'grid h-[34px] w-[34px] place-items-center rounded-[10px] text-[17px]',
            tone === 'leaf' ? 'bg-leaf-bg' : 'bg-pale',
          ].join(' ')}
        >
          {icon}
        </div>
        <span className="text-[13px] font-extrabold text-ink-soft">{label}</span>
      </div>
      <div className="mt-2.5 text-[30px] font-extrabold tracking-tight tabular-nums">{value}</div>
    </div>
  )
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between border-t border-line pt-3 text-sm first:border-t-0 first:pt-0">
      <span className="font-bold text-ink-soft">{label}</span>
      <span className="font-extrabold">{value}</span>
    </div>
  )
}

function RateRow({ rate, onSave }: RateRowProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setInput(String((rate * 100).toFixed(1)))
    setEditing(true)
  }

  const save = async () => {
    if (saving) return
    const pct = parseFloat(input)
    if (!isNaN(pct) && pct > 0 && pct <= 100) {
      setSaving(true)
      try {
        await onSave(parseFloat((pct / 100).toFixed(4)))
        setEditing(false)
      } catch {
        // Leave the editor open so the owner can retry the save.
      } finally {
        setSaving(false)
      }
    } else {
      setEditing(false)
    }
  }

  const cancel = () => setEditing(false)

  if (!editing) {
    return (
      <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="font-bold text-ink-soft">적립률</span>
        <div className="flex items-center gap-2">
          <span className="font-extrabold">결제금액의 {(rate * 100).toFixed(1)}%</span>
          <button
            type="button"
            onClick={startEdit}
            className="rounded-[6px] border border-line px-2 py-0.5 text-[11px] font-extrabold text-ink-soft transition hover:border-brand hover:text-brand-dark"
          >
            수정
          </button>
        </div>
      </div>
    )
  }

  const pct = parseFloat(input)
  const valid = !isNaN(pct) && pct > 0 && pct <= 100

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
      <span className="font-bold text-ink-soft">적립률</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') cancel()
          }}
          min="0.1"
          max="100"
          step="0.1"
          autoFocus
          className="w-[64px] rounded-[8px] border border-brand bg-pale-soft px-2 py-1 text-right text-sm font-extrabold tabular-nums outline-none"
        />
        <span className="font-extrabold">%</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || saving}
          className="rounded-[8px] bg-brand px-2.5 py-1 text-[12px] font-extrabold text-ink transition disabled:opacity-40"
        >
          {saving ? '저장 중' : '저장'}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-[12px] font-bold text-ink-soft hover:text-ink"
        >
          취소
        </button>
      </div>
    </div>
  )
}
