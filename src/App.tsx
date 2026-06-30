import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { STORE_NAME } from './lib/data'
import type { BalanceResponse } from './lib/contracts'
import { OwnerStoreProvider } from './owner/OwnerStoreProvider'
import { OwnerAuthProvider, useOwnerAuth } from './auth/OwnerAuthProvider'
import OwnerLoginForm from './auth/OwnerLoginForm'
import OwnerMfaForm from './auth/OwnerMfaForm'
import Logo from './ui/Logo'
import OwnerRewardScreen from './screens/OwnerRewardScreen'
import OwnerCustomerManageScreen from './screens/OwnerCustomerManageScreen'
import OwnerDashboardScreen from './screens/OwnerDashboardScreen'
import CustomerLandingScreen from './screens/CustomerLandingScreen'
import CustomerPointScreen from './screens/CustomerPointScreen'

type OwnerTab = 'reward' | 'customers' | 'dashboard'

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

// The customer route never imports owner auth or the Supabase auth session — it
// stays an anonymous, session-free balance lookup.
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

// OwnerAuthProvider wraps only the /admin route, so a Supabase auth session is
// created exclusively for the owner. The customer route above never mounts it.
function AdminPage() {
  return (
    <OwnerAuthProvider>
      <AdminGate />
    </OwnerAuthProvider>
  )
}

function AdminGate() {
  const { state } = useOwnerAuth()
  if (state.status === 'loading') return <AdminLoadingScreen />
  if (state.status === 'signed_out')
    return (
      <div className="min-h-full pb-20">
        <OwnerLoginForm />
      </div>
    )
  if (state.status === 'needs_enrollment' || state.status === 'needs_challenge') {
    return (
      <div className="min-h-full pb-20">
        <OwnerMfaForm mode={state.status} />
      </div>
    )
  }
  if (state.status !== 'ready') return <AdminAuthErrorScreen />
  // Mount the production owner store only for the authenticated aal2 owner. It
  // sources all data from the server bootstrap; on logout this subtree unmounts,
  // which discards the provider's owner data.
  return (
    <OwnerStoreProvider>
      <div className="min-h-full pb-20">
        <OwnerApp />
      </div>
    </OwnerStoreProvider>
  )
}

function AdminLoadingScreen() {
  return (
    <div className="grid min-h-full place-items-center px-4 py-[60px]">
      <div className="flex flex-col items-center gap-3 animate-fade">
        <Logo size="lg" emoji="🧑‍🍳" className="inline-grid" />
        <p className="text-[13.5px] font-bold text-ink-soft">로그인 상태 확인 중…</p>
      </div>
    </div>
  )
}

function AdminAuthErrorScreen() {
  const { signOut } = useOwnerAuth()
  return (
    <div className="grid min-h-full place-items-center px-4 py-[60px]">
      <div className="flex max-w-[360px] flex-col items-center gap-3 text-center animate-fade">
        <Logo size="lg" emoji="⚠️" className="inline-grid" />
        <h1 className="text-[19px] font-extrabold tracking-tight">인증 상태를 확인할 수 없어요</h1>
        <p className="text-[13.5px] font-semibold text-ink-soft">
          네트워크 상태를 확인한 뒤 다시 로그인해 주세요.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-1 rounded-[14px] bg-ink px-5 py-3 text-[14px] font-extrabold text-white"
        >
          다시 로그인
        </button>
      </div>
    </div>
  )
}

function OwnerApp() {
  const { signOut } = useOwnerAuth()
  const [tab, setTab] = useState<OwnerTab>('reward')

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
              onClick={() => setTab(t.id)}
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
      {tab === 'dashboard' && <OwnerDashboardScreen onLogout={() => void signOut()} />}
    </div>
  )
}
