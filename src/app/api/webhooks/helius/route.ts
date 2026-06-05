import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { HeliusWebhook } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body: any[] = await request.json();
    
    // Helius sends an array of transaction events
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ message: 'No events found' }, { status: 200 });
    }

    const supabase = await createClient();

    for (const event of body) {
      // Find purchase ID in the memo instruction
      // Helius parsed transaction events usually have descriptions or we can look at accountData
      // For SPL transfers, we look at the instructions
      const signature = event.signature;
      
      // Look for our specific memo pattern: "blinkboard_purchase:UUID"
      // Helius includes instructions in the event object
      const memoInstruction = event.instructions?.find((ins: any) => 
        ins.content?.includes('blinkboard_purchase:')
      );

      let purchaseId = null;
      if (memoInstruction) {
        purchaseId = memoInstruction.content.split(':')[1];
      }

      if (!purchaseId) {
        console.log(`BlinkBoard purchase ID not found in transaction: ${signature}`);
        continue;
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .eq('status', 'PENDING')
        .single();

      if (purchaseError || !purchase) {
        console.log(`Purchase ${purchaseId} not found or not pending. Signature: ${signature}`);
        continue;
      }

      // Update purchase status and store signature
      const { error: updatePurchaseError } = await supabase
        .from('purchases')
        .update({ 
          status: 'CONFIRMED',
          tx_signature: signature
        })
        .eq('id', purchase.id);

      if (updatePurchaseError) {
        console.error('Error updating purchase status:', updatePurchaseError);
        continue;
      }

      // 4. Mark slot as occupied
      const { error: updateSlotError } = await supabase
        .from('slots')
        .update({ status: 'OCCUPIED' })
        .eq('id', purchase.slot_id);

      if (updateSlotError) {
        console.error('Error updating slot status:', updateSlotError);
      }

      // 5. Update wall's occupied credits
      const { data: slot } = await supabase
        .from('slots')
        .select('grid_size')
        .eq('id', purchase.slot_id)
        .single();

      if (slot) {
        const credits = slot.grid_size * slot.grid_size;
        await supabase.rpc('increment_wall_credits', { 
          wall_id_param: purchase.wall_id, 
          credits_param: credits 
        });
      }

      console.log(`Successfully confirmed purchase ${purchase.id} for wall ${purchase.wall_id}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in Helius webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
