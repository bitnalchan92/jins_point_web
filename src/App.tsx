import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { STORE_NAME } from './lib/data'
import type { BalanceResponse } from './lib/contracts'
import { StoreProvider } from './store'
import Logo from './ui/Logo'
import OwnerLoginScreen from './screens/OwnerLoginScreen'
import OwnerRewardScreen from './screens/OwnerRewardScreen'
import OwnerCustomerManageScreen from './screens/OwnerCustomerManageScreen'
import OwnerDashboardScreen from './screens/OwnerDashboardScreen'
import CustomerLandingScreen from './screens/CustomerLandingScreen'
import CustomerPointScreen from './screens/CustomerPointScreen'

type OwnerTab = 'reward' | 'customers' | 'dashboard'

interface OwnerAppProps {
  tab: OwnerTab
  onTab: (tab: OwnerTab) => void
  onLogout: () => void
}

const OWNER_TABS: { id: OwnerTab; label: string }[] = [
  { id: 'reward', label: '☕ 포인트' },
  { id: 'customers', label: '👥 손님 관리' },
  { id: 'dashboard', label: '📊 대시보드' },
]

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function CustomerPage() {
  const [balance, setBalance] = useState<BalanceResponse | null>(null)

  return (
    <div className="min-h-full pb-20">
      <div className="flex justify-center px-4 py-6">
        <div className="relative min-h-[740px] w-full max-w-[430px] overflow-hidden rounded-[30px] border border-line bg-cream shadow-[0_30px_70px_-30px_rgba(70,45,12,.45)]">
          {balance ? (
            <CustomerPointScreen balance={balance} onChangePhone={() => setBalance(null)} />
          ) : (
            <CustomerLandingScreen onSuccess={setBalance} />
          )}
        </div>
      </div>
    </div>
  )
}

// Owner screens still rely on the demo StoreProvider until Tasks 6–7 replace it
// with the production owner provider. Scope it to the /admin route only so the
// customer route never touches demo customers or findCustomer().
function AdminPage() {
  return (
    <StoreProvider>
      <AdminPageInner />
    </StoreProvider>
  )
}

function AdminPageInner() {
  const [authed, setAuthed] = useState(false)
  const [ownerTab, setOwnerTab] = useState<OwnerTab>('reward')

  const logout = () => {
    setAuthed(false)
    setOwnerTab('reward')
  }

  if (!authed) {
    return (
      <div className="min-h-full pb-20">
        <OwnerLoginScreen onLogin={() => setAuthed(true)} />
      </div>
    )
  }

  return (
    <div className="min-h-full pb-20">
      <OwnerApp tab={ownerTab} onTab={setOwnerTab} onLogout={logout} />
    </div>
  )
}

function OwnerApp({ tab, onTab, onLogout }: OwnerAppProps) {
  return (
    <div className="mx-auto max-w-[1180px] animate-fade px-[18px] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line bg-card py-3 pl-[18px] pr-3.5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <div className="text-base font-extrabold tracking-tight">{STORE_NAME}</div>
            <div className="text-[11.5px] font-bold text-ink-soft">사장님 모드 · 포인트 관리</div>
          </div>
        </div>
        <div className="flex gap-1.5 rounded-[14px] bg-[#f5eedf] p-[5px]">
          {OWNER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={[
                'rounded-[10px] px-4 py-2.5 text-[13.5px] font-extrabold transition-all',
                tab === t.id ? 'bg-card text-ink shadow-[0_4px_12px_-5px_rgba(70,45,12,.4)]' : 'text-ink-soft',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'reward' && <OwnerRewardScreen />}
      {tab === 'customers' && <OwnerCustomerManageScreen />}
      {tab === 'dashboard' && <OwnerDashboardScreen onLogout={onLogout} />}
    </div>
  )
}
