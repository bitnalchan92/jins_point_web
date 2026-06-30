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
 * Verifies the caller is an owner authenticated at aal2.
 *
 * 1. No Authorization header / empty token -> 401.
 * 2. `auth.getUser(token)` rejects an invalid/expired JWT -> 401.
 * 3. A user-scoped SELECT on `app_user_roles` returns a row ONLY when the
 *    `owner_read_roles` RLS policy passes, i.e. `private.is_owner_aal2()`.
 *    An aal1 owner or a non-owner aal2 user therefore sees no row -> 403.
 *
 * The private-schema function is never exposed via the Data API; we observe its
 * effect indirectly through the RLS-filtered SELECT.
 */
export async function authenticateOwner(
  request: Request,
  createUserClient: CreateUserClient = defaultCreateUserClient,
): Promise<OwnerContext> {
  const token = bearerToken(request)
  const client = createUserClient(token)

  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData?.user) throw new HttpError(401, 'UNAUTHORIZED')

  const { data: role } = await client
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'owner')
    .maybeSingle()
  if (!role) throw new HttpError(403, 'OWNER_AAL2_REQUIRED')

  return { client, userId: userData.user.id }
}
