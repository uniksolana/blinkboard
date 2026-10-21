export type TierId = 'STANDARD' | 'GOLD' | 'PLATINUM' | 'VIP';
export type Duration = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export const TIERS: Record<TierId, { id: TierId; size: number; credits: number; minPriceUSDC: number }> = {
  STANDARD: { id: 'STANDARD', size: 1, credits: 1, minPriceUSDC: 10 },
  GOLD: { id: 'GOLD', size: 2, credits: 4, minPriceUSDC: 30 },
  PLATINUM: { id: 'PLATINUM', size: 3, credits: 9, minPriceUSDC: 70 },
  VIP: { id: 'VIP', size: 4, credits: 16, minPriceUSDC: 150 },
};

export const TIER_IDS = Object.keys(TIERS) as TierId[];

// Cuántas veces el precio diario se cobra por cada duración
export const DURATION_MULTIPLIER: Record<Duration, number> = {
  DAILY: 1,
  WEEKLY: 5,
  MONTHLY: 15,
};

export const DURATION_DAYS: Record<Duration, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
};

// Plantillas: cuántos slots de cada tier (siempre suman 64 créditos)
export const WALL_TEMPLATES: Record<string, Partial<Record<TierId, number>>> = {
  EXCLUSIVE: { VIP: 4 },
  GRANDE: { VIP: 4 },
  MEDIANA: { GOLD: 16 },
  COMUNITARIA: { STANDARD: 64 },
  HYBRID: { VIP: 1, PLATINUM: 2, GOLD: 4, STANDARD: 14 },
};

export const RESERVATION_MINUTES = 5;

export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as
  | 'devnet'
  | 'mainnet-beta';

// Mints oficiales de USDC (Circle)
const USDC_MINTS = {
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const;

export const USDC_MINT = process.env.USDC_MINT_ADDRESS || USDC_MINTS[SOLANA_NETWORK] || USDC_MINTS.devnet;
export const USDC_DECIMALS = 6;

export const TREASURY_WALLET = process.env.SOLANA_TREASURY_WALLET || null;

// Comisión de la plataforma en puntos básicos (100 = 1%). Requiere TREASURY_WALLET.
export const PLATFORM_FEE_BPS = Math.max(0, Math.min(5000, Number(process.env.PLATFORM_FEE_BPS || 0)));

export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const MEMO_PREFIX = 'blinkboard_purchase:';

export const BLOCKCHAIN_IDS = {
  'mainnet-beta': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  devnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
} as const;

export function getServerRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    (SOLANA_NETWORK === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com')
  );
}
