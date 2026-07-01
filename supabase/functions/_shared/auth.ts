import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

/**
 * An error carrying a stable HTTP status + machine code. The message is never
 * surfaced to clients verbatim — handlers map `code` to a generic message.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code)
    this.name = 'HttpError'
  }
}

export type UserClient = SupabaseClient<Database>

export type CreateUserClient = (token: string) => UserClient

export interface OwnerContext {
  client: UserClient
  userId: string
}

/**
 * Builds a USER-SCOPED client: the caller's JWT is attached as the bearer for
 * every PostgREST/RPC request, so Postgres RLS is enforced as that user. We use
 * the publishable/anon key here, never the service-role secret.
 */
export function defaultCreateUserClient(token: string): UserClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!url || !anon) throw new HttpError(500, 'SERVER_MISCONFIGURED')
  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new HttpError(401, 'UNAUTHORIZED')
  const token = match[1].trim()
  if (!token) throw new HttpError(401, 'UNAUTHORIZED')
  return token
}

/**
 * Decode the `sub` claim from a JWT without a network call.
 * PostgREST already verifies the signature on every query, so we can trust the
 * payload — we just need the user ID to filter the app_user_roles query.
 */
function userIdFromJwt(token: string): string {
  try {
    const raw = token.split('.')[1]
    if (!raw) throw new Error('no payload')
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      raw.length + (4 - (raw.length % 4)) % 4,
      '=',
    )
    const payload = JSON.parse(atob(padded)) as { sub?: string }
    if (!payload.sub) throw new Error('no sub')
    return payload.sub
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED')
  }
}

/**
 * Verifies the caller is an owner authenticated at aal2.
 *
 * 1. No Authorization header / empty token -> 401.
 * 2. Decodes `sub` from the JWT locally (no Auth API call); PostgREST verifies
 *    the JWT signature on every query using the project JWT secret.
 * 3. Filters `app_user_roles` by the decoded user_id. The `owner_read_roles`
 *    RLS policy enforces `private.is_owner_aal2()`. An aal1 owner or a
 *    non-owner aal2 user sees no row -> 403.
 *
 * Avoids calling `auth.getUser(token)` (Auth API network round-trip) which can
 * hit per-account rate limits under rapid CI load and surface as spurious 401s.
 */
export async function authenticateOwner(
  request: Request,
  createUserClient: CreateUserClient = defaultCreateUserClient,
): Promise<OwnerContext> {
  const token = bearerToken(request)
  const userId = userIdFromJwt(token)
  const client = createUserClient(token)

  // PostgREST verifies the JWT signature on every query. A JWT error (expired,
  // bad signature) surfaces as a non-null roleError. A valid JWT with no
  // matching owner+aal2 row (aal1 or non-owner) produces null data -> 403.
  const { data: role, error: roleError } = await client
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle()

  if (roleError) throw new HttpError(401, 'UNAUTHORIZED')
  if (!role) throw new HttpError(403, 'OWNER_AAL2_REQUIRED')

  return { client, userId }
}
