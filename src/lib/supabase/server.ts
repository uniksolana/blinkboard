import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Cliente de Supabase con service role. SOLO para código de servidor.
 * Toda la lectura/escritura de datos pasa por las API routes.
 */
export async function createClient(): Promise<SupabaseClient> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }
  cached = createSupabaseClient(url, key, { auth: { persistSession: false } });
  return cached;
}
