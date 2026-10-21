'use client';

import React, { useMemo, createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';

// Import Solana Wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// --- AUTHENTICATION ADAPTER SYSTEM ---
// We adapt Privy's user model to our app's expected model
interface AuthUser {
  id: string; // Internal or Privy ID
  x_handle: string;
  avatar_url: string;
  x_id: string;
  wallet_address?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithX: (role?: 'creator' | 'sponsor') => void;
  logout: () => void;
  /** Devuelve el access token de Privy para llamar a la API (Authorization: Bearer) */
  getAccessToken: () => Promise<string | null>;
  /** fetch con el token de sesión incluido */
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function PrivyAuthAdapter({ children }: { children: React.ReactNode }) {
  const { user: privyUser, ready, login, logout: privyLogout, authenticated, getAccessToken } = usePrivy();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncing, setSyncing] = useState(false);

  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = await getAccessToken();
      const headers = new Headers(init.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      return fetch(input, { ...init, headers });
    },
    [getAccessToken]
  );

  useEffect(() => {
    let cancelled = false;
    async function syncUser() {
      if (ready && authenticated && privyUser) {
        setSyncing(true);
        try {
          // El servidor verifica el token y lee el perfil de X directamente de Privy
          const res = await authFetch('/api/auth/sync', { method: 'POST' });
          const data = await res.json();
          if (!cancelled && res.ok && data.user) {
            setUser({
              id: data.user.id,
              x_handle: data.user.x_handle,
              avatar_url: data.user.avatar_url,
              x_id: data.user.x_id,
              wallet_address: data.user.wallet_address || '',
            });
          } else if (!res.ok) {
            console.error('Error sincronizando usuario:', data.error);
          }
        } finally {
          if (!cancelled) setSyncing(false);
        }
      } else if (ready && !authenticated) {
        setUser(null);
      }
    }
    syncUser();
    return () => {
      cancelled = true;
    };
  }, [privyUser?.id, ready, authenticated, authFetch]);

  const loginWithX = (_role?: 'creator' | 'sponsor') => {
    login();
  };

  const logout = () => {
    privyLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading: !ready || syncing, loginWithX, logout, getAccessToken, authFetch, isMock: false }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// --- MAIN PROVIDERS WRAPPER ---
export function Providers({ children }: { children: React.ReactNode }) {
  // Solana setup
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as WalletAdapterNetwork;
  
  // Use Helius or cluster API URL
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }
    return clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'insert-privy-app-id'}
      config={{
        loginMethods: ['twitter', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#00ff88',
          logo: 'https://cryptologos.cc/logos/solana-sol-logo.png', // Fallback logo
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <PrivyAuthAdapter>
              {children}
            </PrivyAuthAdapter>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </PrivyProvider>
  );
}
