import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useReadContract, useReadContracts, useWatchContractEvent, usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { contracts } from '../utils/config';
import { formatUnits } from '@ethersproject/units';
import { RaceCard } from '../components/race/RaceCard';
import { RaceJoinModal } from '../components/race/RaceJoinModal';
import { abi as raceContractAbi } from '../contracts/CritterRace/abi';

// Power-up configuration
const POWER_UPS = [
  {
    name: 'Speed Boost',
    description: '+100 to final score and 0.01 MON bonus prize',
    image: '🚀',
    color: 'from-blue-500 to-blue-700',
    type: 'speedBoosts' as const
  }
] as const;

interface CritterStats {
  speed: number;
  stamina: number;
  luck: number;
  rarity: number;
}

interface Critter {
  id: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  stats: {
    speed: number;
    stamina: number;
    luck: number;
  };
}

interface PowerUpInventory {
  speedBoosts: number;
}

const rarityMap = ['common', 'uncommon', 'rare', 'legendary'] as const;

// Constants
const RACE_CONTRACT_ADDRESS = contracts.monad.race as `0x${string}`;
const RACE_DURATION = 60000; // 1 minute in milliseconds

// Race types configuration
const RACE_TYPES = [
  { type: '2/2' as const, maxPlayers: 2, winners: 1, entryFee: '0.1', raceSize: 1 as const }, // RaceSize.Two
  { type: '5/5' as const, maxPlayers: 5, winners: 2, entryFee: '0.1', raceSize: 2 as const }, // RaceSize.Five
  { type: '10/10' as const, maxPlayers: 10, winners: 3, entryFee: '0.1', raceSize: 3 as const } // RaceSize.Ten
] as const;

// ERC721 ABI for balanceOf and getStats
const critterAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint8', name: 'speed' },
        { type: 'uint8', name: 'stamina' },
        { type: 'uint8', name: 'luck' },
        { type: 'uint8', name: 'rarity' }
      ]
    }],
  }
] as const;

// Update RaceInfo interface to match contract structure
interface RaceInfo {
  id: bigint;
  raceSize: number;
  players: readonly `0x${string}`[];
  critterIds: readonly bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: bigint;
}

// Add a new interface for race type mapping
interface RaceTypeMapping {
  races: RaceInfo[];
  isLoading?: boolean;
  error?: Error | null;
}

// Add this helper function before the component
const serializeRaceForComparison = (race: RaceInfo) => ({
  ...race,
  id: race.id.toString(),
  critterIds: race.critterIds.map(id => id.toString()),
  startTime: race.startTime.toString(),
  prizePool: race.prizePool.toString(),
});

export default function RaceLobbyPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Validate contract address
  useEffect(() => {
    if (!contracts.monad.race) {
      console.error('Race contract address is not set!');
      toast.error('Configuration error: Race contract address is missing');
    } else {
      console.debug('Using race contract:', contracts.monad.race);
    }
  }, []);
  
  // Helper function to get race type index
  const getRaceTypeIndex = useCallback((raceType: typeof RACE_TYPES[number]): number => {
    return RACE_TYPES.findIndex(rt => rt.type === raceType.type);
  }, []);
  
  // Update the races state to handle multiple races per type
  const [races, setRaces] = useState<Map<string, RaceTypeMapping>>(new Map());
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  
  // User state
  const [userCritters, setUserCritters] = useState<Critter[]>([]);
  const [isLoadingCritters, setIsLoadingCritters] = useState(true);
  const [selectedCritter, setSelectedCritter] = useState<number | null>(null);
  const [selectedRaceType, setSelectedRaceType] = useState<typeof RACE_TYPES[number] | null>(null);
  
  // Power-ups state
  const [selectedPowerUps, setSelectedPowerUps] = useState<{ speedBoosts: number }>({ speedBoosts: 0 });
  const [userPowerUps, setUserPowerUps] = useState<{ speedBoosts: number }>({ speedBoosts: 0 });
  
  // UI state
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isJoiningRace, setIsJoiningRace] = useState(false);
  const [isCreatingRace, setIsCreatingRace] = useState(false);
  const [isPurchasingBoost, setIsPurchasingBoost] = useState(false);
  const [boostAmount, setBoostAmount] = useState(1);
  const [joinBoostAmount, setJoinBoostAmount] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [potentialWinnings, setPotentialWinnings] = useState<string>('0');
  const [selectedRaceForJoin, setSelectedRaceForJoin] = useState<RaceInfo | null>(null);
  
  // Use useReadContracts for efficient data fetching
  const { data: activeRaces, isLoading: isLoadingRaces, refetch: refetchRaces } = useReadContracts({
    contracts: RACE_TYPES.map(raceType => ({
      address: contracts.monad.race as `0x${string}`,
      abi: raceContractAbi,
      functionName: 'getActiveRaces',
      args: [raceType.raceSize as number],
      query: {
        enabled: !!address && !!contracts.monad.race,
        refetchInterval: 15000,
        retry: true,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        select: (data: any) => {
          try {
            if (!data) {
              console.error('No data received for race type:', raceType.type);
              return [];
            }

            // Ensure data is an array and has elements
            if (!Array.isArray(data) || data.length === 0) {
              console.error('Invalid data format for race type:', raceType.type, 'Data:', data);
              return [];
            }

            // Map each race tuple to a RaceInfo object with careful validation
            return data.map((race: any) => {
              try {
                // Basic structure validation
                if (!race || !Array.isArray(race) || race.length < 8) {
                  console.error('Invalid race data structure for race type:', raceType.type, 'Race:', race);
                  return null;
                }

                // Safely extract fields with type checking and logging
                const [rawId, rawRaceSize, rawPlayers, rawCritterIds, rawStartTime, rawIsActive, rawHasEnded, rawPrizePool] = race;
                console.debug('Processing race:', {
                  type: raceType.type,
                  id: rawId?.toString(),
                  raceSize: rawRaceSize,
                  playersCount: Array.isArray(rawPlayers) ? rawPlayers.length : 'invalid',
                  crittersCount: Array.isArray(rawCritterIds) ? rawCritterIds.length : 'invalid',
                  startTime: rawStartTime?.toString(),
                  isActive: rawIsActive,
                  hasEnded: rawHasEnded,
                  prizePool: rawPrizePool?.toString()
                });

                // Validate and convert id
                const id = BigInt(rawId?.toString() || '0');
                if (id === 0n) {
                  console.error('Invalid race ID for type:', raceType.type);
                  return null;
                }

                // Validate and convert players array
                let players: readonly `0x${string}`[] = [];
                if (Array.isArray(rawPlayers)) {
                  players = rawPlayers.filter((addr): addr is `0x${string}` => {
                    if (typeof addr !== 'string') {
                      console.error('Invalid player address type:', typeof addr);
                      return false;
                    }
                    try {
                      return addr.startsWith('0x') && addr.length === 42;
                    } catch {
                      console.error('Invalid player address format:', addr);
                      return false;
                    }
                  });
                }

                // Validate and convert critterIds array
                let critterIds: readonly bigint[] = [];
                if (Array.isArray(rawCritterIds)) {
                  critterIds = rawCritterIds
                    .map(id => {
                      try {
                        return BigInt(id?.toString() || '0');
                      } catch (err) {
                        console.error('Invalid critter ID:', id, err);
                        return 0n;
                      }
                    })
                    .filter(id => id !== 0n);
                }

                // Validate arrays have matching lengths
                if (players.length !== critterIds.length) {
                  console.error('Mismatched players and critterIds arrays for race type:', raceType.type);
                  return null;
                }

                // Convert startTime with validation
                const startTime = BigInt(rawStartTime?.toString() || '0');

                // Convert isActive and hasEnded with fallback
                const isActive = Boolean(rawIsActive);
                const hasEnded = Boolean(rawHasEnded);

                // Convert prizePool with validation
                let prizePool: bigint;
                try {
                  prizePool = BigInt(rawPrizePool?.toString() || '0');
                } catch (err) {
                  console.error('Invalid prize pool value for race type:', raceType.type, err);
                  return null;
                }

                return {
                  id,
                  raceSize: Number(rawRaceSize),
                  players,
                  critterIds,
                  startTime,
                  isActive,
                  hasEnded,
                  prizePool
                } as const;
              } catch (err) {
                console.error('Error processing individual race for type:', raceType.type, err);
                return null;
              }
            }).filter((race): race is RaceInfo => race !== null);
          } catch (err) {
            console.error('Error processing races for type:', raceType.type, err);
            return [];
          }
        },
      },
    })),
  });

  // Watch for new races being created
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'RaceCreated' as const,
    onLogs: async () => {
      try {
        await refetchRaces();
      } catch (error) {
        console.error('Error refetching races after new race created:', error);
        toast.error('Failed to update race list');
      }
    }
  });

  // Update races state when data changes, following critter pattern
  useEffect(() => {
    if (!activeRaces) return;

    // Create new races Map without referencing current state
    const newRaces = new Map<string, RaceTypeMapping>();
    
    activeRaces.forEach((raceData, index) => {
      const raceType = RACE_TYPES[index].type;
      
      if (raceData.status === 'success' && Array.isArray(raceData.result)) {
        // Filter and sort races - only include active and non-ended races
        const activeRaces = raceData.result
          .filter(race => {
            // Check if the race is still active and not ended
            const isActive = race.isActive;
            const hasEnded = race.hasEnded;
            
            // Check if the user is in this race
            const userAddress = address?.toLowerCase();
            const isUserInRace = userAddress && race.players.some(
              player => player.toLowerCase() === userAddress
            );
            
            // Only keep races that are:
            // 1. Active and not ended OR
            // 2. Have the user as a participant and haven't ended
            return (isActive && !hasEnded) || (isUserInRace && !hasEnded);
          })
          .sort((a, b) => Number(a.id - b.id));

        newRaces.set(raceType, {
          races: activeRaces,
          isLoading: false,
          error: null
        });
      } else {
        // Handle error case
        console.error('Error loading races for type', raceType, raceData.error);
        newRaces.set(raceType, {
          races: [],
          isLoading: false,
          error: raceData.error instanceof Error ? raceData.error : new Error('Failed to load races')
        });
      }
    });

    // Only update state if there are actual changes
    let hasChanges = false;
    if (newRaces.size !== races.size) {
      hasChanges = true;
    } else {
      for (const [type, mapping] of newRaces) {
        const currentMapping = races.get(type);
        if (!currentMapping || 
            mapping.races.length !== currentMapping.races.length ||
            mapping.error !== currentMapping.error) {
          hasChanges = true;
          break;
        }
        
        // Compare serialized versions of the races
        const serializedNew = mapping.races.map(serializeRaceForComparison);
        const serializedCurrent = currentMapping.races.map(serializeRaceForComparison);
        if (JSON.stringify(serializedNew) !== JSON.stringify(serializedCurrent)) {
          hasChanges = true;
          break;
        }
      }
    }

    if (hasChanges) {
      setRaces(newRaces);
      setLastLoadTime(Date.now());
    }
  }, [activeRaces, address, races]);

  // Add RaceEnded event listener
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'RaceEnded' as const,
    onLogs: async (logs) => {
      try {
        console.log('Race ended event received:', logs);
        // Refetch races to update UI
        await refetchRaces();
        
        // Navigate to race view if user was in this race
        const raceId = logs[0].args.raceId;
        const results = logs[0].args.results;
        
        if (raceId && results && address) {
          const userResult = results.find((r: any) => 
            r.player.toLowerCase() === address.toLowerCase()
          );
          
          if (userResult) {
            navigate('/race');
          }
        }
      } catch (error) {
        console.error('Error processing race end event:', error);
      }
    }
  });

  // Add RaceStarted event listener
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'RaceCreated' as const,
    onLogs: async (logs) => {
      try {
        console.log('Race started event received:', logs);
        await refetchRaces();
      } catch (error) {
        console.error('Error processing race start event:', error);
      }
    }
  });

  // Read user's actual power-up inventory from contract
  const { data: speedBoosts, isError: speedError } = useReadContract({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    functionName: 'playerInventory_SpeedBoost',
    args: address ? [address as `0x${string}`] : undefined
  });

  // Update userPowerUps when contract data changes
  useEffect(() => {
    if (speedBoosts !== undefined) {
      setUserPowerUps({
        speedBoosts: Number(speedBoosts)
      });
    }
  }, [speedBoosts]);
  
  // Read user's critter balance
  const { data: critterBalance } = useReadContract({
    address: contracts.monad.critter as `0x${string}`,
    abi: critterAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
  });

  // Read total supply to know the range of token IDs
  const { data: totalSupply } = useReadContract({
    address: contracts.monad.critter as `0x${string}`,
    abi: critterAbi,
    functionName: 'totalSupply',
  });

  // Load user's critters
  useEffect(() => {
    const loadCritters = async () => {
      if (!address || !publicClient || !totalSupply || !critterBalance) return;

      // Only set loading state if we don't have any critters yet
      if (userCritters.length === 0) {
      setIsLoadingCritters(true);
      }

      try {
        const critters: Critter[] = [];
        
        // For simplicity in the MVP, we'll just check the first 100 tokens
        // In a production app, we would use a more efficient method
        for (let tokenId = 1; tokenId <= Math.min(100, Number(totalSupply)); tokenId++) {
            try {
              const owner = await publicClient.readContract({
                address: contracts.monad.critter as `0x${string}`,
                abi: critterAbi,
                functionName: 'ownerOf',
                args: [BigInt(tokenId)]
              });

              if (owner === address) {
                // Check if we already have this critter in our state to avoid re-fetching
                const existingCritter = userCritters.find(c => c.id === tokenId.toString());
                if (existingCritter) {
                  critters.push(existingCritter);
                } else {
                  const stats = await publicClient.readContract({
                    address: contracts.monad.critter as `0x${string}`,
                    abi: critterAbi,
                    functionName: 'getStats',
                    args: [BigInt(tokenId)]
                  }) as unknown as CritterStats;

                critters.push({
                  id: tokenId.toString(),
                  rarity: rarityMap[stats.rarity],
                  stats: {
                    speed: stats.speed,
                    stamina: stats.stamina,
                    luck: stats.luck
                  }
                });
                }
              }
            } catch (error) {
              console.debug('Error checking token:', tokenId, error);
            }
        }

        // Only update state if we have new data and it's different from current state
        if (critters.length > 0 && JSON.stringify(critters) !== JSON.stringify(userCritters)) {
          setUserCritters(critters);
        }
      } catch (error) {
        console.error('Error loading critters:', error);
        toast.error('Failed to load your critters');
      } finally {
        setIsLoadingCritters(false);
      }
    };

    loadCritters();
    
    // Set up a less frequent interval for refreshing critters
    // This prevents the UI from constantly refreshing and causing flickering
    const interval = setInterval(loadCritters, 15000); // Refresh every 15 seconds instead of with every render
    return () => clearInterval(interval);
  }, [address, publicClient, totalSupply, critterBalance]);

  // Calculate potential winnings based on selected race type - memoize the calculation
  const potentialWinningsValue = React.useMemo(() => {
    if (!selectedRaceType) return '0';
    
    const race = races.get(selectedRaceType.type);
    if (!race?.races.length || !race.races[0]?.prizePool) return '0';
    
    try {
      const prizePool = Number(formatUnits(race.races[0].prizePool, 18));
      const firstPlacePercentage = 0.5; // 50% for first place
      return (prizePool * firstPlacePercentage).toFixed(4);
    } catch (error) {
      console.error('Error calculating potential winnings:', error);
      return '0';
    }
  }, [selectedRaceType, races]);

  // Update potential winnings state when memoized value changes
  useEffect(() => {
    setPotentialWinnings(potentialWinningsValue);
  }, [potentialWinningsValue]);

  // Effect to handle critter selection
  useEffect(() => {
    if (selectedCritter && userCritters.length > 0) {
      // Check if the currently selected critter is still in the list
      const critterStillExists = userCritters.some(c => parseInt(c.id) === selectedCritter);
      
      // If not, select the first available critter
      if (!critterStillExists) {
        setSelectedCritter(parseInt(userCritters[0].id));
      }
    } else if (userCritters.length > 0 && !selectedCritter) {
      // If we have critters but none selected, select the first one
      setSelectedCritter(parseInt(userCritters[0].id));
    }
  }, [userCritters, selectedCritter]);

  const handlePowerUpSelect = (value: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Check if user has enough power-ups
    if (value > userPowerUps.speedBoosts) {
      toast.error(`You only have ${userPowerUps.speedBoosts} Speed Boosts available`);
      return;
    }

    if (value > 2) {
      toast.error('Maximum 2 speed boosts per race!');
      return;
    }

    setSelectedPowerUps({
      speedBoosts: value
    });

    // Show effect description
    if (value > 0) {
      toast.success(`Speed Boost: +${value * 100} to final score`);
    }
  };

  const handleRaceCardClick = (raceType: typeof RACE_TYPES[number]) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (userCritters.length === 0) {
      toast.error('You need to mint some critters first');
      return;
    }

    // Default to first critter if none selected
    if (!selectedCritter) {
      setSelectedCritter(parseInt(userCritters[0].id));
    }
    
    const race = races.get(raceType.type);
    if (!race) {
      toast.error('Race not found');
      return;
    }
    
    setSelectedRaceType(raceType);
    setSelectedRaceForJoin(race.races[0]);
    setJoinBoostAmount(0); // Reset boost amount for this race
    setIsJoinModalOpen(true);
  };

  // Update the handleJoinRace function to handle full races
  const handleJoinRace = async () => {
    if (!isConnected || !selectedCritter || !selectedRaceType || !walletClient || !selectedRaceForJoin || !address || !publicClient) {
      toast.error('Please connect wallet, select a critter, and choose a race type');
      return;
    }

    // Check if race is already full
    const playerCount = selectedRaceForJoin.players.filter(p => p !== '0x0000000000000000000000000000000000000000').length;
    if (playerCount >= selectedRaceType.maxPlayers) {
      toast.error('This race is already full');
      setIsJoinModalOpen(false);
      return;
    }

    // Check if user has enough speed boosts
    if (joinBoostAmount > userPowerUps.speedBoosts) {
      toast.error(`You only have ${userPowerUps.speedBoosts} Speed Boosts available`);
      return;
    }

    setIsJoiningRace(true);
    const toastId = toast.loading('Preparing to join race...');

    try {
      // Get race type index based on max players
      let raceTypeIndex;
      switch (selectedRaceType.maxPlayers) {
        case 2:
          raceTypeIndex = 1; // RaceSize.Two
          break;
        case 5:
          raceTypeIndex = 2; // RaceSize.Five
          break;
        case 10:
          raceTypeIndex = 3; // RaceSize.Ten
          break;
        default:
          throw new Error('Invalid race type');
      }

      // First simulate the transaction
      const { request } = await publicClient.simulateContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'joinRace',
        args: [
          BigInt(selectedRaceForJoin.id),
          BigInt(raceTypeIndex),
          BigInt(selectedCritter),
          BigInt(joinBoostAmount)
        ],
        value: BigInt(Math.floor(parseFloat(selectedRaceType.entryFee) * 10**18)),
        account: address as `0x${string}`
      });

      if (!request) {
        throw new Error('Failed to simulate transaction');
      }

      // If simulation succeeds, send the actual transaction
      const hash = await walletClient.writeContract(request);

      // Update toast to show pending transaction
      toast.loading(`Transaction submitted! Waiting for confirmation...`, { id: toastId });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      // Update local state to reflect used boosts
      setUserPowerUps(prev => ({
        speedBoosts: prev.speedBoosts - joinBoostAmount
      }));

      // Update selected power ups for confirmation screen
      setSelectedPowerUps({
        speedBoosts: joinBoostAmount
      });

      toast.success('Successfully joined race!', { id: toastId });
      setIsJoinModalOpen(false);
      setShowConfirmation(true);
      
      setTimeout(() => {
        navigate('/race');
      }, 3000);
    } catch (error: any) {
      console.error('Error joining race:', error);
      let errorMessage = 'Failed to join race';
      if (error.message) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Failed to join race: Contract execution reverted';
        }
      }
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsJoiningRace(false);
    }
  };

  // Handle creating a new race
  const handleCreateRace = async (raceType: typeof RACE_TYPES[number]) => {
    if (!isConnected || !walletClient || !publicClient || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    // After this point, we know these are defined
    const client = publicClient;
    const wallet = walletClient;

    setIsCreatingRace(true);
    const toastId = toast.loading(`Creating a new ${raceType.type} race...`);

    try {
      const existingRace = races.get(raceType.type);
      if (existingRace && existingRace.races.length > 0 && existingRace.races[0].isActive) {
        toast.error(`A ${raceType.type} race is already active. Please join it instead.`, { id: toastId });
        setIsCreatingRace(false);
        return;
      }

      // Map maxPlayers to RaceSize enum values
      let raceTypeIndex = 0;
      switch (raceType.maxPlayers) {
        case 2:
          raceTypeIndex = 1; // RaceSize.Two
          break;
        case 5:
          raceTypeIndex = 2; // RaceSize.Five
          break;
        case 10:
          raceTypeIndex = 3; // RaceSize.Ten
          break;
        default:
          throw new Error('Invalid race size');
      }

      const { request } = await client.simulateContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'createRace',
        args: [raceTypeIndex],
        account: address as `0x${string}`
      });

      const hash = await wallet.writeContract(request);

      // Update toast to show pending transaction
      toast.loading(`Transaction submitted! Waiting for confirmation...`, { id: toastId });

      // Wait for transaction confirmation
      const receipt = await client.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      // Immediately refetch the races to update the UI
      await refetchRaces();

      // Show success message with transaction hash
      toast.success(
        <div>
          Successfully created a new {raceType.type} race!
          <br />
          <a 
            href={`https://sepolia.etherscan.io/tx/${hash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            View transaction
          </a>
        </div>,
        { id: toastId, duration: 5000 }
      );

      // Update selected race type
      setSelectedRaceType(raceType);
    } catch (error: any) {
      console.error('Error creating race:', error);
      
      let errorMessage = 'Failed to create race';
      if (error.message) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Race creation failed: Contract execution reverted';
        } else if (error.message.includes('race type not active')) {
          errorMessage = 'This race type is not currently active';
        }
      }
      
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsCreatingRace(false);
    }
  };

  // Handle purchasing speed boosts
  const handlePurchaseBoost = async () => {
    if (!isConnected || !walletClient || !publicClient || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (boostAmount <= 0) {
      toast.error('Please select a valid amount');
      return;
    }

    setIsPurchasingBoost(true);
    const toastId = toast.loading(`Preparing to purchase ${boostAmount} speed boost${boostAmount > 1 ? 's' : ''}...`);

    try {
      // Get the TWO player race entry fee and calculate price per boost
      const twoPlayerRaceType = RACE_TYPES[0]; // Use index 0 for TWO player race
      const POWER_UP_PERCENT = 10; // 10% of entry fee
      const pricePerBoost = (parseFloat(twoPlayerRaceType.entryFee) * POWER_UP_PERCENT) / 100;
      const totalCost = BigInt(Math.floor(pricePerBoost * boostAmount * 10**18)); // Convert to wei

      // First simulate the transaction to check for potential errors
      const { request } = await publicClient.simulateContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'buyPowerUps',
        args: [BigInt(boostAmount)], // Convert to bigint for contract call
        value: totalCost,
        account: address as `0x${string}`
      });

      // Update toast to show signing request
      toast.loading('Please sign the transaction...', { id: toastId });

      // If simulation succeeds, send the actual transaction
      const hash = await walletClient.writeContract(request);

      // Update toast to show pending transaction
      toast.loading(`Transaction submitted! Waiting for confirmation...`, { id: toastId });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      // Get updated boost count
      const newBoostCount = await publicClient.readContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'playerInventory_SpeedBoost',
        args: [address as `0x${string}`]
      });

      // Update UI state
      setUserPowerUps({
        speedBoosts: Number(newBoostCount)
      });

      // Show success message with transaction hash
      toast.success(
        <div>
          Successfully purchased {boostAmount} speed boost{boostAmount > 1 ? 's' : ''}!
          <br />
          You now have {Number(newBoostCount)} boosts.
          <br />
          <a 
            href={`https://sepolia.etherscan.io/tx/${hash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            View transaction
          </a>
        </div>,
        { id: toastId, duration: 5000 }
      );

      // Reset amount
      setBoostAmount(1);

    } catch (error: any) {
      console.error('Error purchasing speed boost:', error);

      let errorMessage = 'Failed to purchase speed boost';
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient MON balance to purchase boosts';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed: Contract execution reverted';
        }
      }

      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsPurchasingBoost(false);
    }
  };

  // Confirmation overlay
  const ConfirmationOverlay = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-green-400 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
          <p className="text-gray-300 mb-4">
            You've successfully joined the {selectedRaceType?.type} race with your {
              userCritters.find(c => c.id === selectedCritter?.toString())?.rarity
            } critter.
          </p>
          
          <div className="bg-gray-700/50 p-4 rounded-lg mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Potential Winnings:</span>
              <span className="text-green-400 font-bold">{potentialWinnings} MON</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Speed Boosts:</span>
              <span className="text-blue-400">{selectedPowerUps.speedBoosts} (+{selectedPowerUps.speedBoosts * 100} score)</span>
            </div>
          </div>
          
          <p className="text-gray-400 text-sm mb-6">
            Redirecting to race view in a moment...
          </p>
          
          <div className="flex justify-center">
            <button
              onClick={() => navigate('/race')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Race Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Update the renderRaceCard function to use the RaceCard component
  const renderRaceCard = (raceType: typeof RACE_TYPES[number]) => {
    const raceData = races.get(raceType.type) as RaceTypeMapping | undefined;
    const activeRace = raceData?.races[0]; // Get the most recent active race
    
    // Check if user is already in this race
    const isUserInRace = activeRace?.players.some(player => 
      player.toLowerCase() === address?.toLowerCase()
    ) ?? false;

    // Count actual players (excluding zero addresses)
    const currentPlayers = activeRace?.players.filter(
      p => p !== '0x0000000000000000000000000000000000000000'
    ).length ?? 0;

    // Determine if race is full
    const isFull = currentPlayers >= raceType.maxPlayers;

    // Smart visibility logic:
    // 1. Always show if user is in the race
    // 2. Show if race is not full
    // 3. Show if no active race exists (can create new)
    const shouldShowCard = isUserInRace || !isFull || !activeRace;

    // Only show if it meets our visibility criteria
    if (!shouldShowCard) return null;

    // Determine if a new race can be created
    const canCreateRace = !activeRace?.isActive;
    
    // Determine race status and interactivity
    const isRaceActive = activeRace?.isActive && !activeRace?.hasEnded;
    const canJoin = isRaceActive && !isFull && !isUserInRace;

    return (
      <RaceCard
        key={raceType.type}
        type={raceType.type}
        currentPlayers={currentPlayers}
        maxPlayers={raceType.maxPlayers}
        winners={raceType.winners}
        entryFee={raceType.entryFee}
        prizePool={activeRace ? formatUnits(activeRace.prizePool, 18) : '0'}
        isLoading={raceData?.isLoading}
        error={raceData?.error}
        isRaceActive={isRaceActive ?? false}
        isUserInRace={isUserInRace}
        onJoin={canJoin ? () => handleRaceCardClick(raceType) : undefined}
        onCreateRace={canCreateRace ? () => handleCreateRace(raceType) : undefined}
        isCreatingRace={isCreatingRace}
      />
    );
  };

  // Add effect to fetch user's power-ups when contract events occur
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'PowerUpLoaded' as const,
    onLogs: async () => {
      try {
        // Refetch user's power-ups after any power-up event
        if (address && contracts.monad.race && publicClient) {
          const result = await publicClient.readContract({
            address: contracts.monad.race as `0x${string}`,
            abi: raceContractAbi,
            functionName: 'playerInventory_SpeedBoost',
            args: [address as `0x${string}`]
          });

          setUserPowerUps({
            speedBoosts: Number(result)
          });
        }
      } catch (error) {
        console.error('Error updating power-ups after event:', error);
      }
    }
  });

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
            <h1 className="text-4xl sm:text-5xl font-bold mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 animate-text-shimmer">
                Race Lobby
              </span>
            </h1>
            <p className="text-gray-300 text-lg">Join or create races and compete with your Critters</p>
          </motion.div>
          
          {/* Speed Boost Purchase */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
          >
            <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Purchase Speed Boosts
            </h2>
            <p className="text-gray-400 mb-4">
              Speed boosts give you an advantage in races. Each boost costs 0.01 MON and adds +100 to your final race score.
            </p>
            
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center bg-gray-700/50 rounded-lg p-2 w-full md:w-auto border border-gray-600/50">
                <button 
                  onClick={() => setBoostAmount(Math.max(1, boostAmount - 1))}
                  className="px-3 py-1 bg-gray-600/50 rounded-l text-white hover:bg-gray-500/50 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={boostAmount}
                  onChange={(e) => setBoostAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-transparent text-center text-white"
                />
                <button 
                  onClick={() => setBoostAmount(boostAmount + 1)}
                  className="px-3 py-1 bg-gray-600/50 rounded-r text-white hover:bg-gray-500/50 transition-colors"
                >
                  +
                </button>
              </div>

              <div className="text-gray-300 flex-grow">
                <div>Total Cost: <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-bold">{(0.01 * boostAmount).toFixed(2)} MON</span></div>
                <div className="text-sm text-gray-400">You currently have: <span className="text-blue-400 font-bold">{userPowerUps.speedBoosts}</span> boosts</div>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePurchaseBoost}
                disabled={isPurchasingBoost || !isConnected}
                className={`px-6 py-2 rounded-lg font-medium transition-all transform ${
                  isPurchasingBoost || !isConnected
                    ? 'bg-gray-600/50 text-gray-300 cursor-not-allowed border border-gray-500/50'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
                }`}
              >
                {isPurchasingBoost ? 'Purchasing...' : 'Purchase Boosts'}
              </motion.button>
            </div>
          </motion.div>
          
          {/* Critter Selection */}
          {userCritters.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Select Critter
              </h2>
              
              {isLoadingCritters && userCritters.length > 0 ? (
                <div className="flex items-center justify-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent"></div>
                  <span className="ml-2 text-gray-400">Refreshing critters...</span>
                </div>
              ) : null}
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {userCritters.map((critter) => (
                  <motion.div
                    key={critter.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedCritter(parseInt(critter.id))}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedCritter === parseInt(critter.id)
                        ? 'bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-2 border-purple-500/50'
                        : 'bg-gray-700/50 border-2 border-transparent hover:border-gray-500/50'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">#{critter.id}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        critter.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-300' :
                        critter.rarity === 'rare' ? 'bg-purple-500/20 text-purple-300' :
                        critter.rarity === 'uncommon' ? 'bg-green-500/20 text-green-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {critter.rarity}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Speed</div>
                      <div className="text-right text-gray-200">{critter.stats.speed}</div>
                      <div className="text-gray-400">Stamina</div>
                      <div className="text-right text-gray-200">{critter.stats.stamina}</div>
                      <div className="text-gray-400">Luck</div>
                      <div className="text-right text-gray-200">{critter.stats.luck}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : isLoadingCritters ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Loading Critters
              </h2>
              <div className="flex items-center justify-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
                <span className="ml-3 text-gray-300">Loading your critters...</span>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                No Critters Found
              </h2>
              <p className="text-gray-400 mb-4">
                You don't have any critters yet. Head to the minting page to get some!
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/mint')}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transform transition-all shadow-lg hover:shadow-purple-500/25"
              >
                Go to Minting Page
              </motion.button>
            </motion.div>
          )}
          
          {/* Race Selection */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Available Races
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {RACE_TYPES.map(renderRaceCard)}
            </div>
          </motion.div>
          
          {/* Join Race Modal */}
          {isJoinModalOpen && (
            <RaceJoinModal
              isOpen={isJoinModalOpen}
              onClose={() => {
                setIsJoinModalOpen(false);
                setJoinBoostAmount(0);
              }}
              onJoin={async (critterId, boostAmount) => {
                setJoinBoostAmount(boostAmount);
                await handleJoinRace();
              }}
              critters={userCritters}
              entryFee={selectedRaceType?.entryFee || '0.1'}
              maxPlayers={selectedRaceType?.maxPlayers || 2}
              currentPlayers={selectedRaceForJoin?.players.length || 0}
              winners={selectedRaceType?.winners || 1}
              availableBoosts={userPowerUps.speedBoosts}
            />
          )}
          
          {/* Confirmation Overlay */}
          {showConfirmation && <ConfirmationOverlay />}
        </div>
      </div>
    </div>
  );
}

