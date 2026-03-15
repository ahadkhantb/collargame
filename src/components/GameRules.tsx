import React from 'react';
import { motion } from 'motion/react';
import { Info, HelpCircle, Trophy, Target, Zap } from 'lucide-react';

export const GameRules: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-white/60 mb-2">
        <HelpCircle size={20} className="text-[#F27D26]" />
        <h3 className="text-xl font-serif italic">How to Play</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass p-6 rounded-2xl border border-white/5"
        >
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
            <Target size={20} />
          </div>
          <h4 className="font-bold mb-2">1. Choose Selection</h4>
          <p className="text-xs text-white/40 leading-relaxed">
            Select a Color (Green, Red, Violet) or a Number (0-9) to place your prediction.
          </p>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="glass p-6 rounded-2xl border border-white/5"
        >
          <div className="w-10 h-10 bg-[#F27D26]/10 text-[#F27D26] rounded-full flex items-center justify-center mb-4">
            <Zap size={20} />
          </div>
          <h4 className="font-bold mb-2">2. Set Amount</h4>
          <p className="text-xs text-white/40 leading-relaxed">
            Choose your bet amount starting from ৳10 up to ৳5000 per prediction.
          </p>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="glass p-6 rounded-2xl border border-white/5"
        >
          <div className="w-10 h-10 bg-violet-500/10 text-violet-500 rounded-full flex items-center justify-center mb-4">
            <Trophy size={20} />
          </div>
          <h4 className="font-bold mb-2">3. Wait for Result</h4>
          <p className="text-xs text-white/40 leading-relaxed">
            Each period lasts 3 minutes. Betting closes 30 seconds before the draw.
          </p>
        </motion.div>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="bg-white/5 p-4 border-b border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Info size={16} className="text-[#F27D26]" />
            Winning Conditions & Payouts
          </h4>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span className="text-xs font-medium">Green</span>
                </div>
                <span className="text-xs font-mono text-emerald-400">2x Payout</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-500 rounded-full" />
                  <span className="text-xs font-medium">Red</span>
                </div>
                <span className="text-xs font-mono text-rose-400">2x Payout</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-violet-500 rounded-full" />
                  <span className="text-xs font-medium">Violet</span>
                </div>
                <span className="text-xs font-mono text-violet-400">4.5x Payout</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl h-full">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Number (0-9)</span>
                  <span className="text-[10px] text-white/30">Exact match prediction</span>
                </div>
                <span className="text-xs font-mono text-[#F27D26]">9x Payout</span>
              </div>
            </div>
          </div>

          <div className="bg-black/20 p-4 rounded-xl border border-white/5">
            <h5 className="text-[10px] uppercase font-bold text-white/40 mb-2">Color Rules</h5>
            <ul className="text-[10px] text-white/60 space-y-1 list-disc pl-4">
              <li><span className="text-emerald-400">Green</span> wins if result number is 1, 3, 7, or 9.</li>
              <li><span className="text-rose-400">Red</span> wins if result number is 2, 4, 6, or 8.</li>
              <li><span className="text-violet-400">Violet</span> wins if result number is 0 or 5.</li>
              <li>If you bet on a number and it matches, you win 9x regardless of color.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
