// POS 스타일 숫자 키패드 — PIN 입력 / 금액 입력에 공유
export default function Keypad({ keys, onPress }) {
  return (
    <div className="grid grid-cols-3 gap-[9px]">
      {keys.map((k) => (
        <button
          key={k.value}
          type="button"
          onClick={() => onPress(k.value)}
          className={[
            'flex h-[52px] items-center justify-center rounded-[13px] border border-line bg-card font-extrabold transition active:scale-95 active:bg-pale',
            k.muted ? 'text-lg text-ink-soft' : 'text-[21px] text-ink',
          ].join(' ')}
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}

// 숫자 + 백스페이스
export const numericKeys = [
  ...'123456789'.split('').map((n) => ({ label: n, value: n })),
  { label: '00', value: '00' },
  { label: '0', value: '0' },
  { label: '⌫', value: 'back', muted: true },
]

// 숫자 + C(전체삭제) + 백스페이스 (PIN용)
export const pinKeys = [
  ...'123456789'.split('').map((n) => ({ label: n, value: n })),
  { label: 'C', value: 'clear', muted: true },
  { label: '0', value: '0' },
  { label: '⌫', value: 'back', muted: true },
]
