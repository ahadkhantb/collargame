import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, doc, updateDoc, increment, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Game, Bet, ColorSelection, NumberSelection, BetSelection } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, History, Trophy, HelpCircle, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { gameService } from '../gameService';
import { GameRules } from './GameRules';
import { soundService } from '../soundService';

import { handleFirestoreError, OperationType } from '../firestoreError';

export const GameBoard: React.FC = () => {
  const { profile } = useAuth();
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [betting, setBetting] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundService.isEnabled());

  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [betHistory, setBetHistory] = useState<Bet[]>([]);
  const [lastSuccessSelection, setLastSuccessSelection] = useState<BetSelection | null>(null);

  const toggleSound = () => {
    const newState = soundService.toggle();
    setSoundEnabled(newState);
    soundService.play('click');
  };

  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && soundEnabled) {
      soundService.play('tick');
    }
    if (timeLeft === 0 && currentGame?.status === 'active') {
      soundService.play('draw');
      // Trigger game check immediately when timer hits zero
      gameService.ensureActiveGame().catch(console.error);
    }
  }, [timeLeft, soundEnabled, currentGame]);

  useEffect(() => {
    const checkGame = async () => {
      try {
        await gameService.ensureActiveGame();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'games');
      }
    };
    checkGame();
    
    // Check every minute if game needs refresh
    const interval = setInterval(checkGame, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('startTime', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      const active = games.find(g => g.status === 'active');
      const completed = games.filter(g => g.status === 'completed');
      
      // Play sound if a new result just came in
      setHistory(prevHistory => {
        if (prevHistory.length > 0 && completed.length > 0 && completed[0].id !== prevHistory[0].id) {
          soundService.play('draw'); // Neutral sound for new result
        }
        return completed;
      });

      setCurrentGame(active || null);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'games');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile || !currentGame) return;

    const q = query(
      collection(db, 'bets'),
      where('userId', '==', profile.uid),
      where('gameId', '==', currentGame.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newBets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      
      // Check for status changes to play win/loss sounds
      if (userBets.length > 0) {
        const justSettled = newBets.find(nb => {
          const oldBet = userBets.find(ob => ob.id === nb.id);
          return oldBet && oldBet.status === 'pending' && nb.status !== 'pending';
        });

        if (justSettled) {
          soundService.play(justSettled.status === 'won' ? 'win' : 'lose');
        }
      }

      setUserBets(newBets);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bets');
    });

    return () => unsubscribe();
  }, [profile, currentGame]);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'bets'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBetHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bets');
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!currentGame) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(currentGame.endTime).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentGame]);

  const placeBet = async (selection: ColorSelection | NumberSelection) => {
    if (!profile || !currentGame || betting) return;
    if (profile.balance < selectedAmount) {
      alert('Insufficient balance');
      return;
    }

    soundService.play('bet');
    setBetting(true);
    try {
      const bet: Omit<Bet, 'id'> = {
        userId: profile.uid,
        gameId: currentGame.id!,
        amount: selectedAmount,
        selection,
        status: 'pending',
        payout: 0,
        createdAt: new Date().toISOString(),
      };

      try {
        await addDoc(collection(db, 'bets'), bet);
        setLastSuccessSelection(selection);
        setTimeout(() => setLastSuccessSelection(null), 1500);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'bets');
      }

      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          balance: increment(-selectedAmount)
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      }
    } catch (error) {
      console.error('Bet failed', error);
    } finally {
      setBetting(false);
    }
  };

  const colors = [
    { id: 'green', label: 'Green', class: 'bg-emerald-500', multiplier: '2x' },
    { id: 'violet', label: 'Violet', class: 'bg-violet-500', multiplier: '4.5x' },
    { id: 'red', label: 'Red', class: 'bg-rose-500', multiplier: '2x' },
  ] as const;

  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const amounts = [10, 50, 100, 500, 1000, 5000];

  const handleAmountSelect = (amt: number) => {
    setSelectedAmount(amt);
    soundService.play('click');
  };

  if (!currentGame) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-[#F27D26]/20 border-t-[#F27D26] rounded-full animate-spin" />
        <p className="text-white/40 font-serif italic">Initializing Live Betting System...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Timer Section */}
      <div className="glass rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-[#F27D26] to-amber-400 shadow-[0_0_15px_rgba(242,125,38,0.5)]"
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / 180) * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>

        {/* Sound Toggle */}
        <button 
          onClick={toggleSound}
          className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5"
        >
          {soundEnabled ? <Volume2 size={16} className="text-[#F27D26]" /> : <VolumeX size={16} className="text-white/20" />}
        </button>
        
        <div className="flex items-center gap-2 text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold mb-4">
          <Clock size={14} className={timeLeft <= 10 ? 'text-rose-500 animate-pulse' : ''} />
          <span className={timeLeft <= 10 ? 'text-rose-500' : ''}>Next Draw In</span>
        </div>
        
        <div className={`text-7xl font-serif italic tracking-tighter flex gap-2 transition-all duration-300 ${timeLeft <= 10 ? 'text-rose-500 scale-110' : 'text-white'}`}>
          <span>{Math.floor(timeLeft / 60).toString().padStart(2, '0')}</span>
          <span className="text-white/20">:</span>
          <span>{(timeLeft % 60).toString().padStart(2, '0')}</span>
        </div>
        
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Period</span>
          <span className="text-[10px] font-mono text-[#F27D26] bg-[#F27D26]/10 px-2 py-0.5 rounded border border-[#F27D26]/20">
            {currentGame?.periodId || 'LOADING...'}
          </span>
        </div>
      </div>

      {/* Betting Section */}
      <div className="glass rounded-3xl p-8">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-serif italic">Place Your Bet</h3>
          <div className="flex gap-2">
            {amounts.map(amt => (
              <button
                key={amt}
                onClick={() => handleAmountSelect(amt)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                  selectedAmount === amt 
                    ? 'bg-[#F27D26] text-black border-[#F27D26] shadow-[0_0_10px_rgba(242,125,38,0.3)]' 
                    : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:border-white/10'
                }`}
              >
                ৳{amt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {colors.map(color => (
            <motion.button
              key={color.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              animate={lastSuccessSelection === color.id ? { 
                scale: [1, 1.1, 1],
                boxShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.5)', '0 0 0px rgba(255,255,255,0)']
              } : {}}
              disabled={timeLeft < 30 || betting}
              onClick={() => placeBet(color.id as ColorSelection)}
              className={`relative ${color.class} h-24 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg disabled:opacity-50 disabled:grayscale group overflow-hidden`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="font-bold uppercase tracking-widest text-xs text-black/80 relative z-10">{color.label}</span>
              <span className="text-[10px] font-mono text-black/40 relative z-10">{color.multiplier}</span>
              {color.id === 'green' && <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-emerald-400/20 blur-xl rounded-full" />}
              {color.id === 'red' && <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-rose-400/20 blur-xl rounded-full" />}
              {color.id === 'violet' && <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-violet-400/20 blur-xl rounded-full" />}
            </motion.button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-3">
          {numbers.map(num => (
            <motion.button
              key={num}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={lastSuccessSelection === num ? { 
                scale: [1, 1.2, 1],
                backgroundColor: ['rgba(255,255,255,0.05)', '#F27D26', 'rgba(255,255,255,0.05)'],
                color: ['#fff', '#000', '#fff']
              } : {}}
              disabled={timeLeft < 30 || betting}
              onClick={() => placeBet(num as NumberSelection)}
              className="h-14 glass rounded-xl flex items-center justify-center font-serif text-xl hover:bg-[#F27D26] hover:text-black transition-all disabled:opacity-50"
            >
              {num}
            </motion.button>
          ))}
        </div>
        
        {timeLeft < 30 && (
          <div className="mt-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
            <p className="text-[10px] uppercase font-bold text-rose-500">Betting Closed for this period</p>
          </div>
        )}
      </div>

      {/* My Bets Section */}
      <div className="glass rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-white/60">
            <Trophy size={18} className="text-[#F27D26]" />
            <h3 className="text-lg font-serif italic">My Betting History</h3>
          </div>
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Last 20 Bets</span>
        </div>
        
        {betHistory.length === 0 ? (
          <div className="py-12 text-center text-white/20 italic font-serif">
            No bets placed yet.
          </div>
        ) : (
          <div className="space-y-3">
            {betHistory.map(bet => (
              <div key={bet.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    typeof bet.selection === 'string' 
                      ? (bet.selection === 'green' ? 'bg-emerald-500 text-black' : 
                         bet.selection === 'red' ? 'bg-rose-500 text-black' : 'bg-violet-500 text-white')
                      : 'bg-white/10 text-white border border-white/10'
                  }`}>
                    {bet.selection}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">৳{bet.amount}</p>
                      <span className="text-[8px] font-mono text-white/20">#{bet.gameId.slice(-6)}</span>
                    </div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">
                      {new Date(bet.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border ${
                    bet.status === 'won' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' :
                    bet.status === 'lost' ? 'bg-rose-500/20 text-rose-500 border-rose-500/20' :
                    'bg-amber-500/20 text-amber-500 border-amber-500/20'
                  }`}>
                    {bet.status}
                  </span>
                  {bet.status === 'won' && (
                    <p className="text-xs font-bold text-emerald-500 mt-1">+৳{bet.payout.toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules Section Toggle */}
      <div className="glass rounded-3xl overflow-hidden">
        <button 
          onClick={() => {
            setShowRules(!showRules);
            soundService.play('click');
          }}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F27D26]/10 text-[#F27D26] rounded-full flex items-center justify-center">
              <HelpCircle size={20} />
            </div>
            <div className="text-left">
              <h3 className="font-serif italic text-lg">Game Rules</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">How to play & Payouts</p>
            </div>
          </div>
          {showRules ? <ChevronUp size={20} className="text-white/20" /> : <ChevronDown size={20} className="text-white/20" />}
        </button>
        
        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="px-8 pb-8 border-t border-white/5"
            >
              <div className="pt-8">
                <GameRules />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History Section */}
      <div className="glass rounded-3xl p-8">
        <div className="flex items-center gap-2 mb-6 text-white/60">
          <History size={18} />
          <h3 className="text-lg font-serif italic">Recent Results</h3>
        </div>
        
        <div className="space-y-4">
          {history.map(game => (
            <div key={game.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white/20 uppercase">Period</span>
                <span className="text-sm font-bold">{game.periodId}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-serif ${
                  game.resultColor === 'green' ? 'bg-emerald-500' : 
                  game.resultColor === 'red' ? 'bg-rose-500' : 'bg-violet-500'
                }`}>
                  {game.resultNumber}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
