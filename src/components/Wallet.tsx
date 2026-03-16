import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc, increment, query, where, orderBy, limit, onSnapshot, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Transaction } from '../types';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, CreditCard, History, Clock, CheckCircle, XCircle } from 'lucide-react';
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
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [profile]);

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
      const transaction: Omit<Transaction, 'id'> = {
        userId: profile.uid,
        type: activeTab,
        amount: amountNum,
        method,
        accountNumber,
        transactionId: activeTab === 'deposit' ? txId : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

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

  const methods = [
    { id: 'bkash', name: 'bKash', color: '#D12053', number: paymentNumbers.bkash },
    { id: 'nagad', name: 'Nagad', color: '#F7941D', number: paymentNumbers.nagad },
    { id: 'rocket', name: 'Rocket', color: '#8C3494', number: paymentNumbers.rocket },
  ] as const;

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
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-2">Payment Instructions</p>
                  <p className="text-sm text-white/80">
                    Send Money to the number below and enter the Transaction ID.
                  </p>
                  <div className="mt-3 flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                    <span className="font-mono text-lg">{methods.find(m => m.id === method)?.number}</span>
                    <span className="text-[10px] uppercase font-bold text-white/40">{method}</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`py-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                          method === m.id 
                            ? 'border-[#F27D26] bg-[#F27D26]/10' 
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-xs font-bold">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Amount (৳)</label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Min ৳100"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#F27D26] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">
                    {activeTab === 'deposit' ? 'Your Number' : 'Withdrawal Number'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#F27D26] transition-colors"
                  />
                </div>

                {activeTab === 'deposit' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Transaction ID</label>
                    <input
                      type="text"
                      required
                      value={txId}
                      onChange={(e) => setTxId(e.target.value)}
                      placeholder="Enter TrxID"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#F27D26] transition-colors"
                    />
                  </div>
                )}
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
        <div className="flex items-center gap-2 px-2 text-white/60">
          <History size={18} />
          <h3 className="text-lg font-serif italic">Transaction History</h3>
        </div>

        {history.length === 0 ? (
          <div className="glass p-8 rounded-3xl text-center text-white/20 text-sm">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((tx) => (
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
