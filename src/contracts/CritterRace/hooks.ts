import { useReadContract, useWriteContract, useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { useEffect, useState } from 'react';
import { abi } from './abi';
import { 
  RaceInfo, 
  RaceSize,
  RaceType,
  RaceResult,
  PlayerStats,
  RaceEndInfo,
  RaceTypeInfo,
  LeaderboardEntry,
  CritterStats,
  RaceScore,
  PowerUpRevenueWithdrawnEvent,
  AccidentalTokensWithdrawnEvent
} from './types';
import { contracts, QUERY_CONFIG } from '../../utils/config';
// Get contract address from environment variable
const RACE_CONTRACT_ADDRESS = process.env.VITE_RACE_CONTRACT_ADDRESS as Address;
if (!RACE_CONTRACT_ADDRESS) {
  throw new Error('VITE_RACE_CONTRACT_ADDRESS is not defined in environment variables');
}

// Helper to get contract address - no chain dependency
function useContractAddress() {
  return RACE_CONTRACT_ADDRESS;
}

// Contract configuration with static address
function useContractConfig() {
  return {
    address: RACE_CONTRACT_ADDRESS,
    abi
  } as const;
}

// Get race info
export function useRaceInfo(raceId: bigint | undefined) {
  return useReadContract({
    address: contracts.monad.race as `0x${string}`,
    abi,
    functionName: 'getRaceInfo',
    args: raceId ? [raceId] : undefined,
    query: {
      ...QUERY_CONFIG.standard,
      enabled: !!raceId
    }
  });
}

// Get active races for a specific race size
export function useActiveRaces(raceSize: RaceSize) {
  return useReadContract({
    address: contracts.monad.race as `0x${string}`,
    abi,
    functionName: 'getActiveRaces',
    args: [raceSize],
    query: {
      ...QUERY_CONFIG.realtime,
      select: (data) => {
        if (!data) return [];
        return data.filter(race => race.players.some(p => p !== '0x0000000000000000000000000000000000000000'));
      }
    }
  });
}

// Get race type info
export function useRaceTypeInfo(raceSize: RaceSize) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getRaceTypeInfo',
    args: [raceSize]
  });
}

// Get player stats
export function usePlayerStats(playerAddress: `0x${string}` | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getPlayerStats',
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress
    }
  });
}

// Get player's win rate
export function usePlayerWinRate(playerAddress: `0x${string}` | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getWinRate',
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress
    }
  });
}

// Get top players by wins
export function useTopPlayersByWins(limit: bigint) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getTopPlayersByWins',
    args: [limit]
  });
}

// Get top players by score
export function useTopPlayersByScore(limit: bigint) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getTopPlayersByScore',
    args: [limit]
  });
}

// Get latest available race for a size
export function useLatestAvailableRace(raceSize: RaceSize) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getLatestAvailableRace',
    args: [raceSize]
  });
}

// Get user's races
export function useUserRaces(userAddress: `0x${string}` | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getUserRaces',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress
    }
  });
}

// Get batch race scores
export function useBatchRaceScores(
  critterIds: bigint[] | undefined,
  boosts: bigint[] | undefined
) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getBatchRaceScores',
    args: critterIds && boosts ? [critterIds, boosts] : undefined,
    query: {
      enabled: !!(critterIds && boosts && critterIds.length === boosts.length)
    }
  });
}

// Get race leaderboard
export function useRaceLeaderboard(raceId: bigint | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getRaceLeaderboard',
    args: raceId ? [raceId] : undefined,
    query: {
      enabled: !!raceId
    }
  });
}

// Get batch race leaderboards
export function useBatchRaceLeaderboards(raceIds: bigint[] | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getBatchRaceLeaderboards',
    args: raceIds ? [raceIds] : undefined,
    query: {
      enabled: !!raceIds
    }
  });
}

// Write functions with proper wagmi v2 configuration
export function useCreateRace() {
  const contractConfig = useContractConfig();
  const { writeContract } = useWriteContract();
  return {
    write: (args?: Parameters<typeof writeContract>[0]) =>
      writeContract({
        ...contractConfig,
        functionName: 'createRace',
        ...args
      })
  };
}

export function useJoinRace() {
  const contractConfig = useContractConfig();
  const { writeContract } = useWriteContract();
  return {
    write: (args?: Parameters<typeof writeContract>[0]) =>
      writeContract({
        ...contractConfig,
        functionName: 'joinRace',
        ...args
      })
  };
}

export function useStartRace() {
  const contractConfig = useContractConfig();
  const { writeContract } = useWriteContract();
  return {
    write: (args?: Parameters<typeof writeContract>[0]) =>
      writeContract({
        ...contractConfig,
        functionName: 'startRaceExternal',
        ...args
      })
  };
}

export function useEndRace() {
  const contractConfig = useContractConfig();
  const { writeContract } = useWriteContract();
  return {
    write: (args?: Parameters<typeof writeContract>[0]) =>
      writeContract({
        ...contractConfig,
        functionName: 'endRace',
        ...args
      })
  };
}

export function useBuyPowerUps() {
  const contractConfig = useContractConfig();
  const { writeContract } = useWriteContract();
  return {
    write: (args?: Parameters<typeof writeContract>[0]) =>
      writeContract({
        ...contractConfig,
        functionName: 'buyPowerUps',
        ...args
      })
  };
}

// Event hooks with proper typing
export function useRaceEvents(
  onRaceCreated: (raceId: bigint) => void,
  onPlayerJoined: (raceId: bigint, player: `0x${string}`, critterId: bigint) => void,
  onRaceStarted: (raceId: bigint, startTime: bigint) => void,
  onRaceEnded: (raceId: bigint, results: RaceResult[]) => void,
  onPowerUpRevenue: (owner: `0x${string}`, amount: bigint) => void,
  onAccidentalTokens: (owner: `0x${string}`, amount: bigint) => void
) {
  // Watch RaceCreated events
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi,
    eventName: 'RaceCreated',
    onLogs: (logs) => {
      const raceId = logs[0].args.raceId;
      if (raceId) onRaceCreated(raceId);
    }
  });

  // Watch PlayerJoined events
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi,
    eventName: 'PlayerJoined',
    onLogs: (logs) => {
      const { raceId, player, critterId } = logs[0].args;
      if (raceId && player && critterId) {
        onPlayerJoined(raceId, player, critterId);
      }
    }
  });

  // Watch RaceStarted events
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi,
    eventName: 'RaceStarted',
    onLogs: (logs) => {
      const { raceId, startTime } = logs[0].args;
      if (raceId && startTime) {
        onRaceStarted(raceId, startTime);
      }
    }
  });

  // Watch RaceEnded events
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi,
    eventName: 'RaceEnded',
    onLogs: (logs) => {
      const { raceId, results } = logs[0].args;
      if (raceId && results) {
        // Create a new mutable array from the readonly results
        const mutableResults: RaceResult[] = results.map(result => ({
          player: result.player,
          critterId: result.critterId,
          finalPosition: result.finalPosition,
          reward: result.reward,
          score: result.score
        }));
        onRaceEnded(raceId, mutableResults);
      }
    }
  });

  // Watch PowerUpRevenueWithdrawn events
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi,
    eventName: 'PowerUpRevenueWithdrawn',
    onLogs: (logs) => {
      const { owner, amount } = logs[0].args;
      if (owner && amount) {
        onPowerUpRevenue(owner, amount);
      }
    }
  });

  // Watch AccidentalTokensWithdrawn events
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi,
    eventName: 'AccidentalTokensWithdrawn',
    onLogs: (logs) => {
      const { owner, amount } = logs[0].args;
      if (owner && amount) {
        onAccidentalTokens(owner, amount);
      }
    }
  });
}

// Cache base scores
export function useCacheBaseScores() {
  const contractConfig = useContractConfig();
  const { writeContract } = useWriteContract();
  return {
    write: (args?: Parameters<typeof writeContract>[0]) =>
      writeContract({
        ...contractConfig,
        functionName: 'cacheBaseScores',
        ...args
      })
  };
}

// Get batch race results
export function useBatchRaceResults(raceIds: bigint[] | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getBatchRaceResults',
    args: raceIds ? [raceIds] : undefined,
    query: {
      enabled: !!raceIds
    }
  });
}

export type {
  RaceInfo,
  RaceSize,
  RaceType,
  RaceResult,
  PlayerStats,
  RaceEndInfo,
  RaceTypeInfo,
  LeaderboardEntry,
  CritterStats,
  RaceScore,
  PowerUpRevenueWithdrawnEvent,
  AccidentalTokensWithdrawnEvent
};

