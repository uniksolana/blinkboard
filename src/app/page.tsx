'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './providers';
import { InteractiveWall, SlotWithPurchase } from '@/components/InteractiveWall';

// Mock slots for visual display on the landing page
const MOCK_LANDING_SLOTS: SlotWithPurchase[] = [
  { id: '1', wall_id: 'w1', tier: 'VIP', grid_x: 0, grid_y: 0, grid_size: 4, status: 'OCCUPIED', purchase: { buyer_x_handle: 'solana', buyer_avatar_url: 'https://unavatar.io/twitter/solana' } },
  { id: '2', wall_id: 'w1', tier: 'GOLD', grid_x: 4, grid_y: 0, grid_size: 2, status: 'OCCUPIED', purchase: { buyer_x_handle: 'phantom', buyer_avatar_url: 'https://unavatar.io/twitter/phantom' } },
  { id: '3', wall_id: 'w1', tier: 'GOLD', grid_x: 6, grid_y: 0, grid_size: 2, status: 'AVAILABLE' },
  { id: '4', wall_id: 'w1', tier: 'STANDARD', grid_x: 4, grid_y: 2, grid_size: 1, status: 'AVAILABLE' },
  { id: '5', wall_id: 'w1', tier: 'STANDARD', grid_x: 5, grid_y: 2, grid_size: 1, status: 'AVAILABLE' },
  { id: '6', wall_id: 'w1', tier: 'GOLD', grid_x: 6, grid_y: 2, grid_size: 2, status: 'OCCUPIED', purchase: { buyer_x_handle: 'heliuslabs', buyer_avatar_url: 'https://unavatar.io/twitter/heliuslabs' } },
  { id: '7', wall_id: 'w1', tier: 'PLATINUM', grid_x: 0, grid_y: 4, grid_size: 3, status: 'AVAILABLE' },
  { id: '8', wall_id: 'w1', tier: 'STANDARD', grid_x: 3, grid_y: 4, grid_size: 1, status: 'AVAILABLE' },
  { id: '9', wall_id: 'w1', tier: 'VIP', grid_x: 4, grid_y: 4, grid_size: 4, status: 'AVAILABLE' },
  { id: '10', wall_id: 'w1', tier: 'STANDARD', grid_x: 3, grid_y: 5, grid_size: 1, status: 'AVAILABLE' },
  { id: '11', wall_id: 'w1', tier: 'GOLD', grid_x: 0, grid_y: 7, grid_size: 2, status: 'AVAILABLE' },
  { id: '12', wall_id: 'w1', tier: 'GOLD', grid_x: 2, grid_y: 7, grid_size: 2, status: 'AVAILABLE' },
];

export default function LandingPage() {
  const { user, loginWithX, isLoading } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<SlotWithPurchase | undefined>(undefined);

  return (
    <div className="relative overflow-hidden pt-8 pb-16 flex flex-col items-center">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto mb-16 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/5 text-[#00ff88] text-xs font-semibold mb-6 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
          Solana Actions & Blinks MVP
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight sm:leading-none mb-6">
          Vende publicidad en X <br className="hidden sm:inline" />
          mediante{' '}
          <span className="bg-gradient-to-r from-[#00ff88] via-[#00e5ff] to-[#8b5cf6] bg-clip-text text-transparent">
            Solana Blinks
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          BlinkBoard permite a creadores de contenido configurar muros de patrocinadores en segundos. Tus sponsors compran slots directamente en USDC y se auto-publican al instante.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#00ff88] to-[#00e5ff] text-black font-extrabold rounded-xl hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] hover:scale-[1.02] transition-all duration-300 text-center"
          >
            Crear mi Muro Ahora
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto px-8 py-4 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 font-bold rounded-xl text-center transition-all duration-300"
          >
            Ver demo interactiva
          </a>
        </div>
      </section>

      {/* Grid Interactive Preview Section */}
      <section id="demo" className="w-full max-w-6xl mx-auto mb-24 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Text panel */}
          <div className="lg:col-span-5 flex flex-col justify-center text-left">
            <h2 className="text-3xl font-extrabold mb-6">
              El Muro Publicitario del Futuro
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88] font-bold shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-base mb-1">Precios por Tiers</h4>
                  <p className="text-sm text-slate-400">
                    Configura el coste de tus slots STANDARD, GOLD, PLATINUM o VIP y deja que el algoritmo empaquete el muro a la perfección.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/20 flex items-center justify-center text-[#00e5ff] font-bold shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-base mb-1">Compra Instantánea en USDC</h4>
                  <p className="text-sm text-slate-400">
                    Tus patrocinadores inician sesión con su cuenta de X y firman la transacción de USDC desde su wallet.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6] font-bold shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-base mb-1">Actualización en Tiempo Real</h4>
                  <p className="text-sm text-slate-400">
                    Al validarse la transacción en Solana, la imagen dinámica del Blink y el muro en la web se actualizan automáticamente con su perfil.
                  </p>
                </div>
              </div>
            </div>

            {selectedSlot && (
              <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl relative overflow-hidden animate-fadeIn">
                <h4 className="text-xs font-black uppercase text-[#00ff88] tracking-wider mb-2">Slot Seleccionado</h4>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-sm block">Tier {selectedSlot.tier}</span>
                    <span className="text-xs text-slate-400">Tamaño: {selectedSlot.grid_size}x{selectedSlot.grid_size}</span>
                  </div>
                  <span className="text-lg font-black text-white">
                    {selectedSlot.tier === 'VIP' ? 150 : selectedSlot.tier === 'PLATINUM' ? 70 : selectedSlot.tier === 'GOLD' ? 30 : 10} USDC
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Wall */}
          <div className="lg:col-span-7 flex justify-center">
            <InteractiveWall 
              slots={MOCK_LANDING_SLOTS} 
              selectedSlotId={selectedSlot?.id}
              onSlotSelect={(slot) => setSelectedSlot(slot)}
            />
          </div>
        </div>
      </section>

      {/* Feature Specs */}
      <section id="features" className="w-full max-w-6xl mx-auto mb-20 px-4 text-center">
        <h2 className="text-3xl font-extrabold mb-12">¿Por qué BlinkBoard?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-[#00ff88]/30 transition-all duration-300 text-left">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#ec4899] to-purple-600 flex items-center justify-center font-bold text-lg mb-6 shadow-lg shadow-pink-500/10">
              ⚡
            </div>
            <h3 className="text-xl font-bold mb-3">Integración con X</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Los patrocinadores ven tu muro y acceden con un click en la timeline. La autenticación con X valida su identidad instantáneamente.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-[#00e5ff]/30 transition-all duration-300 text-left">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#00e5ff] to-blue-600 flex items-center justify-center font-bold text-lg mb-6 shadow-lg shadow-cyan-500/10">
              💎
            </div>
            <h3 className="text-xl font-bold mb-3">Pagos Directos</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sin intermediarios. Los USDC van directamente de la billetera del patrocinador a la billetera que especifiques como creador.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-[#8b5cf6]/30 transition-all duration-300 text-left">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#8b5cf6] to-indigo-600 flex items-center justify-center font-bold text-lg mb-6 shadow-lg shadow-purple-500/10">
              📦
            </div>
            <h3 className="text-xl font-bold mb-3">Diseño Empaquetado</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              El algoritmo matemático de packing acomoda de manera determinista cada slot para garantizar un diseño limpio sin huecos.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
