import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { releaseExpiredSlots } from '@/lib/purchases/service';
import { getTierDailyPrice, type TierPrices } from '@/lib/pricing';
import type { TierId } from '@/lib/solana/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Datos públicos de un muro: slots, precios y patrocinadores activos. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ wallId: string }> }) {
  const { wallId } = await params;
  if (!UUID_RE.test(wallId)) return NextResponse.json({ error: 'Muro no encontrado' }, { status: 404 });

  await releaseExpiredSlots();
  const supabase = await createClient();

  const { data: wall } = await supabase
    .from('walls')
    .select('id, name, layout_type, is_active, layout_config, occupied_credits, total_credits, wallet_address')
    .eq('id', wallId)
    .maybeSingle();
  if (!wall || !wall.is_active) return NextResponse.json({ error: 'Muro no encontrado' }, { status: 404 });

  const [{ data: slots }, { data: purchases }] = await Promise.all([
    supabase.from('slots').select('id, wall_id, tier, grid_x, grid_y, grid_size, status, current_purchase_id').eq('wall_id', wallId),
    supabase
      .from('purchases')
      .select('id, slot_id, buyer_x_handle, buyer_avatar_url, message, expires_at')
      .eq('wall_id', wallId)
      .eq('status', 'CONFIRMED'),
  ]);

  const prices = (wall.layout_config as { prices?: TierPrices } | null)?.prices;
  const byId = new Map((purchases ?? []).map((p) => [p.id, p]));

  return NextResponse.json(
    {
      wall: {
        id: wall.id,
        name: wall.name,
        layout_type: wall.layout_type,
        occupied_credits: wall.occupied_credits,
        total_credits: wall.total_credits,
        accepts_payments: !!wall.wallet_address,
        prices: {
          STANDARD: getTierDailyPrice(prices, 'STANDARD'),
          GOLD: getTierDailyPrice(prices, 'GOLD'),
          PLATINUM: getTierDailyPrice(prices, 'PLATINUM'),
          VIP: getTierDailyPrice(prices, 'VIP'),
        },
      },
      slots: (slots ?? []).map((s) => {
        const p = s.status === 'OCCUPIED' && s.current_purchase_id ? byId.get(s.current_purchase_id) : undefined;
        return {
          id: s.id,
          wall_id: s.wall_id,
          tier: s.tier,
          grid_x: s.grid_x,
          grid_y: s.grid_y,
          grid_size: s.grid_size,
          status: s.status,
          price_usdc: getTierDailyPrice(prices, s.tier as TierId),
          purchase: p
            ? {
                buyer_x_handle: p.buyer_x_handle,
                buyer_avatar_url: p.buyer_avatar_url,
                message: p.message,
                expires_at: p.expires_at,
              }
            : null,
        };
      }),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
