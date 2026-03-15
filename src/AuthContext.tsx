import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

import { handleFirestoreError, OperationType } from './firestoreError';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const adminEmails = ['mdabdulahadtb468@gmail.com', 'ahadkhantb@gmail.com'];

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const isAdminEmail = firebaseUser.email && adminEmails.includes(firebaseUser.email);
        
        // Listen to profile changes
        const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            
            // Auto-upgrade to admin if email matches
            if (isAdminEmail && data.role !== 'admin') {
              await setDoc(userDocRef, { ...data, role: 'admin' }, { merge: true });
              return; // onSnapshot will trigger again
            }

            setProfile(data);
            
            // Ensure referral code mapping exists (for legacy users)
            if (data.referralCode) {
              const refCodeRef = doc(db, 'referral_codes', data.referralCode);
              const refCodeSnap = await getDoc(refCodeRef);
              if (!refCodeSnap.exists()) {
                await setDoc(refCodeRef, {
                  uid: data.uid,
                  displayName: data.displayName
                });
              }
            }
          } else {
            // Create profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Player',
              balance: 0,
              role: isAdminEmail ? 'admin' : 'user',
              referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
              createdAt: new Date().toISOString(),
            };
            try {
              await setDoc(userDocRef, newProfile);
              // Also create a referral code mapping for secure lookup
              await setDoc(doc(db, 'referral_codes', newProfile.referralCode!), {
                uid: firebaseUser.uid,
                displayName: newProfile.displayName
              });
              setProfile(newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
