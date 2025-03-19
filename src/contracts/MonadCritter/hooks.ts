import { 
  readContract,
  writeContract,
  watchContractEvent,
  getAccount,
  simulateContract,
  readContracts,
  getPublicClient,
  type Config
} from '@wagmi/core';
import { 
  useReadContract as useWagmiReadContract,
  useWriteContract as useWagmiWriteContract,
  useWatchContractEvent as useWagmiWatchContractEvent,
  useAccount as useWagmiAccount,
  useSimulateContract as useWagmiSimulateContract,
  useReadContracts as useWagmiReadContracts,
  usePublicClient
} from 'wagmi';
import { Address } from 'viem';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { abi } from './abi';
import { CritterStats, Critter, CritterMetadata } from './types';

// Get contract address from environment variable
const MONAD_CONTRACT_ADDRESS = import.meta.env.VITE_MONAD_CRITTER_ADDRESS as Address;
if (!MONAD_CONTRACT_ADDRESS) {
  throw new Error('VITE_MONAD_CRITTER_ADDRESS is not defined in environment variables');
}

// Helper to get contract address
export function useContractAddress(): Address {
  return MONAD_CONTRACT_ADDRESS;
}

// Fallback contract address (Monad Testnet)
export const FALLBACK_CONTRACT_ADDRESS = MONAD_CONTRACT_ADDRESS;

// Constants for optimized fetching
const MAX_BATCH_SIZE = 3; // Reduced from 5 to 3 to avoid rate limits
const BATCH_INTERVAL = 2000; // Increased from 1000ms to 2000ms
const MAX_RETRIES = 5; // Increased from 3 to 5
const INITIAL_RETRY_DELAY = 2000; // Initial retry delay in ms

// Hook to get all owned critters efficiently
export function useOwnedCritters(ownerAddress?: Address) {
  const contractAddress = useContractAddress();
  const [critters, setCritters] = useState<ExtendedCritter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const publicClient = usePublicClient();
  const [retryCount, setRetryCount] = useState(0);

  // Add debug logging
  useEffect(() => {
    if (ownerAddress) {
      console.log('useOwnedCritters - Address:', ownerAddress);
      console.log('useOwnedCritters - Contract Address:', contractAddress);
    }
  }, [ownerAddress, contractAddress]);

  // Get balance with optimized caching
  const { data: balance, isLoading: isLoadingBalance } = useWagmiReadContract({
    address: contractAddress,
    abi,
    functionName: 'balanceOf',
    args: ownerAddress ? [ownerAddress] : undefined,
    query: {
      enabled: !!ownerAddress,
      gcTime: 300_000, // 5 minutes cache
      staleTime: 60_000, // Consider data fresh for 1 minute
      retry: (failureCount, error: any) => {
        // Only retry on rate limit errors
        if (error?.message?.includes('429')) {
          return failureCount < MAX_RETRIES;
        }
        return false;
      },
      retryDelay: (failureCount) => {
        // Exponential backoff: 2^n * 2000ms
        return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, failureCount), 30000);
      }
    }
  });

  // Add debug logging for balance
  useEffect(() => {
    if (balance !== undefined) {
      console.log('useOwnedCritters - Balance:', balance.toString());
    }
  }, [balance]);

  // Create batches of token indices to fetch
  const tokenBatches = useMemo(() => {
    if (!balance || !ownerAddress) {
      console.log('useOwnedCritters - No balance or owner address, returning empty batches');
      return [];
    }
    
    const balanceNum = Number(balance);
    console.log('useOwnedCritters - Creating batches for balance:', balanceNum);
    
    if (balanceNum === 0) {
      console.log('useOwnedCritters - Balance is 0, returning empty batches');
      return [];
    }
    
    const batches: number[][] = [];
    
    for (let i = 0; i < balanceNum; i += MAX_BATCH_SIZE) {
      const batchIndices: number[] = [];
      for (let j = i; j < Math.min(i + MAX_BATCH_SIZE, balanceNum); j++) {
        batchIndices.push(j);
      }
      batches.push(batchIndices);
    }
    
    console.log(`useOwnedCritters - Created ${batches.length} batches:`, batches);
    return batches;
  }, [balance, ownerAddress]);

  // State for tracking batch processing
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [batchRetries, setBatchRetries] = useState<Record<number, number>>({});

  // Prepare contract calls for the current batch
  const currentBatchCalls = useMemo(() => {
    if (!ownerAddress || !balance) {
      console.log('useOwnedCritters - No owner address or balance for batch calls');
      return [];
    }
    
    if (tokenBatches.length === 0) {
      console.log('useOwnedCritters - No token batches available');
      return [];
    }
    
    if (currentBatchIndex >= tokenBatches.length) {
      console.log('useOwnedCritters - Current batch index out of range');
      return [];
    }
    
    const currentBatch = tokenBatches[currentBatchIndex];
    console.log(`useOwnedCritters - Preparing calls for batch ${currentBatchIndex + 1}/${tokenBatches.length}:`, currentBatch);
    
    return currentBatch.map(index => ({
      address: contractAddress,
      abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [ownerAddress, BigInt(index)]
    }));
  }, [ownerAddress, balance, tokenBatches, currentBatchIndex, contractAddress]);

  // Use the useReadContracts hook to fetch the current batch
  const { data: currentBatchData, isLoading: isLoadingBatch } = useWagmiReadContracts({
    contracts: currentBatchCalls,
    query: {
      enabled: currentBatchCalls.length > 0,
      gcTime: 300_000,
      staleTime: 60_000,
      retry: (failureCount, error: any) => {
        if (error?.message?.includes('429')) {
          return failureCount < MAX_RETRIES;
        }
        return false;
      },
      retryDelay: (failureCount) => {
        // Exponential backoff: 2^n * 2000ms
        return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, failureCount), 30000);
      }
    }
  });

  // Process the current batch results and move to the next batch
  useEffect(() => {
    if (!currentBatchData || isLoadingBatch || currentBatchCalls.length === 0) return;
    
    // Debug logging
    console.log(`useOwnedCritters - Processing batch ${currentBatchIndex + 1}/${tokenBatches.length}`);
    console.log('useOwnedCritters - Current batch data:', currentBatchData);
    
    // Check if all results failed with 429 errors
    const allRateLimited = currentBatchData.every(result => 
      result && 'error' in result && 
      result.error?.message?.includes('429')
    );
    
    if (allRateLimited) {
      console.log('useOwnedCritters - All requests rate limited (429), implementing exponential backoff');
      
      // Get current retry count for this batch
      const currentRetries = batchRetries[currentBatchIndex] || 0;
      
      if (currentRetries < MAX_RETRIES) {
        // Implement exponential backoff
        const retryDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, currentRetries), 30000); // Max 30 seconds
        console.log(`useOwnedCritters - Retrying batch after ${retryDelay}ms delay (retry ${currentRetries + 1}/${MAX_RETRIES})`);
        
        // Update retry count for this batch
        setBatchRetries(prev => ({
          ...prev,
          [currentBatchIndex]: currentRetries + 1
        }));
        
        // Don't increment batch index, just wait and retry
        setTimeout(() => {
          console.log('useOwnedCritters - Retrying batch after backoff');
          // Force a re-render to retry the batch
          setIsLoading(prev => !prev);
          setIsLoading(prev => !prev);
        }, retryDelay);
        
        return;
      } else {
        console.log(`useOwnedCritters - Max retries (${MAX_RETRIES}) reached for batch ${currentBatchIndex}, moving to next batch`);
        // If we've reached max retries, move to the next batch
        if (currentBatchIndex < tokenBatches.length - 1) {
          setTimeout(() => {
            setCurrentBatchIndex(prev => prev + 1);
          }, BATCH_INTERVAL);
        } else {
          console.log('useOwnedCritters - All batches processed (with some failures), setting processingComplete to true');
          setProcessingComplete(true);
        }
        return;
      }
    }
    
    // Extract token IDs from the current batch
    const newTokenIds = currentBatchData
      .filter(result => result && !('error' in result))
      .map(result => result.result as bigint);
    
    // Debug logging
    console.log('useOwnedCritters - New token IDs:', newTokenIds.map(id => id.toString()));
    
    // Add to our collection
    setTokenIds(prev => [...prev, ...newTokenIds]);
    
    // Reset retry count for this batch since it succeeded
    setBatchRetries(prev => ({
      ...prev,
      [currentBatchIndex]: 0
    }));
    
    // Move to next batch after a delay to avoid rate limiting
    if (currentBatchIndex < tokenBatches.length - 1) {
      console.log(`useOwnedCritters - Moving to next batch after ${BATCH_INTERVAL}ms delay`);
      setTimeout(() => {
        setCurrentBatchIndex(prev => prev + 1);
      }, BATCH_INTERVAL);
    } else {
      console.log('useOwnedCritters - All batches processed, setting processingComplete to true');
      setProcessingComplete(true);
    }
  }, [currentBatchData, isLoadingBatch, currentBatchIndex, tokenBatches.length, currentBatchCalls.length]);

  // Add a fallback mechanism to directly fetch tokens if batching fails
  useEffect(() => {
    // If we've processed all batches but got no tokens, try a direct approach
    if (processingComplete && tokenIds.length === 0 && balance && Number(balance) > 0) {
      console.log('useOwnedCritters - Batch processing completed but no tokens found, trying direct approach');
      
      const fetchTokensDirectly = async () => {
        try {
          console.log('useOwnedCritters - Fetching tokens directly');
          
          // Create a simpler approach - fetch one token at a time with delays
          const directTokenIds: bigint[] = [];
          const balanceNum = Number(balance);
          
          // Use the publicClient directly instead of getPublicClient()
          if (!publicClient) {
            console.error('useOwnedCritters - No public client available');
            setError(new Error('No public client available'));
            setIsLoading(false);
            return;
          }
          
          for (let i = 0; i < balanceNum; i++) {
            try {
              // Add a delay between requests to avoid rate limiting
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
              }
              
              console.log(`useOwnedCritters - Directly fetching token at index ${i}`);
              
              // Use the publicClient's readContract method directly
              const result = await publicClient.readContract({
                address: contractAddress,
                abi,
                functionName: 'tokenOfOwnerByIndex',
                args: [ownerAddress!, BigInt(i)]
              });
              
              console.log(`useOwnedCritters - Got token ID: ${result}`);
              directTokenIds.push(result as bigint);
            } catch (err) {
              console.error(`useOwnedCritters - Error fetching token at index ${i}:`, err);
              // If we hit a rate limit, wait longer
              if (err instanceof Error && err.message.includes('429')) {
                console.log('useOwnedCritters - Rate limited, waiting 10 seconds');
                await new Promise(resolve => setTimeout(resolve, 10000));
              }
            }
          }
          
          if (directTokenIds.length > 0) {
            console.log('useOwnedCritters - Successfully fetched tokens directly:', directTokenIds);
            setTokenIds(directTokenIds);
          } else {
            console.error('useOwnedCritters - Failed to fetch any tokens directly');
            setError(new Error('Failed to fetch tokens due to rate limiting'));
            setIsLoading(false);
          }
        } catch (err) {
          console.error('useOwnedCritters - Error in direct token fetching:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch tokens'));
          setIsLoading(false);
        }
      };
      
      fetchTokensDirectly();
    }
  }, [processingComplete, tokenIds.length, balance, contractAddress, ownerAddress, publicClient]);

  // Prepare contract calls for stats once we have all token IDs
  const statsCalls = useMemo(() => {
    if (!processingComplete || tokenIds.length === 0) {
      return [];
    }
    
    return tokenIds.map(tokenId => ({
      address: contractAddress,
      abi,
      functionName: 'getStats',
      args: [tokenId]
    }));
  }, [processingComplete, tokenIds, contractAddress]);

  // Use the useReadContracts hook to fetch all stats
  const { data: statsData, isLoading: isLoadingStats } = useWagmiReadContracts({
    contracts: statsCalls,
    query: {
      enabled: statsCalls.length > 0,
      gcTime: 300_000,
      staleTime: 60_000,
      retry: (failureCount, error: any) => {
        if (error?.message?.includes('429')) {
          return failureCount < MAX_RETRIES;
        }
        return false;
      },
      retryDelay: (failureCount) => {
        // Exponential backoff: 2^n * 2000ms
        return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, failureCount), 30000);
      }
    }
  });

  // Process the stats results
  useEffect(() => {
    if (!statsData || isLoadingStats || !processingComplete) {
      return;
    }
    
    console.log('useOwnedCritters - Processing stats data:', statsData);
    console.log('useOwnedCritters - Token IDs:', tokenIds.map(id => id.toString()));
    
    // Check if all stats requests failed with 429 errors
    const allRateLimited = statsData.every(result => 
      result && 'error' in result && 
      result.error?.message?.includes('429')
    );
    
    if (allRateLimited && tokenIds.length > 0) {
      console.log('useOwnedCritters - All stats requests rate limited (429), will try direct approach');
      
      // We'll handle this in a separate effect
      return;
    }
    
    try {
      const allStats: Array<{
        tokenId: bigint;
        stats: {
          speed: number;
          stamina: number;
          luck: number;
          rarity: number;
        }
      }> = [];
      
      // Process results
      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        const result = statsData[i];
        
        if (result && !('error' in result)) {
          const stats = result.result as unknown as [bigint, bigint, bigint, bigint];
          
          allStats.push({
            tokenId,
            stats: {
              speed: Number(stats[0]),
              stamina: Number(stats[1]),
              luck: Number(stats[2]),
              rarity: Number(stats[3])
            }
          });
        } else {
          console.warn(`useOwnedCritters - Error getting stats for token ID ${tokenId}:`, result);
        }
      }
      
      console.log('useOwnedCritters - Processed stats:', allStats);
      
      // Transform to ExtendedCritter format
      const rarityMap = ['common', 'uncommon', 'rare', 'legendary'] as const;
      const processedCritters = allStats.map(item => ({
        id: item.tokenId.toString(),
        tokenId: item.tokenId.toString(),
        rarity: rarityMap[item.stats.rarity] ?? 'common',
        stats: item.stats
      }));
      
      console.log('useOwnedCritters - Final critters:', processedCritters);
      
      setCritters(processedCritters);
    } catch (err) {
      console.error('Error processing critter stats:', err);
      setError(err instanceof Error ? err : new Error('Failed to process critter data'));
    } finally {
      setIsLoading(false);
    }
  }, [statsData, isLoadingStats, processingComplete, tokenIds]);

  // Add a direct stats fetching approach as fallback
  useEffect(() => {
    // If we have tokens but stats fetching failed due to rate limits, try direct approach
    const statsFailedDueToRateLimit = statsData && 
      statsData.length > 0 && 
      statsData.every(result => result && 'error' in result && result.error?.message?.includes('429'));
    
    if (processingComplete && tokenIds.length > 0 && (statsFailedDueToRateLimit || critters.length === 0)) {
      console.log('useOwnedCritters - Stats fetching failed or no critters processed, trying direct approach');
      
      const fetchStatsDirectly = async () => {
        try {
          console.log('useOwnedCritters - Fetching stats directly for tokens:', tokenIds.map(id => id.toString()));
          
          // Use the publicClient directly instead of getPublicClient()
          if (!publicClient) {
            console.error('useOwnedCritters - No public client available');
            setError(new Error('No public client available'));
            setIsLoading(false);
            return;
          }
          
          const allStats: Array<{
            tokenId: bigint;
            stats: {
              speed: number;
              stamina: number;
              luck: number;
              rarity: number;
            }
          }> = [];
          
          // Fetch stats one by one with delays
          for (let i = 0; i < tokenIds.length; i++) {
            try {
              // Add a delay between requests to avoid rate limiting
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
              }
              
              const tokenId = tokenIds[i];
              console.log(`useOwnedCritters - Directly fetching stats for token ID ${tokenId}`);
              
              // Use the publicClient's readContract method directly
              const result = await publicClient.readContract({
                address: contractAddress,
                abi,
                functionName: 'getStats',
                args: [tokenId]
              });
              
              const stats = result as unknown as [bigint, bigint, bigint, bigint];
              console.log(`useOwnedCritters - Got stats for token ID ${tokenId}:`, stats);
              
              allStats.push({
                tokenId,
                stats: {
                  speed: Number(stats[0]),
                  stamina: Number(stats[1]),
                  luck: Number(stats[2]),
                  rarity: Number(stats[3])
                }
              });
            } catch (err) {
              console.error(`useOwnedCritters - Error fetching stats for token at index ${i}:`, err);
              // If we hit a rate limit, wait longer
              if (err instanceof Error && err.message.includes('429')) {
                console.log('useOwnedCritters - Rate limited, waiting 10 seconds');
                await new Promise(resolve => setTimeout(resolve, 10000));
              }
            }
          }
          
          if (allStats.length > 0) {
            console.log('useOwnedCritters - Successfully fetched stats directly:', allStats);
            
            // Transform to ExtendedCritter format
            const rarityMap = ['common', 'uncommon', 'rare', 'legendary'] as const;
            const processedCritters = allStats.map(item => ({
              id: item.tokenId.toString(),
              tokenId: item.tokenId.toString(),
              rarity: rarityMap[item.stats.rarity] ?? 'common',
              stats: item.stats
            }));
            
            console.log('useOwnedCritters - Final critters from direct approach:', processedCritters);
            
            setCritters(processedCritters);
          } else {
            console.error('useOwnedCritters - Failed to fetch any stats directly');
            setError(new Error('Failed to fetch critter stats due to rate limiting'));
          }
        } catch (err) {
          console.error('useOwnedCritters - Error in direct stats fetching:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch critter stats'));
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchStatsDirectly();
    }
  }, [processingComplete, tokenIds, statsData, critters.length, contractAddress, publicClient]);

  // Reset state when address changes
  useEffect(() => {
    console.log('useOwnedCritters - Address changed:', ownerAddress);
    
    if (ownerAddress) {
      console.log('useOwnedCritters - Resetting state for new address');
      setIsLoading(true);
      setError(null);
      setCurrentBatchIndex(0);
      setTokenIds([]);
      setProcessingComplete(false);
      setCritters([]);
      setBatchRetries({});
      setRetryCount(0);
    } else {
      console.log('useOwnedCritters - No address, clearing state');
      setIsLoading(false);
      setCritters([]);
      setCurrentBatchIndex(0);
      setTokenIds([]);
      setProcessingComplete(false);
      setError(null);
      setBatchRetries({});
      setRetryCount(0);
    }
  }, [ownerAddress]);

  // Set loading to false if balance is 0
  useEffect(() => {
    if (balance !== undefined && Number(balance) === 0) {
      console.log('useOwnedCritters - Balance is 0, setting loading to false');
      setIsLoading(false);
    }
  }, [balance]);

  return {
    data: critters,
    isLoading: isLoading || isLoadingBalance || isLoadingBatch || isLoadingStats || (currentBatchIndex < tokenBatches.length && tokenBatches.length > 0),
    error
  };
}

// Hook to get balance of critters for an address
export function useBalanceOf(address?: Address) {
  const contractAddress = useContractAddress();
  
  return useWagmiReadContract({
    address: contractAddress,
    abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

// Hook to get a specific token by index for an owner
export function useTokenOfOwnerByIndex(owner?: Address, index?: bigint) {
  const contractAddress = useContractAddress();
  
  return useWagmiReadContract({
    address: contractAddress,
    abi,
    functionName: 'tokenOfOwnerByIndex',
    args: owner && index !== undefined ? [owner, index] : undefined,
    query: {
      enabled: !!owner && index !== undefined,
    },
  });
}

// Hook to get stats for a token
export function useTokenStats(tokenId?: bigint) {
  const contractAddress = useContractAddress();
  
  const { data, ...rest } = useWagmiReadContract({
    address: contractAddress,
    abi,
    functionName: 'getStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });
  
  // Transform the raw data into a typed object
  const stats: CritterStats | undefined = data ? {
    speed: Number(data[0]),
    stamina: Number(data[1]),
    luck: Number(data[2]),
    rarity: Number(data[3]),
  } : undefined;
  
  return { data: stats, ...rest };
}

// Hook to get token URI
export function useTokenURI(tokenId?: bigint) {
  const contractAddress = useContractAddress();
  
  return useWagmiReadContract({
    address: contractAddress,
    abi,
    functionName: 'tokenURI',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });
}

// Hook to fetch metadata from token URI
export function useTokenMetadata(tokenId?: bigint) {
  const { data: tokenURI, isLoading: isLoadingURI } = useTokenURI(tokenId);
  const [metadata, setMetadata] = useState<CritterMetadata | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!tokenURI) return;
    
    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(tokenURI as string);
        const data = await response.json();
        setMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch metadata'));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMetadata();
  }, [tokenURI]);
  
  return { data: metadata, isLoading: isLoading || isLoadingURI, error };
}

// Hook to mint a new critter
export function useMintCritter() {
  const contractAddress = useContractAddress();
  
  const { data: simulateData } = useWagmiSimulateContract({
    address: contractAddress,
    abi,
    functionName: 'mint',
    value: BigInt('10000000000000000'), // 0.01 MON from contract
  });

  const { writeContract, ...rest } = useWagmiWriteContract();

  const mint = async () => {
    if (simulateData?.request) {
      await writeContract(simulateData.request);
    }
  };

  return { mint, ...rest };
}

// Hook to listen for Transfer events
export function useTransferEvents() {
  const contractAddress = useContractAddress();
  const [events, setEvents] = useState<Array<any>>([]);
  
  useWagmiWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: 'Transfer',
    onLogs(logs) {
      setEvents(prev => [...prev, ...logs]);
    },
  });
  
  return events;
}

// Hook to get multiple tokens by IDs with their stats
export function useTokensWithStats(tokenIds: bigint[]) {
  const contractAddress = useContractAddress();
  
  const { data, isLoading, error } = useWagmiReadContracts({
    contracts: tokenIds.map(tokenId => ({
      address: contractAddress,
      abi,
      functionName: 'getStats',
      args: [tokenId],
    })),
  });
  
  // Transform the raw data into typed objects
  const tokens: Critter[] = [];
  
  if (data) {
    for (let i = 0; i < tokenIds.length; i++) {
      const statsData = data[i];
      if (statsData && !('error' in statsData)) {
        const id = tokenIds[i];
        const result = statsData.result as unknown as [bigint, bigint, bigint, bigint];
        tokens.push({
          tokenId: id,
          stats: {
            speed: Number(result[0]),
            stamina: Number(result[1]),
            luck: Number(result[2]),
            rarity: Number(result[3]),
          }
        });
      }
    }
  }
  
  return { data: tokens, isLoading, error };
}

// Define the extended critter type
type ExtendedCritter = {
  id: string;
  tokenId: string | bigint;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  stats: {
    speed: number;
    stamina: number;
    luck: number;
    rarity: number;
  }
};

// Export the type for use in other files
export type { ExtendedCritter }; 