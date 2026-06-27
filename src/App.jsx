import { useState } from 'react'
import OwnerLoginScreen from './screens/OwnerLoginScreen'
import OwnerRewardScreen from './screens/OwnerRewardScreen'
import OwnerCustomerSearchScreen from './screens/OwnerCustomerSearchScreen'
import OwnerDashboardScreen from './screens/OwnerDashboardScreen'
import CustomerLandingScreen from './screens/CustomerLandingScreen'
import CustomerPointScreen from './screens/CustomerPointScreen'

const MODES = [
  { id: 'owner', label: '사장님', emoji: '🧑‍🍳' },
  { id: 'customer', label: '손님', emoji: '📱' },
]

const OWNER_TABS = [
  { id: 'reward', label: '적립', emoji: '☕' },
  { id: 'customers', label: '손님 조회', emoji: '👥' },
  { id: 'dashboard', label: '대시보드', emoji: '📊' },
]

export default function App() {
  const [mode, setMode] = useState('owner')
  const [customerPhone, setCustomerPhone] = useState(null)
  const [ownerAuthed, setOwnerAuthed] = useState(false)
  const [ownerTab, setOwnerTab] = useState('reward')

  const handleModeChange = (next) => {
    setMode(next)
    if (next === 'customer') setCustomerPhone(null)
  }

  const handleLogout = () => {
    setOwnerAuthed(false)
    setOwnerTab('reward')
  }

  let body
  if (mode === 'owner') {
    if (!ownerAuthed) {
      body = <OwnerLoginScreen onLogin={() => setOwnerAuthed(true)} />
    } else {
      body = (
        <>
          {ownerTab === 'reward' && <OwnerRewardScreen />}
          {ownerTab === 'customers' && <OwnerCustomerSearchScreen />}
          {ownerTab === 'dashboard' && <OwnerDashboardScreen onLogout={handleLogout} />}
          <OwnerTabBar tab={ownerTab} onChange={setOwnerTab} />
        </>
      )
    }
  } else if (customerPhone) {
    body = (
      <CustomerPointScreen
        phone={customerPhone}
        onChangePhone={() => setCustomerPhone(null)}
      />
    )
  } else {
    body = <CustomerLandingScreen onSubmit={setCustomerPhone} />
  }

  return (
    <div className="min-h-full">
      <DemoSwitcher mode={mode} onChange={handleModeChange} />
      {body}
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

function OwnerTabBar({ tab, onChange }) {
  return (
    <nav
      aria-label="사장님 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-300 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
        {OWNER_TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={[
                'flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all active:scale-95',
                active ? 'text-caramel-600' : 'text-coffee-600 hover:text-coffee-900',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-lg leading-none">{t.emoji}</span>
              <span className={['text-[11px] font-semibold', active && 'font-bold'].join(' ')}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
