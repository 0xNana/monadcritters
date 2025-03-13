import { useReadContract, useWriteContract, useWatchContractEvent, useAccount, useChainId } from 'wagmi';
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
  RaceTypeInfo
} from './types';
import { contracts } from '../../utils/config';
import { type Config } from 'wagmi';

// Get contract address based on chain ID
function useContractAddress() {
  const chainId = useChainId();
  return chainId === 11155111 
    ? contracts.sepolia.race 
    : contracts.monad.race;
}

// Contract configuration with dynamic address
function useContractConfig() {
  const address = useContractAddress();
  return {
    address: address as `0x${string}`,
    abi
  } as const;
}

// Get race info
export function useRaceInfo(raceId: bigint | undefined) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getRaceInfo',
    args: raceId ? [raceId] : undefined,
    query: {
      enabled: !!raceId
    }
  });
}

// Get active races for a specific race size
export function useActiveRaces(raceSize: RaceSize) {
  const contractConfig = useContractConfig();
  return useReadContract({
    ...contractConfig,
    functionName: 'getActiveRaces',
    args: [raceSize]
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
  onRaceCreated?: (raceId: bigint) => void,
  onPlayerJoined?: (raceId: bigint, player: `0x${string}`, critterId: bigint) => void,
  onRaceStarted?: (raceId: bigint, startTime: bigint) => void,
  onRaceEnded?: (raceId: bigint, results: RaceResult[]) => void
) {
  const contractConfig = useContractConfig();
  
  useWatchContractEvent({
    ...contractConfig,
    eventName: 'RaceCreated' as const,
    onLogs: ([log]) => {
      if (onRaceCreated && log?.args) {
        onRaceCreated(log.args.raceId as bigint);
      }
    }
  });
  
  useWatchContractEvent({
    ...contractConfig,
    eventName: 'PlayerJoined' as const,
    onLogs: ([log]) => {
      if (onPlayerJoined && log?.args) {
        const { raceId, player, critterId } = log.args as any;
        onPlayerJoined(raceId, player, critterId);
      }
    }
  });
  
  useWatchContractEvent({
    ...contractConfig,
    eventName: 'RaceStarted' as const,
    onLogs: ([log]) => {
      if (onRaceStarted && log?.args) {
        const { raceId, startTime } = log.args as any;
        onRaceStarted(raceId, startTime);
      }
    }
  });
  
  useWatchContractEvent({
    ...contractConfig,
    eventName: 'RaceEnded' as const,
    onLogs: ([log]) => {
      if (onRaceEnded && log?.args) {
        const { raceId, results } = log.args as any;
        onRaceEnded(raceId, results);
      }
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
  RaceTypeInfo
};

