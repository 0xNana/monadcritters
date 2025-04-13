import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { CRITTER_CLASH_CORE_ABI, CRITTER_CLASH_CORE_ADDRESS, CRITTER_CLASH_STATS_ABI, CRITTER_CLASH_STATS_ADDRESS } from '../constants/contracts';
import { ClashSize, ClashState } from '../contracts/CritterClashCore/types';

// Constants
const LEADERBOARD_CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_PLAYERS = 100; // Maximum number of players to fetch

export interface LeaderboardEntry {
  address: string;
  score: bigint;
  wins: bigint;
  clashCount: bigint;
  rewards: bigint;
}

interface LeaderboardCache {
  data: LeaderboardEntry[];
  timestamp: number;
}

interface ClashInfo {
  clashSize: ClashSize;
  state: ClashState;
  playerCount: bigint;
  startTime: bigint;
  players: readonly string[];
  critterIds: readonly bigint[];
  results: readonly {
    player: string;
    critterId: bigint;
    position: bigint;
    reward: bigint;
    score: bigint;
  }[];
}

export const useClashLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const updateLeaderboard = useCallback(async () => {
    if (!publicClient || !CRITTER_CLASH_STATS_ADDRESS) {
      console.log('Debug: Missing public client or contract address');
      return;
    }

    try {
      setIsLoading(true);

      // Get leaderboard data using the correct function name
      const result = await publicClient.readContract({
        address: CRITTER_CLASH_STATS_ADDRESS,
        abi: CRITTER_CLASH_STATS_ABI,
        functionName: 'getLeaderboard',
        args: [BigInt(0), BigInt(MAX_PLAYERS)] // offset, count
      });

      if (!result) {
        console.log('Debug: No result from getLeaderboard');
        return;
      }

      // Destructure the result based on the contract's return structure
      const [players, scores, wins, clashCounts, rewards] = result as [
        string[],
        bigint[],
        bigint[],
        bigint[],
        bigint[]
      ];

      if (!Array.isArray(players)) {
        console.log('Debug: Invalid players array', players);
        return;
      }

      // Format the data into our expected structure
      const entries: LeaderboardEntry[] = players.map((player, index) => ({
        address: player,
        score: scores[index],
        wins: wins[index],
        clashCount: clashCounts[index],
        rewards: rewards[index]
      }));

      // Sort by score descending
      entries.sort((a, b) => (b.score > a.score ? 1 : -1));

      setLeaderboard(entries);
      setIsLoading(false);

      // Cache the results
      localStorage.setItem('clash_leaderboard_cache', JSON.stringify({
        timestamp: Date.now(),
        data: entries.map(entry => ({
          ...entry,
          score: entry.score.toString(),
          wins: entry.wins.toString(),
          clashCount: entry.clashCount.toString(),
          rewards: entry.rewards.toString()
        }))
      }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setIsLoading(false);
    }
  }, [publicClient]);

  // Load cached data on mount with proper BigInt conversion
  useEffect(() => {
    const cached = localStorage.getItem('clash_leaderboard_cache');
    if (cached) {
      try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < LEADERBOARD_CACHE_TIME) {
          // Convert string values back to BigInt
          const convertedData = data.map((entry: any) => ({
            ...entry,
            score: BigInt(entry.score),
            wins: BigInt(entry.wins),
            clashCount: BigInt(entry.clashCount),
            rewards: BigInt(entry.rewards)
          }));
          setLeaderboard(convertedData);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error('Error parsing cached leaderboard data:', e);
      }
    }
    updateLeaderboard();
  }, [updateLeaderboard]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(updateLeaderboard, LEADERBOARD_CACHE_TIME);
    return () => clearInterval(interval);
  }, [updateLeaderboard]);

  return {
    leaderboard,
    isLoading,
    userRank: address ? leaderboard.findIndex(entry => entry.address.toLowerCase() === address.toLowerCase()) + 1 : 0,
    refetch: updateLeaderboard
  };
};

// Hook for getting clash info and results
export const useClashInfo = (clashId?: bigint) => {
  const [clashInfo, setClashInfo] = useState<ClashInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();

  const fetchClashInfo = useCallback(async () => {
    if (!clashId || !publicClient || !CRITTER_CLASH_CORE_ADDRESS) {
      setClashInfo(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await publicClient.readContract({
        address: CRITTER_CLASH_CORE_ADDRESS,
        abi: CRITTER_CLASH_CORE_ABI,
        functionName: 'getClashInfo',
        args: [clashId]
      }) as unknown as readonly [
        number, // clashSize
        number, // state
        bigint, // playerCount
        bigint, // startTime
        readonly string[], // players
        readonly bigint[], // critterIds
        readonly {
          player: string;
          critterId: bigint;
          position: bigint;
          reward: bigint;
          score: bigint;
        }[] // results
      ];

      const [clashSize, state, playerCount, startTime, players, critterIds, results] = result;

      setClashInfo({
        clashSize: clashSize as ClashSize,
        state: state as ClashState,
        playerCount,
        startTime,
        players,
        critterIds,
        results
      });
    } catch (error) {
      console.error('Error fetching clash info:', error);
      setClashInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [clashId, publicClient]);

  useEffect(() => {
    fetchClashInfo();
  }, [fetchClashInfo]);

  return {
    clashInfo,
    isLoading,
    refetch: fetchClashInfo
  };
};

// Hook for monitoring clash state changes
export const useClashStateMonitor = (clashId: bigint | undefined) => {
  const { clashInfo, isLoading, refetch } = useClashInfo(clashId);
  const [previousState, setPreviousState] = useState<ClashState>();
  
  useEffect(() => {
    if (clashInfo?.state !== previousState) {
      setPreviousState(clashInfo?.state);
    }
  }, [clashInfo?.state, previousState]);

  const isReadyToComplete = useMemo(() => {
    if (!clashInfo) return false;
    
    const hasAllPlayers = clashInfo.playerCount === BigInt(clashInfo.clashSize === ClashSize.Two ? 2 : 4);
    const currentTime = Math.floor(Date.now() / 1000);
    const hasEnded = currentTime > Number(clashInfo.startTime) + 60; // 60 second clash duration
    
    return clashInfo.state === ClashState.CLASHING && hasAllPlayers && hasEnded;
  }, [clashInfo]);

  return {
    currentState: clashInfo?.state,
    previousState,
    isLoading,
    refetch,
    isReadyToComplete
  };
}; 