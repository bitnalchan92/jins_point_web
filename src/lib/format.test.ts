import { describe, expect, it } from 'vitest'
import { formatPhone, onlyDigits } from './format'

describe('phone formatting', () => {
  it('formats a Korean mobile number without changing its digits', () => {
    expect(formatPhone('01023457788')).toBe('010-2345-7788')
    expect(onlyDigits('010-2345-7788')).toBe('01023457788')
  })
})
