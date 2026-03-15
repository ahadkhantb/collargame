import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction } from '../types';
import { gameService } from '../gameService';
import { Check, X, Clock, ShieldCheck, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreError';

export const AdminPanel: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
    try {
      await gameService.approveTransaction(id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await gameService.rejectTransaction(id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${id}`);
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
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Transaction Management</p>
          </div>
        </div>
        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
          <span className="text-xs text-white/40 mr-2">Pending Requests:</span>
          <span className="text-sm font-mono font-bold text-[#F27D26]">{transactions.length}</span>
        </div>
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
    </div>
  );
};
