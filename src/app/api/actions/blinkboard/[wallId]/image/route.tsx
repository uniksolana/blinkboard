import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallId: string }> }
) {
  try {
    const { wallId } = await params;
    const supabase = await createClient();

    // Get wall and its slots
    const { data: wall, error: wallError } = await supabase
      .from('walls')
      .select('*, slots(*)')
      .eq('id', wallId)
      .single();

    if (wallError || !wall) {
      return new Response('Wall not found', { status: 404 });
    }

    // Get purchases for occupied slots to show handles/avatars
    const { data: purchases } = await supabase
      .from('purchases')
      .select('*')
      .eq('wall_id', wallId)
      .eq('status', 'CONFIRMED');

    // Map slots
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

    const occupancyPercent = Math.round((wall.occupied_credits / (wall.total_credits || 64)) * 100);

    const CELL_SIZE = 60;
    const GAP = 4;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0f172a',
            padding: '40px',
            color: '#ffffff',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '48px', fontWeight: 'bold' }}>BlinkBoard</h1>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#8b5cf6' }}>
              {occupancyPercent}% ocupado
            </div>
          </div>
          <div
            style={{
              position: 'relative',
              width: '480px',
              height: '480px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              alignSelf: 'center',
              display: 'flex',
            }}
          >
            {slotsForImage.map((slot: any, index: number) => {
              const left = slot.x * CELL_SIZE;
              const top = slot.y * CELL_SIZE;
              const width = slot.size * CELL_SIZE - GAP;
              const height = slot.size * CELL_SIZE - GAP;

              if (slot.purchase) {
                return (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#8b5cf6',
                      borderRadius: '4px',
                      padding: '8px',
                      color: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '16px',
                        backgroundColor: '#e0e7ff',
                        marginBottom: '4px',
                      }}
                    />
                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                      @{slot.purchase.buyer_x_handle}
                    </span>
                  </div>
                );
              }

              const tierColors: Record<string, string> = {
                VIP: '#ec4899',
                PLATINUM: '#06b6d4',
                GOLD: '#f59e0b',
                STANDARD: '#64748b',
              };

              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tierColors[slot.tier] || '#64748b',
                    borderRadius: '4px',
                    opacity: 0.3,
                    fontSize: '8px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                  }}
                >
                  {slot.tier}
                </div>
              );
            })}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error: any) {
    console.error('Error generating Blink image:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
