import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createUSDCTransferTransaction } from '@/lib/solana/actions';
import { createPurchaseSchema } from '@/lib/api/validation';
import type { PostBlinkResponse } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallId: string }> }
) {
  try {
    const { wallId } = await params;
    const body = await request.json().catch(() => ({}));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // If slotId is not provided, we redirect the user to the web configuration/selection page
    if (!body.slotId) {
      return NextResponse.json({
        message: 'Redirigiendo a la web para elegir tu slot...',
        redirect: `${baseUrl}/walls/${wallId}`,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    // Validate request
    const validated = createPurchaseSchema.parse({
      ...body,
      wallId,
    });

    const supabase = await createClient();

    // Get slot
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('*')
      .eq('id', validated.slotId)
      .single();

    if (slotError || !slot) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Check if slot is available
    if (slot.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: 'Slot is not available' },
        { status: 400 }
      );
    }

    // Reserve slot
    const { error: updateError } = await supabase
      .from('slots')
      .update({
        status: 'RESERVED',
        reserved_at: new Date().toISOString(),
      })
      .eq('id', validated.slotId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reserve slot' },
        { status: 500 }
      );
    }

    // Calculate expiry time based on duration
    const now = new Date();
    const durationDays =
      validated.duration === 'DAILY' ? 1 : validated.duration === 'WEEKLY' ? 7 : 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Create purchase record (PENDING status)
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert([
        {
          slot_id: validated.slotId,
          wall_id: wallId,
          buyer_user_id: body.buyerId || 'temp-user-id',
          buyer_wallet: validated.buyerWallet,
          buyer_x_handle: body.buyerXHandle || 'unknown',
          buyer_x_id: body.buyerXId || 'unknown',
          buyer_avatar_url: body.buyerAvatarUrl || '',
          amount_usdc: validated.amount,
          duration: validated.duration,
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: 'PENDING',
          message: validated.message || null,
        },
      ])
      .select()
      .single();

    if (purchaseError) {
      return NextResponse.json(
        { error: 'Failed to create purchase' },
        { status: 500 }
      );
    }

    // Create USDC transfer transaction
    const transactionBase64 = await createUSDCTransferTransaction(
      validated.buyerWallet,
      validated.amount,
      purchase.id
    );

    const response: PostBlinkResponse = {
      transaction: transactionBase64,
      message: `Transacción preparada. Costo: ${validated.amount} USDC durante ${durationDays} días.`,
    };

    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error in POST /purchase:', error);
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}
