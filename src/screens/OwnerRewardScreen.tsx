import { useRef, useState } from 'react'
import type { OwnerBootstrap, OwnerCustomer } from '../lib/contracts'
import { comma, onlyDigits } from '../lib/format'
import { displayKoreanPhone } from '../lib/phone'
import { OwnerApiError } from '../owner/ownerApi'
import { useOwnerStore } from '../owner/OwnerStoreProvider'
import type { OwnerStoreValue } from '../owner/OwnerStoreProvider'
import Keypad, { numericKeys } from '../ui/Keypad'
import Toast from '../ui/Toast'
import type { ToastConfig } from '../ui/Toast'
import { OwnerLoading, OwnerRetry } from './ownerShared'

type RewardMode = 'earn' | 'use'
type RewardStep = 'search' | 'select' | 'amount'

interface SearchStepProps {
  suffix: string
  onKey: (value: string) => void
  onSearch: () => void
  mode: RewardMode
}

interface SelectStepProps {
  matches: OwnerCustomer[]
  onSelect: (customer: OwnerCustomer) => void
  onBack: () => void
  suffix: string
}

interface AmountStepProps {
  mode: RewardMode
  resolved: OwnerCustomer
  amountNumber: number
  earn: number
  notEnough: boolean | null
  notUnitValid: boolean
  rate: number
  redeemUnit: number
  onKey: (value: string) => void
  onEarnChip: (delta: number) => void
  onUseChip: (delta: number) => void
  onBack: () => void
}

interface PreviewCardProps {
  mode: RewardMode
  step: RewardStep
  resolved: OwnerCustomer | null
  amountNumber: number
  earn: number
  notEnough: boolean | null
  notUnitValid: boolean
  rate: number
}

const EARN_CHIPS = [
  { label: '+1,000', delta: 1000 },
  { label: '+5,000', delta: 5000 },
  { label: '전체삭제', delta: 0 },
]

const USE_CHIPS = [
  { label: '+1,000P', delta: 1000 },
  { label: '+3,000P', delta: 3000 },
  { label: '전체삭제', delta: 0 },
]

function errorToast(code: OwnerApiError['code']): ToastConfig {
  switch (code) {
    case 'IDEMPOTENCY_CONFLICT':
      return { icon: '⚠️', title: '이미 처리된 요청이에요', sub: '잠시 후 다시 시도해 주세요' }
    case 'UNPROCESSABLE':
      return {
        icon: '⚠️',
        title: '처리할 수 없는 요청이에요',
        sub: '포인트 잔액과 사용 단위를 확인해 주세요',
      }
    case 'UNAUTHORIZED':
      return { icon: '🔒', title: '세션이 만료되었어요', sub: '다시 로그인해 주세요' }
    default:
      return { icon: '⚠️', title: '처리하지 못했어요', sub: '잠시 후 다시 시도해 주세요' }
  }
}

function rewardTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function OwnerRewardScreen() {
  const { state, refresh, applyReward } = useOwnerStore()
  if (state.status === 'loading') return <OwnerLoading />
  if (state.status === 'error' || !state.data) return <OwnerRetry onRetry={() => void refresh()} />
  return <RewardScreen data={state.data} applyReward={applyReward} />
}

// 단계: 'search' → 손님 4자리 입력, 'select' → 복수 매칭 선택, 'amount' → 금액 입력
function RewardScreen({
  data,
  applyReward,
}: {
  data: OwnerBootstrap
  applyReward: OwnerStoreValue['applyReward']
}) {
  const customers = data.customers
  const rate = data.store.rewardRate
  const redeemUnit = data.store.redeemUnit
  const recentRewards = data.recentRewards

  const [mode, setMode] = useState<RewardMode>('earn')
  const [step, setStep] = useState<RewardStep>('search')
  const [suffix, setSuffix] = useState('')
  const [matches, setMatches] = useState<OwnerCustomer[]>([])
  const [resolved, setResolved] = useState<OwnerCustomer | null>(null)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const amountNumber = Number(amount) || 0
  const earn = Math.floor(amountNumber * rate)
  const notEnough = mode === 'use' && resolved && amountNumber > 0 && amountNumber > resolved.points
  const notUnitValid = mode === 'use' && amountNumber > 0 && amountNumber % redeemUnit !== 0
  const canSubmit =
    step === 'amount' &&
    !!resolved &&
    amountNumber > 0 &&
    !notUnitValid &&
    (mode === 'earn' || !notEnough)

  const onSuffixKey = (value: string) => {
    setSuffix((s) => {
      if (value === 'back') return s.slice(0, -1)
      if (s.length >= 4) return s
      return s + value
    })
  }

  // 휴대폰 뒷자리 4자리로 검색 (E.164 끝자리 비교)
  const searchBySuffix = () => {
    const clean = onlyDigits(suffix)
    if (clean.length !== 4) return
    const found = customers.filter((c) => c.phoneE164.endsWith(clean))
    setMatches(found)
    if (found.length === 1) {
      setResolved(found[0]!)
      setStep('amount')
    } else {
      setStep('select')
    }
  }

  const selectCustomer = (customer: OwnerCustomer) => {
    setResolved(customer)
    setStep('amount')
  }

  const onAmountKey = (value: string) => {
    setAmount((a) => {
      const next = value === 'back' ? a.slice(0, -1) : value === '00' ? `${a}00` : a + value
      return next.replace(/^0+/, '').slice(0, 7)
    })
  }

  const onEarnChip = (delta: number) => {
    if (delta === 0) return setAmount('')
    setAmount((a) => String(Math.min(9999999, (Number(a) || 0) + delta)))
  }

  const onUseChip = (delta: number) => {
    if (delta === 0) return setAmount('')
    setAmount((a) => String(Math.min(resolved?.points ?? 9999999, (Number(a) || 0) + delta)))
  }

  const showToast = (config: ToastConfig) => {
    setToast(config)
    clearTimeout(timer.current!)
    timer.current = setTimeout(() => setToast(null), 2600)
  }

  const resetAll = () => {
    setSuffix('')
    setMatches([])
    setResolved(null)
    setAmount('')
    setStep('search')
  }

  const switchMode = (next: RewardMode) => {
    if (next === mode) return
    setMode(next)
    resetAll()
  }

  // 서버가 확정한 pointsDelta/balanceAfter만 표시한다. 클라이언트 계산값(earn)은
  // 입력 중 미리보기 문구에만 쓰고, 결과 토스트에는 절대 사용하지 않는다.
  const submit = async () => {
    if (!resolved || submitting) return
    setSubmitting(true)
    const idempotencyKey = crypto.randomUUID()
    try {
      const result = await applyReward(resolved.id, mode, amountNumber, idempotencyKey)
      if (mode === 'earn') {
        showToast({
          icon: '🍙',
          title: `${resolved.name} · +${comma(result.pointsDelta)}P 적립 완료`,
          sub: `잔여 포인트 ${comma(result.balanceAfter)}P`,
        })
      } else {
        showToast({
          icon: '🎁',
          title: `${resolved.name} · ${comma(result.pointsDelta)}P 사용 완료`,
          sub: `잔여 포인트 ${comma(result.balanceAfter)}P`,
        })
      }
      resetAll()
    } catch (error) {
      const code = error instanceof OwnerApiError ? error.code : 'INTERNAL'
      showToast(errorToast(code))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-[18px] animate-fade">
      {/* 모드 토글 */}
      <div className="mb-4 inline-flex rounded-[14px] border border-line bg-[#f5eedd] p-[5px]">
        <button
          type="button"
          onClick={() => switchMode('earn')}
          className={[
            'rounded-[10px] px-5 py-[9px] text-[14px] font-extrabold transition',
            mode === 'earn' ? 'bg-brand text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          🍙 적립
        </button>
        <button
          type="button"
          onClick={() => switchMode('use')}
          className={[
            'rounded-[10px] px-5 py-[9px] text-[14px] font-extrabold transition',
            mode === 'use' ? 'bg-brand text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
          ].join(' ')}
        >
          🎁 사용
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-[18px]">
        {/* 입력 패널 */}
        <div className="flex-[1_1_360px] rounded-[22px] border border-line bg-card p-6 shadow-[var(--shadow-card)]">
          {step === 'search' && (
            <SearchStep suffix={suffix} onKey={onSuffixKey} onSearch={searchBySuffix} mode={mode} />
          )}

          {step === 'select' && (
            <SelectStep matches={matches} onSelect={selectCustomer} onBack={resetAll} suffix={suffix} />
          )}

          {step === 'amount' && resolved && (
            <AmountStep
              mode={mode}
              resolved={resolved}
              amountNumber={amountNumber}
              earn={earn}
              notEnough={notEnough}
              notUnitValid={notUnitValid}
              rate={rate}
              redeemUnit={redeemUnit}
              onKey={onAmountKey}
              onEarnChip={onEarnChip}
              onUseChip={onUseChip}
              onBack={resetAll}
            />
          )}
        </div>

        {/* 미리보기 + 제출 + 최근 내역 */}
        <div className="flex flex-[1_1_320px] flex-col gap-3.5">
          <PreviewCard
            mode={mode}
            step={step}
            resolved={resolved}
            amountNumber={amountNumber}
            earn={earn}
            notEnough={notEnough}
            notUnitValid={notUnitValid}
            rate={rate}
          />

          {step === 'amount' && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || submitting}
              className={[
                'w-full rounded-2xl py-[17px] text-base font-extrabold transition',
                canSubmit && !submitting
                  ? mode === 'use'
                    ? 'bg-danger text-white shadow-[0_12px_24px_-12px_rgba(216,85,58,.45)]'
                    : 'bg-ink text-white shadow-[0_12px_24px_-12px_rgba(36,27,18,.5)]'
                  : 'cursor-not-allowed bg-[#e7dcc8] text-[#b4a48e]',
              ].join(' ')}
            >
              {submitting ? '처리 중…' : mode === 'earn' ? '포인트 적립하기' : '포인트 사용하기'}
            </button>
          )}

          <div className="rounded-[18px] border border-line bg-card px-[18px] py-4">
            <div className="mb-1.5 text-[12.5px] font-extrabold text-ink-soft">최근 내역</div>
            {recentRewards.length === 0 && (
              <div className="py-2 text-center text-[12px] text-ink-soft">아직 내역이 없어요</div>
            )}
            {recentRewards.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-t border-line py-[9px] first:border-t-0"
              >
                <div>
                  <div className="text-[13.5px] font-bold">{r.customerName}</div>
                  <div className="text-[11px] font-semibold text-ink-soft">{rewardTime(r.createdAt)}</div>
                </div>
                <div
                  className={[
                    'text-sm font-extrabold',
                    r.type === 'use' ? 'text-danger' : 'text-leaf',
                  ].join(' ')}
                >
                  {r.pointsDelta > 0 ? '+' : ''}
                  {comma(r.pointsDelta)}P
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <Toast icon={toast.icon} title={toast.title} sub={toast.sub} />}
    </div>
  )
}

// ── STEP 1: 4자리 뒷번호 검색 ────────────────────────────────────────
function SearchStep({ suffix, onKey, onSearch, mode }: SearchStepProps) {
  const digits = onlyDigits(suffix)
  const filled = digits.length === 4

  return (
    <>
      <h2 className="mb-[18px] text-[19px] font-extrabold tracking-tight">
        {mode === 'earn' ? '포인트 적립' : '포인트 사용'}
      </h2>

      <div className="mb-2 text-[12.5px] font-extrabold text-ink-soft">휴대폰 뒷자리 4자리</div>
      <div className="flex items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-line bg-pale-soft px-6 py-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              'h-4 w-4 rounded-full transition',
              i < digits.length ? 'bg-ink' : 'bg-[#d8c9b0]',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="mt-3">
        <Keypad keys={numericKeys} onPress={onKey} />
      </div>

      <button
        type="button"
        onClick={onSearch}
        disabled={!filled}
        className={[
          'mt-4 w-full rounded-2xl py-[15px] text-base font-extrabold transition',
          filled
            ? 'bg-ink text-white shadow-[0_12px_24px_-12px_rgba(36,27,18,.5)]'
            : 'cursor-not-allowed bg-[#e7dcc8] text-[#b4a48e]',
        ].join(' ')}
      >
        손님 조회
      </button>
    </>
  )
}

// ── STEP 2: 복수 매칭 선택 ───────────────────────────────────────────
function SelectStep({ matches, onSelect, onBack, suffix }: SelectStepProps) {
  return (
    <>
      <div className="mb-[18px] flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] px-3 py-1.5 text-sm font-extrabold text-ink-soft hover:bg-pale"
        >
          ← 다시
        </button>
        <h2 className="text-[19px] font-extrabold tracking-tight">손님 선택</h2>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="text-[40px]">🔍</div>
          <div className="text-[14px] font-bold text-ink-soft">
            뒷번호 {suffix}인 손님을 찾을 수 없어요
          </div>
          <button
            type="button"
            onClick={onBack}
            className="mt-1 rounded-[11px] border border-line px-5 py-2.5 text-sm font-extrabold hover:bg-pale"
          >
            다시 입력
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="mb-1 text-[12.5px] font-extrabold text-ink-soft">
            뒷번호 {suffix} — {matches.length}명 매칭
          </div>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="flex w-full items-center justify-between rounded-[16px] border border-line bg-pale-soft px-5 py-4 text-left transition hover:border-brand hover:bg-pale"
            >
              <div>
                <div className="text-[16px] font-extrabold">{c.name}</div>
                <div className="mt-0.5 text-[12px] font-semibold text-ink-soft">
                  {displayKoreanPhone(c.phoneE164)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-extrabold text-brand-dark">{comma(c.points)}P</div>
                <div className="text-[11px] font-semibold text-ink-soft">{c.visits}회 방문</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── STEP 3: 금액 입력 ────────────────────────────────────────────────
function AmountStep({
  mode,
  resolved,
  amountNumber,
  earn,
  notEnough,
  notUnitValid,
  rate,
  redeemUnit,
  onKey,
  onEarnChip,
  onUseChip,
  onBack,
}: AmountStepProps) {
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] px-3 py-1.5 text-sm font-extrabold text-ink-soft hover:bg-pale"
        >
          ← 다시
        </button>
        <span className="text-[18px] font-extrabold">{resolved.name}</span>
      </div>

      {mode === 'use' ? (
        <div className="mb-4 flex items-center justify-between rounded-[14px] bg-[linear-gradient(135deg,var(--color-brand),var(--color-brand-dark))] px-5 py-3.5">
          <span className="text-[13px] font-extrabold text-ink/70">보유 포인트</span>
          <span className="text-[22px] font-extrabold tabular-nums text-ink">
            {comma(resolved.points)} P
          </span>
        </div>
      ) : (
        <div className="mb-3 text-[12px] font-semibold text-ink-soft">보유 {comma(resolved.points)}P</div>
      )}

      <div className="block text-[12.5px] font-extrabold text-ink-soft">
        {mode === 'earn' ? '결제 금액' : '사용할 포인트'}
      </div>
      <div className="mt-2.5 flex min-h-[56px] items-baseline justify-end gap-1 rounded-[14px] border-[1.5px] border-line bg-pale-soft px-[18px] py-3.5">
        <span
          className="text-[30px] font-extrabold tracking-tight tabular-nums"
          style={{ color: amountNumber > 0 ? 'var(--color-ink)' : '#cdbc9f' }}
        >
          {amountNumber > 0 ? comma(amountNumber) : '0'}
        </span>
        <span className="text-lg font-extrabold text-ink-soft">{mode === 'earn' ? '원' : 'P'}</span>
      </div>

      <div className="mt-2.5 flex gap-2">
        {(mode === 'earn' ? EARN_CHIPS : USE_CHIPS).map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => (mode === 'earn' ? onEarnChip(q.delta) : onUseChip(q.delta))}
            className="flex-1 rounded-[11px] border border-line bg-pale-soft py-[9px] text-[13px] font-extrabold text-brand-dark transition hover:bg-pale"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <Keypad keys={numericKeys} onPress={onKey} />
      </div>

      {mode === 'earn' && amountNumber > 0 && (
        <div className="mt-3 rounded-[12px] bg-pale px-4 py-2.5 text-[13px] font-extrabold text-brand-dark">
          적립 예정: +{comma(earn)}P ({(rate * 100).toFixed(1)}% 적용) · 최종 적립은 서버 확정
        </div>
      )}
      {mode === 'use' && !notEnough && !notUnitValid && (
        <div className="mt-3 rounded-[12px] bg-pale px-4 py-2.5 text-[12.5px] font-bold text-ink-soft">
          {comma(redeemUnit)}P 단위로만 사용 가능해요
        </div>
      )}
      {notUnitValid && (
        <div className="mt-3 rounded-[12px] bg-[#fdeae5] px-4 py-2.5 text-[13px] font-extrabold text-danger">
          ⚠️ {comma(redeemUnit)}P 단위로 입력해주세요
        </div>
      )}
      {notEnough && (
        <div className="mt-3 rounded-[12px] bg-[#fdeae5] px-4 py-2.5 text-[13px] font-extrabold text-danger">
          ⚠️ 포인트가 부족해요 (최대 {comma(resolved.points)}P)
        </div>
      )}
    </>
  )
}

function PreviewCard({
  mode,
  step,
  resolved,
  amountNumber,
  earn,
  notEnough,
  notUnitValid,
  rate,
}: PreviewCardProps) {
  if (!resolved) {
    return (
      <div className="flex min-h-[188px] flex-col items-center justify-center rounded-[22px] bg-[linear-gradient(158deg,var(--color-brand),var(--color-brand-dark))] p-6 text-center opacity-80 shadow-[var(--shadow-lift)]">
        <div className="text-[38px]">{mode === 'earn' ? '🧾' : '🎁'}</div>
        <div className="mt-2 text-sm font-bold leading-relaxed">
          {step === 'search'
            ? '휴대폰 뒷자리 4자리를 입력하면\n손님 정보가 표시됩니다'
            : '손님을 선택해주세요'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[188px] flex-col justify-center rounded-[22px] bg-[linear-gradient(158deg,var(--color-brand),var(--color-brand-dark))] p-6 shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-2.5">
        <div className="text-[17px] font-extrabold">{resolved.name}</div>
        <span className="rounded-full bg-ink/15 px-[11px] py-1 text-[11.5px] font-extrabold text-ink">
          단골
        </span>
      </div>
      <div className="mt-0.5 text-[12.5px] font-bold opacity-80">
        보유 {comma(resolved.points)}P · {resolved.visits}회 방문
      </div>

      <div className="mt-[18px] rounded-2xl bg-white/30 px-[18px] py-3.5">
        {mode === 'earn' ? (
          amountNumber > 0 ? (
            <>
              <div className="text-[12.5px] font-extrabold opacity-85">
                적립 예정 포인트 ({(rate * 100).toFixed(1)}% 적용)
              </div>
              <div className="mt-0.5 flex items-end gap-0.5">
                <span className="text-[38px] font-extrabold leading-none tracking-tight tabular-nums">
                  +{comma(earn)}
                </span>
                <span className="pb-1 text-lg font-extrabold">P</span>
              </div>
            </>
          ) : (
            <div className="text-[12.5px] font-extrabold opacity-85">결제 금액을 입력해주세요</div>
          )
        ) : notEnough ? (
          <>
            <div className="text-[12.5px] font-extrabold opacity-85">⚠️ 포인트가 부족해요</div>
            <div className="mt-0.5 text-sm font-bold opacity-70">
              최대 {comma(resolved.points)}P 사용 가능
            </div>
          </>
        ) : notUnitValid ? (
          <>
            <div className="text-[12.5px] font-extrabold opacity-85">⚠️ 단위를 확인해주세요</div>
            <div className="mt-0.5 text-sm font-bold opacity-70">현재 {comma(amountNumber)}P 입력됨</div>
          </>
        ) : amountNumber > 0 ? (
          <>
            <div className="text-[12.5px] font-extrabold opacity-85">사용 후 잔여 포인트</div>
            <div className="mt-0.5 flex items-end gap-0.5">
              <span className="text-[38px] font-extrabold leading-none tracking-tight tabular-nums">
                {comma(resolved.points - amountNumber)}
              </span>
              <span className="pb-1 text-lg font-extrabold">P</span>
            </div>
          </>
        ) : (
          <div className="text-[12.5px] font-extrabold opacity-85">사용할 포인트를 입력해주세요</div>
        )}
      </div>
    </div>
  )
}
