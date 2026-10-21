import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/privy';
import { createClient } from '@/lib/supabase/server';
import { packSlots } from '@/lib/algorithms/packing';
import { createWallSchema } from '@/lib/api/validation';
import { errorResponse } from '@/lib/api/http';
import { isValidSolanaAddress } from '@/lib/solana/actions';
import { WALL_TEMPLATES } from '@/lib/solana/constants';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // El creador sale del token de Privy verificado, nunca del body
    const user = await requireUser(request);
    const input = createWallSchema.parse(await request.json());

    if (!isValidSolanaAddress(input.walletAddress)) {
      return NextResponse.json({ error: 'La wallet de Solana no es válida' }, { status: 400 });
    }

    const packing = packSlots(WALL_TEMPLATES[input.layoutType] as Record<string, number>);
    if (!packing.isValid) {
      return NextResponse.json({ error: packing.error }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: wall, error: wallError } = await supabase
      .from('walls')
      .insert({
        creator_id: user.id,
        name: input.name,
        layout_type: input.layoutType,
        wallet_address: input.walletAddress,
        total_slots: packing.slots.length,
        total_credits: 64,
        occupied_credits: 0,
        is_active: true,
        layout_config: { prices: input.prices },
      })
      .select()
      .single();
    if (wallError || !wall) throw wallError ?? new Error('No se pudo crear el muro');

    const { error: slotsError } = await supabase.from('slots').insert(
      packing.slots.map((s) => ({
        wall_id: wall.id,
        tier: s.tier,
        grid_x: s.x,
        grid_y: s.y,
        grid_size: s.size,
        status: 'AVAILABLE',
      }))
    );
    if (slotsError) {
      await supabase.from('walls').delete().eq('id', wall.id);
      throw slotsError;
    }

    return NextResponse.json({ success: true, wallId: wall.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
