import { NextRequest, NextResponse } from 'next/server';
import { releaseExpiredSlots } from '@/lib/purchases/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Llamado por Vercel Cron. Las lecturas del muro también liberan slots caducados. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await releaseExpiredSlots();
  return NextResponse.json({ success: true });
}
