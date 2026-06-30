import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A controllable fake of the Supabase Realtime surface. The hook must call
// realtime.setAuth() *before* opening a channel, open a `private` channel on the
// owner topic, and route every broadcast through a single debounced refresh.
// `vi.hoisted` exposes the fake to the hoisted `vi.mock` factory below.
const rt = vi.hoisted(() => {
  const order: string[] = []
  const channel = {
    on: vi.fn((event: string, _opts: unknown, handler: (...a: unknown[]) => void) => {
      if (event === 'broadcast') rt.broadcastHandler = handler
      return channel
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      rt.subscribeCb = cb
      return channel
    }),
  }
  return {
    order,
    channel,
    broadcastHandler: undefined as ((...a: unknown[]) => void) | undefined,
    subscribeCb: undefined as ((status: string) => void) | undefined,
    setAuth: vi.fn(async () => {
      order.push('setAuth')
    }),
    channelFn: vi.fn((name: string, opts: unknown) => {
      order.push('channel')
      rt.lastChannelArgs = [name, opts]
      return channel
    }),
    removeChannel: vi.fn(() => {
      order.push('removeChannel')
    }),
    lastChannelArgs: undefined as [string, unknown] | undefined,
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    realtime: { setAuth: rt.setAuth },
    channel: rt.channelFn,
    removeChannel: rt.removeChannel,
  },
}))

import { useOwnerRealtime } from './useOwnerRealtime'

// Flush the microtask that the hook's async `start()` awaits (setAuth), so the
// channel is created before assertions run.
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  rt.order.length = 0
  rt.broadcastHandler = undefined
  rt.subscribeCb = undefined
  rt.lastChannelArgs = undefined
  rt.channel.on.mockClear()
  rt.channel.subscribe.mockClear()
  rt.setAuth.mockClear()
  rt.channelFn.mockClear()
  rt.removeChannel.mockClear()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('useOwnerRealtime', () => {
  it('does not open any socket when disabled (the customer route)', async () => {
    const refresh = vi.fn(async () => {})
    renderHook(() => useOwnerRealtime(false, refresh))
    await flush()

    expect(rt.setAuth).not.toHaveBeenCalled()
    expect(rt.channelFn).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('authenticates before opening a private channel on the owner topic', async () => {
    const refresh = vi.fn(async () => {})
    renderHook(() => useOwnerRealtime(true, refresh))
    await flush()

    expect(rt.setAuth).toHaveBeenCalledTimes(1)
    expect(rt.channelFn).toHaveBeenCalledTimes(1)
    // setAuth must precede channel creation.
    expect(rt.order).toEqual(['setAuth', 'channel'])
    expect(rt.lastChannelArgs).toEqual(['store:1:owner', { config: { private: true } }])
    expect(rt.channel.on).toHaveBeenCalledWith('broadcast', { event: '*' }, expect.any(Function))
    expect(rt.channel.subscribe).toHaveBeenCalledTimes(1)
  })

  it('debounces a burst of broadcasts into a single refresh after 150ms', async () => {
    const refresh = vi.fn(async () => {})
    renderHook(() => useOwnerRealtime(true, refresh))
    await flush()

    rt.broadcastHandler?.()
    rt.broadcastHandler?.()
    rt.broadcastHandler?.()
    expect(refresh).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes immediately once the channel is SUBSCRIBED', async () => {
    const refresh = vi.fn(async () => {})
    renderHook(() => useOwnerRealtime(true, refresh))
    await flush()

    act(() => {
      rt.subscribeCb?.('SUBSCRIBED')
    })
    expect(refresh).toHaveBeenCalledTimes(1)

    // A non-subscribed status must not refresh.
    act(() => {
      rt.subscribeCb?.('CHANNEL_ERROR')
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes when the tab becomes visible again', async () => {
    const refresh = vi.fn(async () => {})
    renderHook(() => useOwnerRealtime(true, refresh))
    await flush()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes (debounced) when the browser comes back online', async () => {
    const refresh = vi.fn(async () => {})
    renderHook(() => useOwnerRealtime(true, refresh))
    await flush()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(refresh).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('removes the channel and detaches listeners on unmount', async () => {
    const refresh = vi.fn(async () => {})
    const { unmount } = renderHook(() => useOwnerRealtime(true, refresh))
    await flush()

    unmount()
    expect(rt.removeChannel).toHaveBeenCalledTimes(1)
    expect(rt.removeChannel).toHaveBeenCalledWith(rt.channel)

    // After unmount, late OS events must not trigger a refresh.
    act(() => {
      window.dispatchEvent(new Event('online'))
      vi.advanceTimersByTime(150)
    })
    expect(refresh).not.toHaveBeenCalled()
  })
})
