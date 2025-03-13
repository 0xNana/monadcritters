export enum RaceSize {
  TWO = 0,
  FIVE = 1,
  TEN = 2
}

export interface Race {
  id: number;
  raceSize: RaceSize;
  currentPlayers: number;
  maxPlayers: number;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: string;
  startTime: number;
  players: string[];
  critterIds: number[];
}

export interface RaceResult {
  player: string;
  critterId: number;
  finalPosition: number;
  reward: string;
  score: number;
}
