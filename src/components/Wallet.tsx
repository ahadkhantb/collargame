import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc, increment, query, where, orderBy, limit, onSnapshot, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Transaction } from '../types';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, CreditCard, History, Clock, CheckCircle, XCircle, Copy, Info, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { handleFirestoreError, OperationType } from '../firestoreError';

export const Wallet: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [txId, setTxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'deposit' | 'withdraw'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [txSearch, setTxSearch] = useState('');
  const [paymentNumbers, setPaymentNumbers] = useState({
    bkash: '017XXXXXXXX',
    nagad: '018XXXXXXXX',
    rocket: '019XXXXXXXX'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'payment'));
        if (settingsDoc.exists()) {
          setPaymentNumbers(settingsDoc.data() as any);
        }
      } catch (err) {
        console.error('Failed to fetch payment settings', err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredHistory = history.filter(tx => {
    const matchesType = historyFilter === 'all' || tx.type === historyFilter;
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    const matchesSearch = !txSearch || (tx.transactionId?.toLowerCase().includes(txSearch.toLowerCase()) || tx.accountNumber.includes(txSearch));
    return matchesType && matchesStatus && matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 100) {
      setError('Minimum amount is ৳100');
      return;
    }

    if (activeTab === 'withdraw' && profile.balance < amountNum) {
      setError('Insufficient balance for withdrawal');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const transaction: any = {
        userId: profile.uid,
        type: activeTab,
        amount: amountNum,
        method,
        accountNumber,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      if (activeTab === 'deposit') {
        transaction.transactionId = txId;
      }

      const batch = writeBatch(db);
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, transaction);

      if (activeTab === 'withdraw') {
        const userRef = doc(db, 'users', profile.uid);
        batch.update(userRef, {
          balance: increment(-amountNum)
        });
      }

      await batch.commit();
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAmount('');
        setAccountNumber('');
        setTxId('');
      }, 3000);
    } catch (err) {
      console.error('Transaction failed', err);
      setError('Transaction failed. Please try again.');
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optionally show a toast or temporary state
  };

  const methods = [
    { id: 'bkash', name: 'bKash', color: '#D12053', number: paymentNumbers.bkash, logo: 'https://picsum.photos/seed/bkash/40/40' },
    { id: 'nagad', name: 'Nagad', color: '#F7941D', number: paymentNumbers.nagad, logo: 'https://picsum.photos/seed/nagad/40/40' },
    { id: 'rocket', name: 'Rocket', color: '#8C3494', number: paymentNumbers.rocket, logo: 'https://picsum.photos/seed/rocket/40/40' },
  ] as const;

  const currentMethod = methods.find(m => m.id === method);

  return (
    <div className="max-w-md mx-auto glass rounded-3xl overflow-hidden">
      <div className="p-8 bg-white/5 border-b border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-serif italic">Wallet</h2>
          <CreditCard className="text-[#F27D26]" />
        </div>
        
        <div className="flex gap-2 p-1 bg-black/40 rounded-2xl">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'deposit' ? 'bg-[#F27D26] text-black' : 'text-white/60'
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'withdraw' ? 'bg-[#F27D26] text-black' : 'text-white/60'
            }`}
          >
            Withdraw
          </button>
        </div>
      </div>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
              <h3 className="text-xl font-bold mb-2">Request Submitted</h3>
              <p className="text-white/60 text-sm">Our team will verify your {activeTab} within 30 minutes.</p>
            </motion.div>
          ) : (
            <motion.form
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {activeTab === 'deposit' && (
                <div className="space-y-4">
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-emerald-500 text-black rounded-full flex items-center justify-center text-[10px] font-black">1</div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-black">Send Money</p>
                    </div>
                    
                    <p className="text-sm text-white/80 mb-4 leading-relaxed">
                      Please send the deposit amount to our <span className="font-bold text-white">{currentMethod?.name}</span> Personal number using the <span className="italic">"Send Money"</span> option.
                    </p>

                    <div className="bg-black/60 p-4 rounded-2xl border border-white/5 flex items-center justify-between group">
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Our {currentMethod?.name} Number</span>
                        <span className="font-mono text-xl text-white tracking-wider">{currentMethod?.number}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleCopy(currentMethod?.number || '')}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-white/60 hover:text-white"
                        title="Copy Number"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-3xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-amber-500 text-black rounded-full flex items-center justify-center text-[10px] font-black">2</div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-black">Submit Details</p>
                    </div>
                    <p className="text-xs text-white/60">
                      After successful payment, fill in the form below with your number and the Transaction ID.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'withdraw' && (
                <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-3xl">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="text-blue-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Withdrawal Info</p>
                      <p className="text-[11px] text-white/60 leading-relaxed">
                        Withdrawals are processed within 30-60 minutes. Minimum withdrawal is ৳500. Ensure your number is correct.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black ml-2 mb-2 block">Select Method</label>
                  <div className="grid grid-cols-3 gap-3">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`relative py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 overflow-hidden ${
                          method === m.id 
                            ? 'border-[#F27D26] bg-[#F27D26]/5' 
                            : 'border-white/5 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {method === m.id && (
                          <motion.div 
                            layoutId="activeMethod"
                            className="absolute top-2 right-2"
                          >
                            <CheckCircle2 size={14} className="text-[#F27D26]" />
                          </motion.div>
                        )}
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px]"
                          style={{ backgroundColor: m.color, color: 'white' }}
                        >
                          {m.name[0]}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${method === m.id ? 'text-white' : 'text-white/40'}`}>
                          {m.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div className="relative">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black ml-2 mb-2 block">Amount (৳)</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min={activeTab === 'deposit' ? "100" : "500"}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={activeTab === 'deposit' ? "Min ৳100" : "Min ৳500"}
                        className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#F27D26]/40 transition-all text-lg font-mono placeholder:text-white/10"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 font-bold">TK</div>
                    </div>
                    {amount && parseFloat(amount) < (activeTab === 'deposit' ? 100 : 500) && (
                      <p className="text-[10px] text-rose-500 font-bold mt-2 ml-2 flex items-center gap-1">
                        <AlertCircle size={10} />
                        Minimum {activeTab} is ৳{activeTab === 'deposit' ? 100 : 500}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black ml-2 mb-2 block">
                      {activeTab === 'deposit' ? 'Your Sender Number' : 'Your Receiver Number'}
                    </label>
                    <input
                      type="tel"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#F27D26]/40 transition-all text-lg font-mono placeholder:text-white/10"
                    />
                  </div>

                  {activeTab === 'deposit' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black ml-2 mb-2 block">Transaction ID (TrxID)</label>
                      <input
                        type="text"
                        required
                        value={txId}
                        onChange={(e) => setTxId(e.target.value)}
                        placeholder="8XJ9K2L..."
                        className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#F27D26]/40 transition-all text-lg font-mono placeholder:text-white/10 uppercase"
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    {activeTab === 'deposit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    <span>Confirm {activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'}</span>
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Transaction History */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-white/60">
            <History size={18} />
            <h3 className="text-lg font-serif italic">Transaction History</h3>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {(['all', 'deposit', 'withdraw'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    historyFilter === f ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {f}
                </button>
              ))}
              <div className="w-px h-4 bg-white/10 self-center mx-1" />
              {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    statusFilter === s ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <History className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input 
                type="text"
                placeholder="Search by TrxID or Number..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#F27D26]/40 transition-all placeholder:text-white/10"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="glass p-8 rounded-3xl text-center text-white/20 text-sm">
              No matching transactions
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((tx) => (
                <div key={tx.id} className="glass p-4 rounded-2xl flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {tx.type === 'deposit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">৳{tx.amount}</span>
                      <span className="text-[10px] uppercase font-bold text-white/40">{tx.method}</span>
                    </div>
                    <p className="text-[10px] text-white/40">
                      {new Date(tx.createdAt).toLocaleDateString()} • {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {tx.transactionId && (
                      <p className="text-[10px] text-[#F27D26]/60 font-mono mt-1">ID: {tx.transactionId}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {tx.status === 'pending' && (
                    <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase">Pending</span>
                    </div>
                  )}
                  {tx.status === 'approved' && (
                    <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                      <CheckCircle size={12} />
                      <span className="text-[10px] font-bold uppercase">Approved</span>
                    </div>
                  )}
                  {tx.status === 'rejected' && (
                    <div className="flex items-center gap-1 text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full">
                      <XCircle size={12} />
                      <span className="text-[10px] font-bold uppercase">Rejected</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
