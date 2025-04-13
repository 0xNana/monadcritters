import { ClashResult } from '../contracts/CritterClashCore/types';

export interface ClashLeaderboardEntry {
  address: string;
  score: number;
  rewards: bigint;
  rank?: number;
  stats: {
    totalClashes: number;
    wins: number;
    topThree: number;
    winRate: number;
    averagePosition: number;
    bestScore: number;
    totalRewards: bigint;
  };
}

export interface ClashLeaderboardFilters {
  timeRange?: 'all' | 'day' | 'week' | 'month';
  minClashes?: number;
  sortBy?: 'score' | 'rewards' | 'winRate';
}

interface ClashData {
  id: bigint;
  clashSize: number;
  players: readonly `0x${string}`[];
  critterIds: readonly bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  calculatedResults?: ClashResult[];
}

export class ClashLeaderboardService {
  private static instance: ClashLeaderboardService;
  private cache: Map<string, ClashLeaderboardEntry>;
  private lastUpdate: number;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
    this.lastUpdate = 0;
  }

  static getInstance(): ClashLeaderboardService {
    if (!ClashLeaderboardService.instance) {
      ClashLeaderboardService.instance = new ClashLeaderboardService();
    }
    return ClashLeaderboardService.instance;
  }

  computeLeaderboard(clashes: ClashData[], filters: ClashLeaderboardFilters = {}): ClashLeaderboardEntry[] {
    const now = Date.now();
    const cacheKey = JSON.stringify(filters);
    
    // Return cached results if fresh
    if (now - this.lastUpdate < this.CACHE_DURATION && this.cache.size > 0) {
      return Array.from(this.cache.values())
        .sort((a, b) => this.sortEntries(a, b, filters.sortBy));
    }

    // Clear old cache
    this.cache.clear();

    // Process all clashes and aggregate player stats
    clashes.forEach(clash => {
      // Skip clashes that haven't ended or don't have results
      if (!clash.hasEnded || !clash.calculatedResults) return;

      // Apply time range filter
      if (filters.timeRange && !this.isWithinTimeRange(clash.startTime, filters.timeRange)) {
        return;
      }

      // Process each player's results
      clash.calculatedResults.forEach(result => {
        const existingEntry = this.cache.get(result.player) || this.createNewEntry(result.player);
        this.updatePlayerStats(existingEntry, result, clash);
        this.cache.set(result.player, existingEntry);
      });
    });

    // Apply minimum clashes filter
    let entries = Array.from(this.cache.values());
    const minClashes = filters.minClashes ?? 0;
    if (minClashes > 0) {
      entries = entries.filter(entry => entry.stats.totalClashes >= minClashes);
    }

    // Sort and add ranks
    entries.sort((a, b) => this.sortEntries(a, b, filters.sortBy));
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.lastUpdate = now;
    return entries;
  }

  private createNewEntry(address: string): ClashLeaderboardEntry {
    return {
      address,
      score: 0,
      rewards: BigInt(0),
      stats: {
        totalClashes: 0,
        wins: 0,
        topThree: 0,
        winRate: 0,
        averagePosition: 0,
        bestScore: 0,
        totalRewards: BigInt(0)
      }
    };
  }

  private updatePlayerStats(entry: ClashLeaderboardEntry, result: ClashResult, clash: ClashData): void {
    // Update basic stats
    entry.stats.totalClashes++;
    entry.stats.totalRewards = entry.stats.totalRewards + result.reward;
    entry.rewards = entry.stats.totalRewards;

    // Update position-based stats
    const position = Number(result.position);
    if (position === 1) entry.stats.wins++;
    if (position <= 3) entry.stats.topThree++;

    // Update score
    const score = Number(result.score);
    entry.stats.bestScore = Math.max(entry.stats.bestScore, score);
    entry.score += score; // Accumulate total score

    // Update averages
    entry.stats.winRate = (entry.stats.wins / entry.stats.totalClashes) * 100;
    entry.stats.averagePosition = 
      ((entry.stats.averagePosition * (entry.stats.totalClashes - 1)) + position) / 
      entry.stats.totalClashes;
  }

  private isWithinTimeRange(timestamp: bigint, range: 'all' | 'day' | 'week' | 'month'): boolean {
    if (range === 'all') return true;
    
    const now = Date.now();
    const clashTime = Number(timestamp) * 1000; // Convert to milliseconds
    const diff = now - clashTime;
    
    switch (range) {
      case 'day': return diff <= 24 * 60 * 60 * 1000;
      case 'week': return diff <= 7 * 24 * 60 * 60 * 1000;
      case 'month': return diff <= 30 * 24 * 60 * 60 * 1000;
      default: return true;
    }
  }

  private sortEntries(a: ClashLeaderboardEntry, b: ClashLeaderboardEntry, sortBy: string = 'score'): number {
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

  getPlayerStats(address: string): ClashLeaderboardEntry | undefined {
    return Array.from(this.cache.values())
      .find(entry => entry.address.toLowerCase() === address.toLowerCase());
  }
} 