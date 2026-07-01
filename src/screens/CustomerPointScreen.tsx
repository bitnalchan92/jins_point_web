import type { BalanceResponse, HistoryItem } from '../lib/contracts'
import { comma } from '../lib/format'
import Logo from '../ui/Logo'

interface CustomerPointScreenProps {
  balance: BalanceResponse
  onChangePhone: () => void
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function formatAsOf(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function NaverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.27 12.96L7.5 0H0v24h7.73V11.04L16.5 24H24V0h-7.73z"/>
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const isEarn = item.type === 'earn'
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className={[
          'rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
          isEarn ? 'bg-leaf-bg text-leaf' : 'bg-pale text-brand-dark',
        ].join(' ')}>
          {isEarn ? '적립' : '사용'}
        </span>
        <span className={[
          'text-[15px] font-extrabold tabular-nums',
          isEarn ? 'text-leaf' : 'text-brand-dark',
        ].join(' ')}>
          {isEarn ? '+' : '-'}{comma(item.amount)}P
        </span>
      </div>
      <div className="text-right">
        <div className="text-[11.5px] font-bold text-ink-soft">{formatHistoryDate(item.createdAt)}</div>
        <div className="text-[11px] font-semibold text-ink-soft/70">잔액 {comma(item.pointsAfter)}P</div>
      </div>
    </div>
  )
}

export default function CustomerPointScreen({ balance, onChangePhone }: CustomerPointScreenProps) {
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
          title="다른 번호로 조회"
          aria-label="다른 번호로 조회"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl border border-line bg-card text-ink-soft transition hover:border-brand"
        >
          <LogoutIcon />
        </button>
      </div>

      <div className="px-[22px] pb-[30px] pt-3.5">
        {/* 포인트 히어로 */}
        <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(158deg,var(--color-brand)_0%,var(--color-brand-dark)_100%)] px-6 pb-6 pt-[22px] shadow-[var(--shadow-lift)]">
          <div className="absolute -right-[30px] -top-[30px] h-[130px] w-[130px] rounded-full bg-white/20" aria-hidden />
          <div className="relative">
            {balance.maskedName && (
              <div className="mb-2 text-[13.5px] font-extrabold text-white/90">
                {balance.maskedName}님 안녕하세요! 👋
              </div>
            )}
            <span className="text-[13px] font-bold opacity-75">사용 가능 포인트</span>
            <div className="mt-0.5 flex items-end gap-1">
              <span className="animate-pop text-[52px] font-extrabold leading-[0.95] tracking-tighter tabular-nums">
                {comma(balance.points)}
              </span>
              <span className="pb-1.5 text-2xl font-extrabold">P</span>
            </div>
          </div>
        </div>

        {/* 소셜 링크 */}
        <div className="mt-4 flex gap-3">
          <a
            href="https://www.instagram.com/dalcomjins.official/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-[16px] border border-line bg-card py-3.5 text-[13px] font-extrabold text-ink transition hover:border-brand active:scale-[0.98]"
          >
            <InstagramIcon />
            인스타그램
          </a>
          <a
            href="https://naver.me/FK53SYrR"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-[16px] border border-line bg-card py-3.5 text-[13px] font-extrabold text-ink transition hover:border-brand active:scale-[0.98]"
          >
            <NaverIcon />
            네이버 플레이스
          </a>
        </div>

        {/* 적립 이력 */}
        {balance.history.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-[20px] border border-line bg-card">
            <div className="px-5 pb-1 pt-4 text-[12px] font-extrabold text-ink-soft">적립 이력</div>
            <div className="divide-y divide-line">
              {balance.history.map((item, i) => (
                <HistoryRow key={i} item={item} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-[11.5px] font-semibold text-ink-soft">
          기준 시각 {formatAsOf(balance.asOf)}
        </div>
      </div>
    </div>
  )
}
