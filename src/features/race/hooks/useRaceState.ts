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
      // Enhanced error handling for insufficient funds
      if (
        error?.message?.toLowerCase().includes('insufficient funds') ||
        error?.message?.toLowerCase().includes('insufficient balance') ||
        error?.reason?.toLowerCase().includes('insufficient') ||
        error?.details?.toLowerCase().includes('insufficient')
      ) {
        toast.error('Insufficient funds to complete this transaction.', { 
          id: toastId,
          duration: 5000 // Show for 5 seconds
        });
      } else {
        const message = error?.reason || error?.message || 'Transaction failed';
        toast.error(message, { id: toastId });
      }
      throw error;
    }
  };

  return { contract, wrapWithErrorHandler };
};

// Update constants
const RACE_DATA_CACHE_KEY = 'race_data_cache';
const RACE_DATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_DEBOUNCE_DELAY = 5000; // 5 seconds debounce
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
  const backgroundDataRef = useRef<RaceInfo[]>([]);
  const isInitialLoadRef = useRef(true);

  const fetchRaces = useCallback(async (force = false, isBackground = false) => {
    if (!publicClient) return;

    const now = Date.now();
    if (!force && now - lastFetchRef.current < FETCH_DEBOUNCE_DELAY) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => fetchRaces(true, isBackground), FETCH_DEBOUNCE_DELAY);
      return;
    }

    try {
      // Only show loading state on initial load
      if (!isBackground && isInitialLoadRef.current) {
        setLoading(true);
      }
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
            if (!isBackground) {
              setRaces(parsedCache.data);
            } else {
              backgroundDataRef.current = parsedCache.data;
            }
            if (isInitialLoadRef.current) {
              setLoading(false);
              isInitialLoadRef.current = false;
            }
            // Schedule a background refresh if cache is older than half its duration
            if (Date.now() - parsedCache.timestamp > RACE_DATA_CACHE_DURATION / 2) {
              setTimeout(() => fetchRaces(true, true), 1000);
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
          if (error?.message?.includes('429') || error?.message?.includes('400')) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const formattedRaces = allRaces
        .filter((race): race is RawRaceData => Boolean(race && race.id))
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
        if (!isBackground) {
          setRaces(formattedRaces);
        } else {
          // Store background data and only update UI if there are meaningful changes
          const hasChanges = JSON.stringify(formattedRaces) !== JSON.stringify(races);
          if (hasChanges) {
            backgroundDataRef.current = formattedRaces;
            // Use requestAnimationFrame to smoothly update UI
            requestAnimationFrame(() => {
              setRaces(formattedRaces);
            });
          }
        }
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
      }

    } catch (error: any) {
      console.error('Error fetching races:', error);
      if (error?.message?.includes('429') || error?.message?.includes('400')) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => fetchRaces(true, true), retryDelay);
        } else if (!isBackground) {
          toast.error('Too many requests. Please try again later.');
        }
      } else if (!isBackground) {
        toast.error('Failed to fetch races. Using cached data if available.');
      }
    } finally {
      if (!isBackground && isInitialLoadRef.current) {
        setLoading(false);
        isInitialLoadRef.current = false;
      }
    }
  }, [contract, publicClient, retryCount, races]);

  useEffect(() => {
    if (!publicClient) return;
    
    // Initial fetch
    fetchRaces(false, false);

    // Set up polling interval for background updates
    const pollInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastFetchRef.current >= FETCH_DEBOUNCE_DELAY) {
        fetchRaces(true, true);
      }
    }, POLLING_INTERVAL);

    // Watch for race events in the background
    const unwatch = publicClient.watchContractEvent({
      ...contract,
      eventName: 'RaceEnded',
      onLogs: () => {
        const now = Date.now();
        if (now - lastFetchRef.current >= FETCH_DEBOUNCE_DELAY) {
          fetchRaces(true, true);
        }
      }
    });

    return () => {
      clearInterval(pollInterval);
      unwatch();
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [contract, publicClient, fetchRaces]);

  // Expose a function to force a UI refresh from background data
  const forceRefresh = useCallback(() => {
    if (backgroundDataRef.current.length > 0) {
      setRaces(backgroundDataRef.current);
    }
  }, []);

  return { 
    races, 
    loading, 
    refreshRaces: () => fetchRaces(true, false),
    forceRefresh 
  };
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
    if (!walletClient) {
      toast.error('Please connect your wallet first.');
      return;
    }

    if (!address) {
      toast.error('No wallet address found.');
      return;
    }

    if (!publicClient) {
      toast.error('Network connection error.');
      return;
    }

    const cost = parseEther('0.01') * BigInt(amount); // 0.01 ETH per power-up

    try {
      // Check balance before attempting purchase
      const balance = await publicClient.getBalance({ address });
      if (balance < cost) {
        toast.error(
          `Insufficient funds. You need ${(Number(cost) / 1e18).toFixed(3)} ETH to purchase ${amount} boost${amount > 1 ? 's' : ''}.`, 
          { duration: 5000 }
        );
        return;
      }

      return wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'buyPowerUps',
          args: [BigInt(amount)],
          value: cost
        }),
        'Purchasing power-ups...'
      );
    } catch (error: any) {
      // Additional error handling specific to power-up purchase
      if (error?.message?.toLowerCase().includes('insufficient funds')) {
        toast.error(
          `Insufficient funds. You need ${(Number(cost) / 1e18).toFixed(3)} ETH to purchase ${amount} boost${amount > 1 ? 's' : ''}.`,
          { duration: 5000 }
        );
      }
      throw error;
    }
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
