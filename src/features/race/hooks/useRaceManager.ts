import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../../components/WalletProvider';
import { useWatchContractEvent, usePublicClient, useChainId } from 'wagmi';
import { contracts } from '../../../utils/config';
import { parseAbiItem } from 'viem';
import { RaceState, RaceValidation } from '../lib/types';
import { RaceSize } from '../types';

// Constants for race configuration
const MAX_POSITION = 287; // Maximum valid position from contract (exclusive upper bound)
const INITIAL_POSITION = 1; // Initial position must be > 0 per contract
const INITIAL_SPEED = 5;  // Initial speed for critters

// Get contract address
function useContractAddress() {
  return contracts.monad.race;
}

// Position validation utility with detailed logging
const validatePosition = (position: number, context: string): number => {
  // Contract requires: 0 < position < 288
  if (position <= 0 || position >= 288) {
    console.debug('Position validation:', { 
      context,
      original: position, 
      corrected: INITIAL_POSITION,
      reason: position <= 0 ? 'position <= 0' : 'position >= 288',
      maxAllowed: MAX_POSITION
    });
    return INITIAL_POSITION;
  }
  return position;
};

// Get initial power-ups from localStorage
const getPlayerPowerUps = () => {
  try {
    // Debug: Log all localStorage keys
    console.debug('All localStorage keys:', Object.keys(localStorage));
    
    const raceJoinData = localStorage.getItem('race_join_powerups');
    console.debug('Raw race join data:', raceJoinData);
    
    if (raceJoinData) {
      const data = JSON.parse(raceJoinData);
      console.debug('Parsed power-ups data:', data);
      
      // Ensure we're getting the correct properties
      const powerUps = {
        speedBoosts: Number(data.speedBoosts ?? data.speed ?? 0),
        sabotages: Number(data.sabotages ?? data.sabotage ?? 0),
        usedInRace: 0
      };
      
      console.debug('Final power-ups:', powerUps);
      return powerUps;
    }
  } catch (error) {
    console.error('Error loading power-ups:', error);
  }
  return { speedBoosts: 0, sabotages: 0, usedInRace: 0 };
};

// Race contract ABI for events
const raceAbi = [
  {
    name: 'RaceCreated',
    type: 'event',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true }
    ]
  },
  {
    name: 'PlayerJoined',
    type: 'event',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'critterId', indexed: true }
    ]
  },
  {
    name: 'PowerUpLoaded',
    type: 'event',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'bool', name: 'isSpeedBoost', indexed: false },
      { type: 'uint256', name: 'amount', indexed: false }
    ]
  },
  {
    name: 'getRaceInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'raceId' }],
    outputs: [
      { type: 'uint256', name: 'id' },
      { type: 'address[]', name: 'players' },
      { type: 'uint256[]', name: 'critterIds' },
      { type: 'uint256', name: 'startTime' },
      { type: 'bool', name: 'isActive' },
      { type: 'bool', name: 'hasEnded' },
      { type: 'uint256', name: 'prizePool' }
    ]
  },
  {
    name: 'currentRaceId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
] as const;

// Add these before the STORAGE_KEYS constant
const RACE_CACHE_KEYS = {
  RACE_DATA: (raceId: string) => `race_data_${raceId}`,
  ACTIVE_RACE: (address: string) => `active_race_${address.toLowerCase()}`,
  LAST_CREATED: 'last_created_race',
  PLAYER_STATUS: (address: string) => `player_race_status_${address.toLowerCase()}`
} as const;

const RACE_CACHE_DURATION = {
  ACTIVE: 30 * 1000,        // 30 seconds for active race
  WAITING: 60 * 1000,       // 1 minute for waiting race
  COMPLETED: 5 * 60 * 1000, // 5 minutes for completed race
  PLAYER_STATUS: 30 * 1000  // 30 seconds for player status
} as const;

// Consolidated storage keys for better state management
const STORAGE_KEYS = {
  ACTIVE_RACES: 'monad_active_races',
  CURRENT_RACE: 'current_race_data',
  RACE_JOIN: (raceId: string) => `race_${raceId}_join`,
  RACE_POWERUPS: (raceId: string, player: string) => `race_${raceId}_powerups_${player}`,
  WALLET_RACE_STATUS: 'wallet_race_status',
  ALL_RACE_IDS: 'all_race_ids',
  WAITING_RACES: 'waiting_races',
  LAST_CREATED_RACE: 'last_created_race',
} as const;

// Enhanced race info interface
export interface RaceInfo {
  id: string;
  isActive: boolean;
  players: string[];
  critterIds: string[];
  prizePool: bigint;
  startTime: number;
  raceStatus: 'waiting' | 'starting' | 'active' | 'ended';
  hasEnded: boolean;
  maxPlayers: number;
  entryFee: bigint;
  joinedPlayerDetails: {
    [address: string]: {
      critterId: string;
      joinedAt: number;
      powerUps: {
        speedBoosts: number;
        sabotages: number;
        usedInRace: number;
      }
    }
  };
}

interface RaceManagerState {
  activeRaces: RaceInfo[];
  currentRace: RaceInfo | null;
  isLoading: boolean;
  error: string | null;
  raceState: RaceState;
}

// Add utility function for timestamp conversion
function parseContractTimestamp(timestamp: bigint | number): string {
  // Convert to milliseconds if in seconds
  const timeMs = typeof timestamp === 'bigint' 
    ? Number(timestamp) * 1000 
    : timestamp * 1000;
  
  return new Date(timeMs).toISOString();
}

// Add validation functions after the RaceManagerState interface
interface JoinRaceValidation {
  canJoin: boolean;
  reason?: string;
  activeRaceId?: string;
}

// Add these validation functions before the useRaceManager hook
const validateRaceJoin = (race: RaceInfo | null, playerAddress: string | undefined): JoinRaceValidation => {
  if (!race) {
    return { canJoin: false, reason: 'No active race found' };
  }

  if (!playerAddress) {
    return { canJoin: false, reason: 'No wallet connected' };
  }

  if (race.hasEnded) {
    return { canJoin: false, reason: 'Race has already ended' };
  }

  if (race.raceStatus !== 'waiting') {
    return { canJoin: false, reason: 'Race has already started' };
  }

  if (race.players.length >= race.maxPlayers) {
    return { canJoin: false, reason: 'Race is full' };
  }

  const normalizedAddress = playerAddress.toLowerCase();
  
  // Check if player is in any active race
  if (race.players.some(p => p.toLowerCase() === normalizedAddress)) {
    return { 
      canJoin: false, 
      reason: `You are already in Race #${race.id}`,
      activeRaceId: race.id
    };
  }

  return { canJoin: true };
};

// Add CreateRaceValidation interface after JoinRaceValidation
interface CreateRaceValidation {
  canCreate: boolean;
  reason?: string;
  activeRaceId?: string;
}

// Add validation function for race creation
const validateRaceCreation = (
  activeRaces: RaceInfo[],
  playerAddress: string | undefined,
  currentRace: RaceInfo | null
): CreateRaceValidation => {
  if (!playerAddress) {
    return { canCreate: false, reason: 'No wallet connected' };
  }

  // Check if player is in any active or waiting race
  const playerActiveRace = activeRaces.find(race => 
    (race.raceStatus === 'waiting' || race.raceStatus === 'active') && 
    race.players.some(p => p.toLowerCase() === playerAddress.toLowerCase())
  );

  if (playerActiveRace) {
    return { 
      canCreate: false, 
      reason: `You are already in Race #${playerActiveRace.id}`,
      activeRaceId: playerActiveRace.id // Add this to help UI show the current race
    };
  }

  // Check if there's already an active race waiting for players
  const waitingRace = activeRaces.find(race => race.raceStatus === 'waiting');
  if (waitingRace) {
    return { 
      canCreate: false, 
      reason: `Race #${waitingRace.id} is waiting for players`,
      activeRaceId: waitingRace.id
    };
  }

  return { canCreate: true };
};

// Add interface for wallet race status
interface WalletRaceStatus {
  activeRaceId?: string;
  lastUpdated: number;
  status: 'waiting' | 'starting' | 'active' | 'ended' | 'none';
}

// Add utility function to check if cache is stale (5 minutes)
const isCacheStale = (timestamp: number) => {
  return Date.now() - timestamp > 5 * 60 * 1000;
};

// Add these utility functions after the isCacheStale function
const isValidRace = (race: RaceInfo): boolean => {
  // A race is valid if it has matching players and critters
  return (
    race.players.length > 0 && 
    race.critterIds.length === race.players.length &&
    race.players.every((_, index) => race.critterIds[index])
  );
};

// Add interface for waiting race data
interface WaitingRace {
  id: string;
  isActive: boolean;
  hasEnded: boolean;
  startTime: number;
  players: string[];
  lastUpdated: number;
}

export function useRaceManager(initialState?: RaceState) {
  const publicClient = usePublicClient();
  const [state, setState] = useState<RaceManagerState>({
    activeRaces: [],
    currentRace: null,
    isLoading: true,
    error: null,
    raceState: initialState || {
      id: "0",
      players: [],
      raceStatus: 'waiting',
      startTime: Date.now(),
      timeRemaining: 30000,
      entryFee: BigInt(0),
      prizePool: BigInt(0)
    }
  });

  // Add function to get wallet race status from cache
  const getWalletRaceStatus = useCallback((): WalletRaceStatus | null => {
    try {
      const walletData = localStorage.getItem('wallet_address');
      if (!walletData) return null;

      const cachedStatus = localStorage.getItem(STORAGE_KEYS.WALLET_RACE_STATUS);
      if (cachedStatus) {
        const status: WalletRaceStatus = JSON.parse(cachedStatus);
        if (!isCacheStale(status.lastUpdated)) {
          return status;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting wallet race status:', error);
      return null;
    }
  }, []);

  // Add function to update wallet race status
  const updateWalletRaceStatus = useCallback((status: Omit<WalletRaceStatus, 'lastUpdated'>) => {
    try {
      const walletStatus: WalletRaceStatus = {
        ...status,
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.WALLET_RACE_STATUS, JSON.stringify(walletStatus));
    } catch (error) {
      console.error('Error updating wallet race status:', error);
    }
  }, []);

  // Load initial state from localStorage
  useEffect(() => {
    try {
      const storedActiveRaces = localStorage.getItem(STORAGE_KEYS.ACTIVE_RACES);
      const storedCurrentRace = localStorage.getItem(STORAGE_KEYS.CURRENT_RACE);

      setState(prev => ({
        ...prev,
        activeRaces: storedActiveRaces ? JSON.parse(storedActiveRaces) : [],
        currentRace: storedCurrentRace ? JSON.parse(storedCurrentRace) : null,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error loading race data from localStorage:', error);
      setState(prev => ({ ...prev, error: 'Failed to load race data', isLoading: false }));
    }
  }, []);

  // Watch for new races being created
  useWatchContractEvent({
    address: useContractAddress() as `0x${string}`,
    abi: raceAbi,
    eventName: 'RaceCreated',
    onLogs(logs) {
      logs.forEach(async (log) => {
        const createdEvent = log as unknown as {
          args: {
            raceId: bigint;
          }
        };

        if (!createdEvent.args || !publicClient) return;

        try {
          // Fetch complete race info
          const raceInfo = await publicClient.readContract({
            address: useContractAddress() as `0x${string}`,
            abi: raceAbi,
            functionName: 'getRaceInfo',
            args: [createdEvent.args.raceId]
          }) as [bigint, string[], bigint[], bigint, boolean, boolean, bigint];

          // Parse and store new race with correct timestamp and details
          const newRace: RaceInfo = {
            id: createdEvent.args.raceId.toString(),
            isActive: raceInfo[4],
            players: raceInfo[1],
            critterIds: raceInfo[2].map(id => id.toString()),
            prizePool: raceInfo[6],
            startTime: Number(raceInfo[3]),
            raceStatus: raceInfo[5] ? 'ended' : raceInfo[4] ? 'active' : 'waiting',
            hasEnded: raceInfo[5],
            maxPlayers: 10, // This should match your contract's max players
            entryFee: BigInt(0), // This should be fetched from contract if available
            joinedPlayerDetails: {}
          };

          // Initialize joined player details if there are any players
          if (raceInfo[1].length > 0) {
            raceInfo[1].forEach((player, index) => {
              newRace.joinedPlayerDetails[player] = {
                critterId: raceInfo[2][index].toString(),
                joinedAt: Date.now(),
                powerUps: getPlayerPowerUps()
              };
            });
          }

          console.log('Processing new race:', {
            ...newRace,
            startTimeFormatted: parseContractTimestamp(newRace.startTime),
            timestamp: new Date().toISOString()
          });

          // Update state with the new race
          setState(prev => {
            // Remove any existing race with the same ID
            const filteredRaces = prev.activeRaces.filter(r => r.id !== newRace.id);
            const updatedRaces = [...filteredRaces, newRace];
            
            // Sort races by ID to maintain consistent order
            updatedRaces.sort((a, b) => Number(a.id) - Number(b.id));
            
            // Store in localStorage
            localStorage.setItem(STORAGE_KEYS.ACTIVE_RACES, JSON.stringify(updatedRaces));
            
            // If this is a new race, set it as current
            if (Number(newRace.id) > Number(prev.currentRace?.id || 0)) {
              localStorage.setItem(STORAGE_KEYS.CURRENT_RACE, JSON.stringify(newRace));
              return {
                ...prev,
                activeRaces: updatedRaces,
                currentRace: newRace
              };
            }

            return {
              ...prev,
              activeRaces: updatedRaces
            };
          });
        } catch (error) {
          console.error('Error processing new race:', error);
          setState(prev => ({ ...prev, error: 'Failed to process new race' }));
        }
      });
    }
  });

  // Watch for players joining races and power-ups being loaded
  useWatchContractEvent({
    address: useContractAddress() as `0x${string}`,
    abi: raceAbi,
    eventName: 'PlayerJoined',
    onLogs(logs) {
      logs.forEach(log => {
        const joinedEvent = log as unknown as {
          args: {
            raceId: bigint;
            player: string;
            critterId: bigint;
          }
        };

        if (!joinedEvent.args) return;

        setState(prev => {
          const updatedRaces = prev.activeRaces.map(race => {
            if (race.id === joinedEvent.args.raceId.toString()) {
              const updatedRace = {
                ...race,
                players: [...race.players, joinedEvent.args.player],
                critterIds: [...race.critterIds, joinedEvent.args.critterId.toString()],
                joinedPlayerDetails: {
                  ...race.joinedPlayerDetails,
                  [joinedEvent.args.player]: {
                    critterId: joinedEvent.args.critterId.toString(),
                    joinedAt: Date.now(),
                    powerUps: getPlayerPowerUps()
                  }
                }
              };

              // If this is the current race, update it in localStorage
              if (prev.currentRace?.id === race.id) {
                localStorage.setItem(STORAGE_KEYS.CURRENT_RACE, JSON.stringify(updatedRace));
              }

              return updatedRace;
            }
            return race;
          });

          localStorage.setItem(STORAGE_KEYS.ACTIVE_RACES, JSON.stringify(updatedRaces));
          
          return {
            ...prev,
            activeRaces: updatedRaces,
            currentRace: prev.currentRace?.id === joinedEvent.args.raceId.toString()
              ? updatedRaces.find(r => r.id === joinedEvent.args.raceId.toString()) || prev.currentRace
              : prev.currentRace
          };
        });
      });
    }
  });

  // Watch for power-ups being loaded
  useWatchContractEvent({
    address: useContractAddress() as `0x${string}`,
    abi: raceAbi,
    eventName: 'PowerUpLoaded',
    onLogs(logs) {
      logs.forEach(log => {
        const powerUpEvent = log as unknown as {
          args: {
            raceId: bigint;
            player: string;
            isSpeedBoost: boolean;
            amount: bigint;
          }
        };

        if (!powerUpEvent.args) return;

        setState(prev => {
          const updatedRaces = prev.activeRaces.map(race => {
            if (race.id === powerUpEvent.args.raceId.toString()) {
              // Update power-up data in localStorage
              const key = STORAGE_KEYS.RACE_POWERUPS(race.id, powerUpEvent.args.player);
              const storedData = localStorage.getItem(key);
              const powerUps = storedData ? JSON.parse(storedData) : {
                speedBoosts: 0,
                sabotages: 0,
                usedInRace: 0
              };

              if (powerUpEvent.args.isSpeedBoost) {
                powerUps.speedBoosts = Number(powerUpEvent.args.amount);
              } else {
                powerUps.sabotages = Number(powerUpEvent.args.amount);
              }

              localStorage.setItem(key, JSON.stringify(powerUps));

              // If this is the current race, update power-up state
              if (prev.currentRace?.id === race.id) {
                localStorage.setItem(key, JSON.stringify(powerUps));
              }

              return race;
            }
            return race;
          });

          return {
            ...prev,
            activeRaces: updatedRaces
          };
        });

        console.log('Power-up loaded:', {
          raceId: powerUpEvent.args.raceId.toString(),
          player: powerUpEvent.args.player,
          type: powerUpEvent.args.isSpeedBoost ? 'Speed Boost' : 'Sabotage',
          amount: powerUpEvent.args.amount.toString()
        });
      });
    }
  });

  // Add function to fetch and cache all race IDs
  const fetchAllRaceIds = useCallback(async () => {
    if (!publicClient) return [];

    try {
      // Check cache first
      const cachedIds = localStorage.getItem(STORAGE_KEYS.ALL_RACE_IDS);
      const lastCheck = localStorage.getItem('last_race_check');
      const CACHE_DURATION = 30 * 1000; // 30 seconds

      if (cachedIds && lastCheck && Date.now() - Number(lastCheck) < CACHE_DURATION) {
        return JSON.parse(cachedIds);
      }

      // Fetch current race ID from contract
      const currentRaceId = await publicClient.readContract({
        address: useContractAddress() as `0x${string}`,
        abi: raceAbi,
        functionName: 'currentRaceId'
      }) as bigint;

      // Generate array of all race IDs
      const raceIds = Array.from({ length: Number(currentRaceId) }, (_, i) => i + 1);
      
      // Cache the results
      localStorage.setItem(STORAGE_KEYS.ALL_RACE_IDS, JSON.stringify(raceIds));
      localStorage.setItem('last_race_check', Date.now().toString());
      localStorage.setItem(STORAGE_KEYS.LAST_CREATED_RACE, currentRaceId.toString());

      return raceIds;
    } catch (error) {
      console.error('Error fetching race IDs:', error);
      return [];
    }
  }, [publicClient]);

  // Add function to get last created race
  const getLastCreatedRace = useCallback(async (): Promise<string | null> => {
    const cached = localStorage.getItem(STORAGE_KEYS.LAST_CREATED_RACE);
    if (cached) return cached;

    const raceIds = await fetchAllRaceIds();
    return raceIds.length > 0 ? raceIds[raceIds.length - 1].toString() : null;
  }, [fetchAllRaceIds]);

  // Enhanced getWaitingRaceId function
  const getWaitingRaceId = useCallback(async (walletAddress?: string): Promise<string | null> => {
    if (!walletAddress || !publicClient) return null;

    try {
      // Check cached status first
      const cachedStatus = getWalletRaceStatus();
      if (cachedStatus?.activeRaceId && !isCacheStale(cachedStatus.lastUpdated)) {
        return cachedStatus.activeRaceId;
      }

      // Check cached waiting races
      const cachedWaitingRaces = localStorage.getItem(STORAGE_KEYS.WAITING_RACES);
      if (cachedWaitingRaces) {
        const waitingRaces = JSON.parse(cachedWaitingRaces);
        const userWaitingRace = waitingRaces.find((race: any) => 
          race.players.some((p: string) => p.toLowerCase() === walletAddress.toLowerCase())
        );
        if (userWaitingRace && !isCacheStale(userWaitingRace.lastUpdated)) {
          return userWaitingRace.id;
        }
      }

      // Fetch all race IDs if not in cache
      const raceIds = await fetchAllRaceIds();
      const waitingRaces: WaitingRace[] = [];

      // Check each race, starting from most recent
      for (const raceId of raceIds.reverse()) {
        const raceInfo = await publicClient.readContract({
          address: useContractAddress() as `0x${string}`,
          abi: raceAbi,
          functionName: 'getRaceInfo',
          args: [BigInt(raceId)]
        }) as [bigint, string[], bigint[], bigint, boolean, boolean, bigint];

        const race = {
          id: raceId.toString(),
          isActive: raceInfo[4],
          hasEnded: raceInfo[5],
          startTime: Number(raceInfo[3]),
          players: raceInfo[1],
          lastUpdated: Date.now()
        };

        // Check if this is a waiting race
        if (race.isActive && !race.hasEnded && race.startTime === 0) {
          waitingRaces.push(race);
          
          // Check if the wallet is in this race
          if (race.players.some(p => p.toLowerCase() === walletAddress.toLowerCase())) {
            // Update cache
            updateWalletRaceStatus({
              activeRaceId: race.id,
              status: 'waiting'
            });
            
            // Update waiting races cache
            localStorage.setItem(STORAGE_KEYS.WAITING_RACES, JSON.stringify(waitingRaces));
            
            return race.id;
          }
        }
      }

      // Update waiting races cache even if user's race wasn't found
      localStorage.setItem(STORAGE_KEYS.WAITING_RACES, JSON.stringify(waitingRaces));
      return null;

    } catch (error) {
      console.error('Error in getWaitingRaceId:', error);
      return null;
    }
  }, [publicClient, getWalletRaceStatus, updateWalletRaceStatus, fetchAllRaceIds]);

  // Update the fetchActiveRaces function to handle race validity
  const fetchActiveRaces = useCallback(async () => {
    if (!publicClient) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get wallet address
      const walletData = localStorage.getItem('wallet_address');
      const walletAddress = walletData ? JSON.parse(walletData).address : null;

      if (walletAddress) {
        // First check if user is in a waiting race
        const waitingRaceId = await getWaitingRaceId(walletAddress);
        if (waitingRaceId) {
          const raceInfo = await publicClient.readContract({
            address: useContractAddress() as `0x${string}`,
            abi: raceAbi,
            functionName: 'getRaceInfo',
            args: [BigInt(waitingRaceId)]
          }) as [bigint, string[], bigint[], bigint, boolean, boolean, bigint];

          if (raceInfo[4]) { // isActive
            const race: RaceInfo = {
              id: waitingRaceId,
              isActive: raceInfo[4],
              players: raceInfo[1],
              critterIds: raceInfo[2].map(id => id.toString()),
              startTime: Number(raceInfo[3]),
              prizePool: raceInfo[6],
              raceStatus: raceInfo[5] ? 'ended' : raceInfo[4] ? 'active' : 'waiting',
              hasEnded: raceInfo[5],
              maxPlayers: 10,
              entryFee: BigInt(0),
              joinedPlayerDetails: {}
            };

            if (isValidRace(race)) {
              // Initialize joined player details
              raceInfo[1].forEach((player: string, index: number) => {
                race.joinedPlayerDetails[player] = {
                  critterId: raceInfo[2][index].toString(),
                  joinedAt: Date.now(),
                  powerUps: getPlayerPowerUps()
                };
              });

              setState(prev => ({
                ...prev,
                activeRaces: [race],
                currentRace: race,
                isLoading: false
              }));

              localStorage.setItem(STORAGE_KEYS.ACTIVE_RACES, JSON.stringify([race]));
              localStorage.setItem(STORAGE_KEYS.CURRENT_RACE, JSON.stringify(race));
              return;
            }
          }
        }

        // If no waiting race, get the last created race
        const lastCreatedRaceId = await getLastCreatedRace();
        if (lastCreatedRaceId) {
          const raceInfo = await publicClient.readContract({
            address: useContractAddress() as `0x${string}`,
            abi: raceAbi,
            functionName: 'getRaceInfo',
            args: [BigInt(lastCreatedRaceId)]
          }) as [bigint, string[], bigint[], bigint, boolean, boolean, bigint];

          if (raceInfo[4]) { // isActive
            const race: RaceInfo = {
              id: lastCreatedRaceId,
              isActive: raceInfo[4],
              players: raceInfo[1],
              critterIds: raceInfo[2].map(id => id.toString()),
              startTime: Number(raceInfo[3]),
              prizePool: raceInfo[6],
              raceStatus: raceInfo[5] ? 'ended' : raceInfo[4] ? 'active' : 'waiting',
              hasEnded: raceInfo[5],
              maxPlayers: 10,
              entryFee: BigInt(0),
              joinedPlayerDetails: {}
            };

            if (isValidRace(race)) {
              // Initialize joined player details
              raceInfo[1].forEach((player: string, index: number) => {
                race.joinedPlayerDetails[player] = {
                  critterId: raceInfo[2][index].toString(),
                  joinedAt: Date.now(),
                  powerUps: getPlayerPowerUps()
                };
              });

              setState(prev => ({
                ...prev,
                activeRaces: [race],
                currentRace: race,
                isLoading: false
              }));

              localStorage.setItem(STORAGE_KEYS.ACTIVE_RACES, JSON.stringify([race]));
              localStorage.setItem(STORAGE_KEYS.CURRENT_RACE, JSON.stringify(race));
              return;
            }
          }
        }
      }

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Error fetching active races:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch active races',
        isLoading: false
      }));
    }
  }, [publicClient, getWaitingRaceId, getLastCreatedRace]);

  // Function to set current race
  const setCurrentRace = useCallback((raceId: string) => {
    setState(prev => {
      const race = prev.activeRaces.find(r => r.id === raceId);
      if (race) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_RACE, JSON.stringify(race));
        return { ...prev, currentRace: race };
      }
      return prev;
    });
  }, []);

  // Add race management functions
  const startRaceLoop = useCallback(() => {
    setState(prev => ({
      ...prev,
      raceState: {
        ...prev.raceState,
        raceStatus: 'inProgress'
      }
    }));
  }, []);

  const stopRaceLoop = useCallback(() => {
    setState(prev => ({
      ...prev,
      raceState: {
        ...prev.raceState,
        raceStatus: 'finished'
      }
    }));
  }, []);

  const applyPowerUp = useCallback((type: 'speedBoost' | 'sabotage', targetId?: string) => {
    setState(prev => ({
      ...prev,
      raceState: {
        ...prev.raceState,
        players: prev.raceState.players.map(player => {
          if (type === 'speedBoost' && !targetId) {
            // Apply speed boost to current player
            return {
              ...player,
              critter: {
                ...player.critter,
                currentSpeed: player.critter.currentSpeed * 1.2
              }
            };
          } else if (type === 'sabotage' && targetId === player.id) {
            // Apply sabotage to target player
            return {
              ...player,
              critter: {
                ...player.critter,
                currentSpeed: player.critter.currentSpeed * 0.8
              }
            };
          }
          return player;
        })
      }
    }));
  }, []);

  const getCurrentPlayer = useCallback(() => {
    // Get current player's wallet address
    const walletData = localStorage.getItem('wallet_address');
    if (!walletData) return null;

    const { address } = JSON.parse(walletData);
    return state.raceState.players.find(player => player.address.toLowerCase() === address.toLowerCase()) || null;
  }, [state.raceState.players]);

  const getPlayerRank = useCallback((playerId: string) => {
    const sortedPlayers = [...state.raceState.players].sort((a, b) => b.critter.position - a.critter.position);
    return sortedPlayers.findIndex(player => player.id === playerId) + 1;
  }, [state.raceState.players]);

  // Update validation functions to use cached wallet status
  const canJoinCurrentRace = useCallback((): JoinRaceValidation => {
    const walletData = localStorage.getItem('wallet_address');
    const playerAddress = walletData ? JSON.parse(walletData).address : undefined;
    
    // Check cached status first
    const cachedStatus = getWalletRaceStatus();
    if (cachedStatus && cachedStatus.activeRaceId) {
      return {
        canJoin: false,
        reason: `You are already in Race #${cachedStatus.activeRaceId}`,
        activeRaceId: cachedStatus.activeRaceId
      };
    }

    return validateRaceJoin(state.currentRace, playerAddress);
  }, [state.currentRace, getWalletRaceStatus]);

  // Update canCreateRace to use cached wallet status
  const canCreateRace = useCallback((): CreateRaceValidation => {
    const walletData = localStorage.getItem('wallet_address');
    const playerAddress = walletData ? JSON.parse(walletData).address : undefined;

    // Check cached status first
    const cachedStatus = getWalletRaceStatus();
    if (cachedStatus && cachedStatus.activeRaceId) {
      return {
        canCreate: false,
        reason: `You are already in Race #${cachedStatus.activeRaceId}`,
        activeRaceId: cachedStatus.activeRaceId
      };
    }

    return validateRaceCreation(state.activeRaces, playerAddress, state.currentRace);
  }, [state.activeRaces, state.currentRace, getWalletRaceStatus]);

  const setRaceCache = (raceId: string, data: any) => {
    try {
      // Custom BigInt serializer
      const serializableData = JSON.parse(JSON.stringify(data, (key, value) => {
        // Convert BigInt to string with 'n' suffix to identify it during parsing
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      }));

      const cacheData = {
        ...serializableData,
        lastUpdated: Date.now()
      };
      localStorage.setItem(RACE_CACHE_KEYS.RACE_DATA(raceId), JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting race cache:', error);
    }
  };

  // Update getRaceCache to handle BigInt deserialization
  const getRaceCache = (raceId: string) => {
    try {
      const data = localStorage.getItem(RACE_CACHE_KEYS.RACE_DATA(raceId));
      if (!data) return null;
      
      // Parse with BigInt revival
      const parsed = JSON.parse(data, (key, value) => {
        // Convert string with 'n' suffix back to BigInt
        if (typeof value === 'string' && value.endsWith('n')) {
          return BigInt(value.slice(0, -1));
        }
        return value;
      });

      const now = Date.now();
      const cacheDuration = parsed.raceStatus === 'waiting' 
        ? RACE_CACHE_DURATION.WAITING 
        : parsed.raceStatus === 'completed' 
          ? RACE_CACHE_DURATION.COMPLETED 
          : RACE_CACHE_DURATION.ACTIVE;
      
      if (now - parsed.lastUpdated > cacheDuration) {
        localStorage.removeItem(RACE_CACHE_KEYS.RACE_DATA(raceId));
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Error reading race cache:', error);
      return null;
    }
  };

  return {
    ...state,
    fetchActiveRaces,
    setCurrentRace,
    startRaceLoop,
    stopRaceLoop,
    applyPowerUp,
    getCurrentPlayer,
    getPlayerRank,
    canJoinCurrentRace,
    canCreateRace,
    getWaitingRaceId,
    getLastCreatedRace,
    fetchAllRaceIds,
    setRaceCache,
    getRaceCache,
    updateState: (newState: RaceState) => {
      setState(prev => ({
        ...prev,
        raceState: newState
      }));
    }
  };
} 