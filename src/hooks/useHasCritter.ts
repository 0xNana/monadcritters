import { useBalanceOf } from '../contracts/MonadCritter/hooks';
import { Address } from 'viem';

/**
 * Custom hook to check if a user has at least one Critter NFT
 * @param address The user's wallet address
 * @returns Object with hasCritter status and loading state
 */
export function useHasCritter(address?: Address) {
  const { data: balance, isLoading } = useBalanceOf(address, {
    query: {
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 300000, // Keep in cache for 5 minutes
      refetchInterval: 60000, // Refetch every minute
      retry: (failureCount, error: any) => {
        // Only retry on rate limit errors
        if (error?.message?.includes('429')) {
          return failureCount < 3; // Limit retries to 3 attempts
        }
        return false;
      },
      retryDelay: (failureCount) => {
        // Exponential backoff: 2^n * 1000ms
        return Math.min(1000 * Math.pow(2, failureCount), 10000);
      }
    }
  });
  
  return {
    hasCritter: balance ? Number(balance) > 0 : false,
    isLoading
  };
} 