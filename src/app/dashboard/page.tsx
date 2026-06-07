'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers';
import { packSlots, PackedSlot } from '@/lib/algorithms/packing';
import { InteractiveWall, SlotWithPurchase } from '@/components/InteractiveWall';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Copy, Check, ExternalLink, Plus, LogOut } from 'lucide-react';

interface WallListItem {
  id: string;
  name: string;
  layout_type: string;
  wallet_address: string;
  is_active: boolean;
  layout_config: any;
  created_at: string;
}

export default function DashboardPage() {
  const { user, loginWithX, logout, isLoading: authLoading } = useAuth();
  
  // States
  const [walls, setWalls] = useState<WallListItem[]>([]);
  const [loadingWalls, setLoadingWalls] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  
  // Form states
  const [wallName, setWallName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [layoutType, setLayoutType] = useState<'EXCLUSIVE' | 'GRANDE' | 'MEDIANA' | 'COMUNITARIA' | 'HYBRID'>('COMUNITARIA');
  const [prices, setPrices] = useState({
    STANDARD: 10,
    GOLD: 30,
    PLATINUM: 70,
    VIP: 150,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewSlots, setPreviewSlots] = useState<SlotWithPurchase[]>([]);

  const supabase = createClient();

  // Load existing walls when user is logged in
  useEffect(() => {
    if (user) {
      loadCreatorWalls();
    }
  }, [user]);

  // Generate preview slots when template changes
  useEffect(() => {
    const templateCounts: Record<string, Record<string, number>> = {
      EXCLUSIVE: { VIP: 4 }, // 4 slots of 4x4
      GRANDE: { VIP: 4 },
      MEDIANA: { GOLD: 16 }, // 16 slots of 2x2
      COMUNITARIA: { STANDARD: 64 }, // 64 slots of 1x1
      HYBRID: { VIP: 1, PLATINUM: 2, GOLD: 4, STANDARD: 14 }, // Mix: 16 + 18 + 16 + 14 = 64
    };

    const counts = templateCounts[layoutType];
    const packedResult = packSlots(counts);

    if (packedResult.isValid) {
      const slots: SlotWithPurchase[] = packedResult.slots.map((s, idx) => ({
        id: `preview-${idx}`,
        wall_id: 'preview',
        tier: s.tier as any,
        grid_x: s.x,
        grid_y: s.y,
        grid_size: s.size,
        status: 'AVAILABLE',
        price_usdc: prices[s.tier as keyof typeof prices],
      }));
      setPreviewSlots(slots);
    }
  }, [layoutType, prices]);

  const loadCreatorWalls = async () => {
    setLoadingWalls(true);
    try {
      // Create or update creator profile in database when user accesses dashboard
      if (user) {
        // We use x_id as the unique identifier for upserting, letting Supabase generate the UUID PK.
        await supabase.from('creators').upsert({
          auth0_id: user.id, // Storing privy DID here
          x_handle: user.x_handle,
          x_id: user.x_id,
          avatar_url: user.avatar_url,
          wallet_address: walletAddress || null
        }, { onConflict: 'x_id' });
      }

      const { data, error } = await supabase
        .from('walls')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWalls(data || []);
    } catch (err) {
      console.error('Error loading walls:', err);
    } finally {
      setLoadingWalls(false);
    }
  };

  const handlePriceChange = (tier: keyof typeof prices, value: string) => {
    const num = parseFloat(value);
    setPrices(prev => ({
      ...prev,
      [tier]: isNaN(num) ? 0 : num,
    }));
  };

  const handleCreateWall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallName.trim()) return alert('Por favor ingresa un nombre para el muro');
    if (!walletAddress.trim()) return alert('Por favor ingresa la wallet de destino para los USDC');

    setCreating(true);

    try {
      // 1. Create Wall in DB
      const { data: wall, error: wallError } = await supabase
        .from('walls')
        .insert({
          creator_id: user!.id,
          name: wallName,
          layout_type: layoutType,
          wallet_address: walletAddress,
          layout_config: { prices },
          is_active: true,
        })
        .select()
        .single();

      if (wallError) throw wallError;

      // 2. Generate packing slots
      const templateCounts: Record<string, Record<string, number>> = {
        EXCLUSIVE: { VIP: 4 },
        GRANDE: { VIP: 4 },
        MEDIANA: { GOLD: 16 },
        COMUNITARIA: { STANDARD: 64 },
        HYBRID: { VIP: 1, PLATINUM: 2, GOLD: 4, STANDARD: 14 },
      };

      const packedResult = packSlots(templateCounts[layoutType]);

      if (!packedResult.isValid) {
        throw new Error(packedResult.error || 'Error empaquetando los slots');
      }

      // 3. Insert slots to DB
      const slotsToInsert = packedResult.slots.map(s => ({
        wall_id: wall.id,
        tier: s.tier,
        grid_x: s.x,
        grid_y: s.y,
        grid_size: s.size,
        status: 'AVAILABLE',
      }));

      const { error: slotsError } = await supabase
        .from('slots')
        .insert(slotsToInsert);

      if (slotsError) throw slotsError;

      alert('¡Muro publicitario creado exitosamente!');
      setWallName('');
      setActiveTab('list');
      loadCreatorWalls();
    } catch (err: any) {
      console.error('Error creating wall:', err);
      alert(`Error al crear el muro: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const copyBlinkLink = (wallId: string) => {
    const baseUrl = window.location.origin;
    const blinkUrl = `${baseUrl}/walls/${wallId}`;
    navigator.clipboard.writeText(blinkUrl);
    setCopiedId(wallId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- RENDERING IF NOT LOGGED IN ---
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-tr from-purple-500/10 to-[#00ff88]/10 blur-3xl -z-10" />
        <div className="max-w-md p-8 bg-[#0a0f1d]/80 border border-white/5 rounded-3xl shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#00ff88] to-[#00e5ff] flex items-center justify-center font-black text-black text-2xl mx-auto mb-6 shadow-[0_0_20px_rgba(0,255,136,0.3)]">
            B
          </div>
          <h2 className="text-2xl font-black mb-4">Acceso para Creadores</h2>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Conecta tu perfil de X para empezar a crear muros publicitarios y monetizar tus tweets mediante Blinks de Solana.
          </p>
          <button
            onClick={() => loginWithX('creator')}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white text-black font-extrabold rounded-xl hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300"
          >
            {authLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Conectar perfil de X
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD VIEW ---
  return (
    <div className="py-4">
      {/* User Header Profile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0a0f1d]/50 p-4 border border-white/5 rounded-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <img
            src={user.avatar_url}
            alt={user.x_handle}
            className="w-12 h-12 rounded-full border border-[#00ff88]/30 shadow-md"
          />
          <div>
            <h3 className="font-extrabold text-base">@{user.x_handle}</h3>
            <span className="text-[10px] uppercase font-bold text-[#00ff88] tracking-widest">Creador Verificado</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold text-xs rounded-xl transition-all duration-300"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar Sesión
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/5 mb-8">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all duration-300 ${
            activeTab === 'list' ? 'border-[#00ff88] text-[#00ff88]' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Mis Muros
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all duration-300 flex items-center gap-2 ${
            activeTab === 'create' ? 'border-[#00ff88] text-[#00ff88]' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          Crear Nuevo Muro
        </button>
      </div>

      {/* TAB 1: WALLS LIST */}
      {activeTab === 'list' && (
        <div>
          {loadingWalls ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#00ff88] animate-spin" />
            </div>
          ) : walls.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-[#0a0f1d]/20">
              <span className="text-3xl block mb-4">🔲</span>
              <h4 className="font-bold text-lg mb-2">No tienes muros creados</h4>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
                Crea tu primer muro digital para patrocinadores, define los precios de los slots y empieza a monetizar en X.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-5 py-2.5 bg-gradient-to-r from-[#00ff88] to-[#00e5ff] text-black font-extrabold text-xs rounded-xl shadow-lg hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all duration-300"
              >
                Crear mi primer muro
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {walls.map((wall) => {
                const isCopied = copiedId === wall.id;
                const viewUrl = `/walls/${wall.id}`;
                return (
                  <div key={wall.id} className="p-6 bg-[#0a0f1d]/75 border border-white/5 rounded-2xl backdrop-blur-md flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-extrabold text-lg truncate max-w-[70%]">{wall.name}</h4>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-500/30">
                          {wall.layout_type}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-slate-400 mb-6">
                        <div className="flex justify-between">
                          <span>Wallet de Pago:</span>
                          <span className="font-mono text-white truncate max-w-[60%]">{wall.wallet_address}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estado:</span>
                          <span className={wall.is_active ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            {wall.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => copyBlinkLink(wall.id)}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all duration-300 ${
                          isCopied 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' 
                            : 'bg-white/5 text-white hover:bg-white/10 border-white/5'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            ¡Enlace del Blink Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar Enlace del Blink
                          </>
                        )}
                      </button>

                      <a
                        href={viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all duration-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ver Página del Muro
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE WALL FORM */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateWall} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Side */}
          <div className="lg:col-span-5 bg-[#0a0f1d]/75 border border-white/5 p-6 rounded-2xl backdrop-blur-md space-y-6">
            <h4 className="font-extrabold text-lg border-b border-white/5 pb-3">Configurar Muro</h4>
            
            {/* Wall Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">Nombre del Muro</label>
              <input
                type="text"
                value={wallName}
                onChange={e => setWallName(e.target.value)}
                placeholder="Ej. Mi Muro de Sponsors de Cripto"
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:border-[#00ff88] text-sm focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Wallet Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">Wallet Solana (Recibe USDC)</label>
              <input
                type="text"
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="Dirección pública de Solana wallet"
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:border-[#00ff88] text-sm font-mono focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">Plantilla del Layout</label>
              <select
                value={layoutType}
                onChange={e => setLayoutType(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:border-[#00ff88] text-sm focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="COMUNITARIA">Comunitaria (64 slots 1x1)</option>
                <option value="MEDIANA">Mediana (16 slots 2x2)</option>
                <option value="GRANDE">Grande (4 slots 4x4)</option>
                <option value="EXCLUSIVE">Exclusiva (4 slots 4x4)</option>
                <option value="HYBRID">Híbrida (Mix de Tiers)</option>
              </select>
            </div>

            {/* Price Config */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-400 block border-t border-white/5 pt-3">Ajustar Precios por Tier (USDC)</label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400">STANDARD (1x1)</span>
                  <input
                    type="number"
                    value={prices.STANDARD}
                    onChange={e => handlePriceChange('STANDARD', e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                    min="1"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-amber-500">GOLD (2x2)</span>
                  <input
                    type="number"
                    value={prices.GOLD}
                    onChange={e => handlePriceChange('GOLD', e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                    min="1"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-cyan-400">PLATINUM (3x3)</span>
                  <input
                    type="number"
                    value={prices.PLATINUM}
                    onChange={e => handlePriceChange('PLATINUM', e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                    min="1"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-pink-500">VIP (4x4)</span>
                  <input
                    type="number"
                    value={prices.VIP}
                    onChange={e => handlePriceChange('VIP', e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={creating}
              className="w-full py-3.5 bg-gradient-to-r from-[#00ff88] to-[#00e5ff] text-black font-extrabold rounded-xl hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creando Muro...
                </>
              ) : (
                <>Crear y Guardar Muro</>
              )}
            </button>
          </div>

          {/* Live Preview Side */}
          <div className="lg:col-span-7 flex flex-col items-center gap-4 bg-[#0a0f1d]/30 border border-white/5 p-6 rounded-2xl backdrop-blur-md">
            <div className="w-full flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-sm font-bold text-white">Vista Previa Interactiva</span>
              <span className="text-[10px] text-slate-400 font-mono">Modo: {layoutType}</span>
            </div>
            
            <InteractiveWall 
              slots={previewSlots} 
              interactive={false}
              tierPrices={prices}
            />
          </div>
        </form>
      )}
    </div>
  );
}
