import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBalanceLookup } from './useBalanceLookup'

const dto = {
  points: 3420,
  rewardThreshold: 5000,
  pointsToNextReward: 1580,
  storeName: '달콤한 진스쿡',
  asOf: '2026-06-29T00:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('useBalanceLookup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends phone and Turnstile token and exposes the minimal DTO', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(dto))

    const { result } = renderHook(() => useBalanceLookup())
    await act(async () => {
      await result.current.lookup('010-2345-7788', 'token')
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/lookup-balance'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone: '010-2345-7788', turnstileToken: 'token' }),
      }),
    )
    expect(result.current.state).toEqual({ status: 'success', data: dto })
  })

  it('rejects a response that does not match the minimal DTO schema', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ...dto, name: '김서연', phoneE164: '+821023457788' }, 200),
    )

    const { result } = renderHook(() => useBalanceLookup())
    await act(async () => {
      await result.current.lookup('010-2345-7788', 'token')
    })

    // Extra PII fields are stripped: success state carries only the parsed DTO.
    expect(result.current.state).toEqual({ status: 'success', data: dto })
    if (result.current.state.status === 'success') {
      expect(Object.keys(result.current.state.data).sort()).toEqual(
        ['asOf', 'points', 'pointsToNextReward', 'rewardThreshold', 'storeName'].sort(),
      )
    }
  })

  it('does not re-submit while a lookup is already in flight', async () => {
    let resolveFetch: (response: Response) => void = () => {}
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )

    const { result } = renderHook(() => useBalanceLookup())
    act(() => {
      void result.current.lookup('010-2345-7788', 'token')
    })
    expect(result.current.state.status).toBe('loading')

    act(() => {
      void result.current.lookup('010-0000-0000', 'token2')
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch(jsonResponse(dto))
      await Promise.resolve()
    })
    expect(result.current.state.status).toBe('success')
  })

  it('maps a 429 response to a RATE_LIMITED error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: { code: 'RATE_LIMITED', message: '...' } }, 429),
    )

    const { result } = renderHook(() => useBalanceLookup())
    await act(async () => {
      await result.current.lookup('010-2345-7788', 'token')
    })

    expect(result.current.state).toEqual({ status: 'error', code: 'RATE_LIMITED' })
  })

  it('maps a 503 response to an UNAVAILABLE error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: { code: 'UNAVAILABLE', message: '...' } }, 503),
    )

    const { result } = renderHook(() => useBalanceLookup())
    await act(async () => {
      await result.current.lookup('010-2345-7788', 'token')
    })

    expect(result.current.state).toEqual({ status: 'error', code: 'UNAVAILABLE' })
  })

  it('maps a network failure to an UNAVAILABLE error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useBalanceLookup())
    await act(async () => {
      await result.current.lookup('010-2345-7788', 'token')
    })

    expect(result.current.state).toEqual({ status: 'error', code: 'UNAVAILABLE' })
  })

  it('resets a previous result back to idle', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(dto))

    const { result } = renderHook(() => useBalanceLookup())
    await act(async () => {
      await result.current.lookup('010-2345-7788', 'token')
    })
    expect(result.current.state.status).toBe('success')

    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toEqual({ status: 'idle' })
  })
})
