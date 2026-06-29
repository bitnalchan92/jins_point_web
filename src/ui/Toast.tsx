// 적립 완료 토스트 — 화면 하단 중앙에서 떠올랐다 사라짐
export interface ToastConfig {
  icon: string
  title: string
  sub: string
}

export default function Toast({ icon, title, sub }: ToastConfig) {
  return (
    <div className="fixed inset-x-0 bottom-8 z-[80] flex justify-center">
      <div className="flex items-center gap-3 rounded-2xl bg-ink px-5 py-3.5 text-white shadow-[0_20px_40px_-16px_rgba(36,27,18,.6)] animate-[jp-toast_2.6s_cubic-bezier(.2,.8,.2,1)_forwards]">
        <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand text-[19px]">{icon}</div>
        <div>
          <div className="text-[14.5px] font-extrabold">{title}</div>
          <div className="mt-px text-xs font-semibold opacity-75">{sub}</div>
        </div>
      </div>
    </div>
  )
}
