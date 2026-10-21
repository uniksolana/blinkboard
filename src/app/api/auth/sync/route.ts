import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, syncCreator, verifyPrivyToken } from '@/lib/auth/privy';
import { errorResponse } from '@/lib/api/http';

export const runtime = 'nodejs';

/** Sincroniza el usuario de Privy con la tabla creators usando datos verificados. */
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Necesitas iniciar sesión' }, { status: 401 });
    const privyId = await verifyPrivyToken(token);
    const creator = await syncCreator(privyId);
    return NextResponse.json({
      user: {
        id: creator.id,
        x_handle: creator.x_handle,
        x_id: creator.x_id,
        avatar_url: creator.avatar_url,
        wallet_address: creator.wallet_address,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
