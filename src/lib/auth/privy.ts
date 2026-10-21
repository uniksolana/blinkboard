import 'server-only';
import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
// Clave de verificación (Dashboard de Privy > Configuration > App settings)
const PRIVY_VERIFICATION_KEY = (process.env.PRIVY_VERIFICATION_KEY || '').replace(/\\n/g, '\n');

let keyPromise: Promise<CryptoKey> | null = null;
function getVerificationKey() {
  if (!PRIVY_VERIFICATION_KEY) throw new Error('Falta PRIVY_VERIFICATION_KEY');
  keyPromise ??= importSPKI(PRIVY_VERIFICATION_KEY, 'ES256');
  return keyPromise;
}

export class AuthError extends Error {
  status = 401;
}

/** Verifica el access token de Privy y devuelve el DID del usuario. */
export async function verifyPrivyToken(token: string): Promise<string> {
  if (!PRIVY_APP_ID) throw new Error('Falta NEXT_PUBLIC_PRIVY_APP_ID');
  try {
    const { payload } = await jwtVerify(token, await getVerificationKey(), {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    });
    if (!payload.sub) throw new Error('Token sin sub');
    return payload.sub;
  } catch {
    throw new AuthError('Sesión inválida o caducada');
  }
}

function getBearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export interface PrivyProfile {
  privyId: string;
  xHandle: string | null;
  xId: string | null;
  avatarUrl: string | null;
  solanaWallet: string | null;
}

/** Obtiene el perfil verificado del usuario desde la API de Privy (no se fía del cliente). */
export async function fetchPrivyProfile(privyId: string): Promise<PrivyProfile> {
  if (!PRIVY_APP_SECRET) throw new Error('Falta PRIVY_APP_SECRET');
  const res = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(privyId)}`, {
    headers: {
      'privy-app-id': PRIVY_APP_ID,
      Authorization: 'Basic ' + Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64'),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Privy API ${res.status}`);
  const user = await res.json();
  const accounts: any[] = user.linked_accounts || [];
  const twitter = accounts.find((a) => a.type === 'twitter_oauth');
  const solana = accounts.find((a) => a.type === 'wallet' && a.chain_type === 'solana');
  return {
    privyId,
    xHandle: twitter?.username ?? null,
    xId: twitter?.subject ?? null,
    avatarUrl: twitter?.profile_picture_url ?? null,
    solanaWallet: solana?.address ?? null,
  };
}

export interface CreatorRow {
  id: string;
  auth0_id: string;
  x_handle: string;
  x_id: string;
  avatar_url: string;
  wallet_address: string | null;
}

/** Crea o actualiza el creador a partir del perfil verificado de Privy. */
export async function syncCreator(privyId: string): Promise<CreatorRow> {
  const profile = await fetchPrivyProfile(privyId);
  const xHandle = profile.xHandle || (profile.solanaWallet ? profile.solanaWallet.slice(0, 8) : `user_${privyId.slice(-8)}`);
  const xId = profile.xId || privyId;
  const avatar = profile.avatarUrl || `https://unavatar.io/twitter/${xHandle}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creators')
    .upsert(
      {
        auth0_id: privyId,
        x_handle: xHandle,
        x_id: xId,
        avatar_url: avatar,
        wallet_address: profile.solanaWallet,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth0_id' }
    )
    .select()
    .single();
  if (error || !data) throw new Error(`No se pudo sincronizar el usuario: ${error?.message}`);
  return data as CreatorRow;
}

/** Devuelve el usuario autenticado (o null si la petición no trae token). */
export async function getOptionalUser(request: NextRequest): Promise<CreatorRow | null> {
  const token = getBearer(request);
  if (!token) return null;
  const privyId = await verifyPrivyToken(token);
  const supabase = await createClient();
  const { data } = await supabase.from('creators').select('*').eq('auth0_id', privyId).maybeSingle();
  if (data) return data as CreatorRow;
  return syncCreator(privyId);
}

/** Igual que getOptionalUser pero exige sesión. */
export async function requireUser(request: NextRequest): Promise<CreatorRow> {
  const user = await getOptionalUser(request);
  if (!user) throw new AuthError('Necesitas iniciar sesión');
  return user;
}

export function getBearerToken(request: NextRequest) {
  return getBearer(request);
}
