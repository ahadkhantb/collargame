export type ColorSelection = 'green' | 'red' | 'violet';
export type NumberSelection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type BetSelection = ColorSelection | NumberSelection;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  balance: number;
  role: 'user' | 'admin';
  referralCode?: string;
  referredBy?: string;
  referralEarnings?: number;
  hasDeposited?: boolean;
  createdAt: string;
}

export interface Bet {
  id?: string;
  userId: string;
  gameId: string;
  amount: number;
  selection: BetSelection;
  status: 'pending' | 'won' | 'lost';
  payout: number;
  resultColor?: ColorSelection;
  resultNumber?: NumberSelection;
  createdAt: string;
}

export interface Transaction {
  id?: string;
  userId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  method: 'bkash' | 'nagad' | 'rocket';
  accountNumber: string;
  transactionId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedBy?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByEmail?: string;
  rejectedAt?: string;
}

export interface Game {
  id?: string;
  periodId: string;
  resultColor?: ColorSelection;
  resultNumber?: NumberSelection;
  manualResultColor?: ColorSelection;
  manualResultNumber?: NumberSelection;
  startTime: string;
  endTime: string;
  status: 'active' | 'completed';
}
