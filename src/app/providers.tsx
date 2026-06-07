'use client';

import React, { useMemo, createContext, useContext, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { createClient } from '@/lib/supabase/client';

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
  const { user: privyUser, ready, login, logout: privyLogout, authenticated } = usePrivy();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function syncUser() {
      if (ready && authenticated && privyUser) {
        const supabase = createClient();
        const twitter = privyUser.twitter;
        
        const x_handle = twitter?.username || privyUser.wallet?.address?.slice(0, 8) || 'anon';
        const avatar_url = twitter?.profilePictureUrl || `https://unavatar.io/twitter/${x_handle}`;
        const x_id = twitter?.subject || privyUser.id;
        const wallet_address = privyUser.wallet?.address || null;

        // Sync with Supabase to get the true internal UUID
        const { data, error } = await supabase.from('creators').upsert({
          auth0_id: privyUser.id,
          x_handle: x_handle,
          x_id: x_id,
          avatar_url: avatar_url,
          wallet_address: wallet_address
        }, { onConflict: 'x_id' }).select().single();

        if (!error && data) {
          setUser({
            id: data.id, // Internal UUID from Supabase
            x_handle: data.x_handle,
            avatar_url: data.avatar_url,
            x_id: data.x_id,
            wallet_address: data.wallet_address || '',
          });
        }
      } else if (ready && !authenticated) {
        setUser(null);
      }
    }
    syncUser();
  }, [privyUser, ready, authenticated]);

  const loginWithX = (role?: 'creator' | 'sponsor') => {
    login(); // Privy opens its own highly optimized modal
  };

  const logout = () => {
    privyLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading: !ready, loginWithX, logout, isMock: false }}>
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
          createOnLogin: 'users-without-wallets',
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
