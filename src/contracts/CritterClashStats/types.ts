export interface PlayerStats {
  totalScore: number;
  totalWins: number;
  totalClashes: number;
  totalRewards: number;
}

export interface CritterStats {
  clashCount: number;
  winCount: number;
  winStreak: number;
}

export interface TopPlayer {
  player: string;
  totalScore: number;
  totalWins: number;
  totalClashes: number;
  totalRewards: number;
}

export interface MigrationProgress {
  totalPlayers: number;
  importedPlayers: number;
  remainingPlayers: number;
  isComplete: boolean;
} 