export enum ClashSize {
  Two = 1,
  Four = 2
}

export enum ClashState {
  ACCEPTING_PLAYERS = 0,
  CLASHING = 1,
  COMPLETED_WITH_RESULTS = 2
}

export interface ClashResult {
  player: `0x${string}`;
  critterId: bigint;
  position: number;
  reward: bigint;
  score: number;
}

export interface ClashInfo {
  id: bigint;
  clashSize: ClashSize;
  state: ClashState;
  playerCount: number;
  startTime: bigint;
  isProcessed: boolean;
  players: `0x${string}`[];
  critterIds: bigint[];
  boosts: bigint[];
  scores: bigint[];
  results: ClashResult[];
}

export interface ClashDetails {
  id: bigint;
  clashSize: ClashSize;
  state: ClashState;
  playerCount: number;
  startTime: bigint;
  isProcessed: boolean;
}

export interface ClashTypeInfo {
  entryFee: bigint;
  boostFeePercent: bigint;
  rewardPercentages: bigint[];
  maxPlayers: number;
  numWinners: number;
  isActive: boolean;
}

export interface JoinClashParams {
  clashSize: ClashSize;
  critterId: number;
  boostCount: number;
  useInventory: boolean;
  value?: bigint;
}

export interface ClashResultsWithRewards {
  player: `0x${string}`;
  critterId: bigint;
  score: bigint;
  position: number;
  reward: bigint;
}

export interface ClashPlayer {
  player: `0x${string}`;
  critterId: bigint;
  score: bigint;
  rewards: bigint;
  isWinner: boolean;
}

export interface PlayerStats {
  totalScore: bigint;
  totalWins: bigint;
  totalClashes: bigint;
  totalRewards: bigint;
}

export interface ClashDetail {
  id: bigint;
  clashSize: ClashSize;
  state: ClashState;
  maxPlayers: number;
  playerCount: number;
  players: {
    player: `0x${string}`;
    critterId: bigint;
    score: bigint;
    boost: bigint;
  }[];
  results: ClashResult[];
  startTime: bigint;
  totalPrize: bigint;
  status: 'Active' | 'Completed';
  hasEnded: boolean;
  isProcessed: boolean;
}

export interface FundAccounting {
  prizePool: bigint;
  daoFees: bigint;
  boostFees: bigint;
}

export interface EntropyStorage {
  randomRequests: Record<string, string>;
  clashBaseScores: Record<string, bigint[]>;
  clashSequenceNumber: Record<string, bigint>;
  playerSequenceNumbers: Record<string, Record<`0x${string}`, bigint>>;
  pendingScores: Record<string, bigint>;
  pendingPlayers: Record<string, `0x${string}`>;
  requestToClash: Record<string, bigint>;
  nextSequenceNumber: bigint;
  entropyFeeBalance: bigint;
} 