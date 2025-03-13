import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveRaces, useRaceInfo, useRaceEvents } from '../../../contracts/CritterRace/hooks';
import { RaceSize } from '../../../contracts/CritterRace/types';
import { useAccount, useWriteContract, useReadContract, useChainId } from 'wagmi';
import { contracts } from '../../../utils/config';
import { abi } from '../../../contracts/CritterRace/abi';
import { CACHE_CONFIG } from '../../../utils/config';
import { formatUnits } from 'ethers';
import { useRaceContract } from '../hooks/useRaceState';
import { motion } from 'framer-motion';

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
  score: number;
  position: number;
  reward: number;
  isUser?: boolean;
}

interface Race {
  id: bigint;
  size: number;
  currentPlayers: number;
  status: RaceStatus;
  startTime?: Date;
  endTime?: Date;
  results?: Player[];
  progressStatus?: RaceProgressStatus;
  raceStartedAt?: number;
  participants?: RaceParticipant[];
  players: readonly `0x${string}`[];
  hasEnded: boolean;
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
  totalPrizePool: number;
  highestScore: number;
  averageScore: number;
  participantCount: number;
  duration: number;
}

const RACE_DURATION = 30; // Race duration in seconds
const PROCESSING_DURATION = 10000; // Processing duration in milliseconds

// Cache constants
const CACHE_KEYS = {
  ACTIVE_RACES: (raceSize: RaceSize) => `active_races_${raceSize}`,
  RACE_INFO: (raceId: bigint) => `race_info_${raceId}`,
  RACE_RESULTS: (raceId: bigint) => `race_results_${raceId}`,
  RACE_STATS: (raceId: bigint) => `race_stats_${raceId}`
};

// Memory cache with improved typing
const memoryCache = new Map<string, { 
  data: any; 
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
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
    // Try memory cache first
    const memCached = memoryCache.get(key);
    if (memCached) {
      if (Date.now() - memCached.timestamp <= duration) {
        // Update access stats
        memCached.lastAccessed = Date.now();
        memCached.accessCount++;
        return memCached.data as T;
      }
      memoryCache.delete(key);
    }

    // Try localStorage
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > duration) {
      localStorage.removeItem(key);
      return null;
    }

    // Deserialize BigInt values and store in memory cache
    const deserializedData = deserializeBigInt(data);
    setInMemoryCache(key, deserializedData);
    return deserializedData as T;
  } catch {
    return null;
  }
};

const setInCache = <T,>(key: string, data: T, duration = CACHE_CONFIG.DURATION.SHORT) => {
  try {
    // Set in both memory and localStorage
    setInMemoryCache(key, data);
    
    // Serialize BigInt values before storing in localStorage
    const serializedData = serializeBigInt(data);
    localStorage.setItem(key, JSON.stringify({
      data: serializedData,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

const setInMemoryCache = <T,>(key: string, data: T) => {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    lastAccessed: Date.now(),
    accessCount: 1
  });
};

// Prefetch manager
const prefetchManager = {
  queue: new Set<string>(),
  isRunning: false,

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
      const keys = Array.from(this.queue).slice(0, CACHE_CONFIG.BATCH_SIZE);
      keys.forEach(key => this.queue.delete(key));

      try {
        // Process batch
        await Promise.all(keys.map(key => this.prefetchItem(key)));
      } catch (error) {
        console.error('Prefetch error:', error);
      }

      if (this.queue.size > 0) {
        await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.PREFETCH.INTERVAL));
      }
    }

    this.isRunning = false;
  },

  async prefetchItem(key: string) {
    // Implementation depends on the type of data being prefetched
    if (key.startsWith('race_info_')) {
      const raceId = BigInt(key.replace('race_info_', ''));
      // Add your prefetch logic here
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
  
  const timestamp = date instanceof Date ? date.getTime() : typeof date === 'number' ? date : Date.now();
  const diffInMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes === 1) return '1 minute ago';
  return `${diffInMinutes} minutes ago`;
};

const RaceView: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const chainId = useChainId();
  const [selectedRaceSize, setSelectedRaceSize] = useState<RaceSize>(RaceSize.Two);
  const { data: activeRacesData, refetch: refetchActiveRaces } = useActiveRaces(selectedRaceSize);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [countdowns, setCountdowns] = useState<{ [key: string]: number }>({});
  const [processing, setProcessing] = useState<ProcessingState>({ 
    raceId: BigInt(0), 
    loading: false, 
    endingRaces: new Set() 
  });
  const [processingStage, setProcessingStage] = useState<ProcessingStage>({
    stage: 'completing',
    progress: 0
  });
  const [raceStats, setRaceStats] = useState<RaceStats | null>(null);
  
  // Add race size options
  const raceSizeOptions = [
    { value: RaceSize.Two, label: '2/2' },
    { value: RaceSize.Five, label: '5/5' },
    { value: RaceSize.Ten, label: '10/10' }
  ];

  // Contract write functions
  const { writeContract: startRaceWrite } = useWriteContract();
  const { writeContract: endRaceWrite } = useWriteContract();

  // Contract read function for race results
  const { data: raceResults, refetch: refetchResults } = useReadContract({
    address: contracts.monad.race as `0x${string}`,
    abi: abi,
    functionName: 'getRaceInfo',
    args: processing ? [processing.raceId] : undefined,
    query: {
      enabled: !!processing,
      retryDelay: 5000,
      refetchInterval: 10000,
      refetchOnWindowFocus: false
    }
  });

  // Add processing stage messages
  const stageMessages = {
    completing: 'Completing race and gathering results...',
    calculating: 'Calculating final scores...',
    distributing: 'Distributing rewards...',
    finalizing: 'Finalizing standings...'
  };

  // Add race info hook for selected race
  const { data: selectedRaceInfo } = useRaceInfo(selectedRace?.id);

  // Calculate race statistics when race is selected
  useEffect(() => {
    if (selectedRace?.results) {
      const stats: RaceStats = {
        totalPrizePool: selectedRace.results.reduce((sum, p) => sum + p.reward, 0),
        highestScore: Math.max(...selectedRace.results.map(p => p.score)),
        averageScore: selectedRace.results.reduce((sum, p) => sum + p.score, 0) / selectedRace.results.length,
        participantCount: selectedRace.results.length,
        duration: selectedRace.endTime && selectedRace.startTime 
          ? (selectedRace.endTime.getTime() - selectedRace.startTime.getTime()) / 1000
          : 0
      };
      setRaceStats(stats);
    }
  }, [selectedRace]);

  // Memoized function to get race data with improved caching
  const getRaceData = useCallback(async (raceId: bigint) => {
    const cacheKey = CACHE_KEYS.RACE_INFO(raceId);
    
    const cached = getFromCache<Race>(cacheKey);
    if (cached) return cached;

    const result = await refetchResults();
    if (!result?.data) return null;

    const raceData = convertContractRace(result.data);
    setInCache(cacheKey, raceData);

    // Prefetch related data
    prefetchManager.add(CACHE_KEYS.RACE_STATS(raceId));
    
    return raceData;
  }, [refetchResults]);

  // Process race results with caching
  const processRaceResults = useCallback(async (raceId: bigint) => {
    try {
      setProcessing(prev => ({
        ...prev,
        raceId,
        loading: true
      }));
      
      const cacheKey = CACHE_KEYS.RACE_RESULTS(raceId);
      
      // Try memory cache first
      const memCached = getFromCache<any>(cacheKey);
      if (memCached) {
        const updatedRace = await updateRaceResults(raceId, memCached);
        if (updatedRace) setSelectedRace(updatedRace);
        setProcessing(prev => ({ ...prev, loading: false }));
        return;
      }

      // Try local storage cache
      const cached = getFromCache<any>(cacheKey);
      if (cached) {
        const updatedRace = await updateRaceResults(raceId, cached);
        if (updatedRace) setSelectedRace(updatedRace);
        setInMemoryCache(cacheKey, cached);
        setProcessing(prev => ({ ...prev, loading: false }));
        return;
      }

      // Fetch new results
      const result = await refetchResults();
      
      if (result?.data) {
        const raceInfo = result.data as {
          id: bigint;
          raceSize: number;
          players: readonly `0x${string}`[];
          critterIds: readonly bigint[];
          startTime: bigint;
          isActive: boolean;
          hasEnded: boolean;
          prizePool: bigint;
          scores: readonly bigint[];  // Add scores from contract
          rewards: readonly bigint[]; // Add rewards from contract
        };

        // Cache the results
        setInCache(cacheKey, raceInfo);
        setInMemoryCache(cacheKey, raceInfo);

        const updatedRace = await updateRaceResults(raceId, raceInfo);
        if (updatedRace) setSelectedRace(updatedRace);
      }
      
      setProcessing(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error('Failed to process race results:', error);
      setProcessing(prev => ({ ...prev, loading: false }));
    }
  }, [refetchResults]);

  // Update updateRaceResults to use actual contract data
  const updateRaceResults = useCallback((raceId: bigint, raceInfo: any) => {
    let updatedRace: Race | null = null;
    
    setRaces(prevRaces => {
      const newRaces = prevRaces.map(race => {
        if (race.id === raceId) {
          // Get actual scores and rewards from contract data
          const scores = raceInfo.scores?.map((score: bigint) => Number(score)) || [];
          const rewards = raceInfo.rewards?.map((reward: bigint) => Number(formatUnits(reward, 18))) || [];

          // Create array of player results with actual scores and rewards
          const playerResults = raceInfo.players.map((player: string, index: number) => ({
            wallet: player,
            score: scores[index] || 0,
            reward: rewards[index] || 0,
            isUser: player.toLowerCase() === address?.toLowerCase()
          }));

          // Sort players by score to determine positions
          const sortedResults = [...playerResults]
            .sort((a, b) => b.score - a.score)
            .map((result, index) => ({
              ...result,
              position: index + 1
            }));

          updatedRace = {
            ...race,
            status: raceInfo.hasEnded ? RaceStatus.Completed : RaceStatus.Active,
            endTime: raceInfo.hasEnded ? new Date() : undefined,
            players: raceInfo.players,
            results: sortedResults,
            hasEnded: raceInfo.hasEnded
          };
          return updatedRace;
        }
        return race;
      });
      return newRaces;
    });

    return updatedRace;
  }, [address]);

  // Clean up expired cache entries with improved efficiency
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();

      // Clean memory cache with access-based retention
      for (const [key, value] of memoryCache.entries()) {
        const age = now - value.timestamp;
        const timeSinceLastAccess = now - value.lastAccessed;

        // Keep frequently accessed items longer
        const shouldKeep = 
          (age <= CACHE_CONFIG.DURATION.LONG && value.accessCount > 10) ||
          (age <= CACHE_CONFIG.DURATION.MEDIUM && value.accessCount > 5) ||
          (age <= CACHE_CONFIG.DURATION.SHORT);

        if (!shouldKeep || timeSinceLastAccess > CACHE_CONFIG.DURATION.LONG) {
          memoryCache.delete(key);
        }
      }

      // Clean localStorage less frequently
      if (Math.random() < 0.1) { // 10% chance to clean localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('race_')) {
            try {
              const cached = localStorage.getItem(key);
              if (cached) {
                const { timestamp } = JSON.parse(cached);
                if (now - timestamp > CACHE_CONFIG.DURATION.LONG) {
                  localStorage.removeItem(key);
                }
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        });
      }
    };

    const interval = setInterval(cleanup, CACHE_CONFIG.DURATION.SHORT);
    return () => clearInterval(interval);
  }, []);

  // Convert contract race data to our Race interface
  const convertContractRace = (raceData: NonNullable<typeof activeRacesData>[0]): Race => {
    const maxPlayers = getRaceSizeMaxPlayers(raceData.raceSize as RaceSize);
    const currentPlayers = raceData.players.filter(p => p !== '0x0000000000000000000000000000000000000000').length;
    const isFull = currentPlayers >= maxPlayers;

    let progressStatus: RaceProgressStatus = 'ready';
    if (raceData.hasEnded) {
      progressStatus = 'complete';
    } else if (raceData.startTime && Number(raceData.startTime) > 0) {
      progressStatus = 'racing';
    }

    // Convert timestamps to Date objects
    const startTimestamp = raceData.startTime ? Number(raceData.startTime) * 1000 : undefined;
    const startTime = startTimestamp ? new Date(startTimestamp) : undefined;
    
    // Set endTime if race has ended
    const endTime = raceData.hasEnded ? new Date() : undefined;

    return {
      id: raceData.id,
      size: maxPlayers,
      currentPlayers,
      status: raceData.hasEnded ? RaceStatus.Completed : RaceStatus.Active,
      startTime,
      endTime,
      participants: raceData.players.map((player, index) => ({
        player,
        tokenId: raceData.critterIds[index]
      })),
      progressStatus,
      players: raceData.players,
      hasEnded: raceData.hasEnded
    };
  };

  // Update races with improved caching
  useEffect(() => {
    if (!activeRacesData) return;
    
    const cacheKey = CACHE_KEYS.ACTIVE_RACES(selectedRaceSize);
    const cached = getFromCache<Race[]>(cacheKey);
    
    // Compare race IDs safely handling BigInt
    const compareRaceIds = (a: Race[], b: NonNullable<typeof activeRacesData>) => {
      if (a.length !== b.length) return false;
      return a.every((race, index) => 
        race.id.toString() === b[index].id.toString()
      );
    };
    
    // Only update if data has changed
    const shouldUpdate = !cached || !compareRaceIds(cached, activeRacesData);
    
    if (shouldUpdate) {
      const updatedRaces = activeRacesData.map(convertContractRace);
      setRaces(updatedRaces);
      setInCache(cacheKey, updatedRaces);
      
      // Batch prefetch first 3 races
      updatedRaces.slice(0, 3).forEach(race => {
        prefetchManager.add(CACHE_KEYS.RACE_INFO(race.id));
        prefetchManager.add(CACHE_KEYS.RACE_STATS(race.id));
      });
    } else {
      setRaces(cached);
    }
    
    if (activeRacesData.length > 0) {
      const firstRaceSize = activeRacesData[0].raceSize as RaceSize;
      setSelectedRaceSize(firstRaceSize);
    }
  }, [activeRacesData, selectedRaceSize]);

  // Handle race events
  useRaceEvents(
    // RaceCreated
    (raceId) => {
      console.log('Race created:', raceId);
      refetchActiveRaces();
    },
    // PlayerJoined
    (raceId, player, critterId) => {
      console.log('Player joined:', { raceId, player, critterId });
      setRaces(prevRaces => 
        prevRaces.map(race => {
          if (race.id === raceId) {
            const newParticipant: RaceParticipant = {
              player,
              tokenId: critterId
            };
            return {
              ...race,
              currentPlayers: race.currentPlayers + 1,
              participants: [...(race.participants || []), newParticipant],
              progressStatus: race.progressStatus || 'ready'
            };
          }
          return race;
        })
      );
    },
    // RaceStarted
    (raceId, startTime) => {
      console.log('Race started:', { raceId, startTime });
      setRaces(prevRaces => 
        prevRaces.map(race => {
          if (race.id === raceId) {
            const startTimeMs = Number(startTime) * 1000;
            return {
              ...race,
              status: RaceStatus.Active,
              startTime: new Date(startTimeMs),
              progressStatus: 'racing'
            };
          }
          return race;
        })
      );
    },
    // RaceEnded
    (raceId, results) => {
      console.log('Race ended:', { raceId, results });
      // Process the race results when we receive the RaceEnded event
      processRaceResults(raceId);
    }
  );

  // Helper function to check if user is a participant
  const isUserParticipant = useCallback((race: Race) => {
    return address && race.players.some(p => p.toLowerCase() === address.toLowerCase());
  }, [address]);

  // Optimize countdown timer to reduce re-renders
  useEffect(() => {
    if (!races.some(race => race.progressStatus === 'racing')) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setCountdowns(prevCountdowns => {
        const updatedCountdowns: { [key: string]: number } = {};
        let hasChanges = false;

        races.forEach(race => {
          if (race.startTime && race.progressStatus === 'racing') {
            // Ensure startTime is a Date object
            const startTimeMs = race.startTime instanceof Date ? 
              race.startTime.getTime() : 
              new Date(race.startTime).getTime();
            
            const elapsedTime = (now - startTimeMs) / 1000;
            const remainingTime = Math.max(0, RACE_DURATION - elapsedTime);
            const raceIdString = race.id.toString();
            
            if (prevCountdowns[raceIdString] !== remainingTime) {
              hasChanges = true;
              updatedCountdowns[raceIdString] = remainingTime;
              
              // Update race status to complete when time is up
              if (remainingTime === 0) {
                setRaces(prevRaces => 
                  prevRaces.map(r => 
                    r.id === race.id 
                      ? { ...r, progressStatus: 'complete' }
                      : r
                  )
                );
              }
            } else {
              updatedCountdowns[raceIdString] = prevCountdowns[raceIdString];
            }
          }
        });
        
        return hasChanges ? updatedCountdowns : prevCountdowns;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [races]);

  // Helper function to check if user is a participant in the processing race
  const isProcessingRaceParticipant = useCallback(() => {
    if (!processing.raceId || !address) return false;
    const race = races.find(r => r.id === processing.raceId);
    return race ? race.players.some(p => p.toLowerCase() === address.toLowerCase()) : false;
  }, [processing.raceId, races, address]);

  // Update the processing stage based on race end event
  useEffect(() => {
    if (processing.loading) {
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
  }, [processing.loading]);

  const handleGoToLobby = () => navigate('/lobby');

  const startRace = async (raceId: bigint) => {
    try {
      await startRaceWrite({
        address: contracts.monad.race as `0x${string}`,
        abi,
        functionName: 'startRaceExternal',
        args: [raceId]
      });

    setRaces(prevRaces => 
      prevRaces.map(race => 
        race.id === raceId 
          ? { ...race, progressStatus: 'racing', raceStartedAt: Date.now() }
          : race
      )
    );
    } catch (error) {
      console.error('Failed to start race:', error);
    }
  };

  const endRace = async (raceId: bigint) => {
    const raceIdString = raceId.toString();
    
    try {
      // Check if race is already being ended
      if (processing.endingRaces.has(raceIdString)) {
        return;
      }

      setProcessing(prev => ({
        ...prev,
        raceId,
        loading: true,
        endingRaces: new Set([...prev.endingRaces, raceIdString])
      }));
      
      endRaceWrite({
        address: (chainId === 11155111 ? contracts.sepolia.race : contracts.monad.race) as `0x${string}`,
        abi,
        functionName: 'endRace',
        args: [raceId]
      });
      
      // Results will be processed when we receive the RaceEnded event
    } catch (error) {
      console.error('Failed to end race:', error);
      // Remove the race from endingRaces on error
      setProcessing(prev => {
        const newEndingRaces = new Set(prev.endingRaces);
        newEndingRaces.delete(raceIdString);
        return {
          ...prev,
          loading: false,
          endingRaces: newEndingRaces
        };
      });
    }
  };

  if (activeRacesData === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // Sort races into active and completed
  const activeRaces = races.filter(race => !race.hasEnded);
  const completedRaces = races.filter(race => race.hasEnded);

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
            
            {processing.loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
                <span className="ml-3 text-gray-300">Loading races...</span>
              </div>
            ) : activeRaces.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeRaces.map((race) => (
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
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => startRace(race.id)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transform transition-all shadow-lg hover:shadow-green-500/25"
                          >
                            Start Race
                          </motion.button>
                        ) : race.progressStatus === 'racing' ? (
                          <div className="space-y-3">
                            <div className="w-full bg-gray-600/50 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${(countdowns[race.id.toString()] || 0) / RACE_DURATION * 100}%` }}
                              />
                            </div>
                            <div className="text-center text-sm text-gray-400">
                              Race in progress: {countdowns[race.id.toString()] || 0}s remaining
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {race.status === RaceStatus.Completed && race.results && (
                      <div className="mt-4 space-y-3">
                        <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                          Results
                        </h3>
                        {race.results.map((player, index) => (
                          <div 
                            key={player.wallet}
                            className={`flex justify-between items-center p-2 rounded ${
                              player.isUser 
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
                                {player.wallet.slice(0, 6)}...{player.wallet.slice(-4)}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-200">
                                {player.score} pts
                              </div>
                              {player.reward > 0 && (
                                <div className="text-xs text-green-400">
                                  +{formatUnits(player.reward.toString(), 18)} MON
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No active races found</p>
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
                    {raceStats.totalPrizePool.toFixed(2)} MON
                  </div>
                </div>
                
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                  <div className="text-sm text-gray-400 mb-1">Highest Score</div>
                  <div className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                    {raceStats.highestScore}
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

          {/* Processing Overlay */}
          {processing.loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
            >
              <div className="bg-gray-800/90 rounded-xl p-8 max-w-md w-full mx-4 border border-gray-700/50">
                <div className="text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
                  <h2 className="text-2xl font-bold text-white mb-2">Processing Race</h2>
                  <p className="text-gray-300 mb-4">
                    {processingStage?.stage === 'completing' && 'Completing the race...'}
                    {processingStage?.stage === 'calculating' && 'Calculating scores...'}
                    {processingStage?.stage === 'distributing' && 'Distributing rewards...'}
                    {processingStage?.stage === 'finalizing' && 'Finalizing results...'}
                  </p>
                  
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${processingStage?.progress || 0}%` }}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-400">
                    Please wait while we process the race results...
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RaceView;

