import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useCritterClashStats } from '../contracts/CritterClashStats/hooks';
import { PlayerStats } from '../contracts/CritterClashStats/types';
import { useClashPoints } from '../contexts/ClashPointsContext';

interface EnhancedPlayerStats extends PlayerStats {
  winRate: number;
  clashPoints: number;
}

// Cache for storing user stats
const statsCache = new Map<string, {
  stats: EnhancedPlayerStats;
  timestamp: number;
}>();

// Cache validity period in milliseconds (5 minutes)
const CACHE_VALIDITY_PERIOD = 5 * 60 * 1000;

export const useUserClashStats = () => {
  const { address, isConnected } = useAccount();
  const clashStats = useCritterClashStats();
  const { totalPoints: clashPoints } = useClashPoints();
  const [userStats, setUserStats] = useState<EnhancedPlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const initialFetchDone = useRef(false);
  
  // Stable reference to clashPoints to avoid unnecessary re-renders
  const clashPointsRef = useRef(clashPoints);
  useEffect(() => {
    clashPointsRef.current = clashPoints;
  }, [clashPoints]);

  const fetchUserStats = useCallback(async (forceRefresh = false) => {
    if (!isConnected || !address) {
      setUserStats(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const cacheKey = address;
      const now = Date.now();
      const cachedData = statsCache.get(cacheKey);
      
      // Use cache if available and not expired, unless force refresh requested
      if (!forceRefresh && 
          cachedData && 
          now - cachedData.timestamp < CACHE_VALIDITY_PERIOD) {
        
        // Update local state with cached data but include latest clash points
        setUserStats({
          ...cachedData.stats,
          clashPoints: clashPointsRef.current
        });
        setIsLoading(false);
        return;
      }
      
      // If cache miss or expired, fetch fresh data
      const stats = await clashStats.getPlayerStats(address);
      
      // Calculate win rate
      const winRate = stats.totalClashes > 0 
        ? (stats.totalWins / stats.totalClashes) * 100 
        : 0;
      
      const enhancedStats = {
        ...stats,
        winRate,
        clashPoints: clashPointsRef.current
      };
      
      // Update cache
      statsCache.set(cacheKey, {
        stats: enhancedStats,
        timestamp: now
      });
      
      setUserStats(enhancedStats);
    } catch (err) {
      console.error('Error fetching user clash stats:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching stats'));
      
      // If error occurs but we have cached data, use it as fallback
      const cachedData = statsCache.get(address);
      if (cachedData) {
        console.log('Using cached stats data as fallback');
        setUserStats({
          ...cachedData.stats,
          clashPoints: clashPointsRef.current
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, clashStats]); // Removed clashPoints from dependencies

  // Fetch user stats on mount and when dependencies change
  useEffect(() => {
    if (address && isConnected && !initialFetchDone.current) {
      fetchUserStats();
      initialFetchDone.current = true;
    } else if (address && isConnected && initialFetchDone.current) {
      // For subsequent address changes, we want to refetch
      if (userStats && userStats.clashPoints !== clashPointsRef.current) {
        // Only update the clashPoints if that's the only thing that changed
        setUserStats(prev => prev ? {...prev, clashPoints: clashPointsRef.current} : null);
      }
    }
  }, [address, isConnected, fetchUserStats]);

  // Update existing user stats with new clash points when they change
  useEffect(() => {
    if (userStats && userStats.clashPoints !== clashPoints) {
      setUserStats(prev => prev ? {...prev, clashPoints} : null);
    }
  }, [clashPoints, userStats]);

  return {
    stats: userStats,
    isLoading,
    error,
    refetch: () => fetchUserStats(true)  // Force refresh when explicitly refetching
  };
}; 