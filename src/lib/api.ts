import { balanceResponseSchema } from './contracts'
import type { BalanceResponse } from './contracts'
import { env } from './env'

export type ApiErrorCode = 'INVALID_REQUEST' | 'RATE_LIMITED' | 'UNAVAILABLE'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode) {
    super(code)
    this.name = 'ApiError'
    this.code = code
  }
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 429) return 'RATE_LIMITED'
  // Any client-side rejection (bad input / origin / method / unprocessable) is
  // surfaced as a single stable INVALID_REQUEST code to the UI.
  if (status >= 400 && status < 500) return 'INVALID_REQUEST'
  return 'UNAVAILABLE'
}

const LOOKUP_PATH = '/functions/v1/lookup-balance'

export async function lookupBalance(
  phone: string,
  turnstileToken: string,
): Promise<BalanceResponse> {
  let response: Response
  try {
    response = await fetch(`${env.supabaseUrl}${LOOKUP_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: env.supabasePublishableKey,
        authorization: `Bearer ${env.supabasePublishableKey}`,
      },
      body: JSON.stringify({ phone, turnstileToken }),
    })
  } catch {
    throw new ApiError('UNAVAILABLE')
  }

  if (!response.ok) {
    throw new ApiError(codeForStatus(response.status))
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('UNAVAILABLE')
  }

  const parsed = balanceResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError('UNAVAILABLE')
  }
  return parsed.data
}
