'use client';

import React from 'react';
import Image from 'next/image';

export interface SlotWithPurchase {
  id: string;
  wall_id: string;
  tier: 'STANDARD' | 'GOLD' | 'PLATINUM' | 'VIP';
  grid_x: number;
  grid_y: number;
  grid_size: number;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'EXPIRED';
  price_usdc?: number;
  purchase?: {
    buyer_x_handle: string;
    buyer_avatar_url: string;
  } | null;
}

interface InteractiveWallProps {
  slots: SlotWithPurchase[];
  selectedSlotId?: string;
  onSlotSelect?: (slot: SlotWithPurchase) => void;
  tierPrices?: Record<string, number>;
  interactive?: boolean;
}

export function InteractiveWall({
  slots,
  selectedSlotId,
  onSlotSelect,
  tierPrices = { STANDARD: 10, GOLD: 30, PLATINUM: 70, VIP: 150 },
  interactive = true,
}: InteractiveWallProps) {
  
  const tierColors: Record<string, string> = {
    VIP: 'from-[#ec4899] to-[#f43f5e] border-[#f43f5e]/40 shadow-[0_0_15px_rgba(236,72,153,0.15)]',
    PLATINUM: 'from-[#06b6d4] to-[#0ea5e9] border-[#0ea5e9]/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    GOLD: 'from-[#f59e0b] to-[#d97706] border-[#d97706]/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    STANDARD: 'from-[#64748b] to-[#475569] border-[#475569]/40',
  };

  const textColors: Record<string, string> = {
    VIP: 'text-pink-400',
    PLATINUM: 'text-cyan-400',
    GOLD: 'text-amber-400',
    STANDARD: 'text-slate-400',
  };

  return (
    <div className="relative w-full aspect-square md:aspect-auto md:h-[550px] max-w-[550px] mx-auto p-4 bg-[#0a0f1d]/90 border border-white/5 rounded-2xl shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col justify-between">
      {/* Background glow effects inside the wall container */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Container */}
      <div 
        className="grid grid-cols-8 grid-rows-8 gap-2 w-full aspect-square relative z-10 bg-black/40 p-2 rounded-xl border border-white/5"
        style={{
          gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
        }}
      >
        {slots.map((slot) => {
          const isSelected = selectedSlotId === slot.id;
          const isOccupied = slot.status === 'OCCUPIED' && slot.purchase;
          const isReserved = slot.status === 'RESERVED';
          
          const colStart = slot.grid_x + 1;
          const rowStart = slot.grid_y + 1;
          const span = slot.grid_size;

          const price = slot.price_usdc ?? tierPrices[slot.tier] ?? 0;

          return (
            <button
              key={slot.id}
              onClick={() => interactive && onSlotSelect && onSlotSelect(slot)}
              disabled={!interactive || isOccupied || isReserved}
              style={{
                gridColumn: `${colStart} / span ${span}`,
                gridRow: `${rowStart} / span ${span}`,
              }}
              className={`
                relative flex flex-col items-center justify-center rounded-lg border text-center transition-all duration-300 overflow-hidden
                ${isOccupied 
                  ? 'bg-gradient-to-br from-[#1e1b4b] to-[#0f172a] border-indigo-500/30 cursor-default p-1' 
                  : isReserved
                    ? 'bg-yellow-950/40 border-yellow-500/20 cursor-not-allowed animate-pulse'
                    : `bg-gradient-to-br ${tierColors[slot.tier]} hover:scale-[0.98] ${
                        isSelected 
                          ? 'ring-2 ring-[#00ff88] scale-[0.97] opacity-100 z-20' 
                          : 'opacity-70 hover:opacity-100'
                      }`
                }
              `}
            >
              {isOccupied ? (
                <div className="flex flex-col items-center justify-center w-full h-full p-1">
                  <div className="relative w-7 h-7 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-indigo-500/40 shadow-md">
                    <img
                      src={slot.purchase!.buyer_avatar_url || `https://unavatar.io/twitter/${slot.purchase!.buyer_x_handle}`}
                      alt={slot.purchase!.buyer_x_handle}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${slot.purchase!.buyer_x_handle}`;
                      }}
                    />
                  </div>
                  <span className="mt-1 text-[8px] sm:text-[10px] font-bold text-slate-300 truncate max-w-full px-1">
                    @{slot.purchase!.buyer_x_handle}
                  </span>
                </div>
              ) : isReserved ? (
                <div className="text-yellow-500 text-[8px] font-black uppercase tracking-wider">
                  ⚠️ Reservado
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-1 w-full h-full">
                  <span className="text-[9px] sm:text-xs font-black tracking-wider uppercase opacity-90 drop-shadow-sm text-black">
                    {slot.tier}
                  </span>
                  {span > 1 && (
                    <span className="text-[8px] sm:text-[10px] font-bold mt-0.5 text-black/80">
                      {price} USDC
                    </span>
                  )}
                  {/* Subtle Grid Indicator */}
                  <span className="absolute bottom-1 right-1 text-[6px] text-white/40 font-mono">
                    {span}x{span}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] text-slate-400 border-t border-white/5 pt-3 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-[#ec4899] to-[#f43f5e] opacity-70" />
          <span>VIP (4x4)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-[#06b6d4] to-[#0ea5e9] opacity-70" />
          <span>Platinum (3x3)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-[#f59e0b] to-[#d97706] opacity-70" />
          <span>Gold (2x2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-[#64748b] to-[#475569] opacity-70" />
          <span>Standard (1x1)</span>
        </div>
      </div>
    </div>
  );
}
