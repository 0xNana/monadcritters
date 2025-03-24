import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatEther } from 'viem';
import { useWatchContractEvent, useChainId } from 'wagmi';
import { useWallet } from '../../../components/WalletProvider';
import { contracts } from '../../../utils/config';
import { useRaceManager } from '../hooks/useRaceManager';
import { toast } from 'react-hot-toast';
import React from 'react';

// Add PowerUpLoaded event to the ABI
const raceAbi = [
  {
    name: 'PlayerJoined',
    type: 'event',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'critterId', indexed: true }
    ]
  },
  {
    name: 'PowerUpLoaded',
    type: 'event',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'bool', name: 'isSpeedBoost', indexed: false },
      { type: 'uint256', name: 'amount', indexed: false }
    ]
  }
] as const;

interface RaceEntryProps {
  onJoinRace: (critterId: string) => Promise<boolean>;
  onCreateRace: () => Promise<boolean>;
  entryFee: bigint;
  userCritters: any[];
  selectedPowerUps: any;
  isLoading: boolean;
  canJoinRace: boolean;
  canCreateRace: boolean;
}

// Add interface for race join data
interface RaceJoinData {
  raceId: string;
  playerAddress: string;
  critterId: string;
  prizePool: string;
  powerUps: {
    speedBoosts: number;
    sabotages: number;
    usedInRace: number;
  };
  timestamp: number;
}

// Update the validation state interfaces
interface JoinValidationState {
  canJoin: boolean;
  reason?: string;
  activeRaceId?: string;
}

interface CreateValidationState {
  canCreate: boolean;
  reason?: string;
  activeRaceId?: string;
}

// Add cache constants at the top after the interfaces
const CACHE_KEYS = {
  WAITING_RACE: (address: string) => `waiting_race_${address.toLowerCase()}`,
  RACE_DATA: (raceId: string) => `race_data_${raceId}`,
  LAST_CACHE_UPDATE: (address: string) => `last_cache_update_${address.toLowerCase()}`
} as const;

const CACHE_DURATION = 30 * 1000; // 30 seconds cache duration

const RARITY_TYPES = [
  { name: 'Common', color: 'from-gray-400 to-gray-600' },
  { name: 'Uncommon', color: 'from-green-400 to-green-600' },
  { name: 'Rare', color: 'from-blue-400 to-blue-600' },
  { name: 'Legendary', color: 'from-yellow-400 to-yellow-600' }
] as const;

// Add cache utility functions
const getCachedData = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
};

const setCachedData = (key: string, data: any) => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

// Add helper function to check if wallet is in race
const isWalletInRace = (race: any, walletAddress?: string): boolean => {
  if (!walletAddress || !race?.players) return false;
  return race.players.some((p: string) => p.toLowerCase() === walletAddress.toLowerCase());
};

export function RaceEntry({
  onJoinRace,
  onCreateRace,
  entryFee,
  userCritters,
  selectedPowerUps,
  isLoading: externalIsLoading,
  canJoinRace: externalCanJoinRace,
  canCreateRace: externalCanCreateRace,
}: RaceEntryProps) {
  const [selectedCritterId, setSelectedCritterId] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [waitingRaceId, setWaitingRaceId] = useState<string | null>(null);
  const [lastCreatedRaceId, setLastCreatedRaceId] = useState<string | null>(null);
  const [joinValidation, setJoinValidation] = useState<JoinValidationState>({ canJoin: true });
  const [createValidation, setCreateValidation] = useState<CreateValidationState>({ canCreate: true });

  const { 
    currentRace, 
    activeRaces, 
    canJoinCurrentRace, 
    canCreateRace, 
    fetchActiveRaces, 
    getWaitingRaceId,
    getLastCreatedRace
  } = useRaceManager();
  
  const { address } = useWallet();

  const chainId = useChainId();
  const contractAddress = chainId === 10143
    ? contracts.monad.race 
    : contracts.monad.race;

  // Get current player count and max players directly from currentRace
  const currentPlayers = currentRace?.players.length || 0;
  const maxPlayers = currentRace?.maxPlayers || 10;

  // Add new state for cached race data
  const [cachedRaceData, setCachedRaceData] = useState<{[key: string]: any}>({});

  // Modify the checkWaitingRace function to use cache
  useEffect(() => {
    const checkWaitingRace = async () => {
      if (!address) return;
      
      setIsLoading(true);
      try {
        // Check cache first
        const cacheKey = CACHE_KEYS.WAITING_RACE(address);
        const cachedWaitingRace = getCachedData(cacheKey);
        
        if (cachedWaitingRace) {
          setWaitingRaceId(cachedWaitingRace.raceId);
          setCachedRaceData(prev => ({
            ...prev,
            [cachedWaitingRace.raceId]: cachedWaitingRace
          }));
          
          // Update validation states
          if (cachedWaitingRace.raceId) {
            setJoinValidation({
              canJoin: false,
              reason: `You are already in Battle #${cachedWaitingRace.raceId}`,
              activeRaceId: cachedWaitingRace.raceId
            });
            setCreateValidation({
              canCreate: false,
              reason: `You are already in Battle #${cachedWaitingRace.raceId}`,
              activeRaceId: cachedWaitingRace.raceId
            });
          }
          
          setIsLoading(false);
          return;
        }

        // If no cache or expired, fetch from contract
        const waitingId = await getWaitingRaceId(address);
        setWaitingRaceId(waitingId);
        
        if (waitingId) {
          // Cache the waiting race data
          const raceData = {
            raceId: waitingId,
            timestamp: Date.now(),
            address
          };
          setCachedData(cacheKey, raceData);
          setCachedRaceData(prev => ({
            ...prev,
            [waitingId]: raceData
          }));

          setJoinValidation({
            canJoin: false,
            reason: `You are already in Battle #${waitingId}`,
            activeRaceId: waitingId
          });
          setCreateValidation({
            canCreate: false,
            reason: `You are already in Battle #${waitingId}`,
            activeRaceId: waitingId
          });
        }

        // Only fetch last created race if not in a waiting race
        if (!waitingId) {
          const lastCreated = await getLastCreatedRace();
          setLastCreatedRaceId(lastCreated);
        }
        
        await fetchActiveRaces();
      } catch (error) {
        console.error('Error checking waiting battle:', error);
        toast.error('Failed to check battle status');
      } finally {
        setIsLoading(false);
      }
    };

    checkWaitingRace();
  }, [address, getWaitingRaceId, getLastCreatedRace, fetchActiveRaces]);

  // Add cache cleanup on unmount
  useEffect(() => {
    return () => {
      // Only clean up old caches, not the current waiting race
      const now = Date.now();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('race_data_') || key.startsWith('waiting_race_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (now - data.timestamp > CACHE_DURATION) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
          }
        }
      });
    };
  }, []);

  // Debug logging
  useEffect(() => {
    console.debug('Battle Entry State:', {
      waitingRaceId,
      currentRace: currentRace?.id,
      playerCount: currentPlayers,
      maxPlayers,
      walletAddress: address,
      canJoin: joinValidation.canJoin,
      canCreate: createValidation.canCreate
    });
  }, [waitingRaceId, currentRace, currentPlayers, maxPlayers, address, joinValidation, createValidation]);

  // Watch for PlayerJoined events
  useWatchContractEvent({
    address: contractAddress as `0x${string}`,
    abi: raceAbi,
    eventName: 'PlayerJoined',
    onLogs(logs) {
      logs.forEach(log => {
        const joinedEvent = log as unknown as {
          args: {
            raceId: bigint;
            player: string;
            critterId: bigint;
          }
        };

        if (!joinedEvent.args) return;

        // Fetch latest race data when a player joins
        fetchActiveRaces();
      });
    }
  });

  // Watch for PowerUpLoaded events
  useWatchContractEvent({
    address: contractAddress as `0x${string}`,
    abi: raceAbi,
    eventName: 'PowerUpLoaded',
    onLogs(logs) {
      logs.forEach(log => {
        const powerUpEvent = log as unknown as {
          args: {
            raceId: bigint;
            player: string;
            isSpeedBoost: boolean;
            amount: bigint;
          }
        };

        if (!powerUpEvent.args || !currentRace) return;

        if (powerUpEvent.args.raceId.toString() === currentRace.id) {
          // Update power-up data in storage
          const key = `race_${currentRace.id}_powerups_${powerUpEvent.args.player}`;
          const storedData = localStorage.getItem(key);
          const powerUps = storedData ? JSON.parse(storedData) : {
            speedBoosts: 0,
            sabotages: 0,
            usedInRace: 0
          };

          if (powerUpEvent.args.isSpeedBoost) {
            powerUps.speedBoosts = Number(powerUpEvent.args.amount);
          } else {
            powerUps.sabotages = Number(powerUpEvent.args.amount);
          }

          localStorage.setItem(key, JSON.stringify(powerUps));
        }
      });
    }
  });

  // Update validation states when race state changes
  useEffect(() => {
    const joinVal = canJoinCurrentRace();
    const createVal = canCreateRace();

    // If wallet is in current race, update validation accordingly
    if (waitingRaceId && currentRace) {
      setJoinValidation({
        canJoin: false,
        reason: `You are already in Clash #${waitingRaceId}`,
        activeRaceId: waitingRaceId
      });
      setCreateValidation({
        canCreate: false,
        reason: `You are already in Clash #${waitingRaceId}`,
        activeRaceId: waitingRaceId
      });
    } else {
      setJoinValidation(joinVal);
      setCreateValidation(createVal);
    }
    
  }, [currentRace, canJoinCurrentRace, canCreateRace, waitingRaceId]);

  const handleJoinRace = async () => {
    if (!selectedCritterId || !currentRace) {
      toast.error('Please select a critter first');
      return;
    }

    if (waitingRaceId) {
      toast.error(`You are already in Race #${waitingRaceId}`);
      return;
    }

    setIsJoining(true);
    try {
      const success = await onJoinRace(selectedCritterId);
      if (success) {
        toast.success('Successfully joined race!');
        await fetchActiveRaces();
        
        // Update cache with new race data
        if (address) {
          const waitingId = await getWaitingRaceId(address);
          if (waitingId) {
            const raceData = {
              raceId: waitingId,
              timestamp: Date.now(),
              address,
              critterId: selectedCritterId
            };
            setCachedData(CACHE_KEYS.WAITING_RACE(address), raceData);
            setCachedRaceData(prev => ({
              ...prev,
              [waitingId]: raceData
            }));
            setWaitingRaceId(waitingId);
          }
        }
      }
    } catch (error) {
      console.error('Error joining race:', error);
      toast.error('Failed to join race');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRace = async () => {
    if (waitingRaceId) {
      toast.error(`You are already in Race #${waitingRaceId}`);
      return;
    }

    setIsCreating(true);
    try {
      const success = await onCreateRace();
      if (success) {
        toast.success('Successfully created race!');
        setSelectedCritterId('');
        await fetchActiveRaces();
        // Recheck waiting race status
        if (address) {
          const waitingId = await getWaitingRaceId(address);
          setWaitingRaceId(waitingId);
        }
      }
    } catch (error) {
      console.error('Error creating race:', error);
      toast.error('Failed to create race');
    } finally {
      setIsCreating(false);
    }
  };

  // Show loading state while fetching race data
  if (isLoading) {
    return (
      <motion.div className="max-w-4xl mx-auto">
        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <div className="text-center py-8">
            <motion.div
              className="text-2xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              🔄
            </motion.div>
            <p className="mt-4 text-gray-400">Loading race data...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        {/* Show waiting race status */}
        {waitingRaceId && (
          <div className="mb-6 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
            <h3 className="text-lg font-bold text-blue-400">Your Active Race</h3>
            <p className="text-sm text-blue-300">
              You are waiting to start Race #{waitingRaceId}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You cannot join or create new races while waiting for a race to start
            </p>
          </div>
        )}

        {/* Show last created race if no waiting race */}
        {!waitingRaceId && lastCreatedRaceId && (
          <div className="mb-6 p-4 bg-gray-900/30 rounded-lg border border-gray-500/30">
            <h3 className="text-lg font-bold text-gray-400">Latest Race</h3>
            <p className="text-sm text-gray-300">
              Race #{lastCreatedRaceId} is the most recently created race
            </p>
          </div>
        )}

        {/* Always show critter selection, but disable interactions if in waiting race */}
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">
                {waitingRaceId ? 'Current Race Status' : 'Select Your Critter'}
              </h2>
              {currentRace && (
                <div>
                  <p className="text-sm text-blue-400 mt-1">
                    Race #{currentRace.id}
                    {currentRace.raceStatus !== 'waiting' && ` • ${currentRace.raceStatus.toUpperCase()}`}
                  </p>
                  <p className="text-sm text-gray-400">
                    Players: <span className={currentPlayers >= maxPlayers ? 'text-red-400' : 'text-green-400'}>
                      {currentPlayers}/{maxPlayers}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Entry Fee</p>
              <p className="text-lg font-bold text-green-400">
                {formatEther(entryFee)} MON
              </p>
            </div>
          </div>

          {/* Critter selection grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {userCritters.map((critter) => {
              const rarityType = RARITY_TYPES.find(r => r.name.toLowerCase() === critter.rarity);
              return (
                <motion.div
                  key={critter.id}
                  className={`
                    relative p-4 rounded-lg border cursor-pointer transition-all
                    ${selectedCritterId === critter.id 
                      ? `bg-gradient-to-br ${rarityType?.color} bg-opacity-20`
                      : 'border-white/5 bg-black/20 hover:bg-white/5'}
                    ${waitingRaceId ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => !waitingRaceId && setSelectedCritterId(critter.id)}
                  whileHover={{ scale: waitingRaceId ? 1 : 1.02 }}
                  whileTap={{ scale: waitingRaceId ? 1 : 0.98 }}
                >
                  <div className={`text-sm font-semibold mb-2 bg-gradient-to-r ${rarityType?.color} bg-clip-text text-transparent`}>
                    {critter.rarity.charAt(0).toUpperCase() + critter.rarity.slice(1)}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>Speed: {critter.stats.speed}</p>
                    <p>Stamina: {critter.stats.stamina}</p>
                    <p>Luck: {critter.stats.luck}</p>
                  </div>
                  {selectedCritterId === critter.id && (
                    <motion.div
                      className={`absolute inset-0 border-2 rounded-lg bg-gradient-to-br ${rarityType?.color} bg-opacity-10`}
                      layoutId="selectedCritter"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Power-up summary */}
          <div className="flex justify-between items-center text-sm border-t border-white/10 pt-4">
            <div>
              <span className="text-gray-400">Selected Power-ups:</span>{' '}
              <span className="font-bold text-blue-400">
                {selectedPowerUps.speedBoosts} Boost{selectedPowerUps.speedBoosts !== 1 ? 's' : ''}{' '}
              </span>
              <span className="text-gray-400">|</span>{' '}
              <span className="font-bold text-red-400">
                {selectedPowerUps.sabotages} Sabotage{selectedPowerUps.sabotages !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons - disabled if in waiting race */}
        <div className="flex gap-4 mt-6">
          <button
            className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-200 ${
              !waitingRaceId && joinValidation.canJoin && selectedCritterId && !isJoining
                ? 'bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800'
                : 'bg-gray-700 cursor-not-allowed opacity-50'
            }`}
            onClick={handleJoinRace}
            disabled={!!waitingRaceId || !joinValidation.canJoin || !selectedCritterId || isJoining}
            title={waitingRaceId ? `You are in Race #${waitingRaceId}` : joinValidation.reason}
          >
            {isJoining ? 'Joining...' : 'Join Race'}
          </button>
          
          <button
            className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-200 ${
              !waitingRaceId && createValidation.canCreate && !isJoining && !isCreating
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800'
                : 'bg-gray-700 cursor-not-allowed opacity-50'
            }`}
            onClick={handleCreateRace}
            disabled={!!waitingRaceId || !createValidation.canCreate || isJoining || isCreating}
            title={waitingRaceId ? `You are in Race #${waitingRaceId}` : createValidation.reason}
          >
            {isCreating ? 'Creating...' : 'Create Race'}
          </button>
        </div>
      </div>
    </motion.div>
  );
} 