import { STORE_NAME } from '../lib/data'
import { comma, formatPhone } from '../lib/format'
import { useStore } from '../store'
import Logo from '../ui/Logo'

export default function CustomerPointScreen({ phone, onChangePhone }) {
  const { findCustomer } = useStore()
  const customer = findCustomer(phone)

  return (
    <div className="animate-fade">
      <div className="flex items-center justify-between px-[22px] pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">{STORE_NAME}</div>
            <div className="text-[11.5px] font-semibold text-ink-soft">{formatPhone(phone)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onChangePhone}
          title="다시 조회"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl border border-line bg-card text-base text-ink-soft transition hover:border-brand"
        >
          ↻
        </button>
      </div>

      {customer ? <ExistingCustomer customer={customer} /> : <NewCustomer />}
    </div>
  )
}

function NewCustomer() {
  const steps = [
    { n: '1', leaf: false, body: <><b className="text-ink">결제 시 전화번호</b>를 알려주세요</> },
    { n: '2', leaf: false, body: <>결제금액의 <b className="text-ink">일정 %가 포인트</b>로 적립</> },
    { n: '3', leaf: true, body: <>모은 포인트는 <b className="text-ink">현금처럼 사용</b> 가능해요</> },
  ]
  return (
    <div className="px-[22px] pb-[30px] pt-[18px]">
      <div className="rounded-3xl bg-[linear-gradient(155deg,var(--color-brand),var(--color-brand-dark))] px-6 py-8 text-center shadow-[var(--shadow-lift)]">
        <div className="animate-pop text-[46px]">🌱</div>
        <div className="mt-2 text-xl font-extrabold">첫 방문을 환영해요!</div>
        <p className="mt-2.5 text-[13.5px] font-semibold leading-relaxed opacity-85">
          아직 적립 내역이 없어요.
          <br />
          다음 결제부터 포인트가 쌓여요.
        </p>
      </div>

      <div className="mt-4 rounded-[20px] border border-line bg-card p-[22px]">
        <div className="mb-3.5 text-[13px] font-extrabold">이렇게 쌓여요</div>
        <div className="flex flex-col gap-3.5">
          {steps.map((s) => (
            <div key={s.n} className="flex items-start gap-[13px]">
              <div
                className={[
                  'grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] text-sm font-extrabold',
                  s.leaf ? 'bg-leaf-bg text-leaf' : 'bg-pale text-brand-dark',
                ].join(' ')}
              >
                {s.n}
              </div>
              <div className="pt-1 text-[13.5px] leading-snug text-ink-soft">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExistingCustomer({ customer }) {
  const points = customer.points

  return (
    <div className="px-[22px] pb-[30px] pt-3.5">
      {/* 포인트 히어로 */}
      <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(158deg,var(--color-brand)_0%,var(--color-brand-dark)_100%)] px-6 pb-6 pt-[26px] shadow-[var(--shadow-lift)]">
        <div className="absolute -right-[30px] -top-[30px] h-[130px] w-[130px] rounded-full bg-white/20" aria-hidden />
        <div className="relative flex items-center justify-between">
          <span className="text-[13px] font-extrabold opacity-80">{customer.name} 님</span>
          <span className="rounded-full bg-ink/15 px-[11px] py-[5px] text-[11.5px] font-extrabold">
            {customer.visits}회 방문
          </span>
        </div>
        <div className="relative mt-3.5">
          <span className="text-[13px] font-bold opacity-75">사용 가능 포인트</span>
          <div className="mt-0.5 flex items-end gap-1">
            <span className="animate-pop text-[52px] font-extrabold leading-[0.95] tracking-tighter tabular-nums">
              {comma(points)}
            </span>
            <span className="pb-1.5 text-2xl font-extrabold">P</span>
          </div>
        </div>
      </div>

      {/* 적립 · 사용 내역 */}
      {customer.history.length > 0 && (
        <div className="mt-4">
          <div className="px-1 pb-2.5 text-[13px] font-extrabold">적립 · 사용 내역</div>
          <div className="overflow-hidden rounded-[20px] border border-line bg-card">
            {customer.history.map((h, i) => {
              const earn = h.type === 'earn'
              return (
                <div
                  key={i}
                  className="flex items-center gap-[13px] border-t border-line px-[18px] py-3.5 first:border-t-0"
                >
                  <div
                    className={[
                      'grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] text-[17px]',
                      earn ? 'bg-pale-soft' : 'bg-leaf-bg',
                    ].join(' ')}
                  >
                    {earn ? '🍙' : '🎁'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{earn ? '포인트 적립' : '포인트 사용'}</div>
                    <div className="mt-0.5 text-[11.5px] font-semibold text-ink-soft">{h.date}</div>
                  </div>
                  <div
                    className={[
                      'text-[15px] font-extrabold tabular-nums',
                      earn ? 'text-ink' : 'text-leaf',
                    ].join(' ')}
                  >
                    {earn ? '+' : ''}
                    {comma(h.amount)}P
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
