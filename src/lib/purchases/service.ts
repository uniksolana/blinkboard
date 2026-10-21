import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSlotPriceUSDC, splitPayment, usdcToMicro, type TierPrices } from '@/lib/pricing';
import { createUSDCTransferTransaction, isValidSolanaAddress } from '@/lib/solana/actions';
import { fetchParsedTransaction, extractPurchaseId, verifyPayment } from '@/lib/solana/verify';
import {
  DURATION_DAYS,
  RESERVATION_MINUTES,
  TREASURY_WALLET,
  type Duration,
  type TierId,
} from '@/lib/solana/constants';

export class PurchaseError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Libera reservas abandonadas y anuncios caducados. Barato: se llama en cada lectura. */
export async function releaseExpiredSlots() {
  const supabase = await createClient();
  const { error } = await supabase.rpc('release_expired_slots', { p_reservation_minutes: RESERVATION_MINUTES });
  if (error) console.error('release_expired_slots error:', error.message);
}

interface PreparePurchaseInput {
  wallId: string;
  slotId?: string | null;
  tier?: TierId | null;
  duration: Duration;
  buyerWallet: string;
  message?: string | null;
  buyer?: {
    userId: string | null;
    xHandle: string;
    xId: string;
    avatarUrl: string;
  };
}

/**
 * Reserva el slot de forma atómica, calcula el precio EN EL SERVIDOR y
 * devuelve la transacción sin firmar para que la firme el comprador.
 */
export async function preparePurchase(input: PreparePurchaseInput) {
  if (!isValidSolanaAddress(input.buyerWallet)) throw new PurchaseError('Wallet del comprador inválida');
  if (!input.slotId && !input.tier) throw new PurchaseError('Indica un slot o un tier');

  const supabase = await createClient();
  await releaseExpiredSlots();

  const { data: wall, error: wallError } = await supabase
    .from('walls')
    .select('id, name, is_active, wallet_address, layout_config, creator_id')
    .eq('id', input.wallId)
    .maybeSingle();
  if (wallError || !wall) throw new PurchaseError('Muro no encontrado', 404);
  if (!wall.is_active) throw new PurchaseError('El muro no está activo');
  if (!wall.wallet_address || !isValidSolanaAddress(wall.wallet_address)) {
    throw new PurchaseError('El creador no ha configurado una wallet válida', 409);
  }

  // Tier del slot: si se pide un slot concreto, lo leemos para calcular el precio
  let tier: TierId | null = input.tier ?? null;
  if (input.slotId) {
    const { data: slot } = await supabase
      .from('slots')
      .select('id, tier, wall_id')
      .eq('id', input.slotId)
      .eq('wall_id', input.wallId)
      .maybeSingle();
    if (!slot) throw new PurchaseError('Slot no encontrado', 404);
    tier = slot.tier as TierId;
  }

  const prices = (wall.layout_config as { prices?: TierPrices } | null)?.prices;
  const amount = getSlotPriceUSDC(prices, tier!, input.duration);
  const totalMicro = usdcToMicro(amount);
  const { creatorMicro, feeMicro } = splitPayment(totalMicro);

  const buyer = input.buyer ?? {
    userId: null,
    xHandle: input.buyerWallet.slice(0, 4) + '…' + input.buyerWallet.slice(-4),
    xId: `wallet:${input.buyerWallet}`,
    avatarUrl: '',
  };

  const { data: reserved, error: reserveError } = await supabase.rpc('reserve_slot_and_create_purchase', {
    p_wall_id: input.wallId,
    p_slot_id: input.slotId ?? null,
    p_tier: tier,
    p_buyer_user_id: buyer.userId,
    p_buyer_wallet: input.buyerWallet,
    p_buyer_x_handle: buyer.xHandle,
    p_buyer_x_id: buyer.xId,
    p_buyer_avatar_url: buyer.avatarUrl,
    p_amount_usdc: amount,
    p_amount_micro: totalMicro.toString(),
    p_fee_micro: feeMicro.toString(),
    p_payee_wallet: wall.wallet_address,
    p_treasury_wallet: feeMicro > BigInt(0) ? TREASURY_WALLET : null,
    p_duration: input.duration,
    p_message: input.message?.slice(0, 140) || null,
    p_reservation_minutes: RESERVATION_MINUTES,
  });

  if (reserveError) {
    if (reserveError.message.includes('SLOT_NOT_AVAILABLE')) {
      throw new PurchaseError('Ese espacio ya no está disponible', 409);
    }
    throw new PurchaseError(`No se pudo reservar el espacio: ${reserveError.message}`, 500);
  }

  const row = Array.isArray(reserved) ? reserved[0] : reserved;
  const purchaseId: string = row.out_purchase_id;

  try {
    const transaction = await createUSDCTransferTransaction({
      buyerWallet: input.buyerWallet,
      creatorWallet: wall.wallet_address,
      creatorMicro,
      treasuryWallet: feeMicro > BigInt(0) ? TREASURY_WALLET : null,
      feeMicro,
      purchaseId,
    });
    return {
      purchaseId,
      slotId: row.out_slot_id as string,
      tier: row.out_tier as TierId,
      amount,
      days: DURATION_DAYS[input.duration],
      transaction,
    };
  } catch (err) {
    // Si no podemos construir la transacción, liberamos la reserva
    await supabase
      .from('slots')
      .update({ status: 'AVAILABLE', reserved_at: null, current_purchase_id: null })
      .eq('id', row.out_slot_id)
      .eq('current_purchase_id', purchaseId);
    await supabase.from('purchases').update({ status: 'FAILED', failure_reason: 'TX_BUILD_ERROR' }).eq('id', purchaseId);
    throw err;
  }
}

export type ConfirmResult =
  | { status: 'CONFIRMED' | 'ALREADY_CONFIRMED'; purchaseId: string }
  | { status: 'SLOT_TAKEN'; purchaseId: string }
  | { status: 'NOT_FOUND' | 'INVALID' | 'PENDING_ONCHAIN'; reason: string; purchaseId?: string };

/**
 * Confirma una compra a partir de la firma de la transacción.
 * NUNCA se fía del cliente: lee la transacción de la blockchain y comprueba
 * memo, firmante, mint e importes antes de marcar el slot como ocupado.
 */
export async function confirmBySignature(signature: string, expectedPurchaseId?: string): Promise<ConfirmResult> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) {
    return { status: 'INVALID', reason: 'Firma inválida' };
  }

  const tx = await fetchParsedTransaction(signature, expectedPurchaseId ? 5 : 2);
  if (!tx) return { status: 'PENDING_ONCHAIN', reason: 'La transacción aún no aparece en la blockchain' };

  const purchaseId = extractPurchaseId(tx);
  if (!purchaseId) return { status: 'INVALID', reason: 'La transacción no es de BlinkBoard' };
  if (expectedPurchaseId && purchaseId !== expectedPurchaseId) {
    return { status: 'INVALID', reason: 'La transacción no corresponde a esta compra' };
  }

  const supabase = await createClient();
  const { data: purchase } = await supabase.from('purchases').select('*').eq('id', purchaseId).maybeSingle();
  if (!purchase) return { status: 'NOT_FOUND', reason: 'Compra no encontrada', purchaseId };
  if (purchase.status === 'CONFIRMED') return { status: 'ALREADY_CONFIRMED', purchaseId };

  const totalMicro = BigInt(purchase.amount_micro ?? usdcToMicro(Number(purchase.amount_usdc)).toString());
  const feeMicro = BigInt(purchase.fee_micro ?? 0);
  const check = verifyPayment(tx, {
    purchaseId,
    buyerWallet: purchase.buyer_wallet,
    payeeWallet: purchase.payee_wallet,
    creatorMicro: totalMicro - feeMicro,
    treasuryWallet: purchase.treasury_wallet,
    feeMicro,
  });
  if (!check.ok) {
    console.warn(`Pago rechazado ${purchaseId} (${signature}): ${check.reason}`);
    return { status: 'INVALID', reason: check.reason, purchaseId };
  }

  const { data: result, error } = await supabase.rpc('confirm_purchase', {
    p_purchase_id: purchaseId,
    p_signature: signature,
  });
  if (error) {
    // tx_signature es UNIQUE: impide reutilizar una misma firma en dos compras
    if (error.code === '23505') return { status: 'INVALID', reason: 'Esta transacción ya se usó', purchaseId };
    throw new Error(`confirm_purchase: ${error.message}`);
  }

  switch (result) {
    case 'CONFIRMED':
    case 'ALREADY_CONFIRMED':
      return { status: result, purchaseId };
    case 'SLOT_TAKEN':
      return { status: 'SLOT_TAKEN', purchaseId };
    case 'NOT_FOUND':
      return { status: 'NOT_FOUND', reason: 'Compra no encontrada', purchaseId };
    default:
      return { status: 'INVALID', reason: `Estado no válido: ${result}`, purchaseId };
  }
}
