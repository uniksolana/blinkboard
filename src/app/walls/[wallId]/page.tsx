'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../providers';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey } from '@solana/web3.js';
import { InteractiveWall, SlotWithPurchase } from '@/components/InteractiveWall';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Calendar, Coins, User, ArrowLeft, ShieldCheck, HeartHandshake } from 'lucide-react';
import Link from 'next/link';

export default function WallPage() {
  const { wallId } = useParams() as { wallId: string };
  const { user, loginWithX, isLoading: authLoading } = useAuth();
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

  const supabase = createClient();

  useEffect(() => {
    if (wallId) {
      loadWallData();
    }
  }, [wallId]);

  const loadWallData = async () => {
    setLoading(true);
    try {
      // 1. Get Wall details
      const { data: wallData, error: wallError } = await supabase
        .from('walls')
        .select('*')
        .eq('id', wallId)
        .single();

      if (wallError || !wallData) throw new Error('Muro no encontrado');
      setWall(wallData);

      // 2. Get Slots for this wall
      const { data: slotsData, error: slotsError } = await supabase
        .from('slots')
        .select('*')
        .eq('wall_id', wallId);

      if (slotsError) throw slotsError;

      // 3. Get Confirmed purchases for this wall
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('*')
        .eq('wall_id', wallId)
        .eq('status', 'CONFIRMED');

      // 4. Map slots to include purchase info
      const mappedSlots: SlotWithPurchase[] = (slotsData || []).map(slot => {
        const purchase = purchasesData?.find(p => p.slot_id === slot.id);
        return {
          id: slot.id,
          wall_id: slot.wall_id,
          tier: slot.tier,
          grid_x: slot.grid_x,
          grid_y: slot.grid_y,
          grid_size: slot.grid_size,
          status: slot.status,
          price_usdc: wallData.layout_config?.prices?.[slot.tier] || 10,
          purchase: purchase ? {
            buyer_x_handle: purchase.buyer_x_handle,
            buyer_avatar_url: purchase.buyer_avatar_url,
          } : null,
        };
      });

      setSlots(mappedSlots);
    } catch (err) {
      console.error('Error loading wall data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSlotPrice = (slot: SlotWithPurchase) => {
    const basePrice = slot.price_usdc || 10;
    const multiplier = duration === 'DAILY' ? 1 : duration === 'WEEKLY' ? 5 : 15;
    return basePrice * multiplier;
  };

  // --- ACTUAL SOLANA TRANSACTION FLOW ---
  const handleSolanaPurchase = async () => {
    if (!selectedSlot || !publicKey) return;

    setBuying(true);
    setPurchaseStep('Preparando transacción...');

    try {
      const price = getSlotPrice(selectedSlot);

      // 1. Prepare transaction by hitting our POST Blink endpoint
      const response = await fetch(`/api/actions/blinkboard/${wallId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          buyerWallet: publicKey.toBase58(),
          amount: price,
          duration: duration,
          message: customMessage,
          // Pass mock buyer profile info from Auth0
          buyerId: user?.id,
          buyerXHandle: user?.x_handle,
          buyerXId: user?.x_id,
          buyerAvatarUrl: user?.avatar_url,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.transaction) {
        throw new Error(resData.error || 'No se pudo crear la transacción');
      }

      setPurchaseStep('Firmando en tu wallet...');
      
      // 2. Deserialize transaction
      const transaction = Transaction.from(Buffer.from(resData.transaction, 'base64'));

      // 3. Send and sign transaction
      const signature = await sendTransaction(transaction, connection);

      setPurchaseStep('Confirmando en la blockchain...');
      await connection.confirmTransaction(signature, 'confirmed');

      // 4. Extract purchaseId from the transaction memo
      const memoInstruction = transaction.instructions.find(ins => 
        ins.programId.equals(new PublicKey('MemoSq4gqAB2Cc9BnG6zbxDBZid3p6fG9iz9zV7Aup'))
      );
      
      let purchaseId = '';
      if (memoInstruction) {
        purchaseId = memoInstruction.data.toString('utf-8').split(':')[1];
      }

      if (!purchaseId) {
        throw new Error('No se pudo verificar el identificador del pago en la transacción');
      }

      setPurchaseStep('Guardando en el muro...');

      // 5. Finalize status in backend
      const confirmRes = await fetch('/api/purchase/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          txSignature: signature,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error('Error al confirmar el slot en la base de datos');
      }

      alert('¡Pago completado! El muro se ha actualizado.');
      setSelectedSlot(null);
      loadWallData();
    } catch (err: any) {
      console.error('Solana purchase error:', err);
      alert(`Error en la compra: ${err.message || 'Operación cancelada'}`);
    } finally {
      setBuying(false);
      setPurchaseStep('');
    }
  };

  // --- MOCK SIMULATED TRANSACTION FLOW (DEV BYPASS) ---
  const handleSimulatedPurchase = async () => {
    if (!selectedSlot || !user) return;

    setBuying(true);
    setPurchaseStep('Iniciando pago simulado...');

    try {
      const price = getSlotPrice(selectedSlot);

      // 1. Prepare temporary purchase in Supabase
      const response = await fetch(`/api/actions/blinkboard/${wallId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          buyerWallet: publicKey?.toBase58() || 'MOCK_WALLET_ADDRESS_1111111111111111',
          amount: price,
          duration: duration,
          message: customMessage,
          buyerId: user.id,
          buyerXHandle: user.x_handle,
          buyerXId: user.x_id,
          buyerAvatarUrl: user.avatar_url,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.transaction) {
        throw new Error(resData.error || 'No se pudo crear la transacción');
      }

      // 2. Deserialize transaction to extract purchaseId
      const transaction = Transaction.from(Buffer.from(resData.transaction, 'base64'));
      const memoInstruction = transaction.instructions.find(ins => 
        ins.programId.equals(new PublicKey('MemoSq4gqAB2Cc9BnG6zbxDBZid3p6fG9iz9zV7Aup'))
      );
      
      let purchaseId = '';
      if (memoInstruction) {
        purchaseId = memoInstruction.data.toString('utf-8').split(':')[1];
      }

      if (!purchaseId) {
        throw new Error('No se pudo verificar el identificador del pago');
      }

      setPurchaseStep('Procesando pago de prueba (Bypass RPC)...');
      await new Promise(r => setTimeout(r, 1200));

      // 3. Directly hit the confirm API
      const confirmRes = await fetch('/api/purchase/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          txSignature: `mock_tx_${Math.floor(Math.random() * 10000000)}`,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error('Error al confirmar el slot en la base de datos');
      }

      alert('¡Pago de prueba simulado con éxito! Slot adquirido.');
      setSelectedSlot(null);
      loadWallData();
    } catch (err: any) {
      console.error('Simulated purchase error:', err);
      alert(`Error en simulación: ${err.message}`);
    } finally {
      setBuying(false);
      setPurchaseStep('');
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
            tierPrices={wall.layout_config?.prices}
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
                  <span className="text-[10px] text-slate-400 block">Precio Base</span>
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
                        <>Conectar con X (Auth0)</>
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
                          {connected && (
                            <button
                              onClick={handleSolanaPurchase}
                              className="w-full py-3 bg-gradient-to-r from-[#00ff88] to-[#00e5ff] text-black font-extrabold text-xs rounded-xl hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              Pagar {getSlotPrice(selectedSlot)} USDC (Wallet Solana)
                            </button>
                          )}

                          {/* Dev Simulator Bypass (Extremely helpful for testing without mainnet balance) */}
                          <button
                            onClick={handleSimulatedPurchase}
                            className="w-full py-3 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-white font-extrabold text-xs rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 bg-indigo-950/20"
                          >
                            <HeartHandshake className="w-3.5 h-3.5 text-[#00ff88]" />
                            Simular Pago de Prueba (Dev Mode)
                          </button>
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
