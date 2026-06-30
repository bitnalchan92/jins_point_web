import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Owner-only private Realtime invalidation.
//
// A broadcast is treated purely as a *signal*: it is never read as data. Every
// owner-side change (customer/reward_log/store_config) emits a private broadcast
// on `store:1:owner`; on receipt this hook debounces and triggers the provider's
// authoritative server refetch, so a second owner session converges on the
// server-computed truth. It also resyncs on (re)subscribe, tab refocus, and
// network recovery.
//
// `enabled` is gated to the authenticated aal2 owner. When false (the customer
// route, or before the owner store is ready) the hook opens no socket at all and
// calls neither setAuth nor channel.
export function useOwnerRealtime(enabled: boolean, refresh: () => Promise<void>): void {
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    let channel: ReturnType<typeof supabase.channel> | undefined
    const invalidate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 150)
    }
    const start = async () => {
      await supabase.realtime.setAuth()
      if (disposed) return
      channel = supabase
        .channel('store:1:owner', { config: { private: true } })
        .on('broadcast', { event: '*' }, invalidate)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void refresh()
        })
    }
    void start()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', invalidate)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      clearTimeout(timer)
      window.removeEventListener('online', invalidate)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, refresh])
}
