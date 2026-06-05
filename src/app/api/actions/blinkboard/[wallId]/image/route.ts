import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWallImage } from '@/lib/image/generator';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { wallId: string } }
) {
  try {
    const { wallId } = params;
    const supabase = await createClient();

    // Get wall and its slots
    const { data: wall, error: wallError } = await supabase
      .from('walls')
      .select('*, slots(*)')
      .eq('id', wallId)
      .single();

    if (wallError || !wall) {
      return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
    }

    // Get purchases for occupied slots to show handles/avatars
    const { data: purchases, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('wall_id', wallId)
      .eq('status', 'CONFIRMED');

    // Map slots to include purchase data for the generator
    const slotsForImage = wall.slots.map((slot: any) => {
      const purchase = purchases?.find((p: any) => p.slot_id === slot.id);
      return {
        x: slot.grid_x,
        y: slot.grid_y,
        size: slot.grid_size,
        tier: slot.tier,
        purchase: purchase || null,
      };
    });

    const imageBuffer = await generateWallImage(
      slotsForImage,
      wall.occupied_credits,
      wall.total_credits
    );

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      },
    });
  } catch (error) {
    console.error('Error generating Blink image:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
