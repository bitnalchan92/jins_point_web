import { useEffect, useRef } from 'react'
import { env } from '../lib/env'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          action: string
          callback: (token: string) => void
          'expired-callback': () => void
          'error-callback': () => void
        },
      ) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileWidgetProps {
  onToken: (token: string) => void
  onExpire: () => void
  onError: () => void
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve()
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile_script_failed')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error('turnstile_script_failed')))
    document.head.appendChild(script)
  })
}

export default function TurnstileWidget({ onToken, onExpire, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const callbacks = useRef({ onToken, onExpire, onError })
  callbacks.current = { onToken, onExpire, onError }

  useEffect(() => {
    let cancelled = false
    let widgetId: string | undefined
    const container = containerRef.current

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !container || !window.turnstile) return
        widgetId = window.turnstile.render(container, {
          sitekey: env.turnstileSiteKey,
          action: 'lookup_balance',
          callback: (token) => callbacks.current.onToken(token),
          'expired-callback': () => callbacks.current.onExpire(),
          'error-callback': () => callbacks.current.onError(),
        })
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onError()
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId)
      }
    }
  }, [])

  return <div ref={containerRef} data-testid="turnstile-widget" />
}
