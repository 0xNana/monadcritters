import { usePublicClient } from 'wagmi';
import { MONAD_CRITTER_ABI, MONAD_CRITTER_ADDRESS } from '../constants/contracts';
import { useAccount } from 'wagmi';
import { useState, useEffect, useRef, useCallback } from 'react';


interface CritterStats {
  speed: number;
  stamina: number;
  luck: number;
  rarity: number;
}

export interface UserCritter {
  critter: any;
  id: string;
  stats: CritterStats;
}

const rarityMap = ['common', 'uncommon', 'rare', 'legendary'] as const;

// Cache for critter stats to reduce API calls
const statsCache = new Map<string, { stats: CritterStats; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

// Cache for user's critter IDs
const userCrittersCache = new Map<string, { 
  tokenIds: string[]; 
  timestamp: number;
  lastError?: string;
  errorCount: number;
}>();

// Request queue for throttling
const requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;
const MAX_REQUESTS_PER_BATCH = 3; // Reduced from 5 to 3
const BATCH_DELAY = 2000; // Increased from 1000ms to 2000ms

// Process the request queue with throttling
const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    // Process requests in batches
    while (requestQueue.length > 0) {
      const batch = requestQueue.splice(0, MAX_REQUESTS_PER_BATCH);
      
      try {
        await Promise.all(batch.map(fn => fn()));
      } catch (error) {

        // Continue processing the queue even if a batch fails
      }
      
      // Add delay between batches if there are more requests
      if (requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
  } finally {
    isProcessingQueue = false;
  }
};

export const useUserCritters = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [userCritters, setUserCritters] = useState<UserCritter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchTime = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef<number>(0);
  const maxRetries = 2;
  
  // Memoized function to fetch critter stats with caching
  const fetchCritterStats = useCallback(async (tokenId: bigint): Promise<UserCritter | null> => {
    const id = tokenId.toString();
    
    // Check cache first
    const cachedData = statsCache.get(id);
    const now = Date.now();
    
    if (cachedData && (now - cachedData.timestamp) < CACHE_TTL) {
      return {
        id,
        stats: cachedData.stats,
        critter: null
      };
    }
    
    try {
      // Add to request queue for throttling
      return new Promise((resolve) => {
        const fetchFn = async () => {
          if (!publicClient) {
            resolve(null);
            return;
          }
          
          try {
            const result = await publicClient.readContract({
              address: MONAD_CRITTER_ADDRESS,
              abi: MONAD_CRITTER_ABI,
              functionName: 'getStats',
              args: [tokenId]
            });
            
            // Process the raw stats from the contract - handle various return types
            let speed = 0, stamina = 0, luck = 0, rarity = 0;
            
            // Check if result exists
            if (result) {
              try {
                if (Array.isArray(result)) {
                  // Handle array result
                  speed = result.length > 0 ? Number(result[0]) : 0;
                  stamina = result.length > 1 ? Number(result[1]) : 0;
                  luck = result.length > 2 ? Number(result[2]) : 0;
                  rarity = result.length > 3 ? Number(result[3]) : 0;
                } else if (typeof result === 'object' && result !== null) {
                  // Handle object result with property access
                  const obj = result as Record<string, any>;
                  speed = 'speed' in obj ? Number(obj.speed) : 0;
                  stamina = 'stamina' in obj ? Number(obj.stamina) : 0;
                  luck = 'luck' in obj ? Number(obj.luck) : 0;
                  rarity = 'rarity' in obj ? Number(obj.rarity) : 0;
                }
              } catch (err) {
                console.error(`Error parsing stats for critter #${id}:`, err);
                // Use default values if parsing fails
              }
            }
            
            // Create the processed stats object
            const processedStats: CritterStats = {
              speed: isNaN(speed) ? 50 : speed,
              stamina: isNaN(stamina) ? 50 : stamina,
              luck: isNaN(luck) ? 50 : luck,
              rarity: isNaN(rarity) ? 0 : rarity
            };
            
            // Update cache with validated stats
            statsCache.set(id, { stats: processedStats, timestamp: now });
            
            resolve({
              id,
              stats: processedStats,
              critter: null
            });
          } catch (error: any) {
            console.error(`Failed to fetch stats for critter #${id}:`, error);
            
            // If it's a rate limit error, use cached data if available
            if (error.message?.includes('429') || error.message?.includes('rate limit')) {
              if (cachedData) {
                return resolve({
                  id,
                  stats: cachedData.stats,
                  critter: null
                });
              }
            }
            
            // Return a default stats object rather than null to ensure we always show something
            const defaultStats: CritterStats = {
              speed: 50,
              stamina: 50,
              luck: 50,
              rarity: 0
            };
            
            // Update cache with default stats to avoid repeated failures
            statsCache.set(id, { stats: defaultStats, timestamp: now });
            
            resolve({
              id,
              stats: defaultStats,
              critter: null
            });
          }
        };
        
        requestQueue.push(fetchFn);
        processQueue();
      });
    } catch (error) {
      console.error(`Error in fetchCritterStats for #${id}:`, error);
      // Always return a valid critter object
      return {
        id,
        stats: {
          speed: 50,
          stamina: 50,
          luck: 50,
          rarity: 0
        },
        critter: null
      };
    }
  }, [publicClient]);
  
  // Get user's critter IDs with caching and rate limiting
  const fetchUserCritterIds = useCallback(async (): Promise<string[]> => {
    if (!address || !publicClient) return [];
    
    const userAddress = address.toLowerCase();
    const now = Date.now();
    
    // Check cache first
    const cachedData = userCrittersCache.get(userAddress);
    if (cachedData && (now - cachedData.timestamp) < CACHE_TTL) {
      // If we have recent errors, don't use cache
      if (cachedData.errorCount > 2 && (now - cachedData.timestamp) < 30000) {
      } else {
        return cachedData.tokenIds;
      }
    }
    
    try {
      // Use the getTokensOfOwner function from the contract
      const tokenIds = await publicClient.readContract({
        address: MONAD_CRITTER_ADDRESS,
        abi: [
          {
            name: 'getTokensOfOwner',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ type: 'address', name: 'owner' }],
            outputs: [{ type: 'uint256[]' }],
          }
        ],
        functionName: 'getTokensOfOwner',
        args: [address as `0x${string}`]
      }) as unknown as bigint[];
      
      if (!tokenIds || tokenIds.length === 0) {
        // Cache empty result
        userCrittersCache.set(userAddress, { 
          tokenIds: [], 
          timestamp: now,
          errorCount: 0
        });
        return [];
      }
      
      const tokenIdStrings = tokenIds.map(id => id.toString());
      
      // Update cache
      userCrittersCache.set(userAddress, { 
        tokenIds: tokenIdStrings, 
        timestamp: now,
        errorCount: 0
      });
      
      return tokenIdStrings;
    } catch (error: any) {
      console.error('Error fetching user critter IDs:', error);
      
      // Update cache with error
      const existingCache = userCrittersCache.get(userAddress) || { 
        tokenIds: [], 
        timestamp: 0,
        errorCount: 0
      };
      
      userCrittersCache.set(userAddress, { 
        ...existingCache,
        lastError: error.message,
        errorCount: existingCache.errorCount + 1,
        timestamp: now
      });
      
      // If we have cached data, use it despite the error
      if (existingCache.tokenIds.length > 0) {
        console.log('Using cached critter IDs due to error');
        return existingCache.tokenIds;
      }
      
      return [];
    }
  }, [address, publicClient]);
  
  // Debounced fetch function to prevent rapid consecutive calls
  const debouncedFetchCritters = useCallback(async () => {
    if (!address || !publicClient) return;
    
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // Set a new timeout to debounce the fetch
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if we've fetched recently (within 30 seconds)
        const now = Date.now();
        if (now - lastFetchTime.current < 30000) {
          setIsLoading(false);
          return;
        }
        
        lastFetchTime.current = now;
        
        // Get user's critter IDs with caching
        const tokenIdStrings = await fetchUserCritterIds();
        
        if (tokenIdStrings.length === 0) {
          setUserCritters([]);
          setIsLoading(false);
          return;
        }
        
        // Check if we already have all these critters with the same IDs
        const currentIds = new Set(userCritters.map(c => c.id));
        const newIds = new Set(tokenIdStrings);
        
        // If the sets are identical, skip fetching stats
        if (currentIds.size === newIds.size && 
            [...currentIds].every(id => newIds.has(id))) {
          setIsLoading(false);
          return;
        }
        
        // Convert string IDs to bigint for the contract call
        const tokenIds = tokenIdStrings.map(id => BigInt(id));
        
        // Fetch stats for each critter with throttling
        const updatedCritters = await Promise.all(
          tokenIds.map(fetchCritterStats)
        );
        
        // Filter out any failed fetches and sort by ID
        const validCritters = updatedCritters
          .filter((critter): critter is UserCritter => critter !== null)
          .sort((a, b) => parseInt(a.id) - parseInt(b.id));
        
        setUserCritters(validCritters);
        retryCount.current = 0; // Reset retry count on success
      } catch (error) {
        console.error('Error loading critters:', error);
        setError(error instanceof Error ? error : new Error('Failed to load critters'));
        
        // Implement retry with exponential backoff
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          const backoffDelay = Math.min(2000 * Math.pow(2, retryCount.current), 10000);
          console.log(`Retrying in ${backoffDelay}ms (attempt ${retryCount.current}/${maxRetries})`);
          
          setTimeout(() => {
            debouncedFetchCritters();
          }, backoffDelay);
        }
      } finally {
        setIsLoading(false);
      }
    }, 1000); // Increased from 500ms to 1000ms
  }, [address, publicClient, userCritters, fetchCritterStats, fetchUserCritterIds]);
  
  // Initial load and setup polling
  useEffect(() => {
    debouncedFetchCritters();
    
    // Set up polling with a longer interval since critter ownership rarely changes
    const interval = setInterval(debouncedFetchCritters, 120000); // Poll every 120 seconds (increased from 60)
    
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      clearInterval(interval);
    };
  }, [debouncedFetchCritters]);
  
  return {
    userCritters,
    isLoading,
    error
  };
}; 