import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomerPointScreen from './CustomerPointScreen'
import type { BalanceResponse } from '../lib/contracts'

const balance: BalanceResponse = {
  points: 3420,
  rewardThreshold: 5000,
  pointsToNextReward: 1580,
  storeName: '달콤한 진스쿡',
  maskedName: null,
  history: [],
  asOf: '2026-06-29T05:30:00.000Z',
}

describe('CustomerPointScreen', () => {
  it('shows points, store name, and timestamp', () => {
    render(<CustomerPointScreen balance={balance} onChangePhone={() => {}} />)

    expect(screen.getByText('3,420')).toBeInTheDocument()
    expect(screen.getByText('달콤한 진스쿡')).toBeInTheDocument()
    expect(screen.getByText(/기준 시각/)).toBeInTheDocument()
  })

  it('shows masked name greeting when maskedName is provided', () => {
    render(
      <CustomerPointScreen
        balance={{ ...balance, maskedName: '홍*동' }}
        onChangePhone={() => {}}
      />,
    )
    expect(screen.getByText(/홍\*동님 안녕하세요/)).toBeInTheDocument()
  })

  it('shows no greeting when maskedName is null', () => {
    render(<CustomerPointScreen balance={balance} onChangePhone={() => {}} />)
    expect(screen.queryByText(/님 안녕하세요/)).not.toBeInTheDocument()
  })

  it('shows history rows when history is non-empty', () => {
    const balanceWithHistory: BalanceResponse = {
      ...balance,
      history: [
        { type: 'earn', amount: 10, pointsAfter: 30, createdAt: '2026-06-29T05:00:00.000Z' },
        { type: 'use', amount: 5, pointsAfter: 25, createdAt: '2026-06-28T10:00:00.000Z' },
      ],
    }
    render(<CustomerPointScreen balance={balanceWithHistory} onChangePhone={() => {}} />)
    expect(screen.getByText('적립 이력')).toBeInTheDocument()
    expect(screen.getByText('+10P')).toBeInTheDocument()
    expect(screen.getByText('-5P')).toBeInTheDocument()
  })

  it('hides history section when history is empty', () => {
    render(<CustomerPointScreen balance={balance} onChangePhone={() => {}} />)
    expect(screen.queryByText('적립 이력')).not.toBeInTheDocument()
  })

  it('renders no raw customer name, phone, visit count, or demo chips', () => {
    const { container } = render(
      <CustomerPointScreen balance={balance} onChangePhone={() => {}} />,
    )
    expect(screen.queryByText(/회 방문/)).not.toBeInTheDocument()
    expect(screen.queryByText(/DEMO/i)).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/01[016789][\d-]{6,}/)
    for (const name of ['김서연', '이준호', '박지우', '최민재', '정하윤']) {
      expect(screen.queryByText(new RegExp(name))).not.toBeInTheDocument()
    }
  })

  it('shows social links for Instagram and Naver Place', () => {
    render(<CustomerPointScreen balance={balance} onChangePhone={() => {}} />)
    expect(screen.getByRole('link', { name: /인스타그램/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /네이버 플레이스/ })).toBeInTheDocument()
  })

  it('invokes onChangePhone when the logout control is pressed', async () => {
    const onChangePhone = vi.fn()
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CustomerPointScreen balance={balance} onChangePhone={onChangePhone} />)

    await user.click(screen.getByLabelText('다른 번호로 조회'))
    expect(onChangePhone).toHaveBeenCalledTimes(1)
  })
})
