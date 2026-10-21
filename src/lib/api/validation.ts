import { z } from 'zod';
import { TIERS } from '@/lib/solana/constants';

const tierEnum = z.enum(['STANDARD', 'GOLD', 'PLATINUM', 'VIP']);
const durationEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

const price = (min: number) => z.number().finite().min(min, `mínimo ${min} USDC`).max(1_000_000);

export const createWallSchema = z.object({
  name: z.string().trim().min(1).max(50),
  layoutType: z.enum(['EXCLUSIVE', 'GRANDE', 'MEDIANA', 'COMUNITARIA', 'HYBRID']),
  walletAddress: z.string().trim().min(32).max(44),
  prices: z.object({
    STANDARD: price(TIERS.STANDARD.minPriceUSDC),
    GOLD: price(TIERS.GOLD.minPriceUSDC),
    PLATINUM: price(TIERS.PLATINUM.minPriceUSDC),
    VIP: price(TIERS.VIP.minPriceUSDC),
  }),
});

// Compra desde la web (slot concreto). El precio NO lo envía el cliente.
export const webPurchaseSchema = z.object({
  slotId: z.string().uuid(),
  buyerWallet: z.string().min(32).max(44),
  duration: durationEnum,
  message: z.string().max(140).optional().nullable(),
});

// Compra desde el Blink (Solana Actions): el slot se asigna por tier
export const blinkQuerySchema = z.object({
  tier: tierEnum,
  duration: durationEnum,
  handle: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v ? v.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15) : undefined)),
});

export const blinkBodySchema = z.object({
  account: z.string().min(32).max(44),
});

export const confirmSchema = z.object({
  purchaseId: z.string().uuid(),
  txSignature: z.string().min(64).max(90),
});
