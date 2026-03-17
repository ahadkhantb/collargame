import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, doc, updateDoc, increment, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Game, Bet, ColorSelection, NumberSelection, BetSelection } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, History, Trophy, HelpCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Search, X as CloseIcon, ArrowRight } from 'lucide-react';
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
  const [lastResult, setLastResult] = useState<Game | null>(null);
  const [showResultAnimation, setShowResultAnimation] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost' | 'pending'>('all');
  const [periodSearch, setPeriodSearch] = useState('');
  const [bottomTab, setBottomTab] = useState<'results' | 'bets'>('results');
  const [historyLimit, setHistoryLimit] = useState(20);

  const filteredBetHistory = useMemo(() => {
    return betHistory.filter(bet => {
      const matchesStatus = statusFilter === 'all' || bet.status === statusFilter;
      const matchesPeriod = periodSearch === '' || bet.gameId.toLowerCase().includes(periodSearch.toLowerCase());
      return matchesStatus && matchesPeriod;
    });
  }, [betHistory, statusFilter, periodSearch]);

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
          soundService.play('draw');
          setLastResult(completed[0]);
          setShowResultAnimation(true);
          setTimeout(() => setShowResultAnimation(false), 10000); // Show for 10 seconds
        } else if (prevHistory.length === 0 && completed.length > 0) {
          setLastResult(completed[0]);
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
      limit(historyLimit)
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
      {/* Last Result Hero */}
      <AnimatePresence>
        {showResultAnimation && lastResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="glass rounded-[40px] p-8 border border-[#F27D26]/20 bg-gradient-to-br from-[#F27D26]/10 to-transparent relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#F27D26]/10 blur-[80px] rounded-full" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <p className="text-[10px] uppercase font-black tracking-[0.4em] text-[#F27D26] mb-4">Period {lastResult.periodId} Result</p>
              <div className="flex items-center gap-8">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl font-serif italic shadow-2xl ${
                    lastResult.resultColor === 'green' ? 'bg-emerald-500 text-black' : 
                    lastResult.resultColor === 'red' ? 'bg-rose-500 text-black' : 'bg-violet-500 text-white'
                  }`}
                >
                  {lastResult.resultNumber}
                </motion.div>
                <div className="text-left">
                  <p className="text-3xl font-serif italic mb-1 capitalize">{lastResult.resultColor}</p>
                  <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Winning Combination</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Bottom Tabs Section */}
      <div className="glass rounded-[32px] overflow-hidden border border-white/5">
        <div className="flex p-2 bg-black/40 border-b border-white/5">
          <button
            onClick={() => setBottomTab('results')}
            className={`flex-1 py-4 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
              bottomTab === 'results' ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <History size={16} />
            Recent Results
          </button>
          <button
            onClick={() => setBottomTab('bets')}
            className={`flex-1 py-4 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
              bottomTab === 'bets' ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Trophy size={16} />
            My Bets
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {bottomTab === 'results' ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase font-black tracking-widest text-white/20">Trend Visualization</p>
                  <div className="flex gap-1">
                    {history.slice(0, 15).reverse().map((game, i) => (
                      <div 
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                          game.resultColor === 'green' ? 'bg-emerald-500' : 
                          game.resultColor === 'red' ? 'bg-rose-500' : 'bg-violet-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {history.map(game => (
                    <div key={game.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.07] transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">Period</span>
                        <span className="text-xs font-mono font-bold text-white/80">{game.periodId}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-serif italic shadow-lg ${
                          game.resultColor === 'green' ? 'bg-emerald-500 text-black' : 
                          game.resultColor === 'red' ? 'bg-rose-500 text-black' : 'bg-violet-500 text-white'
                        }`}>
                          {game.resultNumber}
                        </div>
                        <div className="text-right min-w-[60px]">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 capitalize">{game.resultColor}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="bets"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5 w-fit">
                    {(['all', 'won', 'lost', 'pending'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          statusFilter === status 
                            ? 'bg-[#F27D26] text-black shadow-lg shadow-[#F27D26]/20' 
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input 
                      type="text"
                      placeholder="Search Period ID..."
                      value={periodSearch}
                      onChange={(e) => setPeriodSearch(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-10 pr-10 text-xs focus:outline-none focus:border-[#F27D26]/40 transition-all placeholder:text-white/10"
                    />
                    {periodSearch && (
                      <button 
                        onClick={() => setPeriodSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40"
                      >
                        <CloseIcon size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {filteredBetHistory.length === 0 ? (
                  <div className="py-12 text-center text-white/20 italic font-serif">
                    {betHistory.length === 0 ? 'No bets placed yet.' : 'No matches found for current filters.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBetHistory.map(bet => (
                      <div key={bet.id} className="flex flex-col p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ${
                              typeof bet.selection === 'string' 
                                ? (bet.selection === 'green' ? 'bg-emerald-500 text-black' : 
                                   bet.selection === 'red' ? 'bg-rose-500 text-black' : 'bg-violet-500 text-white')
                                : 'bg-white/10 text-white border border-white/10'
                            }`}>
                              {bet.selection}
                            </div>
                            
                            {bet.status !== 'pending' && (
                              <>
                                <ArrowRight size={14} className="text-white/20" />
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif italic text-sm shadow-lg ${
                                  bet.resultColor === 'green' ? 'bg-emerald-500 text-black' : 
                                  bet.resultColor === 'red' ? 'bg-rose-500 text-black' : 'bg-violet-500 text-white'
                                }`}>
                                  {bet.resultNumber}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="text-right">
                            <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full border ${
                              bet.status === 'won' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' :
                              bet.status === 'lost' ? 'bg-rose-500/20 text-rose-500 border-rose-500/20' :
                              'bg-amber-500/20 text-amber-500 border-amber-500/20'
                            }`}>
                              {bet.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white/90">৳{bet.amount}</p>
                              <span className="text-[9px] font-mono text-white/20">#{bet.gameId.slice(-8)}</span>
                            </div>
                            <p className="text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                              {new Date(bet.createdAt).toLocaleString()}
                            </p>
                          </div>
                          
                          {bet.status === 'won' && (
                            <div className="text-right">
                              <p className="text-[8px] uppercase font-black text-emerald-500/40">Payout</p>
                              <p className="text-sm font-black text-emerald-500">+৳{bet.payout.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {betHistory.length >= historyLimit && (
                      <button 
                        onClick={() => setHistoryLimit(prev => prev + 20)}
                        className="w-full py-4 text-[10px] uppercase font-black tracking-[0.2em] text-white/20 hover:text-white/40 transition-colors"
                      >
                        Load More History
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
    </div>
  );
};

export default GameBoard;
