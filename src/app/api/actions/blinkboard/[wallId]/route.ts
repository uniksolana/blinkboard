import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { actionJson, actionsOptions } from '@/lib/api/http';
import { releaseExpiredSlots } from '@/lib/purchases/service';
import { getSlotPriceUSDC, type TierPrices } from '@/lib/pricing';
import { TIER_IDS, TIERS, type TierId } from '@/lib/solana/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

/** Metadatos del Blink (Solana Actions spec v2). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ wallId: string }> }) {
  try {
    const { wallId } = await params;
    const baseUrl = getBaseUrl(request);
    await releaseExpiredSlots();
    const supabase = await createClient();

    const { data: wall } = await supabase
      .from('walls')
      .select('id, name, is_active, layout_config, wallet_address, slots(tier, status)')
      .eq('id', wallId)
      .maybeSingle();

    if (!wall || !wall.is_active) {
      return actionJson({ message: 'Muro no encontrado' }, 404);
    }

    const slots = (wall.slots ?? []) as { tier: TierId; status: string }[];
    const occupied = slots.filter((s) => s.status === 'OCCUPIED').length;
    const freeByTier = TIER_IDS.map((tier) => ({
      tier,
      free: slots.filter((s) => s.tier === tier && s.status === 'AVAILABLE').length,
    })).filter((t) => t.free > 0);

    const prices = (wall.layout_config as { prices?: TierPrices } | null)?.prices;
    const icon = `${baseUrl}/api/actions/blinkboard/${wallId}/image.png?t=${Math.floor(Date.now() / 60000)}`;
    const purchaseHref = `${baseUrl}/api/actions/blinkboard/${wallId}/purchase`;
    const soldOut = freeByTier.length === 0 || !wall.wallet_address;

    return actionJson({
      type: 'action',
      icon,
      title: `BlinkBoard: ${wall.name}`,
      description: `Anúnciate en este muro. Ocupación: ${occupied}/${slots.length} espacios. Elige tamaño y duración y paga en USDC.`,
      label: soldOut ? 'Muro completo' : 'Comprar espacio',
      disabled: soldOut,
      ...(soldOut ? { error: { message: 'No quedan espacios libres ahora mismo' } } : {}),
      links: {
        actions: [
          {
            type: 'transaction',
            label: 'Comprar espacio',
            href: `${purchaseHref}?tier={tier}&duration={duration}&handle={handle}`,
            parameters: [
              {
                type: 'select',
                name: 'tier',
                label: 'Tamaño del espacio',
                required: true,
                options: freeByTier.map(({ tier, free }) => ({
                  label: `${tier} ${TIERS[tier].size}x${TIERS[tier].size} · ${getSlotPriceUSDC(prices, tier, 'DAILY')} USDC/día (${free} libres)`,
                  value: tier,
                })),
              },
              {
                type: 'radio',
                name: 'duration',
                label: 'Duración',
                required: true,
                options: [
                  { label: '1 día', value: 'DAILY', selected: true },
                  { label: '7 días (paga 5)', value: 'WEEKLY' },
                  { label: '30 días (paga 15)', value: 'MONTHLY' },
                ],
              },
              {
                type: 'text',
                name: 'handle',
                label: 'Tu @usuario de X (opcional)',
                required: false,
              },
            ],
          },
          {
            type: 'external-link',
            label: 'Elegir el espacio en la web',
            href: `${purchaseHref}?mode=web`,
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error in GET /blinkboard:', error);
    return actionJson({ message: 'Error interno' }, 500);
  }
}

export const OPTIONS = actionsOptions;
