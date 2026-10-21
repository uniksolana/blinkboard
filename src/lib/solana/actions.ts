import 'server-only';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { MEMO_PREFIX, MEMO_PROGRAM_ID, USDC_DECIMALS, USDC_MINT, getServerRpcUrl } from './constants';

export function getConnection() {
  return new Connection(getServerRpcUrl(), 'confirmed');
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    // Se aceptan también direcciones fuera de la curva (p. ej. vaults de Squads)
    return new PublicKey(address).toBase58() === address;
  } catch {
    return false;
  }
}

interface BuildParams {
  buyerWallet: string;
  creatorWallet: string;
  creatorMicro: bigint;
  treasuryWallet: string | null;
  feeMicro: bigint;
  purchaseId: string;
}

/**
 * Construye la transacción de pago:
 *   1. Memo con el ID de la compra (para enlazar la tx con la base de datos)
 *   2. Crea (si no existe) la cuenta USDC del creador, pagada por el comprador
 *   3. Transferencia USDC comprador -> creador
 *   4. (Opcional) Transferencia de la comisión comprador -> plataforma
 */
export async function createUSDCTransferTransaction(params: BuildParams): Promise<string> {
  const connection = getConnection();
  const buyer = new PublicKey(params.buyerWallet);
  const creator = new PublicKey(params.creatorWallet);
  const mint = new PublicKey(USDC_MINT);

  const buyerAta = getAssociatedTokenAddressSync(mint, buyer);
  const creatorAta = getAssociatedTokenAddressSync(mint, creator, true);

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }));
  tx.add(
    new TransactionInstruction({
      keys: [{ pubkey: buyer, isSigner: true, isWritable: false }],
      data: Buffer.from(`${MEMO_PREFIX}${params.purchaseId}`, 'utf-8'),
      programId: new PublicKey(MEMO_PROGRAM_ID),
    })
  );
  tx.add(createAssociatedTokenAccountIdempotentInstruction(buyer, creatorAta, creator, mint));
  tx.add(
    createTransferCheckedInstruction(buyerAta, mint, creatorAta, buyer, params.creatorMicro, USDC_DECIMALS)
  );

  if (params.treasuryWallet && params.feeMicro > BigInt(0)) {
    const treasury = new PublicKey(params.treasuryWallet);
    const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, true);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(buyer, treasuryAta, treasury, mint));
    tx.add(createTransferCheckedInstruction(buyerAta, mint, treasuryAta, buyer, params.feeMicro, USDC_DECIMALS));
  }

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = buyer;

  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}
