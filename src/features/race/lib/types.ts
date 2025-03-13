import { RaceSize } from '../types';

export interface RaceState {
  id: string;
  players: Array<{
    id: string;
    address: string;
    critter: {
      id: string;
      position: number;
      currentSpeed: number;
    }
  }>;
  raceStatus: 'waiting' | 'inProgress' | 'finished';
  startTime: number;
  timeRemaining: number;
  entryFee: bigint;
  prizePool: bigint;
}

export interface RaceStats {
  totalPrizePool: number;
  highestScore: number;
  averageScore: number;
  participantCount: number;
  duration: number;
}

export interface RaceValidation {
  canJoin: boolean;
  reason?: string;
  activeRaceId?: string;
}

export interface RaceCache {
  id: string;
  data: any;
  lastUpdated: number;
} 