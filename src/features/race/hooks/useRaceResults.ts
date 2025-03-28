import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { contracts } from '../../../utils/config';
import { abi as raceContractAbi } from '../../../contracts/CritterRace/abi';
import { toast } from 'react-hot-toast';

// Types
export interface RaceResult {
    player: `0x${string}`;
    position: bigint;
    score: bigint;
    reward: bigint;
}

// Contract response types
interface ContractRaceResult {
    player: `0x${string}`;
    critterId: bigint;
    finalPosition: bigint;
    reward: bigint;
    score: bigint;
}

interface LeaderboardEntry {
    player: `0x${string}`;
    position: bigint;
    score: bigint;
    reward: bigint;
}

interface RaceInfo {
    id: bigint;
    raceSize: number;
    players: readonly `0x${string}`[];
    critterIds: readonly bigint[];
    startTime: bigint;
    isActive: boolean;
    hasEnded: boolean;
    prizePool: bigint;
    results?: ContractRaceResult[];
}

interface UseRaceResultsProps {
    raceId: bigint;
    userAddress?: `0x${string}`;
    isCompleted?: boolean;
}

interface UseRaceResultsReturn {
    results: RaceResult[] | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    retryCount: number;
    resultSource?: 'contract' | 'leaderboard' | 'raceInfo';
}

// Cache results in memory
const resultsCache = new Map<string, { 
    timestamp: number; 
    results: RaceResult[];
    source: 'contract' | 'leaderboard' | 'raceInfo';
}>();

// Add constants for rate limiting and caching
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const RETRY_DELAY = 3000; // 3 seconds
const MAX_RETRIES = 5;
const RATE_LIMIT_DELAY = 5000; // 5 seconds delay for rate limit errors
const CONCURRENT_REQUEST_LIMIT = 3; // Maximum concurrent requests
const REQUEST_QUEUE_TIMEOUT = 30000; // 30 seconds timeout for queued requests

// Request queue implementation
class RequestQueue {
    private queue: Array<() => Promise<any>> = [];
    private running = 0;
    private static instance: RequestQueue;

    static getInstance(): RequestQueue {
        if (!RequestQueue.instance) {
            RequestQueue.instance = new RequestQueue();
        }
        return RequestQueue.instance;
    }

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Request queue timeout'));
            }, REQUEST_QUEUE_TIMEOUT);

            this.queue.push(async () => {
                try {
                    const result = await request();
                    clearTimeout(timeoutId);
                    resolve(result);
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                } finally {
                    this.running--;
                    this.processNext();
                }
            });

            this.processNext();
        });
    }

    private processNext() {
        if (this.running >= CONCURRENT_REQUEST_LIMIT || this.queue.length === 0) {
            return;
        }

        this.running++;
        const next = this.queue.shift();
        if (next) {
            next();
        }
    }
}

// Enhanced contract call wrapper with queue and retries
const makeContractCall = async <T>(
    publicClient: any,
    callConfig: {
        address: `0x${string}`,
        abi: any,
        functionName: string,
        args: any[]
    },
    retryCount = 0
): Promise<T> => {
    try {
        return await RequestQueue.getInstance().add(async () => {
            const result = await publicClient.readContract(callConfig);
            return result as T;
        });
    } catch (error: any) {
        if (isRateLimitError(error)) {
            if (retryCount < MAX_RETRIES) {
                const delay = RATE_LIMIT_DELAY * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return makeContractCall(publicClient, callConfig, retryCount + 1);
            }
        }
        throw error;
    }
};

// Helper function to convert contract results to RaceResult type
const convertContractResults = (results: ContractRaceResult[]): RaceResult[] => {
    return results.map(result => ({
        player: result.player,
        position: result.finalPosition,
        score: result.score,
        reward: result.reward
    }));
};

// Add rate limit error checking
const isRateLimitError = (error: any): boolean => {
    return error?.message?.includes('Too many request') ||
           error?.message?.includes('Status: 429') ||
           error?.details?.code === 15;
};

// Update error checking helper to handle more cases
const isResultsPendingError = (error: any): boolean => {
    const message = error?.message?.toLowerCase() || '';
    const shortMessage = error?.shortMessage?.toLowerCase() || '';
    const causeMessage = error?.cause?.message?.toLowerCase() || '';
    
    const pendingPhrases = [
        'battle results not calculated yet',
        'battle results not calculated',
        'battle results pending',
        'not calculated yet'
    ];
    
    return pendingPhrases.some(phrase => 
        message.includes(phrase) || 
        shortMessage.includes(phrase) || 
        causeMessage.includes(phrase)
    );
};

// Add helper to check if error is a contract revert
const isContractRevertError = (error: any): boolean => {
    return error?.name === 'ContractFunctionExecutionError' ||
           error?.message?.includes('reverted');
};

// Add helper to check if any rewards have been distributed
const hasDistributedRewards = (results: ContractRaceResult[] | LeaderboardEntry[]): boolean => {
    return results.some(result => result.reward > 0n);
};

// Update checkRewardsDistributed function
const checkRewardsDistributed = async (publicClient: any, raceId: bigint): Promise<boolean> => {
    try {
        const raceInfo = await makeContractCall<RaceInfo>(
            publicClient,
            {
                address: contracts.monad.race as `0x${string}`,
                abi: raceContractAbi,
                functionName: 'getRaceInfo',
                args: [raceId]
            }
        );

        // Check if any player has received rewards
        if (raceInfo.results && raceInfo.results.length > 0) {
            return hasDistributedRewards(raceInfo.results);
        }

        return false;
    } catch (err) {
        toast.error('Failed to check rewards distribution');
        return false;
    }
};

// Update getScoresByMethod function
const getScoresByMethod = async (publicClient: any, raceId: bigint): Promise<RaceResult[] | null> => {
    let pendingError = false;
    let rateLimitHit = false;
    let rewardsDistributed = false;
    let lastError: any = null;

    // First check if rewards have been distributed
    rewardsDistributed = await checkRewardsDistributed(publicClient, raceId);

    // Method 1: Try getBatchRaceResults first (most efficient)
    try {
        const batchResults = await makeContractCall<readonly ContractRaceResult[][]>(
            publicClient,
            {
                address: contracts.monad.race as `0x${string}`,
                abi: raceContractAbi,
                functionName: 'getBatchRaceResults',
                args: [[raceId]]
            }
        );

        // Check if we got valid results
        if (batchResults?.[0]?.length > 0) {
            return convertContractResults(Array.from(batchResults[0]));
        }
    } catch (err) {
        lastError = err;
        if (isRateLimitError(err)) {
            rateLimitHit = true;
        } else if (!rewardsDistributed && isResultsPendingError(err)) {
            pendingError = true;
        }
    }

    // Method 2: Try getRaceLeaderboard with queued request
    if (!rateLimitHit && (!pendingError || rewardsDistributed)) {
        try {
            const leaderboard = await makeContractCall<LeaderboardEntry[]>(
                publicClient,
                {
                    address: contracts.monad.race as `0x${string}`,
                    abi: raceContractAbi,
                    functionName: 'getRaceLeaderboard',
                    args: [raceId]
                }
            );

            if (leaderboard?.length > 0) {
                return leaderboard;
            }
        } catch (err) {
            lastError = err;
            if (isRateLimitError(err)) {
                rateLimitHit = true;
            } else if (!rewardsDistributed && isResultsPendingError(err)) {
                pendingError = true;
            }
        }
    }

    // Method 3: Try getRaceInfo with queued request
    if (!rateLimitHit && (!pendingError || rewardsDistributed)) {
        try {
            const raceInfo = await makeContractCall<RaceInfo>(
                publicClient,
                {
                    address: contracts.monad.race as `0x${string}`,
                    abi: raceContractAbi,
                    functionName: 'getRaceInfo',
                    args: [raceId]
                }
            );

            if (raceInfo.hasEnded && raceInfo.results && raceInfo.results.length > 0) {
                return convertContractResults(raceInfo.results);
            }
        } catch (err) {
            lastError = err;
            if (isRateLimitError(err)) {
                rateLimitHit = true;
            }
        }
    }

    // Handle errors based on what we discovered
    if (rateLimitHit) {
        const error = new Error('Rate limit exceeded. Request has been queued.');
        error.name = 'RateLimit';
        throw error;
    }

    if (rewardsDistributed) {
        // If rewards were distributed but we couldn't get results, this is a temporary error
        const error = new Error(
            'Battle results exist (rewards distributed) but could not be retrieved. This may be a temporary issue, please try again.'
        );
        error.name = 'ResultsTemporarilyUnavailable';
        throw error;
    }

    if (pendingError) {
        const error = new Error('Battle results are still being calculated. Please try again in a moment.');
        error.name = 'ResultsPending';
        throw error;
    }

    // If we get here with no specific error condition, return null to indicate no results
    return null;
};

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useRaceResults({ raceId, userAddress, isCompleted }: UseRaceResultsProps): UseRaceResultsReturn {
    const publicClient = usePublicClient();
    const [results, setResults] = useState<RaceResult[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [resultSource, setResultSource] = useState<'contract' | 'leaderboard' | 'raceInfo'>();

    // Check cache first
    const getCachedResults = useCallback(() => {
        const cacheKey = `race_results_${raceId}`;
        const cached = resultsCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached;
        }
        return null;
    }, [raceId]);

    const fetchResults = useCallback(async () => {
        if (!publicClient || !raceId) {
            toast.error('Missing required data to fetch results');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Try cache first
            const cached = getCachedResults();
            if (cached) {
                setResults(cached.results);
                setResultSource(cached.source);
                setIsLoading(false);
                return;
            }

            // Try all methods to get scores
            const scores = await getScoresByMethod(publicClient, raceId);
            
            if (scores) {
                setResults(scores);
                setResultSource('contract');
                
                // Cache the results
                resultsCache.set(`race_results_${raceId}`, {
                    timestamp: Date.now(),
                    results: scores,
                    source: 'contract'
                });
                
                setIsLoading(false);
                return;
            }

            // If we get here, we couldn't find results through any method
            throw new Error('Results are still being calculated. Please try again in a moment.');

        } catch (error: any) {
            setError(error as Error);
            
            // If we've exceeded max retries, show a more helpful error
            if (retryCount >= MAX_RETRIES) {
                const finalError = new Error(
                    isResultsPendingError(error) || error?.name === 'ResultsPending'
                        ? 'Race results are still being calculated. Please check back in a few minutes.'
                        : isRateLimitError(error) || error?.name === 'RateLimit'
                        ? 'Too many requests. Please try again in a few seconds.'
                        : 'Unable to fetch results. Please try again later.'
                );
                setError(finalError);
                toast.error(finalError.message);
                return;
            }
            
            // Calculate retry delay - longer for rate limits
            const baseDelay = isRateLimitError(error) ? RATE_LIMIT_DELAY : RETRY_DELAY;
            const retryDelay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
            
            // Increment retry count and retry after delay
            setRetryCount(prev => prev + 1);
            toast.loading(`Retrying in ${Math.ceil(retryDelay / 1000)}s...`, { duration: retryDelay });
            setTimeout(() => fetchResults(), retryDelay);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient, raceId, retryCount, getCachedResults]);

    // Refetch function that resets retry count
    const refetch = useCallback(async () => {
        setRetryCount(0);
        await fetchResults();
    }, [fetchResults]);

    // Effect to fetch results
    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    return {
        results,
        isLoading,
        error,
        refetch,
        retryCount,
        resultSource
    };
} 