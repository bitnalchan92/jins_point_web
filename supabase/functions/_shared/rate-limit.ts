import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function clients(): {
  global: Ratelimit
  ip: Ratelimit
  phone: Ratelimit
} {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL')
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')
  if (!url || !token) throw new Error('rate_limit_not_configured')

  const redis = new Redis({ url, token })
  return {
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(300, '1 m'),
      prefix: 'lookup:global',
    }),
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 m'),
      prefix: 'lookup:ip',
    }),
    phone: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'lookup:phone',
    }),
  }
}

export async function enforcePreVerificationLimits(ip: string): Promise<void> {
  const rate = clients()
  const results = await Promise.all([rate.global.limit('all'), rate.ip.limit(ip)])
  if (results.some((result) => !result.success)) throw new Error('rate_limited')
}

export async function enforcePhoneLimit(phoneDigest: string): Promise<void> {
  const result = await clients().phone.limit(phoneDigest)
  if (!result.success) throw new Error('rate_limited')
}
