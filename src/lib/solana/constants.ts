export const TIERS = {
  STANDARD: { id: 'STANDARD', size: 1, credits: 1, minPriceUSDC: 10 },
  GOLD: { id: 'GOLD', size: 2, credits: 4, minPriceUSDC: 30 },
  PLATINUM: { id: 'PLATINUM', size: 3, credits: 9, minPriceUSDC: 70 },
  VIP: { id: 'VIP', size: 4, credits: 16, minPriceUSDC: 150 },
};

export const WALL_TEMPLATES = {
  EXCLUSIVE: { VIP: 4 }, // 4 VIP slots = 64 credits
  GRANDE: { VIP: 4 },
  MEDIANA: { GOLD: 16 },
  COMUNITARIA: { STANDARD: 64 },
};

export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
export const USDC_MINT = process.env.USDC_MINT_ADDRESS || 'EPjFWaJHqjZjqjZjqjZjqjZjqjZjqjZjqjZjqjZjqjZj';
export const TREASURY_WALLET = process.env.SOLANA_TREASURY_WALLET;
