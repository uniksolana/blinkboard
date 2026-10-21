import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/privy';
import { createClient } from '@/lib/supabase/server';
import { errorResponse } from '@/lib/api/http';

export const runtime = 'nodejs';

/** Muros del creador autenticado (antes se listaban TODOS los muros). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('walls')
      .select('id, name, layout_type, wallet_address, is_active, layout_config, occupied_credits, total_credits, created_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ walls: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
