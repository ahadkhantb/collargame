import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Transaction } from '../types';
import { gameService } from '../gameService';
import { Check, X, Clock, ShieldCheck, ArrowUpRight, ArrowDownLeft, Settings as SettingsIcon, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreError';

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'transactions' | 'settings'>('transactions');
  const [paymentNumbers, setPaymentNumbers] = useState({
    bkash: '',
    nagad: '',
    rocket: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsDoc = await getDoc(doc(db, 'settings', 'payment'));
      if (settingsDoc.exists()) {
        setPaymentNumbers(settingsDoc.data() as any);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-serif italic">Admin Control</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Platform Management</p>
          </div>
        </div>
        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'transactions' ? 'bg-[#F27D26] text-black' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Transactions
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'settings' ? 'bg-[#F27D26] text-black' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === 'transactions' ? (
        <>
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 inline-flex items-center">
            <span className="text-xs text-white/40 mr-2">Pending Requests:</span>
            <span className="text-sm font-mono font-bold text-[#F27D26]">{transactions.length}</span>
          </div>

          {transactions.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass p-20 text-center rounded-3xl border border-white/5"
            >
              <Clock size={48} className="mx-auto text-white/10 mb-4" />
              <p className="text-white/40 font-serif italic">All transactions are settled.</p>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {transactions.map((tx, index) => (
                <motion.div 
                  key={tx.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
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
                      </div>
                      <p className="text-xl font-mono font-bold">৳{tx.amount.toFixed(2)}</p>
                      <p className="text-xs text-white/60 font-medium">{tx.accountNumber}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                    {tx.transactionId && (
                      <div className="bg-black/40 px-3 py-1 rounded-lg border border-white/5 mb-2 w-full sm:w-auto text-center sm:text-left">
                        <span className="text-[10px] text-white/20 uppercase font-bold mr-2">TXID</span>
                        <span className="text-[10px] font-mono text-white/60">{tx.transactionId}</span>
                      </div>
                    )}
                    <div className="flex gap-3 w-full sm:w-auto">
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
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-3xl border border-white/5"
        >
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
        </motion.div>
      )}
    </div>
  );
};
