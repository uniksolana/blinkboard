import { NextRequest } from 'next/server';
import { ACTION_HEADERS, actionJson, actionsOptions, errorResponse } from '@/lib/api/http';
import { blinkBodySchema, blinkQuerySchema, webPurchaseSchema } from '@/lib/api/validation';
import { getOptionalUser } from '@/lib/auth/privy';
import { preparePurchase } from '@/lib/purchases/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST de compra. Tres modos:
 *   - ?mode=web            -> Blink "external-link": abre la página del muro
 *   - body { account }     -> Blink "transaction": asigna el primer slot libre del tier
 *   - body { slotId, ... } -> Web: slot concreto, comprador autenticado con Privy
 * En todos los casos el precio se calcula en el servidor.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ wallId: string }> }) {
  const { wallId } = await params;
  const url = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  try {
    if (url.searchParams.get('mode') === 'web') {
      return actionJson({ type: 'external-link', externalLink: `${baseUrl}/walls/${wallId}` });
    }

    const body = await request.json().catch(() => ({}));

    // ---- Flujo Blink (Solana Actions) ----
    if (body && typeof body.account === 'string' && !body.slotId) {
      const { account } = blinkBodySchema.parse(body);
      const query = blinkQuerySchema.parse({
        tier: url.searchParams.get('tier') ?? undefined,
        duration: url.searchParams.get('duration') ?? undefined,
        handle: url.searchParams.get('handle') || undefined,
      });

      const result = await preparePurchase({
        wallId,
        tier: query.tier,
        duration: query.duration,
        buyerWallet: account,
        buyer: query.handle
          ? {
              userId: null,
              // Handle declarado desde el Blink (no verificado con X)
              xHandle: query.handle,
              xId: `wallet:${account}`,
              avatarUrl: `https://unavatar.io/x/${query.handle}`,
            }
          : undefined,
      });

      return actionJson({
        type: 'transaction',
        transaction: result.transaction,
        message: `Espacio ${result.tier} reservado 5 min. Total: ${result.amount} USDC por ${result.days} día(s).`,
      });
    }

    // ---- Flujo web ----
    const input = webPurchaseSchema.parse(body);
    const user = await getOptionalUser(request);
    if (!user) return actionJson({ error: 'Inicia sesión con X para comprar', message: 'Inicia sesión con X para comprar' }, 401);

    const result = await preparePurchase({
      wallId,
      slotId: input.slotId,
      duration: input.duration,
      buyerWallet: input.buyerWallet,
      message: input.message,
      buyer: {
        userId: user.id,
        xHandle: user.x_handle,
        xId: user.x_id,
        avatarUrl: user.avatar_url,
      },
    });

    return actionJson({
      type: 'transaction',
      transaction: result.transaction,
      purchaseId: result.purchaseId,
      amount: result.amount,
      message: `Transacción preparada. Total: ${result.amount} USDC por ${result.days} día(s).`,
    });
  } catch (error) {
    return errorResponse(error, ACTION_HEADERS);
  }
}

export const OPTIONS = actionsOptions;
