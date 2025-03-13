import { useState, useEffect } from 'react';
import { useDeployContract, usePublicClient, useSignMessage, useAccount, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { toast } from 'react-hot-toast';
import { RaceSize, RaceInfo, RaceType, RaceResult, PlayerStats } from '../../../contracts/CritterRace/types';
import { abi as RACE_ABI } from '../../../contracts/CritterRace/abi';
import { contracts } from '../../../utils/config';
import { useChainId } from 'wagmi';

// Get contract address based on chain ID
function useContractAddress() {
  const chainId = useChainId();
  return chainId === 11155111 
    ? contracts.sepolia.race 
    : contracts.monad.race;
}

// Base contract hook
export const useRaceContract = () => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const contract = {
    address: useContractAddress() as `0x${string}`,
    abi: RACE_ABI,
  };

  const wrapWithErrorHandler = async <T>(
    promise: Promise<T>,
    pendingMessage: string
  ): Promise<T> => {
    const toastId = toast.loading(pendingMessage);
    try {
      const result = await promise;
      toast.success('Transaction successful!', { id: toastId });
      return result;
    } catch (error: any) {
      console.error('Contract Error:', error);
      const message = error?.reason || error?.message || 'Transaction failed';
      toast.error(message, { id: toastId });
      throw error;
    }
  };

  return { contract, wrapWithErrorHandler };
};

// Race data hook
export const useRaceData = () => {
  const { contract } = useRaceContract();
  const publicClient = usePublicClient();
  const [races, setRaces] = useState<RaceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRaces = async () => {
    if (!publicClient) return;
    
    try {
      setLoading(true);
      const allRaces = await Promise.all(
        [RaceSize.Two, RaceSize.Five, RaceSize.Ten].map(async (size) => {
          const result = await publicClient.readContract({
            ...contract,
            functionName: 'getActiveRaces',
            args: [size]
          });
          return result;
        })
      );

      const formattedRaces = allRaces.flat().map(race => ({
        id: race.id,
        raceSize: race.raceSize as RaceSize,
        playerCount: BigInt(race.players.length),
        players: [...race.players],
        critterIds: [...race.critterIds],
        startTime: race.startTime,
        isActive: race.isActive,
        hasEnded: race.hasEnded,
        prizePool: race.prizePool
      }));

      setRaces(formattedRaces);
    } catch (error) {
      console.error('Error fetching races:', error);
      toast.error('Failed to fetch races');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!publicClient) return;
    
    fetchRaces();

    // Set up event listeners for race updates
    const eventNames = ['RaceCreated', 'PlayerJoined', 'RaceStarted', 'RaceEnded'] as const;
    
    const unwatch = eventNames.map(eventName => 
      publicClient.watchContractEvent({
        ...contract,
        eventName,
        onLogs: fetchRaces
      })
    );

    return () => {
      unwatch.forEach(unwatchFn => unwatchFn());
    };
  }, [contract, publicClient]);

  return { races, loading, refreshRaces: fetchRaces };
};

// Race actions hook
export const useRaceActions = () => {
  const { contract, wrapWithErrorHandler } = useRaceContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [processing, setProcessing] = useState(false);

  const createRace = async (size: RaceSize) => {
    if (!walletClient) throw new Error('Wallet not connected');
    
    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'createRace',
        args: [Number(size)]
      }),
      'Creating new race...'
    );
  };

  const joinRace = async (
    raceId: number,
    raceSize: RaceSize,
    critterId: number,
    boostAmount: number = 0
  ) => {
    if (!walletClient || !publicClient) throw new Error('Wallet not connected');

    const raceTypeInfo = await publicClient.readContract({
      ...contract,
      functionName: 'getRaceTypeInfo',
      args: [raceSize]
    });

    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'joinRace',
        args: [BigInt(raceId), BigInt(Number(raceSize)), BigInt(critterId), BigInt(boostAmount)],
        value: raceTypeInfo.entryFee
      }),
      'Joining race...'
    );
  };

  const startRace = async (raceId: number) => {
    if (!walletClient) throw new Error('Wallet not connected');
    
    setProcessing(true);
    try {
      await wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'startRaceExternal',
          args: [BigInt(raceId)]
        }),
        'Starting race...'
      );
    } finally {
      setProcessing(false);
    }
  };

  const endRace = async (raceId: number) => {
    if (!walletClient) throw new Error('Wallet not connected');
    
    setProcessing(true);
    try {
      await wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'endRace',
          args: [BigInt(raceId)]
        }),
        'Processing race results...'
      );
    } finally {
      setProcessing(false);
    }
  };

  return { createRace, joinRace, startRace, endRace, processing };
};

// Power-ups hook
export const usePowerUps = () => {
  const { contract, wrapWithErrorHandler } = useRaceContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [speedBoosts, setSpeedBoosts] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPowerUps = async () => {
    if (!address || !publicClient) return;
    try {
      setLoading(true);
      const boosts = await publicClient.readContract({
        ...contract,
        functionName: 'playerInventory_SpeedBoost',
        args: [address]
      });
      setSpeedBoosts(Number(boosts));
    } catch (error) {
      console.error('Error fetching power-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const buyPowerUps = async (amount: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    const cost = parseEther('0.01') * BigInt(amount); // Assuming 0.01 ETH per power-up
    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'buyPowerUps',
        args: [BigInt(amount)],
        value: cost
      }),
      'Purchasing power-ups...'
    );
  };

  useEffect(() => {
    if (!publicClient) return;
    
    fetchPowerUps();
    
    // Watch for power-up purchase events
    const unwatch = publicClient.watchContractEvent({
      ...contract,
      eventName: 'PowerUpsPurchased',
      args: { player: address },
      onLogs: fetchPowerUps
    });
    
    return () => {
      unwatch();
    };
  }, [address, contract, publicClient]);

  return { speedBoosts, loading, buyPowerUps, refreshPowerUps: fetchPowerUps };
};

// Critters hook
interface CritterStats {
  speed: number;
  stamina: number;
  luck: number;
}

interface Critter {
  id: number;
  stats: CritterStats;
}

export const useCritters = () => {
  const { contract } = useRaceContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [critters, setCritters] = useState<Critter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCritters = async () => {
    if (!address || !publicClient) return;
    try {
      setLoading(true);
      // Note: This is a mock implementation since the actual contract doesn't have getUserCritters
      // You'll need to implement the actual contract call based on your contract's interface
      const mockCritterIds = [1n, 2n, 3n]; // Replace with actual contract call
      
      const critterData = await Promise.all(
        mockCritterIds.map(async (id) => ({
          id: Number(id),
          stats: {
            speed: 10,
            stamina: 10,
            luck: 10
          }
        }))
      );
      setCritters(critterData);
    } catch (error) {
      console.error('Error fetching critters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCritters();
  }, [address, contract]);

  return { critters, loading, refreshCritters: fetchCritters };
};
