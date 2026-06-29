import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest is configured without `globals: true`, so React Testing Library's
// automatic afterEach cleanup is not auto-registered. Register it explicitly so
// mounted components do not leak between tests.
afterEach(() => {
  cleanup()
})
