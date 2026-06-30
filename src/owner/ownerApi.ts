import { supabase } from '../lib/supabase'
import { env } from '../lib/env'
import { ownerBootstrapSchema, rewardResultSchema } from '../lib/contracts'
import type { OwnerBootstrap, RewardResult } from '../lib/contracts'

// Stable error codes surfaced to the owner UI. They mirror the codes returned
// by supabase/functions/owner-api/index.ts; internal SQL detail never leaks.
export type OwnerApiErrorCode =
  | 'UNAUTHORIZED'
  | 'OWNER_AAL2_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UNPROCESSABLE'
  | 'DUPLICATE_CUSTOMER'
  | 'CUSTOMER_NOT_FOUND'
  | 'INVALID_PHONE'
  | 'INVALID_REQUEST'
  | 'FORBIDDEN'
  | 'UNAVAILABLE'
  | 'INTERNAL'

export class OwnerApiError extends Error {
  readonly status: number
  readonly code: OwnerApiErrorCode

  constructor(status: number, code: OwnerApiErrorCode) {
    super(code)
    this.name = 'OwnerApiError'
    this.status = status
    this.code = code
  }
}

const OWNER_PATH = '/functions/v1/owner-api'

// Every request rides the authenticated browser session's aal2 JWT. The edge
// function + RLS + RPC re-check role and aal independently of the UI.
async function ownerFetch(init: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new OwnerApiError(401, 'UNAUTHORIZED')

  try {
    return await fetch(`${env.supabaseUrl}${OWNER_PATH}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        apikey: env.supabasePublishableKey,
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw new OwnerApiError(0, 'UNAVAILABLE')
  }
}

async function fail(res: Response): Promise<never> {
  let code: OwnerApiErrorCode | undefined
  try {
    const body = (await res.json()) as { error?: { code?: string } }
    code = body.error?.code as OwnerApiErrorCode | undefined
  } catch {
    // Body may be empty or non-JSON; fall through to status-based mapping.
  }
  throw new OwnerApiError(res.status, code ?? (res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL'))
}

export async function fetchOwnerBootstrap(): Promise<OwnerBootstrap> {
  const res = await ownerFetch({ method: 'GET' })
  if (!res.ok) await fail(res)
  const parsed = ownerBootstrapSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new OwnerApiError(res.status, 'INTERNAL')
  return parsed.data
}

export async function createCustomer(phone: string, name: string): Promise<void> {
  const res = await ownerFetch({
    method: 'POST',
    body: JSON.stringify({ action: 'create_customer', name, phone }),
  })
  if (!res.ok) await fail(res)
}

export async function applyReward(
  customerId: string,
  type: 'earn' | 'use',
  amount: number,
  idempotencyKey: string,
): Promise<RewardResult> {
  const res = await ownerFetch({
    method: 'POST',
    body: JSON.stringify({ action: 'apply_reward', customerId, type, amount, idempotencyKey }),
  })
  if (!res.ok) await fail(res)
  const parsed = rewardResultSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new OwnerApiError(res.status, 'INTERNAL')
  return parsed.data
}

export async function updateRate(rewardRate: number): Promise<void> {
  const res = await ownerFetch({
    method: 'POST',
    body: JSON.stringify({ action: 'update_store', rewardRate }),
  })
  if (!res.ok) await fail(res)
}
