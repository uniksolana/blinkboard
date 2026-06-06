import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use the service role key to bypass RLS policies for confirming purchases
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { purchaseId, txSignature } = await request.json();

    if (!purchaseId) {
      return NextResponse.json({ error: 'Missing purchaseId' }, { status: 400 });
    }

    // 1. Fetch the purchase
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    if (purchase.status === 'CONFIRMED') {
      return NextResponse.json({ success: true, message: 'Already confirmed' });
    }

    // 2. Update purchase status
    const { error: updatePurchaseError } = await supabaseAdmin
      .from('purchases')
      .update({
        status: 'CONFIRMED',
        tx_signature: txSignature || `mock_sig_${Math.random().toString(36).substring(7)}`,
      })
      .eq('id', purchaseId);

    if (updatePurchaseError) {
      return NextResponse.json({ error: 'Failed to update purchase status' }, { status: 500 });
    }

    // 3. Mark slot as occupied
    const { error: updateSlotError } = await supabaseAdmin
      .from('slots')
      .update({ status: 'OCCUPIED' })
      .eq('id', purchase.slot_id);

    if (updateSlotError) {
      console.error('Error updating slot status:', updateSlotError);
    }

    // 4. Update wall's occupied credits
    const { data: slot } = await supabaseAdmin
      .from('slots')
      .select('grid_size')
      .eq('id', purchase.slot_id)
      .single();

    if (slot) {
      const credits = slot.grid_size * slot.grid_size;
      await supabaseAdmin.rpc('increment_wall_credits', {
        wall_id_param: purchase.wall_id,
        credits_param: credits,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error confirming purchase:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
