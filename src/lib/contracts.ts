import { z } from 'zod'

export const balanceResponseSchema = z.object({
  points: z.number().int().nonnegative(),
  rewardThreshold: z.number().int().positive(),
  pointsToNextReward: z.number().int().nonnegative(),
  storeName: z.string().min(1),
  asOf: z.string().datetime(),
})

export type BalanceResponse = z.infer<typeof balanceResponseSchema>

// ---------------------------------------------------------------------------
// Owner bootstrap DTO (GET /owner-api). Must mirror the OwnerBootstrap shape
// produced by supabase/functions/owner-api/index.ts exactly.
// ---------------------------------------------------------------------------

export const ownerCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phoneE164: z.string(),
  points: z.number().int().nonnegative(),
  visits: z.number().int().nonnegative(),
  lastVisitedAt: z.string().nullable(),
})

export const ownerRewardSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  type: z.enum(['earn', 'use']),
  amount: z.number().int(),
  pointsDelta: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export const ownerStoreSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  rewardRate: z.number().positive(),
  rewardThreshold: z.number().int().positive(),
  redeemUnit: z.number().int().positive(),
})

export const ownerBootstrapSchema = z.object({
  customers: z.array(ownerCustomerSchema),
  recentRewards: z.array(ownerRewardSchema),
  store: ownerStoreSchema,
})

export type OwnerCustomer = z.infer<typeof ownerCustomerSchema>
export type OwnerReward = z.infer<typeof ownerRewardSchema>
export type OwnerBootstrap = z.infer<typeof ownerBootstrapSchema>

// Server-authoritative result of an apply_reward mutation. The client never
// computes these values; it only renders what the RPC returns.
export const rewardResultSchema = z.object({
  pointsDelta: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
})

export type RewardResult = z.infer<typeof rewardResultSchema>
