import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { User, Mail, Shield, Share2, Copy, CheckCircle2, Save, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreError';
import { UserProfile } from '../types';

export const Profile: React.FC = () => {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [referralError, setReferralError] = useState('');
  const [referralCount, setReferralCount] = useState(0);

  React.useEffect(() => {
    const fetchReferralStats = async () => {
      if (!profile) return;
      try {
        const q = query(collection(db, 'users'), where('referredBy', '==', profile.uid));
        const snapshot = await getDocs(q);
        setReferralCount(snapshot.size);
      } catch (error) {
        console.error('Error fetching referral stats:', error);
      }
    };
    fetchReferralStats();
  }, [profile]);

  if (!profile) return null;

  const handleApplyReferral = async () => {
    if (!referralInput.trim()) return;
    if (referralInput.trim().toUpperCase() === profile.referralCode) {
      setReferralError("You cannot refer yourself.");
      return;
    }

    setSaving(true);
    setReferralError('');
    try {
      // Find the user with this referral code using the secure referral_codes collection
      const referralDocRef = doc(db, 'referral_codes', referralInput.trim().toUpperCase());
      const referralSnap = await getDoc(referralDocRef);
      
      if (!referralSnap.exists()) {
        setReferralError('Invalid referral code.');
        return;
      }

      const { uid: referrerUid } = referralSnap.data();

      await updateDoc(doc(db, 'users', profile.uid), {
        referredBy: referrerUid
      });
      setReferralInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: displayName.trim()
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const copyReferral = () => {
    if (!profile.referralCode) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 p-8 border-b border-white/10">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-4xl font-serif italic text-white shadow-lg shadow-emerald-500/20">
              {profile.displayName.charAt(0)}
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl font-serif italic mb-1">{profile.displayName}</h1>
              <p className="text-white/60 flex items-center justify-center md:justify-start gap-2">
                <Mail size={16} />
                {profile.email}
              </p>
            </div>
            <div className="bg-black/20 px-6 py-3 rounded-2xl border border-white/5 text-center">
              <p className="text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">Current Balance</p>
              <p className="text-2xl font-mono text-emerald-400">৳{profile.balance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Personal Information */}
          <div className="space-y-6">
            <h2 className="text-xl font-serif italic flex items-center gap-2">
              <User size={20} className="text-emerald-400" />
              Personal Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-2">Display Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!isEditing}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                  />
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <button 
                      onClick={handleUpdateProfile}
                      disabled={saving}
                      className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors flex items-center gap-2"
                    >
                      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                      Save
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-2">Email Address</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60 flex items-center gap-2">
                  <Mail size={18} />
                  {profile.email}
                </div>
                <p className="text-[10px] text-white/30 mt-2 italic">Email cannot be changed for security reasons.</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-2">Account Role</label>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase">
                  <Shield size={14} />
                  {profile.role}
                </div>
              </div>
            </div>
          </div>

          {/* Referral System */}
          <div className="space-y-6">
            <h2 className="text-xl font-serif italic flex items-center gap-2">
              <Share2 size={20} className="text-emerald-400" />
              Referral Program
            </h2>

            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
              <p className="text-sm text-white/70 mb-6">
                Invite your friends to join and earn rewards! Share your unique referral code with them.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-2">Your Referral Code</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-xl tracking-widest text-emerald-400 flex items-center justify-center">
                      {profile.referralCode || 'NOT_SET'}
                    </div>
                    <button 
                      onClick={copyReferral}
                      className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors flex items-center gap-2"
                    >
                      {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40">Total Referrals</span>
                    <span className="text-sm font-mono">{referralCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Earned from Referrals</span>
                    <span className="text-sm font-mono text-emerald-400">৳{(profile.referralEarnings || 0).toFixed(2)}</span>
                  </div>
                </div>

                {!profile.referredBy ? (
                  <div className="pt-4 border-t border-white/5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-2">Have a Referral Code?</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ENTER CODE"
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                      <button 
                        onClick={handleApplyReferral}
                        disabled={saving || !referralInput.trim()}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                    {referralError && <p className="text-[10px] text-rose-400 mt-1">{referralError}</p>}
                  </div>
                ) : (
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Referred By</p>
                    <p className="text-sm font-mono text-emerald-400">{profile.referredBy}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="p-8 bg-white/5 border-t border-white/10">
          <h2 className="text-xl font-serif italic mb-6">Account Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-left group">
              <p className="text-sm font-bold group-hover:text-emerald-400 transition-colors">Security Log</p>
              <p className="text-[10px] text-white/40">View recent login activity</p>
            </button>
            <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-left group">
              <p className="text-sm font-bold group-hover:text-emerald-400 transition-colors">Privacy Settings</p>
              <p className="text-[10px] text-white/40">Manage your data visibility</p>
            </button>
            <button className="p-4 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 rounded-2xl transition-all text-left group">
              <p className="text-sm font-bold text-rose-400">Delete Account</p>
              <p className="text-[10px] text-rose-400/40">Permanently remove your data</p>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
