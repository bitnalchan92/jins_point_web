import { z } from 'zod'

export const balanceResponseSchema = z.object({
  points: z.number().int().nonnegative(),
  rewardThreshold: z.number().int().positive(),
  pointsToNextReward: z.number().int().nonnegative(),
  storeName: z.string().min(1),
  asOf: z.string().datetime(),
})

export type BalanceResponse = z.infer<typeof balanceResponseSchema>
