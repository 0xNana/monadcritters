import { useContractRead, useContractWrite, useWatchContractEvent, useAccount, useContractReads } from 'wagmi';
import { Address, parseAbi } from 'viem';
import { useCallback, useEffect, useState } from 'react';
import { abi } from './abi';
import { CritterStats, Critter, CritterMetadata } from './types';
import { fetchJson } from '@/utils/fetch';


// Contract addresses by chain ID
const CONTRACT_ADDRESSES: Record<number, Address> = {
  // Monad Testnet
  1337: '0x7b61bc55623924ee7d740d5cce3a6a01f98fa578', // MonadCritter address from .env
  // Add other networks as needed
};

// Helper to get contract address for current chain
export function useContractAddress(): Address | undefined {
  const { chain } = useAccount();
  return chain?.id ? CONTRACT_ADDRESSES[chain.id] : undefined;
}

// Fallback contract address
export const FALLBACK_CONTRACT_ADDRESS = '0x7b61bc55623924ee7d740d5cce3a6a01f98fa578';

// Hook to get balance of critters for an address
export function useBalanceOf(address?: Address) {
  const contractAddressFromHook = useContractAddress();
  const contractAddress = contractAddressFromHook || FALLBACK_CONTRACT_ADDRESS;
  
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddress,
    },
  });
}

// Hook to get a specific token by index for an owner
export function useTokenOfOwnerByIndex(owner?: Address, index?: bigint) {
  const contractAddressFromHook = useContractAddress();
  const contractAddress = contractAddressFromHook || FALLBACK_CONTRACT_ADDRESS;
  
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'tokenOfOwnerByIndex',
    args: owner && index !== undefined ? [owner, index] : undefined,
    query: {
      enabled: !!owner && index !== undefined && !!contractAddress,
    },
  });
}

// Hook to get stats for a token
export function useTokenStats(tokenId?: bigint) {
  const contractAddressFromHook = useContractAddress();
  const contractAddress = contractAddressFromHook || FALLBACK_CONTRACT_ADDRESS;
  
  const { data, ...rest } = useContractRead({
    address: contractAddress,
    abi,
    functionName: 'getStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined && !!contractAddress,
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
  
  return useContractRead({
    address: contractAddress,
    abi,
    functionName: 'tokenURI',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined && !!contractAddress,
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
        const data = await fetchJson<CritterMetadata>(tokenURI as string);
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
  const contractAddressFromHook = useContractAddress();
  const contractAddress = contractAddressFromHook || FALLBACK_CONTRACT_ADDRESS;
  
  return useContractWrite({
    address: contractAddress,
    abi: parseAbi(['function mint() payable']),
    functionName: 'mint',
  });
}

// Hook to listen for Transfer events
export function useTransferEvents(fromBlock: bigint = 0n) {
  const contractAddress = useContractAddress();
  const [events, setEvents] = useState<Array<any>>([]);
  
  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: 'Transfer',
    onLogs(logs) {
      setEvents(prev => [...prev, ...logs]);
    },
    fromBlock,
  });
  
  return events;
}

// Hook to get all tokens owned by an address using a reliable method
export function useReliableOwnedTokens(address?: Address) {
  const { data: balance, isLoading: isLoadingBalance } = useBalanceOf(address);
  const contractAddressFromHook = useContractAddress();
  const contractAddress = contractAddressFromHook || FALLBACK_CONTRACT_ADDRESS;
  const [tokens, setTokens] = useState<Critter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Function to fetch tokens using tokenOfOwnerByIndex
  const fetchTokensStandard = useCallback(async () => {
    if (!address || !balance) return [];
    
    const tokenIds: bigint[] = [];
    try {
      for (let i = 0n; i < balance; i++) {
        const result = await fetch(`/api/contract/tokenOfOwnerByIndex?address=${address}&index=${i}&chainId=${contractAddress}`);
        const data = await result.json();
        if (data.tokenId) {
          tokenIds.push(BigInt(data.tokenId));
        }
      }
      return tokenIds;
    } catch (err) {
      console.error('Error fetching tokens via standard method:', err);
      return [];
    }
  }, [address, contractAddress, balance]);
  
  // Function to fetch tokens using Transfer events
  const fetchTokensViaEvents = useCallback(async () => {
    if (!address) return [];
    
    try {
      const result = await fetch(`/api/contract/getTokensByEvents?address=${address}&chainId=${contractAddress}`);
      const data = await result.json();
      return data.tokenIds.map((id: string) => BigInt(id));
    } catch (err) {
      console.error('Error fetching tokens via events:', err);
      return [];
    }
  }, [address, contractAddress]);
  
  // Function to fetch stats for a list of token IDs
  const fetchStatsForTokens = useCallback(async (tokenIds: bigint[]) => {
    if (!contractAddress) return [];
    
    const critters: Critter[] = [];
    for (const tokenId of tokenIds) {
      try {
        const result = await fetch(`/api/contract/getStats?tokenId=${tokenId}&chainId=${contractAddress}`);
        const data = await result.json();
        critters.push({
          tokenId,
          stats: {
            speed: data.speed,
            stamina: data.stamina,
            luck: data.luck,
            rarity: data.rarity,
          }
        });
      } catch (err) {
        console.error(`Error fetching stats for token ${tokenId}:`, err);
      }
    }
    return critters;
  }, [contractAddress]);
  
  // Main function to fetch tokens with fallback
  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try standard method first
      let tokenIds = await fetchTokensStandard();
      
      // If standard method fails or returns fewer tokens than expected, try events
      if (tokenIds.length < Number(balance || 0)) {
        const eventTokenIds = await fetchTokensViaEvents();
        
        // Merge and deduplicate token IDs
        const tokenIdSet = new Set([
          ...tokenIds.map((id: bigint) => id.toString()), 
          ...eventTokenIds.map((id: bigint) => id.toString())
        ]);
        tokenIds = Array.from(tokenIdSet).map((id: string) => BigInt(id));
      }
      
      // Fetch stats for all tokens
      const crittersWithStats = await fetchStatsForTokens(tokenIds);
      setTokens(crittersWithStats);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tokens'));
    } finally {
      setIsLoading(false);
    }
  }, [balance, fetchTokensStandard, fetchTokensViaEvents, fetchStatsForTokens]);
  
  // Fetch tokens when balance changes
  useEffect(() => {
    if (balance !== undefined && !isLoadingBalance) {
      fetchTokens();
    }
  }, [balance, isLoadingBalance, fetchTokens]);
  
  return { 
    data: tokens, 
    isLoading: isLoading || isLoadingBalance, 
    error,
    refetch: fetchTokens
  };
}

// Hook to get multiple tokens by IDs with their stats
export function useTokensWithStats(tokenIds: bigint[]) {
  const contractAddress = useContractAddress();
  
  const calls = tokenIds.flatMap(tokenId => [
    {
      address: contractAddress,
      abi,
      functionName: 'getStats',
      args: [tokenId],
    }
  ]);
  
  const { data, isLoading, error } = useContractReads({
    contracts: calls,
    allowFailure: true,
  });
  
  // Transform the raw data into typed objects
  const tokens: Critter[] = [];
  
  if (data) {
    for (let i = 0; i < tokenIds.length; i++) {
      const statsData = data[i];
      if (statsData && !('error' in statsData)) {
        const id = tokenIds[i];
        const result = statsData.result as [bigint, bigint, bigint, bigint];
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