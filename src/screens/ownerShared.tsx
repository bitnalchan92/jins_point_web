// Shared owner-screen states for the async bootstrap: a loading skeleton, a
// retry surface (covers network/session-expired failures), and an empty state.

export function OwnerLoading() {
  return (
    <div className="mt-[18px] animate-fade" role="status" aria-live="polite">
      <div className="mb-4 h-9 w-40 rounded-[12px] bg-[#ece2cf]" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[120px] rounded-[18px] border border-line bg-[#f2ead9]" />
        ))}
      </div>
      <div className="mt-4 h-[260px] rounded-[20px] border border-line bg-[#f2ead9]" />
      <span className="sr-only">불러오는 중…</span>
    </div>
  )
}

export function OwnerRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-[18px] grid place-items-center px-4 py-[60px] animate-fade">
      <div className="flex max-w-[360px] flex-col items-center gap-3 text-center">
        <div className="text-[40px]">⚠️</div>
        <h2 className="text-[18px] font-extrabold tracking-tight">데이터를 불러오지 못했어요</h2>
        <p className="text-[13.5px] font-semibold text-ink-soft">
          네트워크 또는 로그인 상태를 확인한 뒤 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-[14px] bg-ink px-5 py-3 text-[14px] font-extrabold text-white"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
