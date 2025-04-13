import { useEffect, useState, useCallback, useMemo } from 'react';
import { useReadContract, useAccount, usePublicClient } from 'wagmi';
import { CRITTER_CLASH_CORE_ABI, CRITTER_CLASH_CORE_ADDRESS, CRITTER_CLASH_STATS_ADDRESS } from '../constants/contracts';
import { ClashDetail, ClashState, ClashSize } from '../contracts/CritterClashCore/types';

interface GroupedClashes {
  pendingResults: { id: bigint; clash: ClashDetail }[];
  completed: { id: bigint; clash: ClashDetail; results: any[] }[];
}

// Cache for clash details to reduce RPC calls
interface CacheEntry {
  data: any;
  timestamp: number;
}

// Invalid clash ID tracking to avoid repeated failed requests
interface InvalidIdRecord {
  timestamp: number;
  reason: string;
}

// Constants for performance optimization
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes for general cache
const COMPLETED_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for completed clashes
const BATCH_SIZE = 3; // Process 3 clashes at a time
const MIN_BATCH_DELAY = 5000; // 5 seconds between batches
const MAX_BATCH_DELAY = 10000; // Maximum delay of 10 seconds
const MAX_RETRIES = 3; // Maximum number of retries for failed requests
const INVALID_ID_TTL = 6 * 60 * 60 * 1000; // 6 hours - how long to remember invalid IDs
const clashCache = new Map<string, CacheEntry>();
const GLOBAL_RATE_LIMIT = 1000; // Increased minimum time between RPC calls to 1 second
const invalidClashIds = new Map<string, InvalidIdRecord>(); // Track invalid clash IDs
const STORAGE_KEY_PREFIX = 'clash_data_';
const LAST_FETCH_KEY = 'clash_last_fetch';

// Request queue for rate limiting
interface QueuedRequest {
  clashId: bigint;
  resolve: (data: any) => void;
  reject: (error: any) => void;
  priority: number; // Higher number = higher priority
  retries: number;
}

// Store last request time to enforce global rate limiting
let lastRequestTime = 0;
let requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

// Initialize cache from localStorage if available
function initializeCache() {
  try {
    // Check all localStorage keys for our prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const storedData = localStorage.getItem(key);
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            // Deserialize data with BigInt support
            const deserializedData = deserializeWithBigInt(parsedData);
            if (deserializedData.timestamp && deserializedData.data) {
              clashCache.set(key.replace(STORAGE_KEY_PREFIX, ''), {
                data: deserializedData.data,
                timestamp: deserializedData.timestamp
              });
            }
          } catch (parseError) {
            console.error(`Error parsing cached data for key ${key}:`, parseError);
            // Remove invalid data from localStorage
            localStorage.removeItem(key);
          }
        }
      }
    }
    console.log(`Initialized clash cache with ${clashCache.size} items from localStorage`);
  } catch (error) {
    console.error('Error initializing cache from localStorage:', error);
  }
}

// Helper function to serialize data with BigInt support
const serializeWithBigInt = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'bigint') {
    // Convert BigInt to a special format that we can recognize later
    return { __type: 'bigint', value: data.toString() };
  }
  
  if (Array.isArray(data)) {
    // Process array elements recursively
    return data.map(item => serializeWithBigInt(item));
  }
  
  if (typeof data === 'object') {
    // Process object properties recursively
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = serializeWithBigInt(data[key]);
      }
    }
    return result;
  }
  
  // Return primitive values as is
  return data;
};

// Helper function to deserialize data with BigInt support
const deserializeWithBigInt = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'object' && data.__type === 'bigint' && typeof data.value === 'string') {
    // Convert back to BigInt
    return BigInt(data.value);
  }
  
  if (Array.isArray(data)) {
    // Process array elements recursively
    return data.map(item => deserializeWithBigInt(item));
  }
  
  if (typeof data === 'object') {
    // Process object properties recursively
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = deserializeWithBigInt(data[key]);
      }
    }
    return result;
  }
  
  // Return primitive values as is
  return data;
};

export function useClashView(batchSize: number = 10) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [groupedClashes, setGroupedClashes] = useState<GroupedClashes>({
    pendingResults: [],
    completed: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [requestErrors, setRequestErrors] = useState<{[clashId: string]: number}>({});
  
  // Track if the component is mounted to avoid state updates on unmounted component
  const [isMounted, setIsMounted] = useState(true);
  
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      // Clear queue when component unmounts
      requestQueue = [];
    };
  }, []);

  // Initialize cache on component mount
  useEffect(() => {
    setIsMounted(true);
    // Load cache from localStorage on component mount
    initializeCache();
    
    return () => {
      setIsMounted(false);
      // Clear queue when component unmounts
      requestQueue = [];
    };
  }, []);

  // Helper function to save cache to localStorage with BigInt handling
  const saveToCache = useCallback((key: string, data: any, clashState?: number) => {
    try {
      // Determine TTL based on clash state
      const ttl = clashState === ClashState.COMPLETED_WITH_RESULTS 
        ? COMPLETED_CACHE_TTL 
        : CACHE_TTL;
      
      // Save to in-memory cache
      clashCache.set(key, { 
        data, 
        timestamp: Date.now() 
      });
      
      // Serialize data with BigInt support and save to localStorage
      const serializedData = serializeWithBigInt({
        data,
        timestamp: Date.now(),
        state: clashState
      });
      
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${key}`, 
        JSON.stringify(serializedData)
      );
      
      // Update last fetch time
      localStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
      
      console.log(`Cached clash data for key: ${key}, state: ${clashState}`);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, []);
  
  // Helper function to check if cached data is still valid
  const isCacheValid = useCallback((cacheEntry: CacheEntry, clashState?: number) => {
    if (!cacheEntry) return false;
    
    const now = Date.now();
    const ttl = clashState === ClashState.COMPLETED_WITH_RESULTS 
      ? COMPLETED_CACHE_TTL 
      : CACHE_TTL;
    
    return (now - cacheEntry.timestamp) < ttl;
  }, []);

  // Get user's clashes by state using the Stats contract
  // This already efficiently returns only the clashes that the user is part of
  const userClashIdsQuery = useReadContract({
    address: CRITTER_CLASH_STATS_ADDRESS,
    abi: [
      {
        name: 'getUserClashIds',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'acceptingPlayersClashes', type: 'uint256[]' },
          { name: 'clashingClashes', type: 'uint256[]' },
          { name: 'completedClashes', type: 'uint256[]' }
        ]
      }
    ],
    functionName: 'getUserClashIds',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 30000, // Reduce polling frequency to 30 seconds for more responsiveness
      staleTime: 15000, // Consider data stale after 15 seconds to ensure updates are captured quickly
    }
  });

  // Sleep function for rate limiting
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Check if a clash ID is known to be invalid
  const isInvalidClashId = useCallback((clashId: bigint): boolean => {
    const idStr = clashId.toString();
    const record = invalidClashIds.get(idStr);
    
    if (record) {
      // Check if the invalid record has expired
      if (Date.now() - record.timestamp > INVALID_ID_TTL) {
        // Record expired, remove it and allow retrying
        invalidClashIds.delete(idStr);
        return false;
      }
      return true;
    }
    return false;
  }, []);

  // Process the request queue
  const processQueue = useCallback(async () => {
    if (isProcessingQueue || !publicClient) return;
    
    isProcessingQueue = true;
    
    try {
      while (requestQueue.length > 0) {
        // Sort queue by priority (higher first)
        requestQueue.sort((a, b) => b.priority - a.priority);
        
        const request = requestQueue.shift();
        if (!request) continue;
        
        const { clashId, resolve, reject, retries } = request;
        const clashIdStr = clashId.toString();
        
        // Skip if clash ID is known to be invalid
        if (isInvalidClashId(clashId)) {
          console.log(`Skipping known invalid clash ID ${clashIdStr}`);
          reject(new Error(`Known invalid clash ID: ${clashIdStr}`));
          continue;
        }
        
        // Enforce global rate limit
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < GLOBAL_RATE_LIMIT) {
          await sleep(GLOBAL_RATE_LIMIT - timeSinceLastRequest);
        }
        
        try {
          console.log(`Processing queued request for clash ID ${clashId}`);
          const result = await publicClient.readContract({
            address: CRITTER_CLASH_CORE_ADDRESS,
            abi: CRITTER_CLASH_CORE_ABI,
            functionName: 'getClashInfo',
            args: [clashId]
          });
          
          lastRequestTime = Date.now();
          
          // Extract clash state for caching purposes
          let clashState: number | undefined;
          if (Array.isArray(result) && result.length > 1) {
            clashState = typeof result[1] === 'number' ? result[1] : Number(result[1]);
          }
          
          // Cache the result with enhanced persistence
          const cacheKey = `${clashIdStr}-${address}`;
          saveToCache(cacheKey, result, clashState);
          
          resolve(result);
        } catch (error: any) {
          console.error(`Error in queue processing for clash ID ${clashId}:`, error);
          lastRequestTime = Date.now();
          
          // Handle specific errors
          const errorMessage = error.message || '';
          
          // Check for "Invalid clash ID" or similar contract revert messages
          if (
            errorMessage.includes('Invalid clash ID') || 
            errorMessage.includes('reverted') ||
            errorMessage.includes('does not exist')
          ) {
            console.warn(`Adding clash ID ${clashIdStr} to invalid IDs list due to contract revert`);
            // Add to invalid IDs map to avoid future requests
            invalidClashIds.set(clashIdStr, {
              timestamp: Date.now(),
              reason: errorMessage
            });
            reject(new Error(`Invalid clash ID: ${clashIdStr}`));
          }
          // Check if it's a rate limit error
          else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            // Add back to queue with increased backoff if not exceeding max retries
            if (retries < MAX_RETRIES) {
              console.log(`Rate limit hit, re-queueing clash ID ${clashId} (retry ${retries + 1}/${MAX_RETRIES})`);
              requestQueue.push({
                clashId,
                resolve,
                reject,
                priority: request.priority - 1, // Lower priority slightly
                retries: retries + 1
              });
              
              // Wait longer between retries
              const backoffTime = Math.min(2000 * Math.pow(2, retries), 10000);
              await sleep(backoffTime);
            } else {
              reject(error);
            }
          } else {
            reject(error);
          }
        }
      }
    } finally {
      isProcessingQueue = false;
    }
  }, [publicClient, address, isInvalidClashId]);

  // Queue a request and start processing
  const queueRequest = useCallback((clashId: bigint, priority: number = 1): Promise<any> => {
    // Check if the clash ID is known to be invalid before queueing
    if (isInvalidClashId(clashId)) {
      return Promise.reject(new Error(`Known invalid clash ID: ${clashId.toString()}`));
    }
    
    return new Promise((resolve, reject) => {
      requestQueue.push({
        clashId,
        resolve,
        reject,
        priority,
        retries: 0
      });
      
      // Start processing the queue if it's not already running
      processQueue();
    });
  }, [processQueue, isInvalidClashId]);

  // Fetch clash details with caching and queue management
  const fetchClashInfo = useCallback(async (clashId: bigint, priority: number = 1) => {
    if (!address || !publicClient) return null;
    
    const clashIdStr = clashId.toString();
    
    // Check if clash ID is known to be invalid
    if (isInvalidClashId(clashId)) {
      console.log(`Skipping fetch for known invalid clash ID ${clashIdStr}`);
      return null;
    }
    
    // Check if we've had too many errors for this clash ID
    if (requestErrors[clashIdStr] && requestErrors[clashIdStr] >= MAX_RETRIES) {
      console.warn(`Skipping fetch for clash ID ${clashIdStr} due to too many previous errors`);
      return null;
    }
    
    // Check cache first
    const cacheKey = `${clashIdStr}-${address}`;
    const cachedData = clashCache.get(cacheKey);
    
    // Try to get clash state from cached data for TTL determination
    let clashState: number | undefined;
    if (cachedData && cachedData.data && Array.isArray(cachedData.data) && cachedData.data.length > 1) {
      clashState = typeof cachedData.data[1] === 'number' ? cachedData.data[1] : Number(cachedData.data[1]);
    }
    
    // Check if cache is valid based on clash state
    if (cachedData) {
      const isValid = isCacheValid(cachedData, clashState);
      if (isValid) {
        console.log(`Using cached data for clash ID ${clashIdStr}, state: ${clashState}`);
        return cachedData.data;
      }
    }
    
    // For completed clashes, we can also check localStorage as backup
    if (clashState === ClashState.COMPLETED_WITH_RESULTS) {
      try {
        const storageKey = `${STORAGE_KEY_PREFIX}${cacheKey}`;
        const storedData = localStorage.getItem(storageKey);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          // Deserialize data with BigInt support
          const deserializedData = deserializeWithBigInt(parsedData);
          if (
            deserializedData.timestamp && 
            deserializedData.data && 
            Date.now() - deserializedData.timestamp < COMPLETED_CACHE_TTL
          ) {
            console.log(`Using localStorage data for completed clash ID ${clashIdStr}`);
            // Refresh in-memory cache
            clashCache.set(cacheKey, { 
              data: deserializedData.data, 
              timestamp: deserializedData.timestamp 
            });
            return deserializedData.data;
          }
        }
      } catch (error) {
        console.error(`Error reading from localStorage for clash ${clashIdStr}:`, error);
      }
    }
    
    try {
      return await queueRequest(clashId, priority);
    } catch (error: any) {
      // Check if it's an invalid clash ID error
      if (
        error.message && (
          error.message.includes('Invalid clash ID') || 
          error.message.includes('Known invalid clash ID')
        )
      ) {
        // Already handled in the queue processing
        return null;
      }
      
      // Track error count for other types of errors
      setRequestErrors(prev => ({
        ...prev,
        [clashIdStr]: (prev[clashIdStr] || 0) + 1
      }));
      
      console.error(`Error fetching clash info for ID ${clashId}:`, error);
      
      // If we have cached data, return it even if it's expired
      if (cachedData) {
        console.log(`Using expired cached data for clash ID ${clashIdStr} due to error`);
        return cachedData.data;
      }
      
      return null;
    }
  }, [address, publicClient, queueRequest, requestErrors, isInvalidClashId]);

  // Process a single clash's data
  const processClashData = useCallback((clashData: any, clashId: bigint) => {
    if (!clashData) return null;
    
    try {
      // Handle different contract versions by checking array length
      // This makes the hook more resilient to contract changes
      let clashSize, state, playerCount, startTime, isProcessed, players, critterIds, boosts, scores, results;
      
      if (Array.isArray(clashData)) {
        // Extract data based on array length
        if (clashData.length >= 10) {
          [clashSize, state, playerCount, startTime, isProcessed, players, critterIds, boosts, scores, results] = clashData;
        } else if (clashData.length >= 8) {
          // Older contract version might have fewer fields
          [clashSize, state, playerCount, startTime, players, critterIds, scores, results] = clashData;
          isProcessed = state === ClashState.COMPLETED_WITH_RESULTS;
          boosts = players.map(() => BigInt(0)); // Default if not provided
        } else {
          console.error(`Unexpected clash data format for ID ${clashId}:`, clashData);
          return null;
        }
      } else {
        console.error(`Clash data is not an array for ID ${clashId}:`, clashData);
        return null;
      }
      
      // Handle numeric state (might be returned as number instead of enum)
      if (typeof state === 'number') {
        if (state === 0) state = ClashState.ACCEPTING_PLAYERS;
        else if (state === 1) state = ClashState.CLASHING;
        else if (state === 2) state = ClashState.COMPLETED_WITH_RESULTS;
      }
      
      // Ensure all arrays are properly defined
      players = Array.isArray(players) ? players : [];
      critterIds = Array.isArray(critterIds) ? critterIds : [];
      boosts = Array.isArray(boosts) ? boosts : Array(players.length).fill(BigInt(0));
      scores = Array.isArray(scores) ? scores : Array(players.length).fill(BigInt(0));
      results = Array.isArray(results) ? results : [];
      
      // CRITICAL CHECK: Skip this clash if the user is not a participant
      if (address && players.length > 0) {
        const isUserParticipant = players.some(p => 
          p && typeof p === 'string' && 
          address && 
          p.toLowerCase() === address.toLowerCase()
        );
        
        if (!isUserParticipant) {
          console.log(`Skipping clash ${clashId}: user ${address} is not a participant in players list`);
          return null;
        }
      }
      
      // Map players array to correctly structured objects
      const playersList = players.map((player: string, idx: number) => ({
        player: player as `0x${string}`,
        critterId: critterIds[idx] || BigInt(0),
        score: scores[idx] || BigInt(0),
        boost: boosts[idx] || BigInt(0)
      }));
      
      // Calculate totalPrize based on playerCount, clashSize and appropriate entryFee
      // 2-player clashes: 1 MON, 4-player clashes: 2 MON
      const clashSizeNum = typeof clashSize === 'number' ? clashSize : Number(clashSize);
      const entryFee = clashSizeNum === ClashSize.Two 
        ? BigInt('1000000000000000000') // 1 MON for 2-player
        : BigInt('2000000000000000000'); // 2 MON for 4-player
      
      const actualPlayerCount = typeof playerCount === 'number' ? playerCount : Number(playerCount);
      const calculatedPrize = entryFee * BigInt(actualPlayerCount);
      
      // If there are results with rewards, use the highest reward as confirmation
      let totalRewards = BigInt(0);
      if (results && results.length > 0) {
        results.forEach((result: any) => {
          if (result && result.reward) {
            totalRewards += result.reward;
          }
        });
      }
      
      // Use the calculated prize or rewards sum, whichever is higher
      const totalPrize = totalRewards > BigInt(0) ? totalRewards : calculatedPrize;
      
      const clash: ClashDetail = {
        id: clashId,
        clashSize: typeof clashSize === 'number' ? clashSize : Number(clashSize),
        state,
        playerCount: actualPlayerCount,
        startTime,
        players: playersList,
        results: results || [],
        maxPlayers: (typeof clashSize === 'number' ? clashSize : Number(clashSize)) === ClashSize.Two ? 2 : 4,
        totalPrize: totalPrize, // Use calculated prize
        status: state === ClashState.COMPLETED_WITH_RESULTS ? 'Completed' : 'Active',
        hasEnded: state === ClashState.COMPLETED_WITH_RESULTS,
        isProcessed: typeof isProcessed === 'boolean' ? isProcessed : state === ClashState.COMPLETED_WITH_RESULTS
      };
      
      return clash;
    } catch (err) {
      console.error(`Error processing clash data for ID ${clashId}:`, err);
      return null;
    }
  }, [address]);

  // Filter clash IDs to remove known invalid IDs
  const filterInvalidClashIds = useCallback((clashIds: readonly bigint[]): bigint[] => {
    return [...clashIds].filter(id => !isInvalidClashId(id));
  }, [isInvalidClashId]);

  // Prioritize processing active clashes first, then most recent completed clashes
  const prioritizeClashIds = useCallback((clashingIds: readonly bigint[], completedIds: readonly bigint[]): {
    prioritizedClashing: bigint[],
    prioritizedCompleted: bigint[]
  } => {
    // Filter out invalid clash IDs
    const validClashingIds = filterInvalidClashIds(clashingIds);
    const validCompletedIds = filterInvalidClashIds(completedIds);
    
    // Clashing IDs get highest priority (active games)
    const prioritizedClashing = [...validClashingIds];
    
    // For completed IDs, we'll assume newer IDs (higher numbers) are more important
    // This is a heuristic - adjust if your ID system works differently
    const prioritizedCompleted = [...validCompletedIds].sort((a, b) => {
      return Number(b - a); // Sort in descending order (newer first)
    });
    
    // Process all completed clashes for the initial load, then limit on subsequent loads
    // to balance between showing all user's clashes and performance
    let limitedCompleted = prioritizedCompleted;
    
    try {
      // Check when we last did a full fetch
      const lastFetchStr = localStorage.getItem(LAST_FETCH_KEY);
      const lastFetchTime = lastFetchStr ? parseInt(lastFetchStr) : 0;
      const now = Date.now();
      
      // If we've done a full fetch recently, limit the number of clashes to process
      // to reduce API load on frequent page views
      const FULL_FETCH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
      const MAX_COMPLETED_TO_PROCESS = 50; // Increased to 50 to ensure we get all completed clashes
      
      if (now - lastFetchTime < FULL_FETCH_INTERVAL && prioritizedCompleted.length > MAX_COMPLETED_TO_PROCESS) {
        // Recent fetch and we have many completed clashes, only process a subset
        console.log('Recent fetch detected, limiting completed clashes to process');
        limitedCompleted = prioritizedCompleted.slice(0, MAX_COMPLETED_TO_PROCESS);
      } else {
        // No recent full fetch or few completed clashes, process all of them
        console.log('Processing all completed clashes');
        localStorage.setItem(LAST_FETCH_KEY, now.toString());
      }
    } catch (error) {
      console.error('Error checking last fetch time:', error);
      // Fallback to limited processing in case of error
      limitedCompleted = prioritizedCompleted.slice(0, 15);
    }
    
    return {
      prioritizedClashing,
      prioritizedCompleted: limitedCompleted
    };
  }, [filterInvalidClashIds]);

  // Fetch and process clashes in batches to avoid rate limiting
  const fetchAndProcessClashes = useCallback(async (
    acceptingPlayersIds: readonly bigint[], 
    clashingIds: readonly bigint[],
    completedIds: readonly bigint[]
  ) => {
    if (!publicClient || !address || !isMounted) {
      console.error('Public client, address not available, or component unmounted');
      return;
    }
    
    if (isMounted) setIsLoading(true);
    
    try {
      // Filter out any known invalid clash IDs first
      const filteredAcceptingIds = filterInvalidClashIds(acceptingPlayersIds);
      const filteredClashingIds = filterInvalidClashIds(clashingIds);
      const filteredCompletedIds = filterInvalidClashIds(completedIds);
      
      console.log('Fetching clash details for IDs (after filtering invalid):', {
        accepting: filteredAcceptingIds.length,
        clashing: filteredClashingIds.length,
        completed: filteredCompletedIds.length
      });
      
      const pendingResults: { id: bigint; clash: ClashDetail }[] = [];
      const completed: { id: bigint; clash: ClashDetail; results: any[] }[] = [];
      
      // Prioritize the clash IDs
      const { prioritizedClashing, prioritizedCompleted } = prioritizeClashIds(filteredClashingIds, filteredCompletedIds);
      
      console.log(`Processing ${prioritizedClashing.length} clashing and ${prioritizedCompleted.length} completed clashes (prioritized/limited)`);
      
      // Helper function to process a batch of clash IDs
      const processBatch = async (clashIds: readonly bigint[], isCompleted: boolean, batchIndex: number) => {
        // Calculate a progressive delay based on batch index to implement backoff
        const batchDelay = Math.min(MIN_BATCH_DELAY * Math.pow(1.5, batchIndex), MAX_BATCH_DELAY);
        
        for (let i = 0; i < clashIds.length; i += BATCH_SIZE) {
          const batchClashIds = clashIds.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(clashIds.length / BATCH_SIZE)}: ${batchClashIds.map(id => id.toString()).join(', ')}`);
          
          // Process each clash in the batch sequentially to avoid overwhelming the RPC
          for (const clashId of batchClashIds) {
            try {
              // Skip if clash ID is known to be invalid
              if (isInvalidClashId(clashId)) {
                console.log(`Skipping known invalid clash ID ${clashId} during batch processing`);
                continue;
              }
              
              // Set priority higher for clashing clashes than completed ones
              const priority = isCompleted ? 1 : 2;
              const clashData = await fetchClashInfo(clashId, priority);
              if (clashData) {
                const clash = processClashData(clashData, clashId);
                if (clash) {
                  // Verify this is the right clash state before adding it
                  if (isCompleted && clash.state === ClashState.COMPLETED_WITH_RESULTS) {
                    completed.push({ id: clashId, clash, results: clash.results });
                  } else if (!isCompleted && clash.state === ClashState.CLASHING) {
                    pendingResults.push({ id: clashId, clash });
                  } else {
                    // Additional check: completed IDs might include clashes that aren't fully completed yet
                    // This helps handle contract state transitions that might have occurred
                    if (isCompleted && clash.state === ClashState.CLASHING) {
                      pendingResults.push({ id: clashId, clash });
                    } else if (!isCompleted && clash.state === ClashState.COMPLETED_WITH_RESULTS) {
                      completed.push({ id: clashId, clash, results: clash.results });
                    }
                    
                    console.log(`Clash ${clashId} has state ${ClashState[clash.state]} but was in ${isCompleted ? 'completed' : 'clashing'} list`);
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing clash ID ${clashId}:`, error);
              // Continue with the next clash ID even if this one fails
            }
          }
          
          // Add delay between batches with progressive backoff
          if (i + BATCH_SIZE < clashIds.length) {
            console.log(`Waiting ${batchDelay}ms before processing next batch...`);
            await sleep(batchDelay);
          }
        }
      };
      
      // Process clashing clashes (for pending results tab) first (higher priority)
      if (prioritizedClashing.length > 0) {
        await processBatch(prioritizedClashing, false, 0);
      }
      
      // Process completed clashes with a slightly longer delay to prioritize active clashes
      if (prioritizedCompleted.length > 0) {
        // Add extra delay before starting completed clashes
        if (prioritizedClashing.length > 0) {
          await sleep(MIN_BATCH_DELAY);
        }
        await processBatch(prioritizedCompleted, true, prioritizedClashing.length > 0 ? 1 : 0);
      }
      
      console.log('Processed clash results:', {
        pendingResults: pendingResults.length,
        completed: completed.length
      });
      
      if (isMounted) {
        setGroupedClashes({ pendingResults, completed });
      }
    } catch (err) {
      console.error('Error fetching clash details:', err);
      if (isMounted) {
        setError(err instanceof Error ? err : new Error('Failed to fetch clash details'));
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }, [fetchClashInfo, processClashData, publicClient, address, prioritizeClashIds, isMounted, filterInvalidClashIds, isInvalidClashId]);

  // Process data when getUserClashIds query returns
  useEffect(() => {
    if (!userClashIdsQuery.data || !address || !publicClient || !isMounted) return;
    
    try {
      // We already have user-specific clash IDs from the contract
      // so no additional filtering by user is needed
      const data = userClashIdsQuery.data as unknown as [bigint[], bigint[], bigint[]];
      
      // Validate data structure
      if (!Array.isArray(data) || data.length < 3) {
        console.error("Invalid data structure from getUserClashIds:", data);
        if (isMounted) {
          setError(new Error("Invalid data from contract. The structure may have changed."));
          setIsLoading(false);
        }
        return;
      }
      
      const [acceptingPlayersIds, clashingIds, completedIds] = data;
      
      // Validate that each item is an array
      if (!Array.isArray(acceptingPlayersIds) || !Array.isArray(clashingIds) || !Array.isArray(completedIds)) {
        console.error("Invalid arrays in getUserClashIds result:", { acceptingPlayersIds, clashingIds, completedIds });
        if (isMounted) {
          setError(new Error("Invalid arrays in contract response. The structure may have changed."));
          setIsLoading(false);
        }
        return;
      }
      
      console.log('User clash IDs retrieved successfully:', {
        userId: address,
        acceptingPlayers: acceptingPlayersIds.length,
        clashing: clashingIds.length,
        completed: completedIds.length,
        acceptingIds: acceptingPlayersIds.map(id => id.toString()),
        clashingIds: clashingIds.map(id => id.toString()),
        completedIds: completedIds.map(id => id.toString())
      });
      
      // Only fetch details if there are clash IDs to process
      // Prioritize active clashes (CLASHING state)
      const hasClashesToProcess = clashingIds.length > 0 || completedIds.length > 0 || acceptingPlayersIds.length > 0;
      
      if (hasClashesToProcess) {
        fetchAndProcessClashes(acceptingPlayersIds, clashingIds, completedIds);
      } else {
        // If no clashes, set empty state and stop loading
        if (isMounted) {
          setGroupedClashes({ pendingResults: [], completed: [] });
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Error processing clash IDs:', err);
      if (isMounted) {
        setError(err instanceof Error ? err : new Error('Failed to process clash IDs'));
        setIsLoading(false);
      }
    }
  }, [userClashIdsQuery.data, fetchAndProcessClashes, address, publicClient, isMounted]);

  // Handle loading state
  useEffect(() => {
    if (userClashIdsQuery.isLoading && isMounted) {
      setIsLoading(true);
    }
  }, [userClashIdsQuery.isLoading, isMounted]);

  // Handle errors
  useEffect(() => {
    const queryError = userClashIdsQuery.error;
    if (queryError && isMounted) {
      console.error('Error in getUserClashIds query:', queryError);
      setError(queryError instanceof Error ? queryError : new Error('Failed to fetch clash IDs'));
      setIsLoading(false);
    }
  }, [userClashIdsQuery.error, isMounted]);

  // Clear invalid clash IDs periodically
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleared = 0;
      
      invalidClashIds.forEach((record, idStr) => {
        if (now - record.timestamp > INVALID_ID_TTL) {
          invalidClashIds.delete(idStr);
          cleared++;
        }
      });
      
      if (cleared > 0) {
        console.log(`Cleared ${cleared} expired invalid clash IDs from memory`);
      }
    }, 30 * 60 * 1000); // Run every 30 minutes
    
    return () => clearInterval(cleanupTimer);
  }, []);

  // Refetch function to manually trigger a refresh
  const refetch = useCallback(() => {
    if (userClashIdsQuery.refetch && isMounted) {
      console.log('Manually refetching clash data for user:', address);
      
      // Clear request error counts on manual refresh
      setRequestErrors({});
      
      // Selectively clear cache for non-completed clashes 
      // (keep completed clashes cached to reduce API load)
      try {
        // Clear in-memory cache for non-completed clashes
        clashCache.forEach((entry, key) => {
          // Try to determine if this is a completed clash
          let isCompleted = false;
          if (entry.data && Array.isArray(entry.data) && entry.data.length > 1) {
            const state = typeof entry.data[1] === 'number' ? entry.data[1] : Number(entry.data[1]);
            isCompleted = state === ClashState.COMPLETED_WITH_RESULTS;
          }
          
          // Only remove non-completed clashes from in-memory cache
          if (!isCompleted) {
            clashCache.delete(key);
          }
        });
        
        console.log('Cleared non-completed clashes from in-memory cache');
      } catch (error) {
        console.error('Error clearing cache selectively:', error);
      }
      
      // Refetch the data
      userClashIdsQuery.refetch();
    }
  }, [userClashIdsQuery.refetch, isMounted, address]);

  return {
    groupedClashes,
    isLoading,
    error,
    refetch
  };
}