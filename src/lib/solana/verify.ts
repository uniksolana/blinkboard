import 'server-only';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { getConnection } from './actions';
import { MEMO_PREFIX, USDC_MINT } from './constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchParsedTransaction(signature: string, attempts = 1): Promise<ParsedTransactionWithMeta | null> {
  const connection = getConnection();
  for (let i = 0; i < attempts; i++) {
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (tx) return tx;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

/** Extrae el ID de compra del memo `blinkboard_purchase:<uuid>`. */
export function extractPurchaseId(tx: ParsedTransactionWithMeta): string | null {
  for (const ix of tx.transaction.message.instructions) {
    if ('parsed' in ix && (ix.program === 'spl-memo' || ix.programId.toBase58().startsWith('Memo'))) {
      const text = typeof ix.parsed === 'string' ? ix.parsed : '';
      if (text.startsWith(MEMO_PREFIX)) {
        const id = text.slice(MEMO_PREFIX.length).trim();
        if (UUID_RE.test(id)) return id;
      }
    }
  }
  // Fallback: los logs del programa Memo contienen el texto
  for (const log of tx.meta?.logMessages || []) {
    const idx = log.indexOf(MEMO_PREFIX);
    if (idx >= 0) {
      const id = log.slice(idx + MEMO_PREFIX.length, idx + MEMO_PREFIX.length + 36);
      if (UUID_RE.test(id)) return id;
    }
  }
  return null;
}

/** Variación del saldo USDC (en unidades mínimas) de cada propietario en la transacción. */
export function usdcDeltaByOwner(tx: ParsedTransactionWithMeta): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  const add = (owner: string | undefined, amount: string, sign: 1 | -1) => {
    if (!owner) return;
    const v = BigInt(amount) * BigInt(sign);
    deltas.set(owner, (deltas.get(owner) ?? BigInt(0)) + v);
  };
  for (const b of tx.meta?.preTokenBalances || []) {
    if (b.mint === USDC_MINT) add(b.owner, b.uiTokenAmount.amount, -1);
  }
  for (const b of tx.meta?.postTokenBalances || []) {
    if (b.mint === USDC_MINT) add(b.owner, b.uiTokenAmount.amount, 1);
  }
  return deltas;
}

export interface ExpectedPayment {
  purchaseId: string;
  buyerWallet: string;
  payeeWallet: string;
  creatorMicro: bigint;
  treasuryWallet: string | null;
  feeMicro: bigint;
}

/**
 * Comprueba en la blockchain que la transacción:
 *   - existe y no ha fallado
 *   - la firmó el comprador
 *   - lleva el memo de esta compra
 *   - movió al menos el importe esperado de USDC al creador (y a la plataforma)
 */
export function verifyPayment(tx: ParsedTransactionWithMeta, expected: ExpectedPayment): { ok: true } | { ok: false; reason: string } {
  if (tx.meta?.err) return { ok: false, reason: 'La transacción falló en la blockchain' };

  const memoId = extractPurchaseId(tx);
  if (memoId !== expected.purchaseId) return { ok: false, reason: 'El memo no corresponde a esta compra' };

  const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
  if (!signers.includes(expected.buyerWallet)) return { ok: false, reason: 'La transacción no la firmó el comprador' };

  const deltas = usdcDeltaByOwner(tx);
  const required = new Map<string, bigint>();
  required.set(expected.payeeWallet, expected.creatorMicro);
  if (expected.treasuryWallet && expected.feeMicro > BigInt(0)) {
    required.set(
      expected.treasuryWallet,
      (required.get(expected.treasuryWallet) ?? BigInt(0)) + expected.feeMicro
    );
  }
  for (const [owner, amount] of required) {
    if ((deltas.get(owner) ?? BigInt(0)) < amount) {
      return { ok: false, reason: `Importe USDC insuficiente para ${owner}` };
    }
  }
  return { ok: true };
}
