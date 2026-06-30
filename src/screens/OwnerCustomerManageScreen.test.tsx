import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnerBootstrap } from '../lib/contracts'

vi.mock('../owner/ownerApi', () => {
  class OwnerApiError extends Error {
    readonly status: number
    readonly code: string
    constructor(status: number, code: string) {
      super(code)
      this.status = status
      this.code = code
    }
  }
  return {
    OwnerApiError,
    fetchOwnerBootstrap: vi.fn(),
    createCustomer: vi.fn(),
    applyReward: vi.fn(),
    updateRate: vi.fn(),
  }
})

import { OwnerApiError, createCustomer, fetchOwnerBootstrap } from '../owner/ownerApi'
import { OwnerStoreProvider } from '../owner/OwnerStoreProvider'
import OwnerCustomerManageScreen from './OwnerCustomerManageScreen'

const customer = (id: string, name: string, phoneE164: string, points: number) => ({
  id,
  name,
  phoneE164,
  points,
  visits: 3,
  lastVisitedAt: null,
})

const bootstrap: OwnerBootstrap = {
  customers: [
    customer('c1', '김서연', '+821023457788', 3420),
    customer('c2', '이준호', '+821098765432', 5180),
  ],
  recentRewards: [],
  store: {
    name: '달콤한 진스쿡',
    tagline: '김밥 · 샌드위치 전문점',
    rewardRate: 0.05,
    rewardThreshold: 5000,
    redeemUnit: 1000,
  },
}

const bootstrapWithNew: OwnerBootstrap = {
  ...bootstrap,
  customers: [...bootstrap.customers, customer('c3', '홍길동', '+821000001234', 0)],
}

function renderScreen() {
  return render(
    <OwnerStoreProvider>
      <OwnerCustomerManageScreen />
    </OwnerStoreProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchOwnerBootstrap).mockReset().mockResolvedValue(bootstrap)
  vi.mocked(createCustomer).mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('OwnerCustomerManageScreen', () => {
  it('hides customer data until the bootstrap resolves', () => {
    vi.mocked(fetchOwnerBootstrap).mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('김서연')).not.toBeInTheDocument()
  })

  it('filters customers by multiple phone suffixes', async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(await screen.findByText('김서연')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('이름 또는 전화번호로 검색'), '5432')
    expect(screen.getByText('이준호')).toBeInTheDocument()
    expect(screen.queryByText('김서연')).not.toBeInTheDocument()
  })

  it('adds a customer, then refetches the authoritative bootstrap', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchOwnerBootstrap)
      .mockReset()
      .mockResolvedValueOnce(bootstrap)
      .mockResolvedValueOnce(bootstrapWithNew)
    vi.mocked(createCustomer).mockResolvedValue(undefined)

    renderScreen()
    await screen.findByText('김서연')

    await user.click(screen.getByRole('button', { name: '+ 신규 손님' }))
    await user.type(screen.getByPlaceholderText('홍길동'), '홍길동')
    await user.type(screen.getByPlaceholderText('010-0000-0000'), '01000001234')
    await user.click(screen.getByRole('button', { name: '등록하기' }))

    expect(createCustomer).toHaveBeenCalledWith('010-0000-1234', '홍길동')
    expect(await screen.findByText('홍길동')).toBeInTheDocument()
  })

  it('shows a duplicate error returned by the add API', async () => {
    const user = userEvent.setup()
    vi.mocked(createCustomer).mockRejectedValue(new OwnerApiError(409, 'DUPLICATE_CUSTOMER'))

    renderScreen()
    await screen.findByText('김서연')

    await user.click(screen.getByRole('button', { name: '+ 신규 손님' }))
    await user.type(screen.getByPlaceholderText('홍길동'), '김서연')
    await user.type(screen.getByPlaceholderText('010-0000-0000'), '01023457788')
    await user.click(screen.getByRole('button', { name: '등록하기' }))

    // The screen prefixes a "⚠️ " icon, splitting the message across text nodes,
    // so match the message with a regex rather than an exact single-node string.
    expect(await screen.findByText(/이미 등록된 전화번호예요/)).toBeInTheDocument()
  })

  it('shows a pending label while the add request is in flight', async () => {
    const user = userEvent.setup()
    vi.mocked(createCustomer).mockReturnValue(new Promise(() => {}))

    renderScreen()
    await screen.findByText('김서연')

    await user.click(screen.getByRole('button', { name: '+ 신규 손님' }))
    await user.type(screen.getByPlaceholderText('홍길동'), '홍길동')
    await user.type(screen.getByPlaceholderText('010-0000-0000'), '01000001234')
    await user.click(screen.getByRole('button', { name: '등록하기' }))

    expect(await screen.findByRole('button', { name: '등록 중…' })).toBeDisabled()
  })
})
