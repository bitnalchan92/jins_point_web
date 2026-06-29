import type { BalanceResponse } from '../lib/contracts'
import { comma } from '../lib/format'
import Logo from '../ui/Logo'

interface CustomerPointScreenProps {
  balance: BalanceResponse
  onChangePhone: () => void
}

function formatAsOf(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export default function CustomerPointScreen({ balance, onChangePhone }: CustomerPointScreenProps) {
  const reached = balance.pointsToNextReward === 0

  return (
    <div className="animate-fade">
      <div className="flex items-center justify-between px-[22px] pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">{balance.storeName}</div>
            <div className="text-[11.5px] font-semibold text-ink-soft">포인트 조회</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onChangePhone}
          title="다른 번호 조회"
          aria-label="다른 번호 조회"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl border border-line bg-card text-base text-ink-soft transition hover:border-brand"
        >
          ↻
        </button>
      </div>

      <div className="px-[22px] pb-[30px] pt-3.5">
        {/* 포인트 히어로 — 잔액만 표시 */}
        <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(158deg,var(--color-brand)_0%,var(--color-brand-dark)_100%)] px-6 pb-6 pt-[26px] shadow-[var(--shadow-lift)]">
          <div
            className="absolute -right-[30px] -top-[30px] h-[130px] w-[130px] rounded-full bg-white/20"
            aria-hidden
          />
          <div className="relative">
            <span className="text-[13px] font-bold opacity-75">사용 가능 포인트</span>
            <div className="mt-0.5 flex items-end gap-1">
              <span className="animate-pop text-[52px] font-extrabold leading-[0.95] tracking-tighter tabular-nums">
                {comma(balance.points)}
              </span>
              <span className="pb-1.5 text-2xl font-extrabold">P</span>
            </div>
          </div>
        </div>

        {/* 다음 혜택 안내 */}
        <div className="mt-4 rounded-[20px] border border-line bg-card p-[22px]">
          {reached ? (
            <div className="text-center">
              <div className="text-[15px] font-extrabold text-brand-dark">
                🎁 무료 혜택을 받을 수 있어요
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                {comma(balance.rewardThreshold)}P 기준을 달성했어요.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-[13px] font-bold text-ink-soft">다음 혜택까지</div>
              <div className="mt-1 flex items-end justify-center gap-1">
                <span className="text-[28px] font-extrabold tabular-nums text-ink">
                  {comma(balance.pointsToNextReward)}
                </span>
                <span className="pb-1 text-base font-extrabold text-ink-soft">P</span>
              </div>
              <p className="mt-1.5 text-[12.5px] font-semibold text-ink-soft">
                혜택 기준 {comma(balance.rewardThreshold)}P
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-[11.5px] font-semibold text-ink-soft">
          기준 시각 {formatAsOf(balance.asOf)}
        </div>
      </div>
    </div>
  )
}
