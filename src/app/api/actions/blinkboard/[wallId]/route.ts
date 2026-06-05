import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { GetBlinkResponse } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallId: string }> }
) {
  try {
    const { wallId } = await params;
    const supabase = await createClient();

    // Get wall info
    const { data: wall, error } = await supabase
      .from('walls')
      .select('*, slots(status)')
      .eq('id', wallId)
      .single();

    if (error || !wall) {
      return NextResponse.json({ error: 'Wall not found' }, { status: 404 });
    }

    const occupiedSlots = wall.slots.filter((s: any) => s.status === 'OCCUPIED').length;
    const totalSlots = wall.slots.length;
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/api/actions/blinkboard/${wallId}/image?t=${Date.now()}`;

    const response: GetBlinkResponse = {
      title: `BlinkBoard: ${wall.name}`,
      description: `¡Anúnciate en este muro! Ocupación: ${occupiedSlots}/${totalSlots}. Compra tu espacio directamente desde este Blink.`,
      image: imageUrl,
      label: 'Comprar Espacio',
      links: {
        actions: [
          {
            label: 'Comprar Slot',
            href: `${baseUrl}/api/actions/blinkboard/${wallId}/purchase`,
            parameters: [
              {
                name: 'slotId',
                label: 'ID del Slot (Selecciona de la lista)',
                required: true,
              },
              {
                name: 'duration',
                label: 'Duración (DAILY, WEEKLY, MONTHLY)',
                required: true,
              }
            ],
          },
        ],
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error in GET /blinkboard:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
