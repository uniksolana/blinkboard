import { DURATION_MULTIPLIER, PLATFORM_FEE_BPS, TIERS, TREASURY_WALLET, USDC_DECIMALS } from './solana/constants';
import type { Duration, TierId } from './solana/constants';

export type TierPrices = Partial<Record<TierId, number>>;

/** Precio diario configurado por el creador para un tier (o el mínimo del tier). */
export function getTierDailyPrice(prices: TierPrices | null | undefined, tier: TierId): number {
  const configured = prices?.[tier];
  const min = TIERS[tier].minPriceUSDC;
  if (typeof configured !== 'number' || !Number.isFinite(configured)) return min;
  return Math.max(configured, min);
}

/** Precio total en USDC para un tier y una duración. Lo usan cliente y servidor. */
export function getSlotPriceUSDC(prices: TierPrices | null | undefined, tier: TierId, duration: Duration): number {
  return roundUSDC(getTierDailyPrice(prices, tier) * DURATION_MULTIPLIER[duration]);
}

export function roundUSDC(n: number): number {
  return Math.round(n * 100) / 100;
}

export function usdcToMicro(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

/** Reparto del pago entre el creador y la plataforma (en unidades mínimas). */
export function splitPayment(totalMicro: bigint): { creatorMicro: bigint; feeMicro: bigint } {
  if (!TREASURY_WALLET || PLATFORM_FEE_BPS === 0) {
    return { creatorMicro: totalMicro, feeMicro: BigInt(0) };
  }
  const feeMicro = (totalMicro * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
  return { creatorMicro: totalMicro - feeMicro, feeMicro };
}
