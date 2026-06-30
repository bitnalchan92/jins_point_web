import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '../../supabase/functions/_shared/database.types'

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
