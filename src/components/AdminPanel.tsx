import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, setDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Transaction, UserProfile, Game, Bet, ColorSelection, NumberSelection } from '../types';
import { gameService } from '../gameService';
import { 
  Check, X, Clock, ShieldCheck, ArrowUpRight, ArrowDownLeft, 
  Settings as SettingsIcon, Save, Users as UsersIcon, 
  LayoutDashboard, Search, Wallet, TrendingUp, History,
  User as UserIcon, Mail, Calendar, DollarSign, Gamepad2,
  BarChart3, Target, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreError';

type AdminTab = 'overview' | 'users' | 'transactions' | 'game' | 'settings';

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  
  // Data States
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalDeposits: 0,
    totalWithdrawals: 0
  });

  // UI States
  const [userSearch, setUserSearch] = useState('');
  const [txFilter, setTxFilter] = useState<'pending' | 'history'>('pending');
  const [manualResult, setManualResult] = useState<{ color: ColorSelection, number: NumberSelection }>({
    color: 'green',
    number: 1
  });
  const [isSettling, setIsSettling] = useState(false);
  const [isPreSetting, setIsPreSetting] = useState(false);
  const [paymentNumbers, setPaymentNumbers] = useState({
    bkash: '',
    nagad: '',
    rocket: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch Settings
  useEffect(() => {
    const fetchSettings = async () => {
      const settingsDoc = await getDoc(doc(db, 'settings', 'payment'));
      if (settingsDoc.exists()) {
        setPaymentNumbers(settingsDoc.data() as any);
      }
    };
    fetchSettings();
  }, []);

  // Fetch Active Game
  useEffect(() => {
    const q = query(collection(db, 'games'), where('status', '==', 'active'), orderBy('startTime', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const game = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Game;
        setActiveGame(game);
        if (game.manualResultColor && game.manualResultNumber !== undefined) {
          setManualResult({
            color: game.manualResultColor,
            number: game.manualResultNumber
          });
        }
      } else {
        setActiveGame(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Bets for Active Game
  useEffect(() => {
    if (!activeGame?.id) {
      setActiveBets([]);
      return;
    }
    const q = query(collection(db, 'bets'), where('gameId', '==', activeGame.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveBets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet)));
    });
    return () => unsubscribe();
  }, [activeGame?.id]);

  // Fetch Pending Transactions
  useEffect(() => {
    const q = query(
      collection(db, 'transactions'), 
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
    return () => unsubscribe();
  }, []);

  // Fetch Recent Transactions (History)
  useEffect(() => {
    const q = query(
      collection(db, 'transactions'), 
      where('status', 'in', ['approved', 'rejected']),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
    return () => unsubscribe();
  }, []);

  // Fetch Users & Calculate Stats
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(allUsers);
      
      const totalBal = allUsers.reduce((acc, u) => acc + (u.balance || 0), 0);
      setStats(prev => ({
        ...prev,
        totalUsers: allUsers.length,
        totalBalance: totalBal
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  // Fetch All Transactions for Stats
  useEffect(() => {
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTx = snapshot.docs.map(doc => doc.data() as Transaction);
      
      const pDep = allTx.filter(t => t.type === 'deposit' && t.status === 'pending').length;
      const pWith = allTx.filter(t => t.type === 'withdraw' && t.status === 'pending').length;
      const tDep = allTx.filter(t => t.type === 'deposit' && t.status === 'approved').reduce((acc, t) => acc + t.amount, 0);
      const tWith = allTx.filter(t => t.type === 'withdraw' && t.status === 'approved').reduce((acc, t) => acc + t.amount, 0);

      setStats(prev => ({
        ...prev,
        pendingDeposits: pDep,
        pendingWithdrawals: pWith,
        totalDeposits: tDep,
        totalWithdrawals: tWith
      }));
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    if (!profile) return;
    try {
      await gameService.approveTransaction(id, profile.uid, profile.email);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    if (!profile) return;
    try {
      await gameService.rejectTransaction(id, profile.uid, profile.email);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${id}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'payment'), paymentNumbers);
      alert('Payment settings updated successfully!');
    } catch (error) {
      console.error('Failed to update settings', error);
      alert('Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleManualSettle = async () => {
    if (!activeGame?.id || isSettling) return;
    if (!window.confirm(`Are you sure you want to settle period ${activeGame.periodId} with result ${manualResult.color.toUpperCase()} - ${manualResult.number}?`)) return;

    setIsSettling(true);
    try {
      await gameService.settleGame(activeGame.id, manualResult);
      alert('Game settled successfully!');
    } catch (error) {
      console.error('Failed to settle game', error);
      alert('Failed to settle game');
    } finally {
      setIsSettling(false);
    }
  };

  const handlePreSetResult = async () => {
    if (!activeGame?.id || isPreSetting) return;
    
    setIsPreSetting(true);
    try {
      await updateDoc(doc(db, 'games', activeGame.id), {
        manualResultColor: manualResult.color,
        manualResultNumber: manualResult.number
      });
      alert('Result pre-set successfully! It will be used when the game settles.');
    } catch (error) {
      console.error('Failed to pre-set result', error);
      alert('Failed to pre-set result');
    } finally {
      setIsPreSetting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.uid.toLowerCase().includes(userSearch.toLowerCase())
  );

  const getBetTotals = () => {
    const totals = {
      green: 0,
      red: 0,
      violet: 0,
      numbers: Array(10).fill(0)
    };

    activeBets.forEach(bet => {
      if (typeof bet.selection === 'number') {
        totals.numbers[bet.selection] += bet.amount;
      } else {
        totals[bet.selection as ColorSelection] += bet.amount;
      }
    });

    return totals;
  };

  const betTotals = getBetTotals();

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
              <UsersIcon size={20} />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Total Users</span>
          </div>
          <p className="text-3xl font-mono font-bold">{stats.totalUsers}</p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">User Liabilities</span>
          </div>
          <p className="text-3xl font-mono font-bold">৳{stats.totalBalance.toFixed(2)}</p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Net Revenue</span>
          </div>
          <p className="text-3xl font-mono font-bold">৳{(stats.totalDeposits - stats.totalWithdrawals).toFixed(2)}</p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
              <ArrowDownLeft size={20} />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Pending Deposits</span>
          </div>
          <p className="text-3xl font-mono font-bold text-emerald-500">{stats.pendingDeposits}</p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
              <ArrowUpRight size={20} />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Pending Withdrawals</span>
          </div>
          <p className="text-3xl font-mono font-bold text-rose-500">{stats.pendingWithdrawals}</p>
        </div>
      </div>

      <div className="glass p-8 rounded-3xl border border-white/5">
        <h3 className="text-lg font-serif italic mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => setActiveTab('transactions')}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all flex items-center gap-4 group"
          >
            <div className="w-12 h-12 bg-[#F27D26]/10 text-[#F27D26] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold">Review Transactions</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">{pendingTransactions.length} pending requests</p>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('game')}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all flex items-center gap-4 group"
          >
            <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Gamepad2 size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold">Game Control</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Set results and analyze bets</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
        <input 
          type="text"
          placeholder="Search users by email, name or UID..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-[#F27D26] transition-colors"
        />
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((user, index) => (
          <motion.div 
            key={user.uid}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass p-6 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                <UserIcon size={24} className="text-white/40" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold">{user.displayName || 'Anonymous User'}</h4>
                  <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded ${
                    user.role === 'admin' ? 'bg-rose-500/20 text-rose-500' : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/40 text-[10px] font-mono">
                  <Mail size={10} />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-white/20 text-[10px] mt-1">
                  <Calendar size={10} />
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Balance</p>
                <p className="text-xl font-mono font-bold text-emerald-500">৳{user.balance.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Referrals</p>
                <p className="text-xl font-mono font-bold text-[#F27D26]">{user.referralEarnings ? `৳${user.referralEarnings.toFixed(2)}` : '৳0.00'}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5 w-fit">
        <button 
          onClick={() => setTxFilter('pending')}
          className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            txFilter === 'pending' ? 'bg-[#F27D26] text-black' : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Clock size={14} />
          Pending ({pendingTransactions.length})
        </button>
        <button 
          onClick={() => setTxFilter('history')}
          className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            txFilter === 'history' ? 'bg-[#F27D26] text-black' : 'text-white/40 hover:text-white/60'
          }`}
        >
          <History size={14} />
          History
        </button>
      </div>

      <div className="grid gap-4">
        {(txFilter === 'pending' ? pendingTransactions : recentTransactions).map((tx, index) => (
          <motion.div 
            key={tx.id} 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/5 hover:border-white/10 transition-all group"
          >
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                tx.type === 'deposit' 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
              }`}>
                {tx.type === 'deposit' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    tx.type === 'deposit' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
                  }`}>
                    {tx.type}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded">{tx.method}</span>
                  {tx.status !== 'pending' && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      tx.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
                    }`}>
                      {tx.status}
                    </span>
                  )}
                </div>
                <p className="text-xl font-mono font-bold">৳{tx.amount.toFixed(2)}</p>
                <p className="text-xs text-white/60 font-medium">{tx.accountNumber}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
              <div className="flex flex-col items-end">
                <p className="text-[10px] text-white/20 uppercase font-bold">{new Date(tx.createdAt).toLocaleString()}</p>
                {tx.transactionId && (
                  <div className="bg-black/40 px-3 py-1 rounded-lg border border-white/5 mt-1">
                    <span className="text-[8px] text-white/20 uppercase font-bold mr-2">TXID</span>
                    <span className="text-[10px] font-mono text-white/60">{tx.transactionId}</span>
                  </div>
                )}
              </div>
              
              {tx.status === 'pending' ? (
                <div className="flex gap-3 w-full sm:w-auto mt-2">
                  <button 
                    onClick={() => handleReject(tx.id!)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 flex items-center justify-center gap-2"
                  >
                    <X size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Reject</span>
                  </button>
                  <button 
                    onClick={() => handleApprove(tx.id!)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-emerald-500 text-black rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Approve</span>
                  </button>
                </div>
              ) : (
                <div className="text-right mt-2">
                  <p className="text-[8px] text-white/20 uppercase font-bold">Processed By</p>
                  <p className="text-[10px] text-white/40">{tx.approvedByEmail || tx.rejectedByEmail || 'System'}</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderGameControl = () => (
    <div className="space-y-8">
      <div className="glass p-8 rounded-3xl border border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center">
              <Gamepad2 size={20} />
            </div>
            <div>
              <h3 className="text-xl font-serif italic">Active Game</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Period: {activeGame?.periodId || 'None'}</p>
            </div>
          </div>
          {activeGame && (
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Live</span>
            </div>
          )}
        </div>

        {!activeGame ? (
          <div className="text-center py-10">
            <AlertCircle className="mx-auto text-white/10 mb-4" size={48} />
            <p className="text-white/40 font-serif italic">No active game found. It will auto-generate on next user visit.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Bet Analysis */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-[#F27D26]" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-white/60">Bet Analysis</h4>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl text-center">
                  <p className="text-[8px] uppercase font-bold text-emerald-500 mb-1">Green</p>
                  <p className="text-lg font-mono font-bold">৳{betTotals.green}</p>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl text-center">
                  <p className="text-[8px] uppercase font-bold text-rose-500 mb-1">Red</p>
                  <p className="text-lg font-mono font-bold">৳{betTotals.red}</p>
                </div>
                <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-2xl text-center">
                  <p className="text-[8px] uppercase font-bold text-purple-500 mb-1">Violet</p>
                  <p className="text-lg font-mono font-bold">৳{betTotals.violet}</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {betTotals.numbers.map((amount, num) => (
                  <div key={num} className="bg-white/5 border border-white/10 p-2 rounded-xl text-center">
                    <p className="text-[8px] font-bold text-white/40 mb-1">{num}</p>
                    <p className="text-xs font-mono font-bold">৳{amount}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-amber-500" />
                  <span className="text-[10px] font-bold uppercase text-amber-500">Total Pool</span>
                </div>
                <p className="text-2xl font-mono font-bold">৳{activeBets.reduce((acc, b) => acc + b.amount, 0).toFixed(2)}</p>
              </div>
            </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-[#F27D26]" />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-white/60">Manual Control</h4>
                  </div>
                  {activeGame.manualResultColor && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                      <Save size={12} />
                      <span>RESULT PRE-SET</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-white/40 ml-2">Select Color</label>
                    <div className="flex gap-2 mt-2">
                      {(['green', 'red', 'violet'] as ColorSelection[]).map(color => (
                        <button
                          key={color}
                          onClick={() => setManualResult(prev => ({ ...prev, color }))}
                          className={`flex-1 py-3 rounded-xl border transition-all capitalize text-xs font-bold ${
                            manualResult.color === color 
                              ? 'bg-white/10 border-[#F27D26] text-white' 
                              : 'bg-white/5 border-white/5 text-white/40'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-white/40 ml-2">Select Number</label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setManualResult(prev => ({ ...prev, number: i as NumberSelection }))}
                          className={`py-2 rounded-lg border transition-all font-mono font-bold ${
                            manualResult.number === i 
                              ? 'bg-white/10 border-[#F27D26] text-white' 
                              : 'bg-white/5 border-white/5 text-white/40'
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      onClick={handlePreSetResult}
                      disabled={isPreSetting}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    >
                      {isPreSetting ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save size={18} />
                          <span className="text-xs font-bold uppercase tracking-wider">Pre-set Result</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleManualSettle}
                      disabled={isSettling}
                      className="flex-1 bg-[#F27D26] text-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(242,125,38,0.3)]"
                    >
                      {isSettling ? (
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check size={18} />
                          <span className="text-xs font-bold uppercase tracking-wider">Settle Now</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-center text-white/20 italic">"Pre-set" saves the result for auto-settlement. "Settle Now" ends the game immediately.</p>
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-serif italic">Admin Control</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Platform Management</p>
          </div>
        </div>
        
        <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'users', label: 'Users', icon: UsersIcon },
            { id: 'transactions', label: 'Transactions', icon: DollarSign },
            { id: 'game', label: 'Game', icon: Gamepad2 },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id ? 'bg-[#F27D26] text-black' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'transactions' && renderTransactions()}
          {activeTab === 'game' && renderGameControl()}
          {activeTab === 'settings' && (
            <div className="glass p-8 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#F27D26]/10 text-[#F27D26] rounded-xl flex items-center justify-center">
                  <SettingsIcon size={20} />
                </div>
                <h3 className="text-xl font-serif italic">Payment Settings</h3>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-6 max-w-md">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">bKash Number</label>
                  <input 
                    type="text"
                    value={paymentNumbers.bkash}
                    onChange={(e) => setPaymentNumbers({...paymentNumbers, bkash: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 mt-2 focus:outline-none focus:border-[#F27D26] transition-colors font-mono"
                    placeholder="017XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Nagad Number</label>
                  <input 
                    type="text"
                    value={paymentNumbers.nagad}
                    onChange={(e) => setPaymentNumbers({...paymentNumbers, nagad: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 mt-2 focus:outline-none focus:border-[#F27D26] transition-colors font-mono"
                    placeholder="018XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Rocket Number</label>
                  <input 
                    type="text"
                    value={paymentNumbers.rocket}
                    onChange={(e) => setPaymentNumbers({...paymentNumbers, rocket: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 mt-2 focus:outline-none focus:border-[#F27D26] transition-colors font-mono"
                    placeholder="019XXXXXXXX"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={savingSettings}
                  className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingSettings ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={20} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
