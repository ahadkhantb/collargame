import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, where, writeBatch, getDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { Game, Bet, ColorSelection, NumberSelection, Transaction } from './types';
import { soundService } from './soundService';

export const gameService = {
  // Lazy generate game if needed
  async ensureActiveGame() {
    const q = query(collection(db, 'games'), orderBy('startTime', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    const now = new Date();
    
    let latestGame = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Game;

    if (!latestGame || new Date(latestGame.endTime) < now) {
      // Settle previous game if it was active
      if (latestGame && latestGame.status === 'active') {
        try {
          await this.settleGame(latestGame.id!);
        } catch (error) {
          console.warn('Failed to settle game (likely not an admin):', error);
          // Continue to create new game even if settlement fails
        }
      }

      // Create new game
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + 3 * 60 * 1000).toISOString(); // 3 minute periods
      const periodId = now.getFullYear().toString() + 
                       (now.getMonth() + 1).toString().padStart(2, '0') + 
                       now.getDate().toString().padStart(2, '0') + 
                       Math.floor(now.getTime() / (3 * 60 * 1000)).toString().slice(-4);

      const newGame: Omit<Game, 'id'> = {
        periodId,
        startTime,
        endTime,
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'games'), newGame);
      return { id: docRef.id, ...newGame };
    }

    return latestGame;
  },

  async settleGame(gameId: string, manualResult?: { color: ColorSelection, number: NumberSelection }) {
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);
    const gameData = gameSnap.data() as Game;

    let resultNumber: NumberSelection;
    let resultColor: ColorSelection;

    if (manualResult) {
      resultNumber = manualResult.number;
      resultColor = manualResult.color;
    } else if (gameData?.manualResultColor !== undefined && gameData?.manualResultNumber !== undefined) {
      resultNumber = gameData.manualResultNumber;
      resultColor = gameData.manualResultColor;
    } else {
      resultNumber = Math.floor(Math.random() * 10) as NumberSelection;
      if ([1, 3, 7, 9].includes(resultNumber)) resultColor = 'green';
      else if ([2, 4, 6, 8].includes(resultNumber)) resultColor = 'red';
      else resultColor = 'violet'; // 0, 5
    }

    await updateDoc(gameRef, {
      resultColor,
      resultNumber,
      status: 'completed'
    });

    // Settle bets
    const betsQ = query(collection(db, 'bets'), where('gameId', '==', gameId), where('status', '==', 'pending'));
    const betsSnapshot = await getDocs(betsQ);
    
    const batch = writeBatch(db);
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = { id: betDoc.id, ...betDoc.data() } as Bet;
      let won = false;
      let multiplier = 0;

      if (typeof bet.selection === 'number') {
        if (bet.selection === resultNumber) {
          won = true;
          multiplier = 9;
        }
      } else {
        if (bet.selection === resultColor) {
          won = true;
          multiplier = bet.selection === 'violet' ? 4.5 : 2;
        }
      }

      const payout = won ? bet.amount * multiplier : 0;
      batch.update(doc(db, 'bets', bet.id!), {
        status: won ? 'won' : 'lost',
        payout
      });

      if (won) {
        batch.update(doc(db, 'users', bet.userId), {
          balance: increment(payout)
        });
      }
    }

    await batch.commit();
  },

  async approveTransaction(transactionId: string, adminId: string, adminEmail: string) {
    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) return;
    
    const tx = txSnap.data() as Transaction;
    if (tx.status !== 'pending') return;

    const batch = writeBatch(db);
    batch.update(txRef, { 
      status: 'approved',
      approvedBy: adminId,
      approvedByEmail: adminEmail,
      approvedAt: new Date().toISOString()
    });

    const userRef = doc(db, 'users', tx.userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const currentBalance = userData?.balance || 0;

    if (tx.type === 'deposit') {
      batch.update(userRef, { balance: currentBalance + tx.amount });
      
      // Referral Bonus Logic
      if (!userData?.hasDeposited) {
        batch.update(userRef, { hasDeposited: true });
        
        if (userData?.referredBy) {
          const referrerRef = doc(db, 'users', userData.referredBy);
          batch.update(referrerRef, {
            balance: increment(10),
            referralEarnings: increment(10)
          });
        }
      }
    }

    await batch.commit();
  },

  async rejectTransaction(transactionId: string, adminId: string, adminEmail: string) {
    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) return;
    
    const tx = txSnap.data() as Transaction;
    if (tx.status !== 'pending') return;

    const batch = writeBatch(db);
    batch.update(txRef, { 
      status: 'rejected',
      rejectedBy: adminId,
      rejectedByEmail: adminEmail,
      rejectedAt: new Date().toISOString()
    });

    if (tx.type === 'withdraw') {
      const userRef = doc(db, 'users', tx.userId);
      batch.update(userRef, { balance: increment(tx.amount) });
    }

    await batch.commit();
  }
};
