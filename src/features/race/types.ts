

export enum RaceSize {
  TWO = 0,
  FIVE = 1,
  TEN = 2
}

export interface Race {
  id: number;
  raceSize: RaceSize;
  players: string[];
  critterIds: number[];
  startTime: number;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: number;
  currentPlayers: number;
  maxPlayers: number;
  progressStatus?: 'ready' | 'racing' | 'complete';
}

export interface RaceResult {
  player: string;
  critterId: number;
  finalPosition: number;
  reward: number;
  score: number;
} 