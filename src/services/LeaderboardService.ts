import { RaceInfo, RaceResult } from '../contracts/CritterRace/types';

export interface LeaderboardEntry {
  address: string;
  score: number;
  rewards: bigint;
  rank?: number;
  stats: {
    totalRaces: number;
    wins: number;
    topThree: number;
    winRate: number;
    averagePosition: number;
    bestScore: number;
    totalRewards: bigint;
  };
}

export interface LeaderboardFilters {
  timeRange?: 'all' | 'day' | 'week' | 'month';
  minRaces?: number;
  sortBy?: 'score' | 'rewards' | 'winRate';
}

// Define the raw race data type that matches what we receive
interface RawRaceData {
  id: bigint;
  raceSize: number;
  players: readonly `0x${string}`[];
  critterIds: readonly bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: bigint;
  calculatedResults?: RaceResult[];
}

// Extended RaceInfo type that includes calculated results
interface ExtendedRaceInfo extends Omit<RaceInfo, 'players' | 'critterIds'> {
  players: readonly `0x${string}`[];
  critterIds: readonly bigint[];
  calculatedResults?: RaceResult[];
}

export class LeaderboardService {
  private static instance: LeaderboardService;
  private cache: Map<string, LeaderboardEntry>;
  private lastUpdate: number;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
    this.lastUpdate = 0;
  }

  static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  // Helper to convert raw race data to ExtendedRaceInfo
  private convertRaceData(race: RawRaceData): ExtendedRaceInfo {
    return {
      ...race,
      playerCount: BigInt(race.players.length),
      calculatedResults: race.calculatedResults || []
    };
  }

  computeLeaderboard(races: RaceInfo[], filters: LeaderboardFilters = {}): LeaderboardEntry[] {
    const now = Date.now();
    const cacheKey = JSON.stringify(filters);
    
    // Return cached results if fresh
    if (now - this.lastUpdate < this.CACHE_DURATION && this.cache.size > 0) {
      return Array.from(this.cache.values())
        .sort((a, b) => this.sortEntries(a, b, filters.sortBy));
    }

    // Clear old cache
    this.cache.clear();

    // Process all races and aggregate player stats
    races.forEach(race => {
      // Skip races that haven't ended or don't have results
      if (!race.hasEnded || !race.calculatedResults) return;

      // Apply time range filter
      if (filters.timeRange && !this.isWithinTimeRange(race.startTime, filters.timeRange)) {
        return;
      }

      // Process each player's results
      race.calculatedResults.forEach(result => {
        const existingEntry = this.cache.get(result.player) || this.createNewEntry(result.player);
        this.updatePlayerStats(existingEntry, result, race);
        this.cache.set(result.player, existingEntry);
      });
    });

    // Apply minimum races filter
    let entries = Array.from(this.cache.values());
    if (filters.minRaces) {
      entries = entries.filter(entry => entry.stats.totalRaces >= filters.minRaces);
    }

    // Sort and add ranks
    entries.sort((a, b) => this.sortEntries(a, b, filters.sortBy));
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.lastUpdate = now;
    return entries;
  }

  private createNewEntry(address: string): LeaderboardEntry {
    return {
      address,
      score: 0,
      rewards: BigInt(0),
      stats: {
        totalRaces: 0,
        wins: 0,
        topThree: 0,
        winRate: 0,
        averagePosition: 0,
        bestScore: 0,
        totalRewards: BigInt(0)
      }
    };
  }

  private updatePlayerStats(entry: LeaderboardEntry, result: RaceResult, race: RaceInfo): void {
    // Update basic stats
    entry.stats.totalRaces++;
    entry.stats.totalRewards = entry.stats.totalRewards + result.reward;
    entry.rewards = entry.stats.totalRewards;

    // Update position-based stats
    const position = Number(result.finalPosition);
    if (position === 1) entry.stats.wins++;
    if (position <= 3) entry.stats.topThree++;

    // Update score - now using total score across all races
    const score = Number(result.score);
    entry.stats.bestScore = Math.max(entry.stats.bestScore, score);
    entry.score += score; // Accumulate total score instead of using best score

    // Update averages
    entry.stats.winRate = (entry.stats.wins / entry.stats.totalRaces) * 100;
    entry.stats.averagePosition = 
      ((entry.stats.averagePosition * (entry.stats.totalRaces - 1)) + position) / 
      entry.stats.totalRaces;
  }

  private isWithinTimeRange(timestamp: bigint, range: 'all' | 'day' | 'week' | 'month'): boolean {
    if (range === 'all') return true;
    
    const now = Date.now();
    const raceTime = Number(timestamp) * 1000; // Convert to milliseconds
    const diff = now - raceTime;
    
    switch (range) {
      case 'day': return diff <= 24 * 60 * 60 * 1000;
      case 'week': return diff <= 7 * 24 * 60 * 60 * 1000;
      case 'month': return diff <= 30 * 24 * 60 * 60 * 1000;
      default: return true;
    }
  }

  private sortEntries(a: LeaderboardEntry, b: LeaderboardEntry, sortBy: string = 'score'): number {
    switch (sortBy) {
      case 'rewards':
        return Number(b.stats.totalRewards - a.stats.totalRewards);
      case 'winRate':
        return b.stats.winRate - a.stats.winRate;
      case 'score':
      default:
        return b.score - a.score;
    }
  }

  getPlayerStats(address: string): LeaderboardEntry | undefined {
    return Array.from(this.cache.values())
      .find(entry => entry.address.toLowerCase() === address.toLowerCase());
  }
}
