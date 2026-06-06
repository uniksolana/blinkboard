// User & Creator Types
export interface Creator {
  id: string;
  auth0_id: string;
  x_handle: string;
  x_id: string;
  avatar_url: string;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

// Wall Types
export interface Wall {
  id: string;
  creator_id: string;
  name: string;
  layout_type: 'EXCLUSIVE' | 'GRANDE' | 'MEDIANA' | 'COMUNITARIA' | 'HYBRID';
  wallet_address: string | null;
  total_slots: number;
  total_credits: number; // Always 64
  occupied_credits: number;
  is_active: boolean;
  layout_config: {
    prices: Record<string, number>;
  } | null;
  created_at: string;
  updated_at: string;
}

// Tier Types
export interface Tier {
  id: 'STANDARD' | 'GOLD' | 'PLATINUM' | 'VIP';
  size: number; // 1x1=1, 2x2=4, 3x3=9, 4x4=16
  credits: number;
  min_price_usdc: number;
}

// Slot Types
export interface Slot {
  id: string;
  wall_id: string;
  tier: 'STANDARD' | 'GOLD' | 'PLATINUM' | 'VIP';
  grid_x: number;
  grid_y: number;
  grid_size: number; // 1, 2, 3, or 4
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'EXPIRED';
  reserved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Purchase Types
export interface Purchase {
  id: string;
  slot_id: string;
  wall_id: string;
  buyer_user_id: string;
  buyer_wallet: string;
  buyer_x_handle: string;
  buyer_x_id: string;
  buyer_avatar_url: string;
  tx_signature: string | null;
  amount_usdc: number;
  duration: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  starts_at: string;
  expires_at: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
  message: string | null;
  created_at: string;
  updated_at: string;
}

// Blink & Action Types
export interface BlinkRequest {
  account?: string;
}

export interface GetBlinkResponse {
  title: string;
  description: string;
  image: string;
  label: string;
  links: {
    actions: {
      label: string;
      href: string;
      parameters?: Array<{
        name: string;
        label: string;
        required?: boolean;
      }>;
    }[];
  };
}

export interface PostBlinkResponse {
  transaction: string;
  message?: string;
}

// Webhook Types
export interface HeliusWebhook {
  signature: string;
  description: string;
  type: string;
  events: Array<{
    type: string;
    signature: string;
    source: string;
    description: string;
    timestamp: number;
    accountData: Array<{
      account: string;
      nativeBalanceChange: number;
      tokenBalanceChanges: Array<{
        mint: string;
        decimals: number;
        changes: Array<{
          type: string;
          from: string;
          to: string;
          tokenAmount: {
            decimals: number;
            tokenAmount: string;
          };
        }>;
      }>;
    }>;
  }>;
}

// Image Generation Types
export interface ImageGenerationRequest {
  wall_id: string;
  format?: 'png' | 'jpeg';
}
