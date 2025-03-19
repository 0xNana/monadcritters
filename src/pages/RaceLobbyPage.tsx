import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useReadContract, useReadContracts, useWatchContractEvent, usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { contracts, RACE_TYPES, QUERY_CONFIG } from '../utils/config';
import { formatUnits } from '@ethersproject/units';
import { RaceCard } from '../components/race/RaceCard';
import { RaceJoinModal } from '../features/race/components/RaceJoinModal';
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
const REFRESH_INTERVAL = QUERY_CONFIG.standard.refetchInterval;

// ERC721 ABI for balanceOf and getStats
const critterAbi = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [{ type: 'address' }],
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

// Add race type status tracking
interface RaceTypeStatus {
  isActive: boolean;
  lastChecked: number;
  cacheTimeout: number;
}

interface RaceTypeMapping {
  races: RaceInfo[];
  isLoading?: boolean;
  error?: Error | null;
  status?: RaceTypeStatus;
}

// Add this helper function before the component
const serializeRaceForComparison = (race: RaceInfo) => ({
  ...race,
  id: race.id.toString(),
  critterIds: race.critterIds.map(id => id.toString()),
  startTime: race.startTime.toString(),
  prizePool: race.prizePool.toString(),
});

// Add a cache for race type info to reduce RPC calls
const RACE_TYPE_INFO_CACHE = new Map<number, { info: any, timestamp: number }>();
const RACE_TYPE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const STAGGERED_LOADING_DELAY = 500; // 500ms between loading different race types

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
  
  // Add a function to refetch races
  const refetchRaces = useCallback(async () => {
    if (!address || !publicClient) return;
    
    // Refetch races for each race type
    for (let i = 0; i < RACE_TYPES.length; i++) {
      const raceType = RACE_TYPES[i];
      try {
        const races = await publicClient.readContract({
          address: contracts.monad.race as `0x${string}`,
          abi: raceContractAbi,
          functionName: 'getActiveRaces',
          args: [raceType.raceSize]
        }) as RaceInfo[];
        
        setRaces(prev => {
          const updated = new Map(prev);
          const existing = updated.get(raceType.type) || { races: [] };
          updated.set(raceType.type, { 
            ...existing, 
            races,
            isLoading: false, 
            error: null 
          });
          return updated;
        });
      } catch (error) {
        console.error(`Error refetching races for ${raceType.type}:`, error);
      }
    }
  }, [address, publicClient, setRaces]);
  
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
  
  // Read user's actual power-up inventory from contract with optimized caching
  const { data: speedBoosts, isError: speedError, refetch: refetchSpeedBoosts } = useReadContract({
    address: RACE_CONTRACT_ADDRESS,
    abi: raceContractAbi,
    functionName: 'playerInventory_SpeedBoost',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 3000, // Refetch every 3 seconds
      staleTime: 2000,    // Consider data stale after 2 seconds
      gcTime: 5000,       // Keep unused data for 5 seconds
      retry: true,        // Enable retries
      retryDelay: 1000    // Retry every second
    }
  });

  // Update userPowerUps state when speedBoosts data changes
  useEffect(() => {
    if (speedBoosts !== undefined) {
      setUserPowerUps(prev => ({
        ...prev,
        speedBoosts: Number(speedBoosts)
      }));
    }
  }, [speedBoosts]);

  // Add error handling for speed boosts query
  useEffect(() => {
    if (speedError) {
      console.error('Error fetching speed boosts:', speedError);
      toast.error('Failed to load speed boost balance. Please refresh the page.');
    }
  }, [speedError]);

  // Load user's critters with sequential contract calls
  useEffect(() => {
    const loadCritters = async () => {
      if (!address || !publicClient) return;

      // Only set loading state if we don't have any critters yet
      if (userCritters.length === 0) {
        setIsLoadingCritters(true);
      }

      try {
        console.debug('Loading critters for address:', address);
        
        // Use the getTokensOfOwner function from the contract
        const tokenIds = await publicClient.readContract({
          address: contracts.monad.critter as `0x${string}`,
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
        
        console.debug('Found token IDs:', tokenIds);
        
        if (!tokenIds || tokenIds.length === 0) {
          setUserCritters([]);
          setIsLoadingCritters(false);
          return;
        }

        // Check if we already have all these critters with the same IDs
        const currentIds = new Set(userCritters.map(c => c.id));
        const newIds = new Set(tokenIds.map(id => id.toString()));
        
        // If the sets are identical, skip fetching stats
        if (currentIds.size === newIds.size && 
            [...currentIds].every(id => newIds.has(id))) {
          console.debug('Critters unchanged, skipping update');
          setIsLoadingCritters(false);
          return;
        }

        // Fetch stats for each critter sequentially
        const updatedCritters = await Promise.all(
          tokenIds.map(async (tokenId) => {
            try {
              const stats = await publicClient.readContract({
                address: contracts.monad.critter as `0x${string}`,
                abi: critterAbi,
                functionName: 'getStats',
                args: [tokenId]
              }) as unknown as CritterStats;

              return {
                id: tokenId.toString(),
                rarity: rarityMap[stats.rarity],
                stats: {
                  speed: stats.speed,
                  stamina: stats.stamina,
                  luck: stats.luck
                }
              };
            } catch (error) {
              console.error(`Error fetching stats for critter ${tokenId}:`, error);
              return null;
            }
          })
        );

        // Filter out any failed fetches and sort by ID
        const validCritters = updatedCritters
          .filter((critter): critter is Critter => critter !== null)
          .sort((a, b) => parseInt(a.id) - parseInt(b.id));
        
        // Only update state if there are changes
        if (JSON.stringify(validCritters) !== JSON.stringify(userCritters)) {
          console.debug('Updating critters state with:', validCritters.length, 'critters');
          setUserCritters(validCritters);
        }
      } catch (error) {
        console.error('Error loading critters:', error);
      } finally {
        setIsLoadingCritters(false);
      }
    };

    // Initial load
    loadCritters();

    // Set up polling with a longer interval since critter ownership rarely changes
    const interval = setInterval(loadCritters, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [address, publicClient]);

  // Load races for each race type
  useEffect(() => {
    if (!address || !publicClient) return;

    const loadRacesForType = async (raceType: typeof RACE_TYPES[number], index: number) => {
      try {
        // Add a staggered delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, index * STAGGERED_LOADING_DELAY));
        
        setRaces(prev => {
          const updated = new Map(prev);
          const existing = updated.get(raceType.type) || { races: [] };
          updated.set(raceType.type, { ...existing, isLoading: true, error: null });
          return updated;
        });

        const races = await publicClient.readContract({
          address: contracts.monad.race as `0x${string}`,
          abi: raceContractAbi,
          functionName: 'getActiveRaces',
          args: [raceType.raceSize]
        }) as RaceInfo[];

        // Check race type status if needed
        let raceTypeStatus: RaceTypeStatus | undefined;
        const now = Date.now();
        const cachedInfo = RACE_TYPE_INFO_CACHE.get(raceType.raceSize);
        
        if (!cachedInfo || now - cachedInfo.timestamp > RACE_TYPE_CACHE_TIMEOUT) {
          try {
            const raceTypeInfo = await publicClient.readContract({
              address: contracts.monad.race as `0x${string}`,
              abi: raceContractAbi,
              functionName: 'getRaceTypeInfo',
              args: [raceType.raceSize]
            });
            
            // Cache the race type info
            RACE_TYPE_INFO_CACHE.set(raceType.raceSize, {
              info: raceTypeInfo,
              timestamp: now
            });
            
            raceTypeStatus = {
              isActive: raceTypeInfo[4], // Assuming the active status is the 5th element
              lastChecked: now,
              cacheTimeout: RACE_TYPE_CACHE_TIMEOUT
            };
          } catch (error) {
            console.warn(`Error fetching race type info for size ${raceType.raceSize}:`, error);
            // Use cached status if available, otherwise default to active
            raceTypeStatus = {
              isActive: cachedInfo?.info?.[4] ?? true,
              lastChecked: now,
              cacheTimeout: 60 * 1000 // Short timeout to retry sooner
            };
          }
        } else {
          // Use cached race type info
          raceTypeStatus = {
            isActive: cachedInfo.info[4],
            lastChecked: now,
            cacheTimeout: RACE_TYPE_CACHE_TIMEOUT
          };
        }

        setRaces(prev => {
          const updated = new Map(prev);
          updated.set(raceType.type, { 
            races, 
            isLoading: false, 
            error: null,
            status: raceTypeStatus
          });
          return updated;
        });
      } catch (error) {
        console.error(`Error loading races for ${raceType.type}:`, error);
        setRaces(prev => {
          const updated = new Map(prev);
          const existing = updated.get(raceType.type) || { races: [] };
          updated.set(raceType.type, { 
            ...existing, 
            isLoading: false, 
            error: error instanceof Error ? error : new Error(String(error))
          });
          return updated;
        });
      }
    };

    // Load races for each race type with staggered timing
    RACE_TYPES.forEach((raceType, index) => {
      loadRacesForType(raceType, index);
    });

    // Set up polling interval with staggered timing
    const intervalIds = RACE_TYPES.map((raceType, index) => {
      return setInterval(() => {
        loadRacesForType(raceType, index);
      }, REFRESH_INTERVAL + (index * 1000)); // Add 1 second per race type to stagger
    });

    return () => {
      intervalIds.forEach(id => clearInterval(id));
    };
  }, [address, publicClient]);

  // Optimize event watchers with conditional enabling
  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'RaceCreated' as const,
    onLogs: async () => {
      try {
        await refetchRaces();
      } catch (error) {
        console.error('Error refetching races after new race created:', error);
      }
    },
    enabled: isConnected // Only watch when connected
  });

  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'RaceEnded' as const,
    onLogs: async (logs) => {
      try {
        console.log('Race ended event received:', logs);
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
    },
    enabled: isConnected // Only watch when connected
  });

  useWatchContractEvent({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    eventName: 'PowerUpLoaded' as const,
    onLogs: async () => {
      try {
        if (address && contracts.monad.race && publicClient) {
          // Use the refetch function instead of manual contract call
          await refetchSpeedBoosts();
        }
      } catch (error) {
        console.error('Error updating power-ups after event:', error);
      }
    },
    enabled: isConnected && !!address // Only watch when connected and address available
  });

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
    
    const raceData = races.get(raceType.type);
    if (!raceData) {
      toast.error('Race not found');
      return;
    }

    // Get all active races that haven't ended and aren't full
    const availableRaces = raceData.races.filter(race => 
      race.isActive && 
      !race.hasEnded && 
      race.players.filter(p => p !== '0x0000000000000000000000000000000000000000').length < raceType.maxPlayers
    );

    if (availableRaces.length === 0) {
      toast.error('No available races to join. Try creating a new race!');
      return;
    }

    // Select the first available race
    const raceToJoin = availableRaces[0];
    
    console.log('Selected race for joining:', {
      raceId: raceToJoin.id.toString(),
      isActive: raceToJoin.isActive,
      hasEnded: raceToJoin.hasEnded,
      currentPlayers: raceToJoin.players.filter(p => p !== '0x0000000000000000000000000000000000000000').length,
      maxPlayers: raceType.maxPlayers
    });
    
    setSelectedRaceType(raceType);
    setSelectedRaceForJoin(raceToJoin);
    setIsJoinModalOpen(true);
  };

  // Update the handleJoinRace function to handle full races
  const handleJoinRace = async (critterId?: number, boostAmount?: number) => {
    // Use passed parameters if available, otherwise fall back to state
    const effectiveCritterId = critterId ?? selectedCritter;
    const effectiveBoostAmount = boostAmount ?? joinBoostAmount;

    console.log('Join race called with:', {
      critterId: effectiveCritterId,
      boostAmount: effectiveBoostAmount,
      selectedRaceType,
      selectedRaceForJoin,
      address,
      isConnected
    });

    if (!isConnected || !effectiveCritterId || !selectedRaceType || !walletClient || !selectedRaceForJoin || !address || !publicClient) {
      toast.error('Please connect wallet, select a critter, and choose a race type');
      return;
    }

    // Check if race has ended
    if (selectedRaceForJoin.hasEnded) {
      toast.error('This race has already ended');
      setIsJoinModalOpen(false);
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
    if (effectiveBoostAmount > userPowerUps.speedBoosts) {
      toast.error(`You only have ${userPowerUps.speedBoosts} Speed Boosts available`);
      return;
    }

    // Validate boost amount
    if (effectiveBoostAmount > 2) {
      toast.error('Maximum 2 speed boosts per race!');
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

      console.log('Joining race with params:', {
        raceId: selectedRaceForJoin.id.toString(),
        raceTypeIndex,
        critterId: effectiveCritterId,
        boostAmount: effectiveBoostAmount,
        entryFee: BigInt(Math.floor(parseFloat(selectedRaceType.entryFee) * 10**18)).toString()
      });

      // First simulate the transaction
      const { request } = await publicClient.simulateContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'joinRace',
        args: [
          selectedRaceForJoin.id,
          BigInt(selectedRaceType.raceSize),  // Use raceSize directly from selectedRaceType
          BigInt(effectiveCritterId),
          BigInt(effectiveBoostAmount)
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

      // Update local state to reflect used boosts immediately
      setUserPowerUps(prev => ({
        ...prev,
        speedBoosts: prev.speedBoosts - effectiveBoostAmount
      }));

      // Update selected power ups for confirmation screen
      setSelectedPowerUps({
        speedBoosts: effectiveBoostAmount
      });

      // Trigger a refetch of speed boosts to ensure sync with contract
      await refetchSpeedBoosts();

      toast.success('Successfully joined race!', { id: toastId });
      setIsJoinModalOpen(false);
      setShowConfirmation(true);
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

  // Modify handleCreateRace for optimization
  const handleCreateRace = async (raceType: typeof RACE_TYPES[number]) => {
    if (!address || !publicClient || !walletClient) {
      toast.error('Please connect your wallet first');
      return;
    }

    const toastId = toast.loading('Creating new race...');
    
    try {
      // Use the raceSize property directly from the race type
      const raceTypeIndex = raceType.raceSize;

      // Prepare the transaction
      const { request } = await publicClient.simulateContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'createRace',
        args: [raceTypeIndex],
        account: address as `0x${string}`
      });

      if (!request) {
        throw new Error('Failed to prepare transaction');
      }

      // Send the transaction
      const hash = await walletClient.writeContract(request);

      // Update toast to show pending transaction
      toast.loading(`Transaction submitted! Waiting for confirmation...`, { id: toastId });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      // Update UI immediately
      await refetchRaces();
      setSelectedRaceType(raceType);

      toast.success(
        <div>
          Successfully created a new {raceType.maxPlayers}-player race!
          <br />
          <a 
            href={`https://testnet.monadexplorer.com/tx/${hash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            View transaction
          </a>
        </div>,
        { id: toastId }
      );

    } catch (error) {
      console.error('Error creating race:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create race',
        { id: toastId }
      );
    }
  };

  // Update handlePurchaseBoost function
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
      const twoPlayerRaceType = RACE_TYPES[0];
      const POWER_UP_PERCENT = 10;
      const pricePerBoost = (parseFloat(twoPlayerRaceType.entryFee) * POWER_UP_PERCENT) / 100;
      const totalCost = BigInt(Math.floor(pricePerBoost * boostAmount * 10**18));

      // First simulate the transaction
      const { request } = await publicClient.simulateContract({
        address: contracts.monad.race as `0x${string}`,
        abi: raceContractAbi,
        functionName: 'buyPowerUps',
        args: [BigInt(boostAmount)],
        value: totalCost,
        account: address as `0x${string}`
      });

      toast.loading('Please sign the transaction...', { id: toastId });

      const hash = await walletClient.writeContract(request);

      toast.loading(`Transaction submitted! Waiting for confirmation...`, { id: toastId });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1
      });

      // Immediately refetch the balance
      await refetchSpeedBoosts();

      // Update local state optimistically
      setUserPowerUps(prev => ({
        ...prev,
        speedBoosts: prev.speedBoosts + boostAmount
      }));

      // Set up a few retries to ensure balance is updated
      let retries = 3;
      const ensureBalanceUpdate = async () => {
        while (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await refetchSpeedBoosts();
          retries--;
        }
      };
      ensureBalanceUpdate();

      toast.success(
        <div>
          Successfully purchased {boostAmount} speed boost{boostAmount > 1 ? 's' : ''}!
          <br />
          <a 
            href={`https://testnet.monadexplorer.com/tx/${hash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            View transaction
          </a>
        </div>,
        { id: toastId, duration: 5000 }
      );

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
  const ConfirmationOverlay = () => {
    // Calculate max potential winnings based on race size and entry fee
    const maxPotentialWinnings = React.useMemo(() => {
      if (!selectedRaceType?.entryFee) return '0';
      const entryFee = parseFloat(selectedRaceType.entryFee);
      const totalPot = entryFee * selectedRaceType.maxPlayers;
      const firstPlaceWinnings = totalPot * 0.5; // 50% for first place
      return firstPlaceWinnings.toFixed(4);
    }, [selectedRaceType]);

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 rounded-2xl p-8 max-w-md w-full border border-green-500/30 shadow-2xl shadow-green-500/20 backdrop-blur-xl"
        >
          <div className="text-center relative">
            {/* Success Animation */}
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
            >
              <span className="text-4xl">✓</span>
            </motion.div>
            
            {/* Title with Glow Effect */}
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold mb-2"
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                Race Entry Confirmed!
              </span>
            </motion.h2>
            
            {/* Critter Info */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <p className="text-gray-300 text-lg">
                Your{' '}
                <span className={`font-semibold ${
                  userCritters.find(c => c.id === selectedCritter?.toString())?.rarity === 'legendary' ? 'text-yellow-400' :
                  userCritters.find(c => c.id === selectedCritter?.toString())?.rarity === 'rare' ? 'text-purple-400' :
                  userCritters.find(c => c.id === selectedCritter?.toString())?.rarity === 'uncommon' ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  {userCritters.find(c => c.id === selectedCritter?.toString())?.rarity}
                </span>{' '}
                critter has entered the{' '}
                <span className="text-blue-400 font-semibold">
                  {selectedRaceType?.type}
                </span>{' '}
                race!
              </p>
            </motion.div>
            
            {/* Race Details Card */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900/70 rounded-xl p-6 mb-8 border border-gray-700/50 shadow-inner"
            >
              <div className="space-y-4">
                {/* Entry Fee */}
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-400">Entry Fee</span>
                  <span className="text-white font-medium">{selectedRaceType?.entryFee} MON</span>
                </div>
                
                {/* Max Potential Winnings */}
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-400">Max Potential Winnings</span>
                  <div className="text-right">
                    <span className="text-green-400 font-bold text-lg">{maxPotentialWinnings} MON</span>
                    <div className="text-xs text-gray-500">Based on full race</div>
                  </div>
                </div>
                
                {/* Speed Boosts */}
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-400">Speed Boosts</span>
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-400 font-medium">{selectedPowerUps.speedBoosts}x</span>
                      {selectedPowerUps.speedBoosts > 0 && (
                        <span className="text-blue-400/70 text-sm px-2 py-1 rounded-full bg-blue-500/10">
                          +{selectedPowerUps.speedBoosts * 100} score
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Race Size */}
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-400">Race Size</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{selectedRaceType?.maxPlayers} Players</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">
                      {selectedRaceType?.winners} Winner{selectedRaceType?.winners !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Action Buttons */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col space-y-3"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/race')}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transform transition-all shadow-lg hover:shadow-green-500/25 font-medium text-lg"
              >
                Go to Race View
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirmation(false)}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 text-white rounded-xl transform transition-all border border-purple-500/30 hover:border-purple-500/50 font-medium"
              >
                Join Another Race
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  };

  // Update the renderRaceCard function to use the RaceCard component
  const renderRaceCard = (raceType: typeof RACE_TYPES[number]) => {
    const raceData = races.get(raceType.type) as RaceTypeMapping | undefined;
    
    // Get all active races for this type that haven't ended
    const activeRaces = raceData?.races.filter(race => 
      race.isActive && !race.hasEnded
    ) || [];

    // Find the first available race (not full)
    const availableRace = activeRaces.find(race => 
      race.players.filter(p => p !== '0x0000000000000000000000000000000000000000').length < raceType.maxPlayers
    );
    
    // If no available race found, but there are active races, show the most recently created one
    const currentRace = availableRace || activeRaces[0] || raceData?.races[0];
    
    // Check if user is already in any active race of this type
    const isUserInRace = activeRaces.some(race => 
      race.players.some(player => player.toLowerCase() === address?.toLowerCase())
    ) ?? false;

    // Count actual players in current race (excluding zero addresses)
    const currentPlayers = currentRace?.players.filter(
      p => p !== '0x0000000000000000000000000000000000000000'
    ).length ?? 0;

    // Determine race states
    const isFull = currentPlayers >= raceType.maxPlayers;
    const hasEnded = currentRace?.hasEnded ?? false;
    const isRaceActive = currentRace?.isActive ?? false;

    // Smart race creation logic:
    // - Can create if no active races exist
    // - Can create if all active races are full
    // - Cannot create if user is already in a race
    const canCreateRace = !isUserInRace && (
      !currentRace?.isActive || 
      (activeRaces.length > 0 && activeRaces.every(race => 
        race.players.filter(p => p !== '0x0000000000000000000000000000000000000000').length >= raceType.maxPlayers
      ))
    );
    
    // Determine if user can join:
    // - Race must be active and not ended
    // - Race must not be full
    // - User must not be in any race of this type
    const canJoin = isRaceActive && !hasEnded && !isFull && !isUserInRace;

    // Get appropriate race to display
    const displayRace = availableRace || currentRace;

    return (
      <RaceCard
        key={raceType.type}
        type={raceType.type}
        currentPlayers={currentPlayers}
        maxPlayers={raceType.maxPlayers}
        winners={raceType.winners}
        entryFee={raceType.entryFee}
        prizePool={displayRace ? formatUnits(displayRace.prizePool, 18) : '0'}
        isLoading={raceData?.isLoading}
        error={raceData?.error}
        isRaceActive={isRaceActive && !hasEnded}
        isUserInRace={isUserInRace}
        onJoin={canJoin ? () => handleRaceCardClick(raceType) : undefined}
        onCreateRace={canCreateRace ? () => handleCreateRace(raceType) : undefined}
        isCreatingRace={isCreatingRace}
      />
    );
  };

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
                console.log('RaceJoinModal onJoin called with:', { critterId, boostAmount });
                // Call handleJoinRace with the values directly instead of relying on state
                const parsedCritterId = parseInt(critterId);
                await handleJoinRace(parsedCritterId, boostAmount);
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

