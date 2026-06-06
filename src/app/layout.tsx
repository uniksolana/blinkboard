import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../../app/globals.css'; // Path to globals.css in the app directory
import { Providers } from './providers';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BlinkBoard | Muros Publicitarios en Solana Blinks',
  description: 'Monetiza espacios publicitarios digitales en X con Solana Actions & Blinks y USDC.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark scroll-smooth">
      <body className={`${inter.className} bg-[#04060a] text-slate-100 min-h-screen flex flex-col selection:bg-emerald-500 selection:text-black overflow-x-hidden`}>
        <Providers>
          {/* Futuristic Background Blur */}
          <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-purple-900/10 via-emerald-900/5 to-transparent -z-10 pointer-events-none filter blur-3xl opacity-70" />
          <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-cyan-900/15 -z-10 pointer-events-none filter blur-3xl rounded-full opacity-60 animate-pulse" />

          {/* Premium Glass Header */}
          <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#04060a]/75 backdrop-blur-md transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2 group">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00ff88] to-[#00e5ff] flex items-center justify-center font-black text-black text-xl shadow-[0_0_15px_rgba(0,255,136,0.3)] group-hover:scale-105 transition-transform duration-300">
                    B
                  </div>
                  <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent group-hover:text-white transition-colors">
                    Blink<span className="text-[#00ff88]">Board</span>
                  </span>
                </Link>
              </div>

              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                <Link href="/dashboard" className="hover:text-white transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-[#00ff88] hover:after:w-full after:transition-all after:duration-300">
                  Creadores
                </Link>
                <a href="#features" className="hover:text-white transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-[#00ff88] hover:after:w-full after:transition-all after:duration-300">
                  Características
                </a>
                <a href="#roadmap" className="hover:text-white transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-[#00ff88] hover:after:w-full after:transition-all after:duration-300">
                  Roadmap
                </a>
              </nav>

              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-black bg-gradient-to-r from-[#00ff88] to-[#00e5ff] rounded-xl hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] hover:scale-[1.02] transition-all duration-300"
                >
                  Dashboard Creador
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            {children}
          </main>

          {/* Futuristic Footer */}
          <footer className="border-t border-white/5 bg-[#020306]/80 py-8 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                © {new Date().getFullYear()} BlinkBoard. Todos los derechos reservados.
              </div>
              <div className="flex gap-6 text-slate-400">
                <a href="#" className="hover:text-[#00ff88] transition-colors">Términos</a>
                <a href="#" className="hover:text-[#00ff88] transition-colors">Privacidad</a>
                <a href="https://x.com/blinkboard_xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[#00ff88] transition-colors">X (Twitter)</a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
