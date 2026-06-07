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
    const imageUrl = `${baseUrl}/api/actions/blinkboard/${wallId}/image.png?t=${Date.now()}`;

    const response: any = {
      title: `BlinkBoard: ${wall.name}`,
      description: `¡Anúnciate en este muro! Ocupación: ${occupiedSlots}/${totalSlots}. Elige tu espacio, conéctate con X y paga en segundos.`,
      image: imageUrl,
      label: 'Elegir Slot y Comprar',
      links: {
        actions: [
          {
            label: 'Elegir Slot y Comprar',
            href: `${baseUrl}/api/actions/blinkboard/${wallId}/purchase`,
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
