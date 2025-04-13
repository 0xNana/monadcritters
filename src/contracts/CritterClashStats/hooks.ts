import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { abi } from './abi';
import { PlayerStats, CritterStats, TopPlayer, MigrationProgress } from './types';
import { ClashState, ClashSize } from '../CritterClashCore/types';

const contractConfig = {
  address: import.meta.env.VITE_CRITTER_CLASH_STATS_ADDRESS as `0x${string}`,
  abi
};

// Cache for storing player stats
const playerStatsCache = new Map<string, {
  stats: PlayerStats;
  timestamp: number;
}>();

// Cache for storing critter stats
const critterStatsCache = new Map<number, {
  stats: CritterStats;
  timestamp: number;
}>();

// Cache for leaderboard data
let leaderboardCache: {
  data: TopPlayer[];
  timestamp: number;
} | null = null;

// Cache for clash info batches
const clashInfoBatchCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

// Cache validity period in milliseconds (5 minutes)
const CACHE_VALIDITY_PERIOD = 5 * 60 * 1000;

// Rate limiting - adjust these as needed
const MIN_REQUEST_INTERVAL = 1000; // Milliseconds between requests
let lastRequestTime = 0;

// Simple rate limiting function
const rateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;
  
  if (timeElapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeElapsed)
    );
  }
  
  lastRequestTime = Date.now();
};

export const useCritterClashStats = () => {
  const publicClient = usePublicClient();
  const { writeContract } = useWriteContract();

  if (!publicClient) {
    throw new Error('Public client not initialized');
  }

  const getUserClashIds = async (user: string): Promise<{
    acceptingPlayersClashes: bigint[],
    clashingClashes: bigint[],
    completedClashes: bigint[]
  }> => {
    await rateLimit();
    
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getUserClashIds',
      args: [user as `0x${string}`]
    });

    const [acceptingPlayersClashes, clashingClashes, completedClashes] = result as [
      bigint[], bigint[], bigint[]
    ];

    return {
      acceptingPlayersClashes,
      clashingClashes,
      completedClashes
    };
  };

  const getPlayerStats = async (player: string): Promise<PlayerStats> => {
    const cacheKey = player;
    const now = Date.now();
    const cachedData = playerStatsCache.get(cacheKey);
    
    // Use cache if available and not expired
    if (cachedData && now - cachedData.timestamp < CACHE_VALIDITY_PERIOD) {
      return cachedData.stats;
    }
    
    await rateLimit();
    
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getUserStats',
      args: [player as `0x${string}`]
    });

    const [totalScore, totalWins, totalClashes, totalRewards] = result as [
      bigint, bigint, bigint, bigint
    ];

    const stats = {
      totalScore: Number(totalScore),
      totalWins: Number(totalWins),
      totalClashes: Number(totalClashes),
      totalRewards: Number(totalRewards),
    };
    
    // Update cache
    playerStatsCache.set(cacheKey, {
      stats,
      timestamp: now
    });

    return stats;
  };

  const getCritterStats = async (critterId: number): Promise<CritterStats> => {
    const cacheKey = critterId;
    const now = Date.now();
    const cachedData = critterStatsCache.get(cacheKey);
    
    // Use cache if available and not expired
    if (cachedData && now - cachedData.timestamp < CACHE_VALIDITY_PERIOD) {
      return cachedData.stats;
    }
    
    await rateLimit();
    
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getCritterStats',
      args: [BigInt(critterId)]
    });

    const [clashCount, winCount, winStreak] = result as [
      bigint, bigint, bigint
    ];

    const stats = {
      clashCount: Number(clashCount),
      winCount: Number(winCount),
      winStreak: Number(winStreak),
    };
    
    // Update cache
    critterStatsCache.set(cacheKey, {
      stats,
      timestamp: now
    });

    return stats;
  };

  const getTopPlayers = async (count: number): Promise<TopPlayer[]> => {
    const now = Date.now();
    
    // Use cache if available and not expired
    if (leaderboardCache && now - leaderboardCache.timestamp < CACHE_VALIDITY_PERIOD) {
      return leaderboardCache.data.slice(0, count);
    }
    
    await rateLimit();
    
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getLeaderboard',
      args: [BigInt(0), BigInt(Math.max(count, 50))] // Request more data to fill cache
    });

    const [players, scores, wins, clashCounts, rewards] = result as [
      `0x${string}`[], bigint[], bigint[], bigint[], bigint[]
    ];

    const topPlayers = players.map((player, index) => ({
      player,
      totalScore: Number(scores[index]),
      totalWins: Number(wins[index]),
      totalClashes: Number(clashCounts[index]),
      totalRewards: Number(rewards[index]),
    }));
    
    // Update cache
    leaderboardCache = {
      data: topPlayers,
      timestamp: now
    };

    return topPlayers.slice(0, count);
  };

  const getMigrationProgress = async (): Promise<MigrationProgress> => {
    await rateLimit();
    
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getMigrationProgress'
    });

    const [completed, currentIndex, currentPlayerCount] = result as [
      boolean, bigint, bigint
    ];

    return {
      totalPlayers: Number(currentPlayerCount),
      importedPlayers: Number(currentIndex),
      remainingPlayers: Number(currentPlayerCount) - Number(currentIndex),
      isComplete: completed,
    };
  };

  const getClashInfoBatch = async (
    clashIds: bigint[],
    offset: number,
    limit: number
  ) => {
    const cacheKey = `${clashIds.join('_')}:${offset}:${limit}`;
    const now = Date.now();
    const cachedData = clashInfoBatchCache.get(cacheKey);
    
    // Use cache if available and not expired
    if (cachedData && now - cachedData.timestamp < CACHE_VALIDITY_PERIOD) {
      return cachedData.data;
    }
    
    await rateLimit();
    
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getClashInfoBatch',
      args: [clashIds, BigInt(offset), BigInt(limit)]
    });

    const [
      clashSizes, 
      states, 
      playerCounts, 
      startTimes, 
      players, 
      critterIds, 
      boosts, 
      scores, 
      results
    ] = result as [
      number[], 
      number[], 
      bigint[], 
      bigint[], 
      `0x${string}`[][], 
      bigint[][], 
      bigint[][],
      bigint[][],
      any[][]
    ];

    const data = {
      clashSizes: clashSizes as ClashSize[],
      states: states as ClashState[],
      playerCounts,
      startTimes,
      players,
      critterIds,
      boosts,
      scores,
      results
    };
    
    // Update cache
    clashInfoBatchCache.set(cacheKey, {
      data,
      timestamp: now
    });
    
    return data;
  };
  
  // Function to batch fetch player stats for multiple addresses
  const getMultiplePlayerStats = async (players: string[]): Promise<Record<string, PlayerStats>> => {
    const results: Record<string, PlayerStats> = {};
    const playersToFetch: string[] = [];
    
    // Check for cached data first
    for (const player of players) {
      const cachedData = playerStatsCache.get(player);
      const now = Date.now();
      
      if (cachedData && now - cachedData.timestamp < CACHE_VALIDITY_PERIOD) {
        results[player] = cachedData.stats;
      } else {
        playersToFetch.push(player);
      }
    }
    
    // Fetch data for players not in cache
    for (const player of playersToFetch) {
      try {
        results[player] = await getPlayerStats(player);
      } catch (error) {
        console.error(`Error fetching stats for player ${player}:`, error);
        // Use empty stats as fallback
        results[player] = {
          totalScore: 0,
          totalWins: 0,
          totalClashes: 0,
          totalRewards: 0
        };
      }
    }
    
    return results;
  };

  return {
    getUserClashIds,
    getPlayerStats,
    getCritterStats,
    getTopPlayers,
    getMigrationProgress,
    getClashInfoBatch,
    getMultiplePlayerStats  // New function for batch fetching
  };
}; 