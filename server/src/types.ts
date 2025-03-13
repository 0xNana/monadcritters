import type { PowerUpAction } from '../../shared/power-up-types';

export type { PowerUpAction };

export interface RacePlayer {
  id: string;
  address: string;
  position: number;
  currentSpeed: number;
  effects: {
    speedBoost?: { duration: number; endTime: number };
    sabotage?: { duration: number; endTime: number };
  };
} 