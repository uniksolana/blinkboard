import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { confirmBySignature } from '@/lib/purchases/service';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest) {
  const expected = process.env.HELIUS_WEBHOOK_SECRET;
  if (!expected) return false;
  const received = request.headers.get('authorization') || '';
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook de Helius. Configura en Helius el "Auth Header" con el mismo valor
 * que HELIUS_WEBHOOK_SECRET. Del payload solo se usa la firma: el resto se
 * vuelve a leer y verificar directamente desde la blockchain.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const events: any[] = Array.isArray(body) ? body : body ? [body] : [];

  const results: Array<{ signature: string; status: string }> = [];
  for (const event of events) {
    // Webhook "enhanced" -> event.signature; webhook "raw" -> event.transaction.signatures[0]
    const signature: string | undefined = event?.signature ?? event?.transaction?.signatures?.[0];
    if (!signature) continue;
    try {
      const result = await confirmBySignature(signature);
      results.push({ signature, status: result.status });
    } catch (error) {
      console.error(`Webhook: error confirmando ${signature}`, error);
      results.push({ signature, status: 'ERROR' });
    }
  }

  // Siempre 200 para que Helius no reintente eventos que no son nuestros
  return NextResponse.json({ success: true, results });
}
