import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { LogIn, LogOut, User as UserIcon, Wallet, Bell } from 'lucide-react';
import { motion } from 'motion/react';

export const Navbar: React.FC = () => {
  const { user, profile } = useAuth();

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-6xl mx-auto glass rounded-2xl px-6 py-4 flex justify-between items-center border border-white/10 shadow-2xl backdrop-blur-xl">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-[#F27D26] to-amber-500 rounded-xl flex items-center justify-center font-bold text-black text-xl shadow-[0_0_15px_rgba(242,125,38,0.4)]">
            CW
          </div>
          <span className="text-xl font-serif italic tracking-tighter uppercase">ColorWin</span>
        </motion.div>

        <div className="flex items-center gap-4 sm:gap-6">
          {user ? (
            <>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner"
              >
                <Wallet size={16} className="text-[#F27D26]" />
                <span className="font-mono font-bold text-emerald-400">৳{(profile?.balance ?? 0).toFixed(2)}</span>
              </motion.div>
              
              <div className="flex items-center gap-3 border-l border-white/10 pl-4 sm:pl-6">
                <button className="p-2 text-white/40 hover:text-white transition-colors relative">
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#F27D26] rounded-full border-2 border-black" />
                </button>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-serif italic">{profile?.displayName}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{profile?.role}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-all flex items-center justify-center border border-white/5"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogin}
              className="flex items-center gap-2 bg-gradient-to-r from-[#F27D26] to-amber-500 text-black font-bold px-6 py-2.5 rounded-xl shadow-[0_0_20px_rgba(242,125,38,0.3)] transition-all"
            >
              <LogIn size={18} />
              <span className="text-sm uppercase tracking-wider">Login</span>
            </motion.button>
          )}
        </div>
      </div>
    </nav>
  );
};
