import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Wallet } from './components/Wallet';
import { GameBoard } from './components/GameBoard';
import { AuthProvider, useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, Wallet as WalletIcon, Trophy, Settings, ShieldAlert, Check, X, User } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { Profile } from './components/Profile';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { user, loading, profile } = useAuth();
  const [activeView, setActiveView] = useState<'game' | 'wallet' | 'admin' | 'profile'>('game');

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#F27D26]/20 border-t-[#F27D26] rounded-full animate-spin" />
          <p className="text-[#F27D26] font-serif italic animate-pulse">Loading ColorWin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#F27D26] selection:text-black relative overflow-x-hidden">
      {/* Premium Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#F27D26]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-violet-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10">
        <Navbar />
        
        <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
          {!user ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl sm:text-8xl font-serif italic tracking-tighter mb-6 leading-none"
              >
                PREDICT.<br />WIN.<br /><span className="text-[#F27D26] drop-shadow-[0_0_15px_rgba(242,125,38,0.3)]">REPEAT.</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-white/40 max-w-md mb-12 text-lg"
              >
                The most premium color prediction platform in Bangladesh. 
                Instant deposits and withdrawals via bKash, Nagad, and Rocket.
              </motion.p>
              <div className="grid grid-cols-3 gap-8 opacity-20 grayscale">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Bkash_logo.png/1200px-Bkash_logo.png" alt="bKash" className="h-8 object-contain" referrerPolicy="no-referrer" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Nagad_Logo.svg/1200px-Nagad_Logo.svg.png" alt="Nagad" className="h-8 object-contain" referrerPolicy="no-referrer" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Rocket_Logo.svg/1200px-Rocket_Logo.svg.png" alt="Rocket" className="h-8 object-contain" referrerPolicy="no-referrer" />
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeView === 'game' && <GameBoard />}
                {activeView === 'wallet' && <Wallet />}
                {activeView === 'profile' && <Profile />}
                {activeView === 'admin' && profile?.role === 'admin' && <AdminPanel />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Bottom Navigation */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 px-6 py-4">
          <div className="max-w-md mx-auto flex justify-between items-center">
            <button 
              onClick={() => setActiveView('game')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'game' ? 'text-[#F27D26]' : 'text-white/40 hover:text-white/60'}`}
            >
              <LayoutGrid size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Game</span>
            </button>
            <button 
              onClick={() => setActiveView('wallet')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'wallet' ? 'text-[#F27D26]' : 'text-white/40 hover:text-white/60'}`}
            >
              <WalletIcon size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Wallet</span>
            </button>
            <button 
              onClick={() => setActiveView('profile')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'profile' ? 'text-[#F27D26]' : 'text-white/40 hover:text-white/60'}`}
            >
              <User size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
            </button>
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveView('admin')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'admin' ? 'text-[#F27D26]' : 'text-white/40 hover:text-white/60'}`}
              >
                <Settings size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Admin</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
