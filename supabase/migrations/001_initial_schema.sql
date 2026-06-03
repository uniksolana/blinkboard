-- Create creators table
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_id TEXT UNIQUE NOT NULL,
  x_handle TEXT UNIQUE NOT NULL,
  x_id TEXT UNIQUE NOT NULL,
  avatar_url TEXT NOT NULL,
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create walls table
CREATE TABLE walls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_type TEXT NOT NULL CHECK (layout_type IN ('EXCLUSIVE', 'GRANDE', 'MEDIANA', 'COMUNITARIA', 'HYBRID')),
  total_slots INTEGER NOT NULL DEFAULT 64,
  total_credits INTEGER NOT NULL DEFAULT 64,
  occupied_credits INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  layout_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create slots table
CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id UUID NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('STANDARD', 'GOLD', 'PLATINUM', 'VIP')),
  grid_x INTEGER NOT NULL,
  grid_y INTEGER NOT NULL,
  grid_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'EXPIRED')),
  reserved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchases table
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  wall_id UUID NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
  buyer_user_id UUID,
  buyer_wallet TEXT NOT NULL,
  buyer_x_handle TEXT NOT NULL,
  buyer_x_id TEXT NOT NULL,
  buyer_avatar_url TEXT NOT NULL,
  tx_signature TEXT UNIQUE,
  amount_usdc NUMERIC(10, 2) NOT NULL,
  duration TEXT NOT NULL CHECK (duration IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for better query performance
CREATE INDEX idx_walls_creator_id ON walls(creator_id);
CREATE INDEX idx_walls_is_active ON walls(is_active);
CREATE INDEX idx_slots_wall_id ON slots(wall_id);
CREATE INDEX idx_slots_status ON slots(status);
CREATE INDEX idx_purchases_wall_id ON purchases(wall_id);
CREATE INDEX idx_purchases_slot_id ON purchases(slot_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_tx_signature ON purchases(tx_signature);
CREATE INDEX idx_purchases_buyer_wallet ON purchases(buyer_wallet);

-- Row Level Security Policies
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE walls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Creators RLS: Users can only see their own data
CREATE POLICY creators_select ON creators FOR SELECT
  USING (auth.uid()::text = auth0_id);

-- Walls RLS: Users can see their own walls and public walls
CREATE POLICY walls_select ON walls FOR SELECT
  USING (creator_id::text = auth.uid()::text OR is_active = TRUE);

CREATE POLICY walls_insert ON walls FOR INSERT
  WITH CHECK (creator_id::text = auth.uid()::text);

CREATE POLICY walls_update ON walls FOR UPDATE
  USING (creator_id::text = auth.uid()::text);

-- Slots RLS: Users can see slots of walls they own
CREATE POLICY slots_select ON slots FOR SELECT
  USING (wall_id IN (SELECT id FROM walls WHERE creator_id::text = auth.uid()::text OR is_active = TRUE));

-- Purchases RLS: Users can see their own purchases
CREATE POLICY purchases_select ON purchases FOR SELECT
  USING (buyer_user_id::text = auth.uid()::text OR wall_id IN (SELECT id FROM walls WHERE creator_id::text = auth.uid()::text));
