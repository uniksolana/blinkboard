import { NextRequest, NextResponse } from 'next/server';
import { confirmSchema } from '@/lib/api/validation';
import { errorResponse } from '@/lib/api/http';
import { confirmBySignature } from '@/lib/purchases/service';

export const runtime = 'nodejs';

/**
 * Confirmación iniciada por el navegador tras firmar.
 * Es seguro llamarlo sin autenticación: solo confirma si la transacción
 * existe en la blockchain y paga lo que corresponde a esta compra.
 */
export async function POST(request: NextRequest) {
  try {
    const { purchaseId, txSignature } = confirmSchema.parse(await request.json());
    const result = await confirmBySignature(txSignature, purchaseId);

    switch (result.status) {
      case 'CONFIRMED':
      case 'ALREADY_CONFIRMED':
        return NextResponse.json({ success: true, status: result.status });
      case 'PENDING_ONCHAIN':
        return NextResponse.json({ success: false, status: result.status, error: result.reason }, { status: 202 });
      case 'SLOT_TAKEN':
        return NextResponse.json(
          { success: false, status: result.status, error: 'El espacio lo ocupó otra persona. Tu pago queda registrado para reembolso.' },
          { status: 409 }
        );
      case 'NOT_FOUND':
        return NextResponse.json({ success: false, status: result.status, error: result.reason }, { status: 404 });
      default:
        return NextResponse.json({ success: false, status: result.status, error: result.reason }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
