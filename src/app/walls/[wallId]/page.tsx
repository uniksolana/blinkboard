'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../providers';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction } from '@solana/web3.js';
import { InteractiveWall, SlotWithPurchase } from '@/components/InteractiveWall';
import { getSlotPriceUSDC } from '@/lib/pricing';
import { Loader2, Calendar, Coins, User, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function WallPage() {
  const { wallId } = useParams() as { wallId: string };
  const { user, loginWithX, authFetch, isLoading: authLoading } = useAuth();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  // Wall states
  const [wall, setWall] = useState<any>(null);
  const [slots, setSlots] = useState<SlotWithPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithPurchase | null>(null);

  // Form states
  const [duration, setDuration] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [customMessage, setCustomMessage] = useState('');
  
  // Process states
  const [buying, setBuying] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<string>('');

  useEffect(() => {
    if (wallId) {
      loadWallData();
    }
  }, [wallId]);

  const loadWallData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      // Los datos públicos del muro se sirven desde el servidor
      const res = await fetch(`/api/walls/${wallId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Muro no encontrado');
      setWall(data.wall);
      setSlots(data.slots as SlotWithPurchase[]);
    } catch (err) {
      console.error('Error loading wall data:', err);
      setWall(null);
    } finally {
      setLoading(false);
    }
  };

  const getSlotPrice = (slot: SlotWithPurchase) =>
    getSlotPriceUSDC(wall?.prices, slot.tier, duration);

  /** Pide al servidor que verifique la transacción on-chain (con reintentos). */
  const confirmOnServer = async (purchaseId: string, txSignature: string) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch('/api/purchase/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, txSignature }),
      });
      const data = await res.json();
      if (res.ok && data.success) return;
      if (res.status !== 202) throw new Error(data.error || 'No se pudo confirmar el pago');
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(
      'El pago se envió pero aún no se ha confirmado. Se aplicará automáticamente en unos minutos.'
    );
  };

  // --- FLUJO DE PAGO EN SOLANA ---
  const handleSolanaPurchase = async () => {
    if (!selectedSlot || !publicKey) return;

    setBuying(true);
    setPurchaseStep('Reservando el espacio...');

    try {
      // 1. El servidor reserva el slot, calcula el precio y prepara la transacción
      const response = await authFetch(`/api/actions/blinkboard/${wallId}/purchase`, {
        method: 'POST',
        body: JSON.stringify({
          slotId: selectedSlot.id,
          buyerWallet: publicKey.toBase58(),
          duration,
          message: customMessage || null,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.transaction || !resData.purchaseId) {
        throw new Error(resData.error || resData.message || 'No se pudo crear la transacción');
      }

      setPurchaseStep(`Firma el pago de ${resData.amount} USDC en tu wallet...`);
      const transaction = Transaction.from(Buffer.from(resData.transaction, 'base64'));
      const signature = await sendTransaction(transaction, connection);

      setPurchaseStep('Confirmando en la blockchain...');
      await connection.confirmTransaction(signature, 'confirmed');

      setPurchaseStep('Verificando el pago...');
      await confirmOnServer(resData.purchaseId, signature);

      alert('¡Pago completado! El muro se ha actualizado.');
      setSelectedSlot(null);
      setCustomMessage('');
    } catch (err: any) {
      console.error('Solana purchase error:', err);
      alert(`Error en la compra: ${err.message || 'Operación cancelada'}`);
    } finally {
      setBuying(false);
      setPurchaseStep('');
      loadWallData(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-[#00ff88] animate-spin mb-4" />
        <span className="text-sm text-slate-400">Cargando Muro Publicitario...</span>
      </div>
    );
  }

  if (!wall) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
        <p className="text-slate-400 mb-6">El muro que buscas no existe o está inactivo.</p>
        <Link href="/" className="px-5 py-2.5 bg-white text-black font-bold rounded-xl text-xs">
          Ir al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Back button */}
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver al Inicio
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE WALL */}
        <div className="lg:col-span-7 flex flex-col items-center gap-6">
          <div className="text-center w-full">
            <h1 className="text-2xl sm:text-3xl font-black mb-2">{wall.name}</h1>
            <p className="text-xs text-slate-400">
              Sponsor Board de Solana Blinks. Haz clic en un espacio libre para comprarlo.
            </p>
          </div>

          <InteractiveWall 
            slots={slots} 
            selectedSlotId={selectedSlot?.id} 
            onSlotSelect={(slot) => setSelectedSlot(slot)}
            tierPrices={wall.prices}
          />
        </div>

        {/* RIGHT COLUMN: PURCHASE FLOW WIDGET */}
        <div className="lg:col-span-5 bg-[#0a0f1d]/75 border border-white/5 p-6 rounded-2xl backdrop-blur-md">
          {!selectedSlot ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-3xl block mb-3">👈</span>
              <h4 className="font-extrabold text-base text-white mb-2">Selecciona un Slot</h4>
              <p className="text-xs max-w-xs mx-auto leading-relaxed">
                Elige cualquier celda libre en la cuadrícula de la izquierda para configurar su duración y realizar el pago.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-white/5 pb-4 flex justify-between items-center">
                <h4 className="font-extrabold text-base text-white">Comprar Espacio</h4>
                <button 
                  onClick={() => setSelectedSlot(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-300"
                >
                  Cancelar
                </button>
              </div>

              {/* Slot details card */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Detalles del Slot</span>
                  <h5 className="font-extrabold text-sm text-white mt-1">Tier {selectedSlot.tier} ({selectedSlot.grid_size}x{selectedSlot.grid_size})</h5>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Precio por día</span>
                  <span className="font-extrabold text-sm text-white">{selectedSlot.price_usdc} USDC</span>
                </div>
              </div>

              {/* Purchase Duration Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Duración del Anuncio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`py-2 text-xs font-extrabold rounded-lg border transition-all duration-300 ${
                        duration === d
                          ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30 shadow-[0_0_10px_rgba(0,255,136,0.1)]'
                          : 'bg-black/20 text-slate-400 border-white/5 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      {d === 'DAILY' ? '1 Día' : d === 'WEEKLY' ? '7 Días' : '30 Días'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Cost computation */}
              <div className="p-4 bg-gradient-to-tr from-indigo-950/40 to-black/40 border border-indigo-500/20 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-300">Total a pagar:</span>
                </div>
                <span className="text-lg font-black text-white">{getSlotPrice(selectedSlot)} USDC</span>
              </div>

              {/* Custom Sponsor Message */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">Mensaje / Enlace en Hover (Opcional)</label>
                <input
                  type="text"
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Ej. Visita solana.com!"
                  maxLength={140}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:border-[#00ff88] text-xs focus:outline-none transition-colors"
                />
              </div>

              {/* PURCHASE SUBMIT WRAPPER */}
              <div className="border-t border-white/5 pt-6 space-y-4">
                
                {/* STEP 1: AUTHENTICATE WITH X */}
                {!user ? (
                  <div className="space-y-3">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Paso 1: Identifícate en X (Twitter)
                    </span>
                    <button
                      onClick={() => loginWithX('sponsor')}
                      disabled={authLoading}
                      className="w-full py-3 bg-white text-black font-extrabold text-xs rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      {authLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Conectar con X</>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Esto sirve para vincular tu avatar y tu @handle al slot comprado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* User profile confirmation */}
                    <div className="flex items-center justify-between bg-black/30 p-2.5 border border-white/5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <img src={user.avatar_url} className="w-6 h-6 rounded-full" />
                        <span className="font-bold text-slate-300">Publicar como: @{user.x_handle}</span>
                      </div>
                      <span className="text-[9px] text-[#00ff88] font-bold">Autenticado ✅</span>
                    </div>

                    {/* STEP 2: SOLANA WALLET / PAYMENT */}
                    <div className="space-y-3">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                        Paso 2: Conectar Wallet y Confirmar Pago
                      </span>

                      {buying ? (
                        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-indigo-500/20 bg-indigo-950/10 rounded-xl">
                          <Loader2 className="w-8 h-8 text-[#00ff88] animate-spin mb-2" />
                          <span className="text-xs font-bold text-slate-300">{purchaseStep}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {/* Standard Wallet Adapter Connect */}
                          <div className="flex justify-center w-full text-xs">
                            <WalletMultiButton className="!w-full !py-3 !rounded-xl !bg-indigo-600 hover:!bg-indigo-500 !font-extrabold !text-xs !justify-center !transition-all" />
                          </div>

                          {/* Solana Payment Button */}
                          {connected && wall.accepts_payments && (
                            <button
                              onClick={handleSolanaPurchase}
                              className="w-full py-3 bg-gradient-to-r from-[#00ff88] to-[#00e5ff] text-black font-extrabold text-xs rounded-xl hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              Pagar {getSlotPrice(selectedSlot)} USDC (Wallet Solana)
                            </button>
                          )}

                          {!wall.accepts_payments && (
                            <p className="text-[10px] text-red-400 text-center">
                              Este muro todavía no acepta pagos: el creador no ha configurado su wallet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
