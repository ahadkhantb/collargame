import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, setDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Transaction, UserProfile } from '../types';
import { gameService } from '../gameService';
import { 
  Check, X, Clock, ShieldCheck, ArrowUpRight, ArrowDownLeft, 
  Settings as SettingsIcon, Save, Users as UsersIcon, 
  LayoutDashboard, Search, Wallet, TrendingUp, History,
  User as UserIcon, Mail, Calendar, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreError';

type AdminTab = 'overview' | 'users' | 'transactions' | 'settings';

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  
  // Data States
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
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

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.uid.toLowerCase().includes(userSearch.toLowerCase())
  );

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
            onClick={() => setActiveTab('users')}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all flex items-center gap-4 group"
          >
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <UsersIcon size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold">Manage Users</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">View and search user database</p>
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
