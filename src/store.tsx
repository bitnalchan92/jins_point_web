import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { customers as baseCustomers, POINT_RATE } from './lib/data'
import type { Customer } from './lib/data'
import { formatPhone, onlyDigits } from './lib/format'

export type RewardLogType = 'earn' | 'use'

export interface RewardLogEntry {
  id: number
  phone: string
  name: string
  earn: number
  type: RewardLogType
  time: string
}

export type AddCustomerResult =
  | { success: true }
  | { success: false; error: 'invalid_phone' | 'duplicate' }

export interface StoreContextValue {
  customers: Customer[]
  rewardLog: RewardLogEntry[]
  findCustomer: (raw: string) => Customer | null
  addReward: (rawPhone: string, amount: number | string) => { name: string; earn: number } | null
  redeemPoints: (
    rawPhone: string,
    amount: number | string,
  ) => { name: string; use: number; remaining: number } | null
  rate: number
  updateRate: (newRate: number) => void
  addCustomer: (phone: string, name: string) => AddCustomerResult
}

const StoreContext = createContext<StoreContextValue | null>(null)

const initialRewardLog: RewardLogEntry[] = [
  { id: 1, phone: '010-9876-5432', name: '이준호', earn: 320, type: 'earn', time: '14:32' },
  { id: 2, phone: '010-2345-7788', name: '김서연', earn: 170, type: 'earn', time: '13:05' },
  { id: 3, phone: '010-7788-0011', name: '최민재', earn: 90, type: 'earn', time: '11:48' },
]

function nowTime() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function todayLabel() {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function StoreProvider({ children }: PropsWithChildren) {
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [rewardLog, setRewardLog] = useState(initialRewardLog)
  const [rate, setRate] = useState(POINT_RATE)
  const [newCustomers, setNewCustomers] = useState<Customer[]>([])

  const customers = useMemo(
    () =>
      [...baseCustomers, ...newCustomers].map((c) => ({
        ...c,
        points: c.points + (overrides[c.phone] || 0),
      })),
    [overrides, newCustomers],
  )

  const findCustomer = useCallback(
    (raw: string) => {
      const d = onlyDigits(raw)
      return customers.find((c) => c.phone === d) ?? null
    },
    [customers],
  )

  const updateRate = useCallback((newRate: number) => setRate(newRate), [])

  // 신규 손님 등록 (손님 관리 탭에서 사장님이 직접 추가)
  const addCustomer = useCallback(
    (phone: string, name: string): AddCustomerResult => {
      const d = onlyDigits(phone)
      if (d.length < 10) return { success: false, error: 'invalid_phone' }
      if (customers.find((c) => c.phone === d)) return { success: false, error: 'duplicate' }

      setNewCustomers((prev) => [
        ...prev,
        { phone: d, name: name.trim(), points: 0, visits: 0, lastVisit: todayLabel(), history: [] },
      ])
      return { success: true }
    },
    [customers],
  )

  // 포인트 적립 — rate 상태 사용, 등록된 손님만 가능
  const addReward = useCallback(
    (rawPhone: string, amount: number | string) => {
      const d = onlyDigits(rawPhone)
      const earn = Math.floor((Number(amount) || 0) * rate)
      if (d.length < 10 || earn <= 0) return null

      const matched = customers.find((c) => c.phone === d)
      if (!matched) return null

      setOverrides((prev) => ({ ...prev, [d]: (prev[d] || 0) + earn }))
      setRewardLog((prev) =>
        [{ id: Date.now(), phone: formatPhone(d), name: matched.name, earn, type: 'earn' as const, time: nowTime() }, ...prev].slice(0, 8),
      )
      return { name: matched.name, earn }
    },
    [rate, customers],
  )

  // 포인트 사용(차감)
  const redeemPoints = useCallback(
    (rawPhone: string, amount: number | string) => {
      const d = onlyDigits(rawPhone)
      const use = Number(amount) || 0
      if (d.length < 10 || use <= 0) return null

      const matched = customers.find((c) => c.phone === d)
      if (!matched || matched.points < use) return null

      setOverrides((prev) => ({ ...prev, [d]: (prev[d] || 0) - use }))
      setRewardLog((prev) =>
        [{ id: Date.now(), phone: formatPhone(d), name: matched.name, earn: use, type: 'use' as const, time: nowTime() }, ...prev].slice(0, 8),
      )
      return { name: matched.name, use, remaining: matched.points - use }
    },
    [customers],
  )

  const value = useMemo<StoreContextValue>(
    () => ({ customers, rewardLog, findCustomer, addReward, redeemPoints, rate, updateRate, addCustomer }),
    [customers, rewardLog, findCustomer, addReward, redeemPoints, rate, updateRate, addCustomer],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}
