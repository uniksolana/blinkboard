import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { packSlots } from '@/lib/algorithms/packing';
import { createWallSchema } from '@/lib/api/validation';
import { WALL_TEMPLATES, TIERS } from '@/lib/solana/constants';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createWallSchema.parse(body);

    const supabase = await createClient();

    // Get current user (from Auth0 context)
    const userId = body.userId; // This should come from Auth0 middleware

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Determine tier configuration
    let tierCounts: Record<string, number> = {
      STANDARD: 0,
      GOLD: 0,
      PLATINUM: 0,
      VIP: 0,
    };

    if (validated.layoutType === 'HYBRID') {
      if (!validated.hybridConfig) {
        return NextResponse.json(
          { error: 'Hybrid config required for HYBRID layout' },
          { status: 400 }
        );
      }
      tierCounts = validated.hybridConfig;
    } else {
      // Use template configuration
      if (validated.layoutType === 'EXCLUSIVE') {
        tierCounts = { STANDARD: 0, GOLD: 0, PLATINUM: 0, VIP: 1 };
      } else if (validated.layoutType === 'GRANDE') {
        tierCounts = { STANDARD: 0, GOLD: 0, PLATINUM: 0, VIP: 4 };
      } else if (validated.layoutType === 'MEDIANA') {
        tierCounts = { STANDARD: 0, GOLD: 16, PLATINUM: 0, VIP: 0 };
      } else if (validated.layoutType === 'COMUNITARIA') {
        tierCounts = { STANDARD: 64, GOLD: 0, PLATINUM: 0, VIP: 0 };
      }
    }

    // Pack slots
    const packingResult = packSlots(tierCounts);

    if (!packingResult.isValid) {
      return NextResponse.json(
        { error: packingResult.error },
        { status: 400 }
      );
    }

    // Create wall
    const { data: wall, error: wallError } = await supabase
      .from('walls')
      .insert([
        {
          creator_id: userId,
          name: validated.name,
          layout_type: validated.layoutType,
          total_slots: packingResult.slots.length,
          total_credits: 64,
          occupied_credits: 0,
          is_active: true,
          layout_config: packingResult.slots,
        },
      ])
      .select()
      .single();

    if (wallError || !wall) {
      return NextResponse.json(
        { error: 'Failed to create wall' },
        { status: 500 }
      );
    }

    // Create slots
    const slotsToInsert = packingResult.slots.map(slot => ({
      wall_id: wall.id,
      tier: slot.tier,
      grid_x: slot.x,
      grid_y: slot.y,
      grid_size: slot.size,
      status: 'AVAILABLE' as const,
    }));

    const { error: slotsError } = await supabase
      .from('slots')
      .insert(slotsToInsert);

    if (slotsError) {
      // Cleanup wall if slots creation fails
      await supabase.from('walls').delete().eq('id', wall.id);

      return NextResponse.json(
        { error: 'Failed to create slots' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        wallId: wall.id,
        message: 'Wall created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating wall:', error);
    return NextResponse.json(
      { error: 'Failed to create wall' },
      { status: 500 }
    );
  }
}
