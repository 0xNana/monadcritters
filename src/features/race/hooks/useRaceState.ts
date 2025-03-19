import { useState, useEffect, useCallback, useRef } from 'react';
import { useDeployContract, usePublicClient, useSignMessage, useAccount, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { toast } from 'react-hot-toast';
import { RaceSize, RaceInfo, RaceType, RaceResult, PlayerStats } from '../../../contracts/CritterRace/types';
import { abi as RACE_ABI } from '../../../contracts/CritterRace/abi';
import { contracts } from '../../../utils/config';
import { useChainId } from 'wagmi';

// Get contract address
function useContractAddress() {
  return contracts.monad.race;
}

// Base contract hook
export const useRaceContract = () => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const contract = {
    address: useContractAddress() as `0x${string}`,
    abi: RACE_ABI,
  };

  const wrapWithErrorHandler = async <T>(
    promise: Promise<T>,
    pendingMessage: string
  ): Promise<T> => {
    const toastId = toast.loading(pendingMessage);
    try {
      const result = await promise;
      toast.success('Transaction successful!', { id: toastId });
      return result;
    } catch (error: any) {
      console.error('Contract Error:', error);
      const message = error?.reason || error?.message || 'Transaction failed';
      toast.error(message, { id: toastId });
      throw error;
    }
  };

  return { contract, wrapWithErrorHandler };
};

// Update constants
const RACE_DATA_CACHE_KEY = 'race_data_cache';
const RACE_DATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_DEBOUNCE_DELAY = 15000; // 15 seconds debounce
const POLLING_INTERVAL = 30000; // 30 seconds polling
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

interface RaceDataCache {
  timestamp: number;
  data: RaceInfo[];
  lastFetchedBlock: bigint;
}

// Add type for raw race data
interface RawRaceData {
  id: bigint;
  raceSize: number;
  players: readonly `0x${string}`[];
  critterIds: readonly bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: bigint;
}

// Race data hook
export const useRaceData = () => {
  const { contract } = useRaceContract();
  const publicClient = usePublicClient();
  const [races, setRaces] = useState<RaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const lastFetchRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRaces = useCallback(async (force = false) => {
    if (!publicClient) return;

    const now = Date.now();
    if (!force && now - lastFetchRef.current < FETCH_DEBOUNCE_DELAY) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => fetchRaces(true), FETCH_DEBOUNCE_DELAY);
      return;
    }

    try {
      setLoading(true);
      lastFetchRef.current = now;

      // Try to get from cache first
      const cached = localStorage.getItem(RACE_DATA_CACHE_KEY);
      if (cached && !force) {
        try {
          const parsedCache = JSON.parse(cached, (key, value) => {
            if (typeof value === 'string' && /^\d+$/.test(value)) {
              try {
                return BigInt(value);
              } catch {
                return value;
              }
            }
            return value;
          }) as RaceDataCache;

          if (Date.now() - parsedCache.timestamp < RACE_DATA_CACHE_DURATION) {
            setRaces(parsedCache.data);
            setLoading(false);
            // Schedule a background refresh if cache is older than half its duration
            if (Date.now() - parsedCache.timestamp > RACE_DATA_CACHE_DURATION / 2) {
              setTimeout(() => fetchRaces(true), 1000);
            }
            return;
          }
        } catch (error) {
          console.error('Error parsing cache:', error);
        }
      }

      // Fetch races for each size sequentially to ensure proper data format
      const allRaces: RawRaceData[] = [];
      for (const size of [RaceSize.Two, RaceSize.Five, RaceSize.Ten]) {
        try {
          const result = await publicClient.readContract({
            ...contract,
            functionName: 'getActiveRaces',
            args: [size]
          }) as RawRaceData[];
          
          if (Array.isArray(result)) {
            allRaces.push(...result);
          }
        } catch (error: any) {
          console.error(`Error fetching races for size ${size}:`, error);
          // Don't break the loop on error, continue with other sizes
          if (error?.message?.includes('429') || error?.message?.includes('400')) {
            // Wait before trying next size
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const formattedRaces = allRaces
        .filter((race): race is RawRaceData => Boolean(race && race.id)) // Type guard to ensure valid races
        .map(race => ({
          id: race.id,
          raceSize: race.raceSize as RaceSize,
          playerCount: BigInt(race.players.length),
          players: [...race.players],
          critterIds: [...race.critterIds],
          startTime: race.startTime,
          isActive: race.isActive,
          hasEnded: race.hasEnded,
          prizePool: race.prizePool
        }));

      if (formattedRaces.length > 0) {
        setRaces(formattedRaces);
        setRetryCount(0);

        // Cache the results
        try {
          const cache: RaceDataCache = {
            timestamp: Date.now(),
            data: formattedRaces,
            lastFetchedBlock: await publicClient.getBlockNumber()
          };
          const serializedCache = JSON.stringify(cache, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          );
          localStorage.setItem(RACE_DATA_CACHE_KEY, serializedCache);
        } catch (error) {
          console.error('Error caching race data:', error);
        }
      } else if (cached) {
        // If no new data but we have cache, keep using it
        const parsedCache = JSON.parse(cached, (key, value) => {
          if (typeof value === 'string' && /^\d+$/.test(value)) {
            try {
              return BigInt(value);
            } catch {
              return value;
            }
          }
          return value;
        }) as RaceDataCache;
        setRaces(parsedCache.data);
      }

    } catch (error: any) {
      console.error('Error fetching races:', error);
      // Handle rate limiting with exponential backoff
      if (error?.message?.includes('429') || error?.message?.includes('400')) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => fetchRaces(true), retryDelay);
        } else {
          toast.error('Too many requests. Please try again later.');
        }
      } else {
        toast.error('Failed to fetch races. Using cached data if available.');
      }
    } finally {
      setLoading(false);
    }
  }, [contract, publicClient, retryCount]);

  useEffect(() => {
    if (!publicClient) return;
    
    fetchRaces();

    // Set up polling interval
    const pollInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastFetchRef.current >= FETCH_DEBOUNCE_DELAY) {
        fetchRaces(true);
      }
    }, POLLING_INTERVAL);

    // Single event handler for all events
    const unwatch = publicClient.watchContractEvent({
      ...contract,
      eventName: 'RaceEnded', // Only watch for race end events
      onLogs: () => {
        const now = Date.now();
        if (now - lastFetchRef.current >= FETCH_DEBOUNCE_DELAY) {
          fetchRaces(true);
        }
      }
    });

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      unwatch();
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [contract, publicClient, fetchRaces]);

  return { races, loading, refreshRaces: () => fetchRaces(true) };
};

// Race actions hook
export const useRaceActions = () => {
  const [processing, setProcessing] = useState(false);
  const { contract, wrapWithErrorHandler } = useRaceContract();
  const { data: walletClient } = useWalletClient();

  const startRace = useCallback(async (raceId: number) => {
    if (!walletClient || !contract) throw new Error('Contract not initialized');
    
    try {
      setProcessing(true);
      await wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'startRaceExternal',
          args: [BigInt(raceId)]
        }),
        'Starting race...'
      );
    } finally {
      setProcessing(false);
    }
  }, [walletClient, contract, wrapWithErrorHandler]);

  const endRace = useCallback(async (raceId: number) => {
    if (!walletClient || !contract) throw new Error('Contract not initialized');
    
    try {
      setProcessing(true);
      await wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'endRace',
          args: [BigInt(raceId)]
        }),
        'Processing race results...'
      );
    } finally {
      setProcessing(false);
    }
  }, [walletClient, contract, wrapWithErrorHandler]);

  return {
    startRace,
    endRace,
    processing
  };
};

// Power-ups hook
export const usePowerUps = () => {
  const { contract, wrapWithErrorHandler } = useRaceContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [speedBoosts, setSpeedBoosts] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPowerUps = async () => {
    if (!address || !publicClient) return;
    try {
      setLoading(true);
      const boosts = await publicClient.readContract({
        ...contract,
        functionName: 'playerInventory_SpeedBoost',
        args: [address]
      });
      setSpeedBoosts(Number(boosts));
    } catch (error) {
      console.error('Error fetching power-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const buyPowerUps = async (amount: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    const cost = parseEther('0.01') * BigInt(amount); // Assuming 0.01 ETH per power-up
    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'buyPowerUps',
        args: [BigInt(amount)],
        value: cost
      }),
      'Purchasing power-ups...'
    );
  };

  useEffect(() => {
    if (!publicClient) return;
    
    fetchPowerUps();
    
    // Watch for power-up purchase events
    const unwatch = publicClient.watchContractEvent({
      ...contract,
      eventName: 'PowerUpsPurchased',
      args: { player: address },
      onLogs: fetchPowerUps
    });
    
    return () => {
      unwatch();
    };
  }, [address, contract, publicClient]);

  return { speedBoosts, loading, buyPowerUps, refreshPowerUps: fetchPowerUps };
};

// Critters hook
interface CritterStats {
  speed: number;
  stamina: number;
  luck: number;
}

interface Critter {
  id: number;
  stats: CritterStats;
}

export const useCritters = () => {
  const { contract } = useRaceContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [critters, setCritters] = useState<Critter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCritters = async () => {
    if (!address || !publicClient) return;
    try {
      setLoading(true);
      // Note: This is a mock implementation since the actual contract doesn't have getUserCritters
      // You'll need to implement the actual contract call based on your contract's interface
      const mockCritterIds = [1n, 2n, 3n]; // Replace with actual contract call
      
      const critterData = await Promise.all(
        mockCritterIds.map(async (id) => ({
          id: Number(id),
          stats: {
            speed: 10,
            stamina: 10,
            luck: 10
          }
        }))
      );
      setCritters(critterData);
    } catch (error) {
      console.error('Error fetching critters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCritters();
  }, [address, contract]);

  return { critters, loading, refreshCritters: fetchCritters };
};
