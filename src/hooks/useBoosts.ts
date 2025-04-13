import { useReadContract } from 'wagmi';
import { usePublicClient, useWalletClient } from 'wagmi';
import { CRITTER_CLASH_CORE_ADDRESS, CRITTER_CLASH_CORE_ABI } from '../constants/contracts';
import { useToast } from '../components/Toast';
import { useAccount } from 'wagmi';
import { CLASH_CONFIG, CACHE_CONFIG } from '../utils/config';
import { useState, useCallback, useEffect, useRef } from 'react';

// Cache for boost balances to reduce RPC calls
const boostBalanceCache = new Map<string, { value: number; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache TTL

export const useBoosts = () => {
  const { address } = useAccount();
  const { showToast } = useToast();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [localBoostBalance, setLocalBoostBalance] = useState<number>(0);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const lastRefetchTime = useRef<number>(0);
  const refetchCount = useRef<number>(0);
  const maxRefetchInterval = 30000; // 30 seconds max between refetches

  // Check if we have a valid cached value
  const getCachedBalance = useCallback(() => {
    if (!address) return null;
    
    const cached = boostBalanceCache.get(address.toLowerCase());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }
    return null;
  }, [address]);

  // Update cache with new value
  const updateCache = useCallback((value: number) => {
    if (!address) return;
    boostBalanceCache.set(address.toLowerCase(), { value, timestamp: Date.now() });
  }, [address]);

  // Get player's boost balance directly from the playerBoosts mapping
  // Always call useReadContract, but disable the query when address is null
  const { data: boostBalanceData, refetch: refetchBoostBalance, isLoading: isLoadingBoosts } = useReadContract({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'playerBoosts',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address, // Only enable the query when address is available
      refetchInterval: 30000, // Refetch every 30 seconds
      staleTime: 20000,      // Consider data stale after 20 seconds
      retry: (failureCount, error) => {
        // Only retry on rate limit errors
        if (!error?.message?.includes('429')) return false;
        return failureCount < 1; // Limit retries to 1
      },
      retryDelay: (failureCount) => {
        // Exponential backoff with jitter
        const baseDelay = 5000 * Math.pow(2, failureCount);
        const jitter = 1 + (Math.random() * 0.4 - 0.2); // ±20% jitter
        return Math.min(baseDelay * jitter, 15000);
      }
    }
  });

  // Update local state when contract data changes
  useEffect(() => {
    if (boostBalanceData !== undefined) {
      try {
        const balance = Number(boostBalanceData);
        setLocalBoostBalance(balance);
        updateCache(balance);
      } catch (e) {
        console.error('Error parsing boost balance:', e);
      }
    }
  }, [boostBalanceData, updateCache]);

  // Initialize from cache if available
  useEffect(() => {
    if (address && localBoostBalance === 0) {
      const cached = getCachedBalance();
      if (cached !== null) {
        setLocalBoostBalance(cached);
      }
    }
  }, [address, localBoostBalance, getCachedBalance]);

  // Throttled refetch function to prevent too many calls
  const throttledRefetch = useCallback(async () => {
    // Don't refetch if already refetching or if address is not available
    if (isRefetching || !address) return;
    
    // Check if we've refetched recently
    const now = Date.now();
    if (now - lastRefetchTime.current < maxRefetchInterval) {
      console.log('Skipping refetch due to rate limiting');
      return;
    }
    
    // Check if we've refetched too many times recently
    if (refetchCount.current > 3 && now - lastRefetchTime.current < 60000) {
      console.log('Too many refetches, using cached value');
      return;
    }
    
    setIsRefetching(true);
    lastRefetchTime.current = now;
    refetchCount.current++;
    
    try {
      await refetchBoostBalance();
    } catch (error) {
      console.error('Error refetching boost balance:', error);
      
      // If we get a 429, use cached value if available
      if (error.message?.includes('429')) {
        const cached = getCachedBalance();
        if (cached !== null) {
          console.log('Using cached boost balance due to rate limit');
          setLocalBoostBalance(cached);
        }
      }
    } finally {
      setIsRefetching(false);
    }
  }, [refetchBoostBalance, isRefetching, getCachedBalance, address]);

  // Purchase boosts with MON
  const purchaseBoosts = async (amount: number) => {
    if (!address || !walletClient || !publicClient) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    if (amount <= 0 || amount > 10) {
      showToast('Please select a valid amount (1-10)', 'error');
      return;
    }

    try {
      // Use fixed values from CLASH_CONFIG
      const TWO_PLAYER_ENTRY_FEE = parseFloat(CLASH_CONFIG.TYPES.TWO_PLAYER.entryFee);
      const POWER_UP_PERCENT = CLASH_CONFIG.FEES.POWER_UP_PERCENT;
      const pricePerBoost = (TWO_PLAYER_ENTRY_FEE * POWER_UP_PERCENT) / 100;
      const totalCost = BigInt(Math.floor(pricePerBoost * amount * 10**18));

      // First simulate the transaction
      const { request } = await publicClient.simulateContract({
        address: CRITTER_CLASH_CORE_ADDRESS,
        abi: CRITTER_CLASH_CORE_ABI,
        functionName: 'purchaseBoosts',
        args: [BigInt(amount)],
        value: totalCost,
        account: address as `0x${string}`
      });

      // Send the transaction
      const hash = await walletClient.writeContract(request);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      // Update local state immediately for better UX
      const newBalance = localBoostBalance + amount;
      setLocalBoostBalance(newBalance);
      updateCache(newBalance);
      
      // Show success message
      showToast(`Successfully purchased ${amount} boost${amount !== 1 ? 's' : ''}! View transaction: https://testnet.monadexplorer.com/tx/${hash}`, 'success');

      // Refetch boost balance after a delay to ensure blockchain state is updated
      setTimeout(() => {
        throttledRefetch();
      }, 10000); // Increased delay to 10 seconds

    } catch (error: any) {
      console.error('Error purchasing boosts:', error);
      let errorMessage = 'Failed to purchase boosts';
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient MON balance to purchase boosts';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed: Contract execution reverted';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again in a few seconds.';
        }
      }
      showToast(errorMessage, 'error');
    }
  };

  return {
    boostBalance: localBoostBalance,
    purchaseBoosts,
    refetchBoostBalance: throttledRefetch,
    isLoadingBoosts
  };
}; 