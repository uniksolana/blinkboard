import { z } from 'zod';

export const createWallSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(50),
  layoutType: z.enum(['EXCLUSIVE', 'GRANDE', 'MEDIANA', 'COMUNITARIA', 'HYBRID']),
  hybridConfig: z.record(z.string(), z.number()).optional(),
});

export const createPurchaseSchema = z.object({
  wallId: z.string().uuid(),
  slotId: z.string().uuid(),
  buyerWallet: z.string(),
  amount: z.number().positive(),
  duration: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  message: z.string().optional(),
});
