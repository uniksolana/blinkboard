'use client';

import React, { useMemo, createContext, useContext, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import Solana Wallet adapter CSS (we will define styles or load default)
import '@solana/wallet-adapter-react-ui/styles.css';

// --- MOCK AUTHENTICATION SYSTEM ---
interface AuthUser {
  id: string;
  x_handle: string;
  avatar_url: string;
  x_id: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithX: (role: 'creator' | 'sponsor', handle?: string) => Promise<void>;
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

function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for mock session
    const savedUser = localStorage.getItem('blinkboard_mock_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const loginWithX = async (role: 'creator' | 'sponsor', customHandle?: string) => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const handle = customHandle || (role === 'creator' ? 'cryptocreator' : 'sponsor_anon');
    const mockUser: AuthUser = {
      id: role === 'creator' ? 'c1111111-1111-1111-1111-111111111111' : 's2222222-2222-2222-2222-222222222222',
      x_handle: handle,
      avatar_url: `https://unavatar.io/twitter/${handle}`,
      x_id: Math.floor(Math.random() * 1000000000).toString(),
    };

    localStorage.setItem('blinkboard_mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setIsLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('blinkboard_mock_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithX, logout, isMock: true }}>
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
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <MockAuthProvider>
            {children}
          </MockAuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
