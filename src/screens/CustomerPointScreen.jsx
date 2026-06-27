import { POINTS_PER_STAMP, REWARD_THRESHOLD, STORE_NAME, knownCustomers, maskPhone } from '../lib/format'

const knownCustomerData = {
  '01023457788': { balance: 3420, joinedAt: '2026년 3월' },
}

const recentEvents = [
  { id: 1, type: 'earn', point: 270, amount: 5400, when: '오늘' },
  { id: 2, type: 'earn', point: 410, amount: 8200, when: '6월 24일' },
  { id: 3, type: 'redeem', point: -5000, label: '아메리카노 무료 사용', when: '6월 18일' },
  { id: 4, type: 'earn', point: 350, amount: 7000, when: '6월 12일' },
  { id: 5, type: 'earn', point: 280, amount: 5600, when: '6월 5일' },
]

const TOTAL_STAMPS = REWARD_THRESHOLD / POINTS_PER_STAMP

export default function CustomerPointScreen({ phone = '010-2345-7788', onChangePhone }) {
  const digits = phone.replace(/\D/g, '')
  const data = knownCustomerData[digits]
  const isNewCustomer = !knownCustomers.has(digits)
  const balance = data?.balance ?? 0
  const joinedAt = data?.joinedAt ?? '오늘'
  const events = isNewCustomer ? [] : recentEvents

  const balanceInCycle = balance % REWARD_THRESHOLD
  const pointToNextReward = REWARD_THRESHOLD - balanceInCycle
  const filledStamps = Math.floor(balanceInCycle / POINTS_PER_STAMP)
  const partialFraction = (balanceInCycle % POINTS_PER_STAMP) / POINTS_PER_STAMP
  const progressPercent = (balanceInCycle / REWARD_THRESHOLD) * 100

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-6">
      <Header onChangePhone={onChangePhone} />

      <main className="mt-7">
        <div className="text-[13px] text-coffee-600">안녕하세요,</div>
        <h1 className="font-display text-[26px] font-bold leading-tight text-coffee-900">
          {maskPhone(phone)} 손님 <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-xs text-coffee-600">
          {isNewCustomer ? '오늘 처음 만나뵙네요. 환영합니다 🌱' : `${joinedAt}부터 함께해주셔서 감사합니다`}
        </p>

        <BalanceCard
          balance={balance}
          pointToNextReward={pointToNextReward}
          progressPercent={progressPercent}
          filledStamps={filledStamps}
          partialFraction={partialFraction}
        />

        <InfoCard />

        <HistoryList events={events} isNewCustomer={isNewCustomer} />
      </main>
    </div>
  )
}

function Header({ onChangePhone }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-coffee-900 text-cream-100">
          <span className="text-base">☕</span>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-coffee-900">{STORE_NAME}</div>
          <div className="text-[11px] text-coffee-600">내 포인트</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onChangePhone}
        className="grid h-9 w-9 place-items-center rounded-full bg-white text-coffee-600 shadow-[var(--shadow-soft)] transition-all hover:bg-cream-50 active:scale-95"
        aria-label="다른 번호로 조회"
      >
        ↻
      </button>
    </header>
  )
}

function BalanceCard({
  balance,
  pointToNextReward,
  progressPercent,
  filledStamps,
  partialFraction,
}) {
  return (
    <section
      className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-coffee-900 to-coffee-700 p-6 text-cream-100 shadow-[var(--shadow-lift)]"
      aria-label="내 포인트 카드"
    >
      <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-caramel-500/20 blur-2xl" aria-hidden />
      <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-caramel-400/10 blur-2xl" aria-hidden />

      <div className="relative">
        <div className="text-[11px] uppercase tracking-wider text-cream-200/70">
          내 포인트
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-6xl font-bold tabular-nums text-cream-50">
            {balance.toLocaleString('ko-KR')}
          </span>
          <span className="text-2xl font-bold text-caramel-400">P</span>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-cream-200/80">
              다음 무료 음료까지
            </span>
            <span className="font-semibold tabular-nums text-caramel-400">
              {pointToNextReward.toLocaleString('ko-KR')}P 남음
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream-100/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-caramel-400 to-caramel-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <StampRow filledStamps={filledStamps} partialFraction={partialFraction} />
      </div>
    </section>
  )
}

function StampRow({ filledStamps, partialFraction }) {
  return (
    <div className="mt-5">
      <div className="text-[11px] text-cream-200/70">
        도장 카드 · {filledStamps}/{TOTAL_STAMPS}개
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {Array.from({ length: TOTAL_STAMPS }).map((_, i) => {
          const isFilled = i < filledStamps
          const isPartial = i === filledStamps && partialFraction > 0

          return (
            <div
              key={i}
              className={[
                'relative grid aspect-square flex-1 place-items-center rounded-2xl border-2 text-lg transition-all',
                isFilled
                  ? 'border-caramel-400 bg-caramel-500 text-cream-50 shadow-[0_4px_12px_-2px_rgba(217,115,56,0.5)]'
                  : 'border-dashed border-cream-100/30 bg-cream-100/5 text-cream-100/30',
              ].join(' ')}
              aria-label={isFilled ? '도장 채워짐' : '도장 비어있음'}
            >
              {isPartial && (
                <div
                  className="absolute inset-0 rounded-2xl bg-caramel-500/30"
                  style={{ clipPath: `inset(${(1 - partialFraction) * 100}% 0 0 0)` }}
                  aria-hidden
                />
              )}
              <span className="relative">☕</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoCard() {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-caramel-500/15 text-base">
        💡
      </div>
      <div className="text-[13px] leading-snug text-coffee-700">
        결제 금액의 <b className="text-coffee-900">5%</b>가 포인트로 적립돼요.
        <br />
        <b className="text-caramel-600">5,000P</b>가 모이면 음료 한 잔을 무료로 드려요 ☕
      </div>
    </div>
  )
}

function HistoryList({ events, isNewCustomer }) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-coffee-900">최근 내역</h2>
        {events.length > 0 && (
          <button type="button" className="text-xs text-coffee-600 underline-offset-2 hover:underline">
            전체 보기
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-cream-300 bg-cream-50 px-5 py-8 text-center">
          <div className="text-2xl">🌱</div>
          <div className="mt-1.5 text-sm font-semibold text-coffee-900">
            {isNewCustomer ? '아직 적립 내역이 없어요' : '내역이 없어요'}
          </div>
          <div className="mt-1 text-[12px] text-coffee-600">
            카운터에서 첫 적립을 시작해보세요 ☕
          </div>
        </div>
      ) : (
      <ul className="mt-3 space-y-2">
        {events.map((e) => {
          const isEarn = e.type === 'earn'
          return (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-soft)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={[
                    'grid h-9 w-9 place-items-center rounded-full text-sm',
                    isEarn ? 'bg-caramel-500/10 text-caramel-600' : 'bg-coffee-900/8 text-coffee-700',
                  ].join(' ')}
                >
                  {isEarn ? '☕' : '🎁'}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold text-coffee-900">
                    {isEarn ? `${e.amount.toLocaleString('ko-KR')}원 결제` : e.label}
                  </div>
                  <div className="text-[11px] text-coffee-600">{e.when}</div>
                </div>
              </div>
              <div
                className={[
                  'text-sm font-bold tabular-nums',
                  isEarn ? 'text-caramel-600' : 'text-coffee-700',
                ].join(' ')}
              >
                {isEarn ? '+' : ''}
                {e.point.toLocaleString('ko-KR')}P
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
