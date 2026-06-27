import { POINT_RATE, STORE_NAME, maskPhone } from '../lib/format'

const todayStats = {
  rewardCount: 18,
  pointGiven: 4280,
  revenue: 85600,
}

const weeklyTrend = [
  { day: '월', revenue: 62000 },
  { day: '화', revenue: 71000 },
  { day: '수', revenue: 54000 },
  { day: '목', revenue: 88000 },
  { day: '금', revenue: 92000 },
  { day: '토', revenue: 124000 },
  { day: '일', revenue: 85600, isToday: true },
]

const topCustomers = [
  { phone: '010-1212-3434', balance: 12400, visits: 47 },
  { phone: '010-8888-4444', balance: 8120, visits: 32 },
  { phone: '010-7777-1234', balance: 5200, visits: 21 },
]

export default function OwnerDashboardScreen({ onLogout }) {
  const maxRevenue = Math.max(...weeklyTrend.map((d) => d.revenue))

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-6">
      <Header />

      <main className="mt-6">
        <h1 className="font-display text-[28px] font-bold leading-tight text-coffee-900">
          오늘의 가게
        </h1>
        <p className="mt-1 text-sm text-coffee-600">
          오늘도 좋은 하루 보내세요 ☕
        </p>

        <section className="mt-5 grid grid-cols-3 gap-2">
          <Kpi label="적립 건수" value={`${todayStats.rewardCount}`} suffix="건" />
          <Kpi label="지급 포인트" value={todayStats.pointGiven.toLocaleString('ko-KR')} suffix="P" accent />
          <Kpi label="오늘 매출" value={`${(todayStats.revenue / 10000).toFixed(1)}`} suffix="만원" />
        </section>

        <TrendCard weeklyTrend={weeklyTrend} maxRevenue={maxRevenue} />

        <TopCustomersCard customers={topCustomers} />

        <StoreInfoCard onLogout={onLogout} />
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

function Kpi({ label, value, suffix, accent }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3 shadow-[var(--shadow-soft)]">
      <div className="text-[10px] font-medium uppercase tracking-wide text-coffee-600">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-0.5">
        <span
          className={[
            'font-display text-2xl font-bold tabular-nums',
            accent ? 'text-caramel-600' : 'text-coffee-900',
          ].join(' ')}
        >
          {value}
        </span>
        <span
          className={[
            'text-[10px] font-semibold',
            accent ? 'text-caramel-600' : 'text-coffee-600',
          ].join(' ')}
        >
          {suffix}
        </span>
      </div>
    </div>
  )
}

function TrendCard({ weeklyTrend, maxRevenue }) {
  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-coffee-900">이번 주 매출</h2>
        <span className="text-[11px] text-coffee-600">단위: 만원</span>
      </div>

      <div className="mt-4 grid h-32 grid-cols-7 items-end gap-1.5">
        {weeklyTrend.map((d) => {
          const heightPercent = (d.revenue / maxRevenue) * 100
          return (
            <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1.5">
              <div
                className={[
                  'w-full rounded-t-md transition-all',
                  d.isToday
                    ? 'bg-gradient-to-t from-caramel-600 to-caramel-400'
                    : 'bg-cream-300',
                ].join(' ')}
                style={{ height: `${heightPercent}%` }}
                aria-label={`${d.day}요일 ${d.revenue}원`}
              />
              <span
                className={[
                  'text-[10px] tabular-nums',
                  d.isToday ? 'font-bold text-caramel-600' : 'text-coffee-600',
                ].join(' ')}
              >
                {d.day}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TopCustomersCard({ customers }) {
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-coffee-900">단골 손님 TOP 3</h2>
        <span className="text-[11px] text-coffee-600">잔액 기준</span>
      </div>

      <ul className="mt-3 space-y-2">
        {customers.map((c, i) => (
          <li
            key={c.phone}
            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-soft)]"
          >
            <div
              className={[
                'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums',
                i === 0 ? 'bg-caramel-500 text-cream-50' : 'bg-cream-200 text-coffee-700',
              ].join(' ')}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold tabular-nums text-coffee-900">
                {maskPhone(c.phone)}
              </div>
              <div className="text-[11px] text-coffee-600">
                누적 {c.visits}회 방문
              </div>
            </div>
            <div className="text-sm font-bold tabular-nums text-caramel-600">
              {c.balance.toLocaleString('ko-KR')}P
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StoreInfoCard({ onLogout }) {
  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-sm font-bold text-coffee-900">가게 정보</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="가게 이름" value={STORE_NAME} />
        <Row label="적립률" value={`결제 금액의 ${POINT_RATE * 100}%`} />
        <Row label="리워드 기준" value="5,000P → 음료 1잔 무료" />
      </dl>

      <button
        type="button"
        onClick={onLogout}
        className="mt-5 w-full rounded-xl border border-cream-300 px-3 py-2.5 text-xs font-semibold text-coffee-700 transition-all hover:bg-cream-50 active:scale-[0.99]"
      >
        로그아웃
      </button>
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between border-b border-cream-200 pb-1.5 last:border-0 last:pb-0">
      <dt className="text-[12px] text-coffee-600">{label}</dt>
      <dd className="text-sm font-semibold text-coffee-900">{value}</dd>
    </div>
  )
}
