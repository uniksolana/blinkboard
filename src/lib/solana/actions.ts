import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from '@solana/spl-token';
import { SOLANA_NETWORK, USDC_MINT, TREASURY_WALLET } from './constants';

export async function createUSDCTransferTransaction(
  buyerWallet: string,
  amount: number,
  purchaseId: string // Use purchaseId instead of slotId
): Promise<string> {
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!, 'confirmed');
  
  const buyerPubKey = new PublicKey(buyerWallet);
  const treasuryPubKey = new PublicKey(TREASURY_WALLET!);
  const usdcMintPubKey = new PublicKey(USDC_MINT);

  // Get mint info for decimals
  const mintInfo = await getMint(connection, usdcMintPubKey);
  const totalAmount = BigInt(Math.round(amount * Math.pow(10, mintInfo.decimals)));

  // Get token accounts
  const buyerTokenAccount = await getAssociatedTokenAddress(usdcMintPubKey, buyerPubKey);
  const treasuryTokenAccount = await getAssociatedTokenAddress(usdcMintPubKey, treasuryPubKey);

  // 1. Memo instruction (to link tx to database)
  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: buyerPubKey, isSigner: true, isWritable: true }],
    data: Buffer.from(`blinkboard_purchase:${purchaseId}`, 'utf-8'),
    programId: new PublicKey('MemoSq4gqAB2Cc9BnG6zbxDBZid3p6fG9iz9zV7Aup'),
  });

  // 2. Transfer instruction
  const transferInstruction = createTransferCheckedInstruction(
    buyerTokenAccount,
    usdcMintPubKey,
    treasuryTokenAccount,
    buyerPubKey,
    totalAmount,
    mintInfo.decimals
  );

  const transaction = new Transaction().add(memoInstruction, transferInstruction);
  
  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = buyerPubKey;

  // Serialize without signatures (wallet will sign)
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return serializedTransaction.toString('base64');
}
