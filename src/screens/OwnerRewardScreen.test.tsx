import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnerBootstrap } from '../lib/contracts'

// Mock the server boundary. The real OwnerStoreProvider runs on top of it, so we
// exercise the genuine load → mutate → refetch wiring with controlled responses.
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

import { OwnerApiError, applyReward, fetchOwnerBootstrap } from '../owner/ownerApi'
import { OwnerStoreProvider } from '../owner/OwnerStoreProvider'
import OwnerRewardScreen from './OwnerRewardScreen'

const bootstrap: OwnerBootstrap = {
  customers: [
    { id: 'c1', name: '김서연', phoneE164: '+821023457788', points: 3420, visits: 18, lastVisitedAt: null },
    { id: 'c2', name: '박서연', phoneE164: '+821099997788', points: 1000, visits: 5, lastVisitedAt: null },
    { id: 'c3', name: '이준호', phoneE164: '+821098761234', points: 5180, visits: 24, lastVisitedAt: null },
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

function renderScreen() {
  return render(
    <OwnerStoreProvider>
      <OwnerRewardScreen />
    </OwnerStoreProvider>,
  )
}

async function ready() {
  await screen.findByText('🍙 적립')
}

async function typeDigits(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const d of digits) {
    await user.click(screen.getByRole('button', { name: d }))
  }
}

beforeEach(() => {
  vi.mocked(fetchOwnerBootstrap).mockReset().mockResolvedValue(bootstrap)
  vi.mocked(applyReward).mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('OwnerRewardScreen', () => {
  it('shows a loading skeleton before the bootstrap arrives', () => {
    vi.mocked(fetchOwnerBootstrap).mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('🍙 적립')).not.toBeInTheDocument()
  })

  it('lists every customer sharing the searched 4-digit suffix', async () => {
    const user = userEvent.setup()
    renderScreen()
    await ready()

    await typeDigits(user, '7788')
    await user.click(screen.getByRole('button', { name: '손님 조회' }))

    expect(await screen.findByText('손님 선택')).toBeInTheDocument()
    expect(screen.getByText(/2명 매칭/)).toBeInTheDocument()
    expect(screen.getByText('김서연')).toBeInTheDocument()
    expect(screen.getByText('박서연')).toBeInTheDocument()
  })

  it('blocks a duplicate apply click while the first request is in flight', async () => {
    const user = userEvent.setup()
    vi.mocked(applyReward).mockReturnValue(new Promise(() => {})) // never settles
    renderScreen()
    await ready()

    await typeDigits(user, '1234') // unique → jumps to amount step
    await user.click(screen.getByRole('button', { name: '손님 조회' }))
    await typeDigits(user, '10000')

    const submit = screen.getByRole('button', { name: '포인트 적립하기' })
    await user.click(submit)
    await user.click(submit)

    expect(applyReward).toHaveBeenCalledTimes(1)
  })

  it('renders the SERVER-computed delta and balance in the success toast', async () => {
    const user = userEvent.setup()
    // 10,000원 at the 5% preview rate would be 500 client-side. The server says
    // 777 / 4,197 — those authoritative values must be what the toast shows.
    vi.mocked(applyReward).mockResolvedValue({ pointsDelta: 777, balanceAfter: 4197 })
    renderScreen()
    await ready()

    await typeDigits(user, '1234')
    await user.click(screen.getByRole('button', { name: '손님 조회' }))
    await typeDigits(user, '10000')
    await user.click(screen.getByRole('button', { name: '포인트 적립하기' }))

    expect(await screen.findByText(/\+777P 적립 완료/)).toBeInTheDocument()
    expect(screen.getByText(/잔여 포인트 4,197P/)).toBeInTheDocument()
    expect(screen.queryByText(/\+500P 적립 완료/)).not.toBeInTheDocument()
    expect(applyReward).toHaveBeenCalledWith('c3', 'earn', 10000, expect.any(String))
  })

  it('surfaces a 409 idempotency conflict from the server', async () => {
    const user = userEvent.setup()
    vi.mocked(applyReward).mockRejectedValue(new OwnerApiError(409, 'IDEMPOTENCY_CONFLICT'))
    renderScreen()
    await ready()

    await typeDigits(user, '1234')
    await user.click(screen.getByRole('button', { name: '손님 조회' }))
    await typeDigits(user, '10000')
    await user.click(screen.getByRole('button', { name: '포인트 적립하기' }))

    expect(await screen.findByText('이미 처리된 요청이에요')).toBeInTheDocument()
  })

  it('surfaces a 422 insufficient-balance error on use', async () => {
    const user = userEvent.setup()
    vi.mocked(applyReward).mockRejectedValue(new OwnerApiError(422, 'UNPROCESSABLE'))
    renderScreen()
    await ready()

    // switch to use mode
    await user.click(screen.getByRole('button', { name: '🎁 사용' }))
    await typeDigits(user, '1234')
    await user.click(screen.getByRole('button', { name: '손님 조회' }))
    await typeDigits(user, '1000')
    await user.click(screen.getByRole('button', { name: '포인트 사용하기' }))

    expect(await screen.findByText(/포인트 잔액과 사용 단위를 확인해 주세요/)).toBeInTheDocument()
  })

  it('renders the resolved customer phone via the Korean display format', async () => {
    const user = userEvent.setup()
    renderScreen()
    await ready()

    await typeDigits(user, '7788')
    await user.click(screen.getByRole('button', { name: '손님 조회' }))

    await screen.findByText('손님 선택')
    expect(screen.getByText('010-2345-7788')).toBeInTheDocument()
    expect(screen.getByText('010-9999-7788')).toBeInTheDocument()
  })
})
