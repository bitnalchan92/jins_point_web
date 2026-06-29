import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomerPointScreen from './CustomerPointScreen'
import type { BalanceResponse } from '../lib/contracts'

const balance: BalanceResponse = {
  points: 3420,
  rewardThreshold: 5000,
  pointsToNextReward: 1580,
  storeName: '달콤한 진스쿡',
  asOf: '2026-06-29T05:30:00.000Z',
}

describe('CustomerPointScreen', () => {
  it('shows only the minimal balance fields', () => {
    render(<CustomerPointScreen balance={balance} onChangePhone={() => {}} />)

    // balance / next-reward / threshold / storeName / asOf
    expect(screen.getByText('3,420')).toBeInTheDocument()
    expect(screen.getByText('1,580')).toBeInTheDocument()
    expect(screen.getByText(/혜택 기준 5,000P/)).toBeInTheDocument()
    expect(screen.getByText('달콤한 진스쿡')).toBeInTheDocument()
    expect(screen.getByText(/기준 시각/)).toBeInTheDocument()
  })

  it('renders no customer name, phone, visit count, history, or demo chips', () => {
    const { container } = render(
      <CustomerPointScreen balance={balance} onChangePhone={() => {}} />,
    )

    // No customer name suffix.
    expect(screen.queryByText(/님/)).not.toBeInTheDocument()
    // No visit count.
    expect(screen.queryByText(/회 방문/)).not.toBeInTheDocument()
    // No reward history section.
    expect(screen.queryByText(/적립 · 사용 내역/)).not.toBeInTheDocument()
    expect(screen.queryByText(/내역/)).not.toBeInTheDocument()
    // No demo chip affordances.
    expect(screen.queryByText(/DEMO/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/단골/)).not.toBeInTheDocument()
    expect(screen.queryByText(/신규/)).not.toBeInTheDocument()
    // No phone number (full or masked) anywhere in the markup.
    expect(container.textContent ?? '').not.toMatch(/01[016789][\d-]{6,}/)
    // Known demo customer names must never appear.
    for (const name of ['김서연', '이준호', '박지우', '최민재', '정하윤']) {
      expect(screen.queryByText(new RegExp(name))).not.toBeInTheDocument()
    }
  })

  it('shows the reached-reward copy when no points remain to the next reward', () => {
    render(
      <CustomerPointScreen
        balance={{ ...balance, points: 5000, pointsToNextReward: 0 }}
        onChangePhone={() => {}}
      />,
    )
    expect(screen.getByText(/무료 혜택을 받을 수 있어요/)).toBeInTheDocument()
  })

  it('invokes onChangePhone when the lookup-again control is pressed', async () => {
    const onChangePhone = vi.fn()
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CustomerPointScreen balance={balance} onChangePhone={onChangePhone} />)

    await user.click(screen.getByLabelText('다른 번호 조회'))
    expect(onChangePhone).toHaveBeenCalledTimes(1)
  })
})
