import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveRaces, useRaceInfo, useRaceEvents } from '../../../contracts/CritterRace/hooks';
import { useRaceProgress } from '../hooks/useRaceProgress';
import { RaceSize } from '../../../contracts/CritterRace/types';
import { useAccount, useWriteContract, useReadContract, useChainId, usePublicClient } from 'wagmi';
import { contracts, QUERY_CONFIG, CACHE_CONFIG } from '../../../utils/config';
import { abi } from '../../../contracts/CritterRace/abi';
import { formatUnits } from 'ethers';
import { useRaceContract, useRaceData, useRaceActions } from '../hooks/useRaceState';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import CountdownTimer from './CountdownTimer';
import ResultsModal from './ResultsModal';


type RaceProgressStatus = 'ready' | 'racing' | 'complete';

enum RaceStatus {
  Active = 'Active',
  Completed = 'Completed'
}

interface RaceParticipant {
  player: `0x${string}`;
  tokenId: bigint;
}

interface Player {
  wallet: string;
  score: bigint;
  position: number;
  reward: bigint;
  isUser?: boolean;
}

interface Race {
  id: bigint;
  size: number;
  currentPlayers: number;
  status: RaceStatus;
  startTime?: Date;
  endTime?: Date;
  results?: {
    player: `0x${string}`;
    position: bigint;
    score: bigint;
    reward: bigint;
  }[];
  progressStatus?: RaceProgressStatus;
  raceStartedAt?: number;
  participants?: RaceParticipant[];
  players: readonly `0x${string}`[];
  hasEnded: boolean;
  raceSize?: RaceSize;
  maxPlayers?: number;
}

interface ProcessingState {
  raceId: bigint;
  loading: boolean;
  endingRaces: Set<string>;  // Track races that are being ended
}

interface ProcessingStage {
  stage: 'completing' | 'calculating' | 'distributing' | 'finalizing';
  progress: number;
}

interface RaceStats {
  totalPrizePool: bigint;
  highestScore: bigint;
  averageScore: number;
  participantCount: number;
  duration: number;
}

interface LeaderboardEntry {
  player: `0x${string}`;
  position: bigint;
  score: bigint;
  reward: bigint;
}

interface StartStage {
  stage: 'initializing' | 'positioning' | 'warming' | 'starting';
  progress: number;
}

const RACE_DURATION = 30; // Race duration in seconds
const PROCESSING_DURATION = 10000; // Processing duration in milliseconds
const RACE_START_COUNTDOWN = 30; // 30 seconds countdown

// Cache constants
const CACHE_KEYS = {
  ACTIVE_RACES: (raceSize: RaceSize) => `active_races_${raceSize}`,
  RACE_INFO: (raceId: bigint) => `race_info_${raceId}`,
  RACE_RESULTS: (raceId: bigint) => `race_results_${raceId}`,
  RACE_STATS: (raceId: bigint) => `race_stats_${raceId}`
} as const;

// Memory cache with improved typing
const memoryCache = new Map<string, { 
  data: any; 
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  expiresAt: number;
}>();

// Add BigInt serialization helpers
const serializeBigInt = (obj: any): any => {
  if (typeof obj === 'bigint') {
    return { __type: 'BigInt', value: obj.toString() };
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  if (obj && typeof obj === 'object') {
    const result: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
};

const deserializeBigInt = (obj: any): any => {
  if (obj && obj.__type === 'BigInt') {
    return BigInt(obj.value);
  }
  if (Array.isArray(obj)) {
    return obj.map(deserializeBigInt);
  }
  if (obj && typeof obj === 'object') {
    const result: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeBigInt(value);
    }
    return result;
  }
  return obj;
};

// Cache utility functions with improved performance and BigInt handling
const getFromCache = <T,>(key: string, duration = CACHE_CONFIG.DURATION.SHORT): T | null => {
  try {
    const now = Date.now();
    const memCached = memoryCache.get(key);
    
    if (memCached) {
      // Check if cache is still valid
      if (now < memCached.expiresAt) {
        // Update access stats
        memCached.lastAccessed = now;
        memCached.accessCount++;
        return memCached.data as T;
      }
      memoryCache.delete(key);
    }

    // Try localStorage with prefetch optimization
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (now - timestamp > duration) {
      localStorage.removeItem(key);
      return null;
    }

    // Deserialize and store in memory cache
    const deserializedData = deserializeBigInt(data);
    setInMemoryCache(key, deserializedData, duration);
    
    // Setup prefetch if needed
    const timeUntilExpiry = timestamp + duration - now;
    if (timeUntilExpiry <= duration * CACHE_CONFIG.PREFETCH.THRESHOLD) {
      prefetchManager.add(key);
    }
    
    return deserializedData as T;
  } catch {
    return null;
  }
};

const setInMemoryCache = <T,>(key: string, data: T, duration = CACHE_CONFIG.DURATION.SHORT) => {
  const now = Date.now();
  memoryCache.set(key, {
    data,
    timestamp: now,
    lastAccessed: now,
    accessCount: 1,
    expiresAt: now + duration
  });
};

// Prefetch manager with rate limiting
const prefetchManager = {
  queue: new Set<string>(),
  isRunning: false,
  lastFetch: 0,

  add(key: string) {
    this.queue.add(key);
    if (!this.isRunning && CACHE_CONFIG.PREFETCH.ENABLED) {
      this.start();
    }
  },

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.queue.size > 0) {
      const now = Date.now();
      const timeSinceLastFetch = now - this.lastFetch;
      
      if (timeSinceLastFetch < CACHE_CONFIG.BATCH.INTERVAL) {
        await new Promise(resolve => 
          setTimeout(resolve, CACHE_CONFIG.BATCH.INTERVAL - timeSinceLastFetch)
        );
      }

      const keys = Array.from(this.queue).slice(0, CACHE_CONFIG.BATCH.SIZE);
      keys.forEach(key => this.queue.delete(key));

      try {
        await Promise.all(keys.map(key => this.prefetchItem(key)));
        this.lastFetch = Date.now();
      } catch (error) {
        console.error('Error in prefetch batch:', error);
        await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.RETRY.BASE_DELAY));
      }
    }

    this.isRunning = false;
  },

  async prefetchItem(key: string) {
    if (key.startsWith('race_info_')) {
      const raceId = BigInt(key.replace('race_info_', ''));
      // Add prefetch logic here
    }
  }
};

// Add helper function to convert RaceSize to player count
const getRaceSizeMaxPlayers = (raceSize: RaceSize): number => {
  switch (raceSize) {
    case RaceSize.Two:
      return 2;
    case RaceSize.Five:
      return 5;
    case RaceSize.Ten:
      return 10;
    default:
      return 0;
  }
};

// Helper functions
const formatTimeSpan = (date: Date | number | undefined) => {
  if (!date) return 'Time unavailable';
  
  const timestamp = date instanceof Date ? date.getTime() : 
                   typeof date === 'number' ? (date < 1e12 ? date * 1000 : date) : 
                   Date.now();
  const now = Date.now();
  const diff = now - timestamp;
  
  // Return immediately if in the future
  if (diff < 0) return 'Time unavailable';
  
  const seconds = Math.floor(diff / 1000);
  
  // Use more granular time display
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

// Custom debounce implementation
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Add batch update manager
const batchManager = {
  queue: new Set<bigint>(),
  timeout: null as NodeJS.Timeout | null,
  
  add(raceId: bigint) {
    this.queue.add(raceId);
    if (!this.timeout) {
      this.timeout = setTimeout(() => this.process(), CACHE_CONFIG.BATCH.INTERVAL);
    }
  },
  
  async process() {
    if (this.queue.size === 0) {
      this.timeout = null;
      return;
    }
    
    const batch = Array.from(this.queue);
    this.queue.clear();
    this.timeout = null;
    
    try {
      await Promise.all(batch.map(raceId => debouncedProcessRace(raceId)));
    } catch (error) {
      console.error('Error processing race batch:', error);
    }
  }
};

// Add a helper function to convert RaceInfo to Race
const convertRaceInfoToRace = (raceInfo: any): Race => {
  // Ensure raceSize is properly typed as RaceSize enum
  const raceSize = Number(raceInfo.raceSize) as RaceSize;
  const maxPlayers = getRaceSizeMaxPlayers(raceSize);
  const currentPlayers = raceInfo.players.filter(
    (p: string) => p !== '0x0000000000000000000000000000000000000000'
  ).length;

  let progressStatus: RaceProgressStatus = 'ready';
  if (raceInfo.hasEnded) {
    progressStatus = 'complete';
  } else if (raceInfo.startTime && Number(raceInfo.startTime) > 0) {
    progressStatus = 'racing';
  }

  // Convert timestamps to Date objects
  const startTimestamp = raceInfo.startTime ? Number(raceInfo.startTime) * 1000 : undefined;
  const startTime = startTimestamp ? new Date(startTimestamp) : undefined;
  
  // Set endTime based on raceInfo.endTime if available, otherwise calculate from startTime + RACE_DURATION
  let endTime;
  if (raceInfo.hasEnded) {
    if (raceInfo.endTime) {
      endTime = new Date(Number(raceInfo.endTime) * 1000);
    } else if (startTime) {
      // If no endTime but we have startTime, add RACE_DURATION
      endTime = new Date(startTime.getTime() + RACE_DURATION * 1000);
    }
  }

  return {
    id: raceInfo.id,
    size: maxPlayers,
    currentPlayers,
    status: raceInfo.hasEnded ? RaceStatus.Completed : RaceStatus.Active,
    startTime,
    endTime,
    participants: raceInfo.players.map((player: string, index: number) => ({
      player: player as `0x${string}`,
      tokenId: raceInfo.critterIds[index]
    })),
    progressStatus,
    players: raceInfo.players,
    hasEnded: raceInfo.hasEnded,
    raceSize: raceSize,
    maxPlayers
  };
};

// Add race size specific caching
const RACE_CACHE_KEY = 'race_size_cache';
const RACE_CACHE_DURATION = 30000; // 30 seconds

// Add this interface for our cache structure
interface RaceSizeCache {
  timestamp: number;
  races: {
    [RaceSize.Two]: Race[];
    [RaceSize.Five]: Race[];
    [RaceSize.Ten]: Race[];
  };
}

// Add a function to organize races by size
const organizeRacesBySize = (races: Race[]): RaceSizeCache['races'] => {
  const organized = {
    [RaceSize.Two]: [] as Race[],
    [RaceSize.Five]: [] as Race[],
    [RaceSize.Ten]: [] as Race[]
  };

  races.forEach(race => {
    if (race.raceSize) {
      organized[race.raceSize as RaceSize].push(race);
    }
  });

  return organized;
};

// Add this helper function to format race results
const formatRaceResults = (raceResults: any) => {
  if (!raceResults) return [];
  
  return raceResults.map((result: any, index: number) => ({
    player: result.player,
    score: Number(result.score),
    finalPosition: index + 1,
    reward: Number(formatUnits(result.reward || '0', 18))
  }));
};

// Add this near the top with other interfaces
interface CachedRaceResults {
  timestamp: number;
  results: LeaderboardEntry[];
}

// Add this with other cache constants
const RACE_RESULTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Add this near other cache utilities
const raceResultsCache = new Map<string, CachedRaceResults>();

// Add contract response type
interface ContractRaceResult {
  player: string;
  position: number;
  score: bigint;
  reward: bigint;
}

// Update the getRaceResults function to handle type conversions
const getRaceResults = async (raceId: bigint, publicClient: any, attempt = 1, maxAttempts = 5): Promise<LeaderboardEntry[]> => {
  const cacheKey = `race_results_${raceId}`;
  const cached = raceResultsCache.get(cacheKey);
  
  // Return cached results if they're still valid
  if (cached && Date.now() - cached.timestamp < RACE_RESULTS_CACHE_DURATION) {
    return cached.results;
  }
  
  try {
    // Use the getRaceLeaderboard function from the contract
    const results = await publicClient.readContract({
      address: contracts.monad.race as `0x${string}`,
      abi,
      functionName: 'getRaceLeaderboard',
      args: [raceId]
    }) as ContractRaceResult[];
    
    // If results array is empty and we haven't exceeded max attempts, retry
    if ((!results || results.length === 0) && attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.log(`Results not ready, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return getRaceResults(raceId, publicClient, attempt + 1, maxAttempts);
    }
    
    // Convert contract results to LeaderboardEntry type
    const convertedResults = results.map(result => ({
      player: result.player as `0x${string}`,
      position: BigInt(result.position),
      score: result.score,
      reward: result.reward
    }));
    
    // Cache the results if we have them
    if (convertedResults.length > 0) {
      raceResultsCache.set(cacheKey, {
        timestamp: Date.now(),
        results: convertedResults
      });
    }
    
    return convertedResults;
  } catch (error) {
    console.error('Error fetching race results:', error);
    
    if (attempt < maxAttempts && error instanceof Error && 
        (error.message.includes('still calculating') || error.message.includes('not found'))) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.log(`Results still calculating, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return getRaceResults(raceId, publicClient, attempt + 1, maxAttempts);
    }
    
    return cached?.results || [];
  }
};

// Add this new component before the main RaceView component
const RaceProgress = ({ race, onEndRace, isProcessingRace, isUserParticipant }: {
  race: Race;
  onEndRace: (raceId: bigint) => void;
  isProcessingRace: boolean;
  isUserParticipant: boolean;
}) => {
  const { progress, isComplete, timeLeft, isCountdownComplete } = useRaceProgress(
    race.startTime ? BigInt(Math.floor(race.startTime.getTime() / 1000)) : BigInt(0),
    race.progressStatus === 'racing',
    race.hasEnded,
    30000 // 30 seconds countdown
  );

  const isCountdownActive = race.progressStatus === 'racing' && !isCountdownComplete;
  const isRaceInProgress = isCountdownComplete && !isComplete;

  return (
    <div className="flex flex-col items-center space-y-2">
      {isCountdownActive && (
        <>
          <div className="text-lg font-semibold text-white">
            Race starts in: {Math.ceil(timeLeft / 1000)}s
          </div>
          <div className="w-full bg-gray-600/50 rounded-full h-3">
            <motion.div 
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </>
      )}
      
      {!isCountdownActive && (
        <>
          <div className="text-lg font-semibold text-white">
            {isRaceInProgress 
              ? `Race time remaining: ${Math.ceil(timeLeft / 1000)}s`
              : isComplete 
                ? 'Race Complete!'
                : 'Race in Progress'}
          </div>
          <div className="w-full bg-gray-600/50 rounded-full h-2">
            <motion.div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </>
      )}

      {isUserParticipant && (
        <motion.button
          whileHover={{ scale: isComplete ? 1.05 : 1 }}
          whileTap={{ scale: isComplete ? 0.95 : 1 }}
          onClick={() => isComplete && onEndRace(race.id)}
          disabled={isProcessingRace || !isComplete}
          className={`w-full px-4 py-2 rounded-lg transform transition-all shadow-lg ${
            isProcessingRace
              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
              : !isComplete
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white hover:shadow-red-500/25 cursor-pointer"
          }`}
        >
          {isProcessingRace 
            ? 'Processing...' 
            : isCountdownActive
              ? 'Countdown in progress...'
              : isRaceInProgress
                ? 'Race in progress...'
                : isComplete
                  ? 'End Race'
                  : 'Race in progress...'}
        </motion.button>
      )}
    </div>
  );
};

export default function RaceView() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  // Simplified state management
  const [selectedRaceSize, setSelectedRaceSize] = useState<RaceSize>(RaceSize.Two);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [isProcessingRace, setIsProcessingRace] = useState(false);
  const [isProcessingStartRace, setIsProcessingStartRace] = useState(false);
  const [processingRaceId, setProcessingRaceId] = useState<bigint | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | '24h' | 'week'>('all');
  const [selectedResultsRace, setSelectedResultsRace] = useState<Race | null>(null);
  const [startStage, setStartStage] = useState<StartStage>({
    stage: 'initializing',
    progress: 0
  });
  
  // Use the useRaceData hook from useRaceState.ts to manage race data
  const { races: allRacesInfo, loading: isLoadingRaces, refreshRaces } = useRaceData();
  
  // Convert RaceInfo objects to Race objects
  const allRaces = useMemo(() => 
    allRacesInfo.map(convertRaceInfoToRace),
    [allRacesInfo]
  );
  
  // Add state for organized races
  const [organizedRaces, setOrganizedRaces] = useState<RaceSizeCache['races']>({
    [RaceSize.Two]: [],
    [RaceSize.Five]: [],
    [RaceSize.Ten]: []
  });

  // Update the race organization when allRaces changes
  useEffect(() => {
    const organized = organizeRacesBySize(allRaces);
    setOrganizedRaces(organized);
    
    // Cache the organized races with proper serialization
    const cache: RaceSizeCache = {
      timestamp: Date.now(),
      races: organized
    };
    try {
      // Convert BigInt values to strings before caching
      const serializedCache = JSON.stringify(cache, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      localStorage.setItem(RACE_CACHE_KEY, serializedCache);
    } catch (error) {
      console.error('Error caching races:', error);
    }
  }, [allRaces]);

  // Update the effect that loads cached races
  useEffect(() => {
    try {
      const cached = localStorage.getItem(RACE_CACHE_KEY);
      if (cached) {
        // Parse the cache and convert string numbers back to BigInt
        const parsedCache = JSON.parse(cached, (key, value) => {
          // Check if the value is a string and matches a BigInt pattern
          if (typeof value === 'string' && /^\d+$/.test(value)) {
            try {
              return BigInt(value);
            } catch {
              return value;
            }
          }
          return value;
        }) as RaceSizeCache;
        
        if (Date.now() - parsedCache.timestamp < RACE_CACHE_DURATION) {
          setOrganizedRaces(parsedCache.races);
        }
      }
    } catch (error) {
      console.error('Error loading cached races:', error);
    }
  }, []);

  // Derived state - simpler and more direct
  const races = useMemo(() => {
    // Log the race sizes for debugging
    console.log('All races:', allRaces.map(race => ({
      id: race.id.toString(),
      size: race.size,
      raceSize: Number(race.raceSize)
    })));
    console.log('Selected race size:', Number(selectedRaceSize));
    
    // Filter races based on exact race size match
    const filteredRaces = allRaces.filter(race => {
      // Convert both values to numbers for proper comparison
      const raceSize = Number(race.raceSize);
      const selected = Number(selectedRaceSize);
      
      console.log(`Race ${race.id.toString()}: raceSize=${raceSize}, selectedSize=${selected}, matches=${raceSize === selected}`);
      
      // Only include races that exactly match the selected size
      return raceSize === selected;
    });

    console.log('Filtered races:', filteredRaces.map(race => ({
      id: race.id.toString(),
      size: race.size,
      raceSize: Number(race.raceSize)
    })));

    return filteredRaces;
  }, [allRaces, selectedRaceSize]);
  
  const activeRaces = useMemo(() => 
    races.filter(race => !race.hasEnded), 
    [races]
  );
  
  const completedRaces = useMemo(() => 
    races.filter(race => race.hasEnded), 
    [races]
  );
  
  // Update the filteredHistory memo to use client-side sorting
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    
    return completedRaces
      .filter(race => {
        if (historyFilter === 'all') return true;
        if (!race.endTime) return false;
        
        const endTimeMs = race.endTime.getTime();
        
        if (historyFilter === '24h') {
          return now - endTimeMs <= 24 * 60 * 60 * 1000;
        }
        
        if (historyFilter === 'week') {
          return now - endTimeMs <= 7 * 24 * 60 * 60 * 1000;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by end time, most recent first
        const aTime = a.endTime?.getTime() || 0;
        const bTime = b.endTime?.getTime() || 0;
        return bTime - aTime;
      });
  }, [completedRaces, historyFilter]);

  // Add an effect to update relative times
  useEffect(() => {
    if (!filteredHistory.length) return;

    const interval = setInterval(() => {
      // Force re-render to update relative times
      setHistoryFilter(prev => prev);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [filteredHistory.length]);

  // Race size options
  const raceSizeOptions = [
    { value: RaceSize.Two, label: '2/2' },
    { value: RaceSize.Five, label: '5/5' },
    { value: RaceSize.Ten, label: '10/10' }
  ];

  // Add debug logging for race size options
  console.log('Race size options:', raceSizeOptions.map(option => ({
    label: option.label,
    value: option.value,
    numericValue: Number(option.value)
  })));
  
  // Use the useRaceActions hook for race operations
  const { startRace: startRaceAction, endRace: endRaceAction, processing } = useRaceActions();
  
  // Simplified race operations
  const handleStartRace = async (raceId: bigint) => {
    try {
      setIsProcessingStartRace(true);
      setProcessingRaceId(raceId);
      
      // Start the animation sequence
      setStartStage({ stage: 'initializing', progress: 0 });
      
      // Simulate the stages
      const stages: StartStage['stage'][] = ['initializing', 'positioning', 'warming', 'starting'];
      let currentStageIndex = 0;

      const progressInterval = setInterval(() => {
        setStartStage(prev => {
          const newProgress = prev.progress + 2;
          if (newProgress >= 100) {
            currentStageIndex++;
            if (currentStageIndex >= stages.length) {
              clearInterval(progressInterval);
              return prev;
            }
            return {
              stage: stages[currentStageIndex],
              progress: 0
            };
          }
          return {
            ...prev,
            progress: newProgress
          };
        });
      }, 50);

      // Call the contract function
      await startRaceAction(Number(raceId));
      
      // Clear the interval if it's still running
      clearInterval(progressInterval);
      
      // Get the current timestamp for race start
      const startTime = new Date();
      const updatedRace = races.find(r => r.id === raceId);
      
      if (updatedRace) {
        // Create the updated race object with the new start time
        const raceWithProgress = {
          ...updatedRace,
          progressStatus: 'racing' as const,
          startTime, // Use the captured start time
          hasEnded: false
        };

        // Update both the selected race and the races list
        setSelectedRace(raceWithProgress);
        
        // Update the race in the races list
        const updatedRaces = races.map(race => 
          race.id === raceId ? raceWithProgress : race
        );
        
        // Force a refresh of the organized races
        const organized = organizeRacesBySize(updatedRaces);
        setOrganizedRaces(organized);
      }

      // Refresh races after the countdown duration
      setTimeout(() => {
        refreshRaces();
      }, 32000); // 32 seconds to ensure we get the updated state after countdown
    } catch (error) {
      console.error('Failed to start race:', error);
      toast.error('Failed to start the race. Please try again.');
      
      // Reset the race state if the transaction fails
      const originalRace = races.find(r => r.id === raceId);
      if (originalRace) {
        setSelectedRace(originalRace);
      }
    } finally {
      setIsProcessingStartRace(false);
      setProcessingRaceId(null);
    }
  };
  
  const handleEndRace = async (raceId: bigint) => {
    try {
      setIsProcessingRace(true);
      setProcessingRaceId(raceId);
      const endTime = new Date(); // Capture the exact time when endRace is called
      await endRaceAction(Number(raceId));
      
      // Wait for transaction confirmation and fetch results
      const updatedRace = races.find(r => r.id === raceId);
      if (updatedRace) {
        try {
          // Add a small delay to ensure the blockchain has processed the end race transaction
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Fetch the leaderboard results
          const leaderboardResults = await getRaceResults(raceId, publicClient);
          
          // Update the race with results and show modal, using the captured endTime
          const raceWithResults = {
            ...updatedRace,
            progressStatus: 'complete' as const,
            hasEnded: true,
            endTime, // Use the captured endTime
            results: leaderboardResults.map(entry => ({
              player: entry.player as `0x${string}`,
              position: entry.position,
              score: entry.score,
              reward: entry.reward
            }))
          };
          
          setSelectedResultsRace(raceWithResults);
        } catch (error) {
          console.error('Error fetching race results:', error);
          toast.error('Failed to fetch race results. Please try again.');
        }
      }
      
      // Refresh races after a delay to get updated data
      setTimeout(() => {
        refreshRaces();
      }, 2000);
    } catch (error) {
      console.error('Failed to end race:', error);
      toast.error('Failed to end the race. Please try again.');
    } finally {
      setIsProcessingRace(false);
      setProcessingRaceId(null);
    }
  };
  
  // Effect to check for user's active race when component mounts
  useEffect(() => {
    if (address && races.length > 0) {
      // Find if user is in any active race
      const userRace = races.find(race => 
        !race.hasEnded && 
        race.players.some(player => player.toLowerCase() === address.toLowerCase())
      );
      
      if (userRace) {
        setSelectedRace(userRace);
        setSelectedRaceSize(userRace.raceSize as RaceSize);
      }
    }
  }, [address, races]);
  
  // Effect to refresh races periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRaces();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [refreshRaces]);
  // Listen for race events
  useRaceEvents(
    // Race Created
    (raceId) => {
      console.log('Race created:', raceId);
      refreshRaces();
    },
    // Player Joined
    (raceId, player, critterId) => {
      console.log('Player joined:', { raceId, player, critterId });
      refreshRaces();
      
      // If this is the current user, select this race
      if (player.toLowerCase() === address?.toLowerCase()) {
        const race = races.find(r => r.id === raceId);
        if (race) {
          setSelectedRace(race);
          setSelectedRaceSize(race.raceSize as RaceSize);
        } else {
          // If race not found in current state, refresh and then try to select
          refreshRaces().then(() => {
            const updatedRaces = allRaces.filter(r => r.raceSize === selectedRaceSize);
            const updatedRace = updatedRaces.find(r => r.id === raceId);
            if (updatedRace) {
              setSelectedRace(updatedRace);
            }
          });
        }
      }
    },
    // Race Started
    (raceId, startTime) => {
      console.log('Race started:', { raceId, startTime });
      refreshRaces();
      
      // Update the selected race if it's the one that started
      if (selectedRace && selectedRace.id === raceId) {
        setSelectedRace({
          ...selectedRace,
          startTime: new Date(Number(startTime) * 1000),
          progressStatus: 'racing'
        });
      }
    },
    // Race Ended
    async (raceId, results) => {
      console.log('Race ended:', { raceId, results });
      
      // Add a small delay to ensure the blockchain has processed the results
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Fetch the leaderboard results
        const leaderboardResults = await getRaceResults(raceId, publicClient);
        
        const endedRace = races.find(r => r.id === raceId);
        if (endedRace) {
          // Only update endTime if it's not already set
          const raceWithResults = {
            ...endedRace,
            hasEnded: true,
            progressStatus: 'complete' as const,
            endTime: endedRace.endTime || new Date(), // Only set if not already set
            results: leaderboardResults.map(entry => ({
              player: entry.player as `0x${string}`,
              position: entry.position,
              score: entry.score,
              reward: entry.reward
            }))
          };
          
          // Show results modal if user was in the race
          if (isUserParticipant(endedRace)) {
            setSelectedResultsRace(raceWithResults);
          }
        }
      } catch (error) {
        console.error('Error handling race end event:', error);
      }
      
      // Refresh races to update UI
      refreshRaces();
    },
    // PowerUp Revenue Withdrawn
    (owner: `0x${string}`, amount: bigint) => {
      console.log('PowerUp revenue withdrawn:', { owner, amount });
      if (owner.toLowerCase() === address?.toLowerCase()) {
        refreshRaces();
      }
    },
    // PowerUps Purchased
    (player: `0x${string}`, speedBoosts: bigint) => {
      console.log('PowerUps purchased:', { player, speedBoosts });
      if (player.toLowerCase() === address?.toLowerCase()) {
        // Refresh races to update UI with new power-up counts
        refreshRaces();
      }
    }
  );

  // Add race info hook for selected race
  const { data: selectedRaceInfo } = useRaceInfo(selectedRace?.id);

  // Calculate race statistics when race is selected
  const raceStats = useMemo(() => {
    if (selectedRace?.results) {
      const stats: RaceStats = {
        totalPrizePool: selectedRace.results.reduce((sum, p) => sum + p.reward, BigInt(0)),
        highestScore: selectedRace.results.reduce((max, p) => p.score > max ? p.score : max, BigInt(0)),
        averageScore: Number(selectedRace.results.reduce((sum, p) => sum + p.score, BigInt(0))) / selectedRace.results.length,
        participantCount: selectedRace.results.length,
        duration: selectedRace.endTime && selectedRace.startTime 
          ? (selectedRace.endTime.getTime() - selectedRace.startTime.getTime()) / 1000
          : 0
      };
      return stats;
    }
    return null;
  }, [selectedRace]);

  // Update race status type
  const updateRaceStatus = (race: Race, progressStatus: RaceProgressStatus): Race => ({
    ...race,
    progressStatus,
    status: progressStatus === 'complete' ? RaceStatus.Completed : race.status
  });

  // Update countdown timer with fixed types
  const [countdowns, setCountdowns] = useState<{ [key: string]: number }>({});
  useEffect(() => {
    const racingRaces = races.filter(race => race.progressStatus === 'racing');
    if (racingRaces.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setCountdowns(prevCountdowns => {
        const updatedCountdowns: { [key: string]: number } = {};
        let hasChanges = false;

        racingRaces.forEach(race => {
          if (race.startTime) {
            const startTimeMs = race.startTime instanceof Date ? 
              race.startTime.getTime() : 
              new Date(race.startTime).getTime();
            
            const elapsedTime = (now - startTimeMs) / 1000;
            const remainingTime = Math.max(0, RACE_DURATION - elapsedTime);
            const raceIdString = race.id.toString();
            
            // Only update if the countdown has changed by at least 1 second
            if (Math.floor(prevCountdowns[raceIdString]) !== Math.floor(remainingTime)) {
              hasChanges = true;
              updatedCountdowns[raceIdString] = remainingTime;
              
              // Update race status to complete when time is up
              if (remainingTime === 0 && race.progressStatus !== 'complete') {
                // Refresh races to get updated status
                refreshRaces();
                
                // Update the selected race if it's the one that ended
                if (selectedRace && selectedRace.id === race.id) {
                  setSelectedRace({
                    ...selectedRace,
                    hasEnded: true,
                    progressStatus: 'complete',
                    endTime: new Date() // Set end time when countdown reaches zero
                  });
                }
              }
            } else {
              updatedCountdowns[raceIdString] = prevCountdowns[raceIdString];
            }
          }
        });
        
        return hasChanges ? updatedCountdowns : prevCountdowns;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [races, selectedRace, refreshRaces]);

  // Helper function to check if user is a participant in the processing race
  const isProcessingRaceParticipant = useCallback(() => {
    if (!processingRaceId || !address) return false;
    const race = races.find(r => r.id === processingRaceId);
    return race ? race.players.some(p => p.toLowerCase() === address.toLowerCase()) : false;
  }, [processingRaceId, races, address]);

  // Update the processing stage based on race end event
  const [processingStage, setProcessingStage] = useState<ProcessingStage>({
    stage: 'completing',
    progress: 0
  });
  useEffect(() => {
    if (isProcessingRace) {
      const stages: ('completing' | 'calculating' | 'distributing' | 'finalizing')[] = 
        ['completing', 'calculating', 'distributing', 'finalizing'];
      let currentStageIndex = 0;

      const progressInterval = setInterval(() => {
        setProcessingStage(prev => {
          const newProgress = prev.progress + 1;
          if (newProgress >= 100) {
            currentStageIndex++;
            if (currentStageIndex >= stages.length) {
              clearInterval(progressInterval);
              return prev;
            }
            return {
              stage: stages[currentStageIndex],
              progress: 0
            };
          }
          return {
            ...prev,
            progress: newProgress
          };
        });
      }, 50);

      return () => clearInterval(progressInterval);
    }
  }, [isProcessingRace]);

  const handleGoToLobby = () => navigate('/lobby');

  // Add error handling component
  const ErrorDisplay = ({ error, onRetry }: { error: Error | null, onRetry: () => void }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-semibold text-red-400 mb-4">
        Unable to Load Races
      </h2>
      <p className="text-gray-300 mb-6">
        {error?.message?.includes('429')
          ? 'The network is currently experiencing high traffic. We are retrying automatically.'
          : error?.message?.includes('network')
          ? 'There seems to be a network connectivity issue. We are trying alternate connections.'
          : 'There was an error loading the races. Please try again.'}
      </p>
      <div className="flex justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
        >
          Try Again
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/lobby')}
          className="px-6 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-colors"
        >
          Back to Lobby
        </motion.button>
      </div>
    </motion.div>
  );

  // Add loading component
  const LoadingDisplay = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
      <p className="text-gray-400">Loading races...</p>
    </motion.div>
  );

  // Add this function to check if user is a participant in a race
  const isUserParticipant = useCallback((race: Race): boolean => {
    if (!address || !race.players) return false;
    return race.players.some(player => 
      player.toLowerCase() === address.toLowerCase()
    );
  }, [address]);

  // Add this function to check if a race is full
  const isRaceFull = useCallback((race: Race): boolean => {
    return race.currentPlayers >= race.size;
  }, []);

  // Add this function to determine if the Start Race button should be enabled
  const canStartRace = useCallback((race: Race): { enabled: boolean; tooltip: string } => {
    if (!isConnected) {
      return { enabled: false, tooltip: "Connect your wallet to interact with races" };
    }
    
    if (!isUserParticipant(race)) {
      return { enabled: false, tooltip: "Only participants can start the race" };
    }
    
    if (!isRaceFull(race)) {
      return { enabled: false, tooltip: "Race must be full before it can start" };
    }
    
    if (race.progressStatus !== 'ready') {
      return { enabled: false, tooltip: "Race is not in a ready state" };
    }
    
    return { enabled: true, tooltip: "Start the race!" };
  }, [isConnected, isUserParticipant, isRaceFull]);

  // Update the filtered active races logic
  const filteredActiveRaces = useMemo(() => {
    const filtered = races.filter(race => !race.hasEnded);
    console.log('Filtered active races:', filtered.map(race => ({
      id: race.id.toString(),
      size: race.size,
      raceSize: Number(race.raceSize)
    })));
    return filtered;
  }, [races]);

  // Add race counts for the tabs
  const raceCounts = useMemo(() => ({
    [RaceSize.Two]: allRaces.filter(r => Number(r.raceSize) === RaceSize.Two && !r.hasEnded).length,
    [RaceSize.Five]: allRaces.filter(r => Number(r.raceSize) === RaceSize.Five && !r.hasEnded).length,
    [RaceSize.Ten]: allRaces.filter(r => Number(r.raceSize) === RaceSize.Ten && !r.hasEnded).length
  }), [allRaces]);

  // Add this function to fetch completed race results
  const fetchCompletedRaceResults = async (race: Race): Promise<Race> => {
    if (!race.hasEnded || race.results) return race;

    try {
      const results = await getRaceResults(race.id, publicClient);
      return {
        ...race,
        results: results.map(entry => ({
          player: entry.player as `0x${string}`,
          position: BigInt(entry.position),
          score: BigInt(entry.score),
          reward: BigInt(entry.reward)
        }))
      } as Race;
    } catch (error) {
      console.error('Error fetching completed race results:', error);
      return race;
    }
  };

  // Update the click handler for viewing results
  const handleViewResults = async (race: Race) => {
    try {
      // Show loading toast
      const loadingToast = toast.loading('Loading race results...');
      
      // Fetch results if needed
      const raceWithResults = await fetchCompletedRaceResults(race);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show the modal with the race results
      setSelectedResultsRace({
        ...raceWithResults,
        results: raceWithResults.results?.map(result => ({
          ...result,
          position: BigInt(result.position)  // Ensure position is bigint
        }))
      });
    } catch (error) {
      console.error('Error handling view results:', error);
      toast.error('Failed to load race results. Please try again.');
    }
  };

  // Handle loading and error states early
  if (isLoadingRaces) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <LoadingDisplay />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      {/* Background elements */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/racing-grid.png')] opacity-10 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 animate-gradient"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold mb-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 animate-text-shimmer">
                    Race View
                  </span>
                </h1>
                <p className="text-gray-300 text-lg">Watch your critters compete in real-time</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGoToLobby}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transform transition-all shadow-lg hover:shadow-purple-500/25"
              >
                Back to Lobby
              </motion.button>
            </div>
          </motion.div>

          {/* Race Size Filter Tabs */}
          <div className="mb-4 flex space-x-4">
            {raceSizeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  console.log('Setting selected race size to:', option.value);
                  setSelectedRaceSize(option.value);
                }}
                className={`px-4 py-2 rounded-lg transition-all relative ${
                  selectedRaceSize === option.value
                    ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                }`}
              >
                <span className="flex items-center">
                  {option.label}
                </span>
                {raceCounts[option.value] > 0 && (
                  <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {raceCounts[option.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active Races Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
          >
            <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Active Races
            </h2>
            
            {isProcessingRace ? (
              <div className="flex items-center justify-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
                <span className="ml-3 text-gray-300">Processing race...</span>
              </div>
            ) : filteredActiveRaces.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredActiveRaces.map((race) => (
                  <motion.div
                    key={race.id.toString()}
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-700/50 rounded-lg p-6 border border-gray-600/50 hover:border-purple-500/50 transition-all"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        Race #{race.id.toString()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        race.status === RaceStatus.Active
                      ? 'bg-green-500/20 text-green-300'
                          : 'bg-blue-500/20 text-blue-300'
                }`}>
                        {race.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Players</span>
                        <span className="text-gray-200">{race.currentPlayers}/{race.size}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Status</span>
                        <span className="text-gray-200">{race.progressStatus || 'Waiting'}</span>
                      </div>
                      {race.startTime && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Started</span>
                          <span className="text-gray-200">{formatTimeSpan(race.startTime)}</span>
                        </div>
                      )}
                    </div>

                    {race.status === RaceStatus.Active && (
                      <div className="mt-4">
                        {race.progressStatus === 'ready' ? (
                          <div className="relative group">
                            <motion.button
                              whileHover={{ scale: canStartRace(race).enabled ? 1.05 : 1 }}
                              whileTap={{ scale: canStartRace(race).enabled ? 0.95 : 1 }}
                              onClick={() => canStartRace(race).enabled && handleStartRace(race.id)}
                              disabled={!canStartRace(race).enabled || isProcessingRace}
                              className={`w-full px-4 py-2 rounded-lg transform transition-all shadow-lg ${
                                isProcessingRace 
                                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                  : canStartRace(race).enabled 
                                    ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-green-500/25 cursor-pointer" 
                                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {isProcessingRace ? 'Processing...' : 'Start Race'}
                            </motion.button>
                            {!canStartRace(race).enabled && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                              {canStartRace(race).tooltip}
                            </div>
                          )}
                          </div>
                        ) : race.progressStatus === 'racing' ? (
                          <div className="space-y-3">
                            {race.startTime && (
                              <RaceProgress
                                race={race}
                                onEndRace={handleEndRace}
                                isProcessingRace={isProcessingRace}
                                isUserParticipant={isUserParticipant(race)}
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {race.status === RaceStatus.Completed && race.results && (
                      <div className="mt-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                            Results
                          </h3>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleViewResults(race)}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm rounded-lg transform transition-all shadow-lg hover:shadow-purple-500/25"
                          >
                            View Results
                          </motion.button>
                        </div>
                        {race.results.slice(0, 3).map((player, index) => (
                          <div 
                            key={player.player}
                            className={`flex justify-between items-center p-2 rounded ${
                              player.player.toLowerCase() === address?.toLowerCase()
                                ? 'bg-purple-500/20 border border-purple-500/50' 
                                : 'bg-gray-600/30'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm ${
                                index === 0 ? 'text-yellow-400' :
                                index === 1 ? 'text-gray-400' :
                                index === 2 ? 'text-amber-600' :
                                'text-gray-300'
                              }`}>
                                #{index + 1}
                              </span>
                              <span className="text-gray-300 truncate">
                                {player.player.slice(0, 6)}...{player.player.slice(-4)}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-200">
                                {player.score.toString()} pts
                              </div>
                              {player.reward > BigInt(0) && (
                                <div className="text-xs text-green-400">
                                  +{formatUnits(player.reward.toString(), 18)} MON
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {race.results.length > 3 && (
                          <div className="text-center text-sm text-gray-400 mt-2">
                            Click "View Results" to see all {race.results.length} participants
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No active {
                  selectedRaceSize === RaceSize.Two ? '2/2' : 
                  selectedRaceSize === RaceSize.Five ? '5/5' : 
                  selectedRaceSize === RaceSize.Ten ? '10/10' : ''
                } races found</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGoToLobby}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transform transition-all shadow-lg hover:shadow-purple-500/25"
                >
                  Join a Race
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* Race History Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Race History
              </h2>
              
              <div className="flex gap-2">
                {(['all', '24h', 'week'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      historyFilter === filter
                        ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                    }`}
                  >
                    {filter === 'all' ? 'All Time' : 
                     filter === '24h' ? 'Last 24h' : 
                     'Last Week'}
                  </button>
                ))}
              </div>
            </div>
            
            {filteredHistory.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredHistory.map(race => (
                  <motion.div
                    key={race.id.toString()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-lg font-semibold text-gray-300">
                          Race #{race.id.toString()}
                        </span>
                        <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-600/50 text-gray-300">
                          {race.size} Players
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">
                          {formatTimeSpan(race.endTime)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-4">
                      <div className="flex items-center space-x-4">
                        {race.results && race.results[0] && (
                          <div className="flex items-center space-x-2">
                            <span className="text-yellow-400">🏆</span>
                            <span className="text-gray-300">
                              {race.results[0].player.slice(0, 6)}...{race.results[0].player.slice(-4)}
                            </span>
                            <span className="text-yellow-400">
                              {formatUnits(race.results[0].reward.toString(), 18)} MON
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewResults(race)}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transform transition-all shadow-lg hover:shadow-purple-500/25"
                      >
                        View Results
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">
                No race history found for this period
              </p>
            )}
          </motion.div>

          {/* Race Stats Section */}
          {selectedRace && raceStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Race Statistics
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                  <div className="text-sm text-gray-400 mb-1">Prize Pool</div>
                  <div className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                    {formatUnits(raceStats.totalPrizePool.toString(), 18)} MON
                  </div>
                </div>
                
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                  <div className="text-sm text-gray-400 mb-1">Highest Score</div>
                  <div className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                    {raceStats.highestScore.toString()}
                  </div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                  <div className="text-sm text-gray-400 mb-1">Average Score</div>
                  <div className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    {raceStats.averageScore.toFixed(0)}
                  </div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                  <div className="text-sm text-gray-400 mb-1">Duration</div>
                  <div className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                    {raceStats.duration}s
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Start Race Processing Overlay */}
          {isProcessingStartRace && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
            >
              <div className="bg-gray-800/90 rounded-xl p-8 max-w-md w-full mx-4 border border-gray-700/50">
                <div className="text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent mb-4"></div>
                  <h2 className="text-2xl font-bold text-white mb-2">Preparing Race</h2>
                  <p className="text-gray-300 mb-4">
                    {startStage?.stage === 'initializing' && 'Initializing race track...'}
                    {startStage?.stage === 'positioning' && 'Positioning critters at starting line...'}
                    {startStage?.stage === 'warming' && 'Warming up engines...'}
                    {startStage?.stage === 'starting' && 'Ready, set, GO!'}
                  </p>
                  
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${startStage?.progress || 0}%` }}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-400">
                    Get ready! The race is about to begin... 🏁
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Processing Overlay */}
          {isProcessingRace && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
            >
              <div className="bg-gray-800/90 rounded-xl p-8 max-w-md w-full mx-4 border border-gray-700/50">
                <div className="text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
                  <h2 className="text-2xl font-bold text-white mb-2">Finalizing Race</h2>
                  <p className="text-gray-300 mb-4">
                    {processingStage?.stage === 'completing' && 'Calculating final positions...'}
                    {processingStage?.stage === 'calculating' && 'Tallying up scores...'}
                    {processingStage?.stage === 'distributing' && 'Distributing rewards...'}
                    {processingStage?.stage === 'finalizing' && 'Preparing race results...'}
                  </p>
                  
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${processingStage?.progress || 0}%` }}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-400">
                    Almost there! Your race results will be revealed soon... 🏁
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Results Modal */}
          {selectedResultsRace && (
            <ResultsModal
              race={selectedResultsRace}
              onClose={() => setSelectedResultsRace(null)}
              userAddress={address as `0x${string}` | undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function debouncedProcessRace(raceId: unknown): any {
  throw new Error('Function not implemented.');
}

