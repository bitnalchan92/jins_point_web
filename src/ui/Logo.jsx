const SIZES = {
  sm: 'h-[38px] w-[38px] rounded-xl text-[19px]',
  md: 'h-[42px] w-[42px] rounded-[13px] text-[21px]',
  lg: 'h-16 w-16 rounded-[20px] text-[32px] shadow-[0_14px_28px_-12px_rgba(240,169,26,.7)]',
  xl: 'h-[78px] w-[78px] rounded-3xl text-[38px] -rotate-4 shadow-[0_14px_28px_-10px_rgba(240,169,26,.7)]',
}

// 🍙 그라데이션 브랜드 로고
export default function Logo({ size = 'md', emoji = '🍙', className = '' }) {
  return (
    <div
      className={`grid shrink-0 place-items-center bg-[linear-gradient(150deg,var(--color-brand),var(--color-brand-dark))] ${SIZES[size]} ${className}`}
      aria-hidden
    >
      {emoji}
    </div>
  )
}
