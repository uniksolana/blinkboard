import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from '@/lib/auth/privy';
import { PurchaseError } from '@/lib/purchases/service';
import { BLOCKCHAIN_IDS, SOLANA_NETWORK } from '@/lib/solana/constants';

/** Cabeceras requeridas por la especificación de Solana Actions. */
export const ACTION_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids',
  'Access-Control-Expose-Headers': 'X-Action-Version, X-Blockchain-Ids',
  'X-Action-Version': '2.4',
  'X-Blockchain-Ids': BLOCKCHAIN_IDS[SOLANA_NETWORK],
};

export function actionJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: ACTION_HEADERS });
}

export function actionsOptions() {
  return new NextResponse(null, { status: 204, headers: ACTION_HEADERS });
}

/** Convierte errores conocidos en respuestas JSON con el código adecuado. */
export function errorResponse(error: unknown, headers?: Record<string, string>) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, message: error.message }, { status: 401, headers });
  }
  if (error instanceof PurchaseError) {
    return NextResponse.json({ error: error.message, message: error.message }, { status: error.status, headers });
  }
  if (error instanceof ZodError) {
    const message = 'Datos inválidos: ' + error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return NextResponse.json({ error: message, message }, { status: 400, headers });
  }
  console.error(error);
  return NextResponse.json({ error: 'Error interno', message: 'Error interno' }, { status: 500, headers });
}
