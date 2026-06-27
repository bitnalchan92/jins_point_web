import { useState } from 'react'
import OwnerRewardScreen from './screens/OwnerRewardScreen'
import CustomerLandingScreen from './screens/CustomerLandingScreen'
import CustomerPointScreen from './screens/CustomerPointScreen'

const MODES = [
  { id: 'owner', label: '사장님', emoji: '🧑‍🍳' },
  { id: 'customer', label: '손님', emoji: '📱' },
]

export default function App() {
  const [mode, setMode] = useState('owner')
  const [customerPhone, setCustomerPhone] = useState(null)

  const handleModeChange = (next) => {
    setMode(next)
    if (next === 'customer') setCustomerPhone(null)
  }

  return (
    <div className="min-h-full">
      <DemoSwitcher mode={mode} onChange={handleModeChange} />
      {mode === 'owner' ? (
        <OwnerRewardScreen />
      ) : customerPhone ? (
        <CustomerPointScreen
          phone={customerPhone}
          onChangePhone={() => setCustomerPhone(null)}
        />
      ) : (
        <CustomerLandingScreen onSubmit={setCustomerPhone} />
      )}
    </div>
  )
}

function DemoSwitcher({ mode, onChange }) {
  return (
    <div className="border-b border-cream-300 bg-cream-50">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-coffee-600">
          데모 화면
        </span>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-[var(--shadow-soft)]">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                mode === m.id
                  ? 'bg-coffee-900 text-cream-50'
                  : 'text-coffee-600 hover:text-coffee-900',
              ].join(' ')}
            >
              <span className="mr-1">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
