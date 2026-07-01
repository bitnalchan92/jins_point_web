import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerLandingScreen from './CustomerLandingScreen'
import type { BalanceResponse } from '../lib/contracts'

// Control the Turnstile token from tests without loading the real Cloudflare
// script. Bumping the widget key remounts this mock, clearing prior token UI.
vi.mock('../customer/TurnstileWidget', () => ({
  default: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('ts-token')}>
      issue-turnstile-token
    </button>
  ),
}))

// Control API responses via the hook's dependency.
vi.mock('../lib/api', () => {
  class ApiError extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return { ApiError, lookupBalance: vi.fn() }
})

import { ApiError, lookupBalance } from '../lib/api'

const mockLookup = vi.mocked(lookupBalance)

const dto: BalanceResponse = {
  points: 3420,
  rewardThreshold: 5000,
  pointsToNextReward: 1580,
  storeName: '달콤한 진스쿡',
  maskedName: null,
  history: [],
  asOf: '2026-06-29T05:30:00.000Z',
}

const PHONE = '01023457788'

function issueTokenButton() {
  return screen.getByRole('button', { name: 'issue-turnstile-token' })
}
function submitButton() {
  return screen.getByRole('button', { name: /내 포인트 보기|조회 중/ })
}

beforeEach(() => {
  mockLookup.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('CustomerLandingScreen', () => {
  it('keeps submit disabled until both a valid phone and a Turnstile token exist', async () => {
    const user = userEvent.setup()
    render(<CustomerLandingScreen onSuccess={() => {}} />)

    expect(submitButton()).toBeDisabled()

    await user.type(screen.getByLabelText('전화번호'), PHONE)
    // Valid phone but still no token.
    expect(submitButton()).toBeDisabled()

    await user.click(issueTokenButton())
    expect(submitButton()).toBeEnabled()
  })

  it('does not allow re-submit while a lookup is loading', async () => {
    const user = userEvent.setup()
    // Never resolves: keeps the hook in the loading state.
    mockLookup.mockReturnValue(new Promise<BalanceResponse>(() => {}))
    render(<CustomerLandingScreen onSuccess={() => {}} />)

    await user.type(screen.getByLabelText('전화번호'), PHONE)
    await user.click(issueTokenButton())
    await user.click(submitButton())

    expect(screen.getByText(/포인트를 불러오는 중이에요/)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
    expect(screen.getByLabelText('전화번호')).toBeDisabled()

    // Attempting another submit does nothing while loading.
    await user.click(submitButton())
    expect(mockLookup).toHaveBeenCalledTimes(1)
  })

  it('sends the phone and token and reports the balance on success', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    mockLookup.mockResolvedValue(dto)
    render(<CustomerLandingScreen onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('전화번호'), PHONE)
    await user.click(issueTokenButton())
    await user.click(submitButton())

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(dto))
    expect(mockLookup).toHaveBeenCalledWith('010-2345-7788', 'ts-token')
  })

  it('shows RATE_LIMITED copy distinct from UNAVAILABLE, each with a retry', async () => {
    const user = userEvent.setup()
    mockLookup.mockRejectedValueOnce(new ApiError('RATE_LIMITED'))
    render(<CustomerLandingScreen onSuccess={() => {}} />)

    await user.type(screen.getByLabelText('전화번호'), PHONE)
    await user.click(issueTokenButton())
    await user.click(submitButton())

    const rateAlert = await screen.findByRole('alert')
    expect(rateAlert).toHaveTextContent('잠시 후 다시 시도해 주세요')
    expect(rateAlert).toHaveTextContent('조회 요청이 많아')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByText(/연결이 어려워요/)).not.toBeInTheDocument()

    // Retry, then trigger an UNAVAILABLE error to confirm distinct copy.
    mockLookup.mockRejectedValueOnce(new ApiError('UNAVAILABLE'))
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await user.click(issueTokenButton())
    await user.click(submitButton())

    const unavailableAlert = await screen.findByRole('alert')
    expect(unavailableAlert).toHaveTextContent('연결이 어려워요')
    expect(unavailableAlert).not.toHaveTextContent('조회 요청이 많아')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('resets lookup state and the Turnstile token when the number is edited', async () => {
    const user = userEvent.setup()
    mockLookup.mockRejectedValueOnce(new ApiError('RATE_LIMITED'))
    render(<CustomerLandingScreen onSuccess={() => {}} />)

    const input = screen.getByLabelText('전화번호')
    await user.type(input, PHONE)
    await user.click(issueTokenButton())
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    // Editing the number clears the error state and the captured token.
    await user.type(input, '9')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // Token was cleared, so submit is disabled again even with a valid number.
    expect(submitButton()).toBeDisabled()
  })

  it('resets state and token when returning to look up a different number', async () => {
    function Harness() {
      const [balance, setBalance] = useState<BalanceResponse | null>(null)
      return balance ? (
        <div>
          <div>balance:{balance.points}</div>
          <button type="button" onClick={() => setBalance(null)}>
            change-number
          </button>
        </div>
      ) : (
        <CustomerLandingScreen onSuccess={setBalance} />
      )
    }

    const user = userEvent.setup()
    mockLookup.mockResolvedValue(dto)
    render(<Harness />)

    await user.type(screen.getByLabelText('전화번호'), PHONE)
    await user.click(issueTokenButton())
    await user.click(submitButton())
    await screen.findByText('balance:3420')

    // Go back to look up a different number: landing remounts fresh.
    await user.click(screen.getByRole('button', { name: 'change-number' }))
    expect(screen.getByLabelText('전화번호')).toHaveValue('')
    // Fresh landing requires a brand-new token before submit is possible.
    expect(submitButton()).toBeDisabled()
  })

  it('does not depend on the demo store provider', () => {
    // Renders without a <StoreProvider> wrapper — would throw if it used useStore().
    expect(() => render(<CustomerLandingScreen onSuccess={() => {}} />)).not.toThrow()
  })
})
