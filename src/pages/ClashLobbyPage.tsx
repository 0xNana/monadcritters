import React, { useState, useEffect, Component, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConfig } from 'wagmi';
import { useWallet } from '../components/WalletProvider';
import { CRITTER_CLASH_CORE_ABI, CRITTER_CLASH_CORE_ADDRESS } from '../constants/contracts';
import { useToast } from '../components/Toast';
import { useHasCritter } from '../hooks/useHasCritter';
import { useUserCritters } from '../hooks/useUserCritters';
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { transformClashData } from '../utils/transformers';
import { BoostPurchase } from '../components/BoostPurchase';
import JoinClashModal from '../components/JoinClashModal';
import { ClashDetail, ClashSize, ClashState } from '../contracts/CritterClashCore/types';
import ClashSizeCard from '../components/ClashSizeCard';
import CritterCard from '../components/CritterCard';
import { useCritterClashCore } from '../contracts/CritterClashCore/hooks';

// Error Boundary Component
class ClashCardErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Clash Card Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/20 backdrop-blur-sm rounded-xl p-6 text-center">
          <p className="text-red-400">Failed to load clash data</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-md text-white"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrapper component for clash cards with error boundary
const SafeClashCard = ({ children }: { children: React.ReactNode }) => (
  <ClashCardErrorBoundary>
    <div className="relative">
      {children}
    </div>
  </ClashCardErrorBoundary>
);

// Helper function to check if user is in clash
const isUserInClash = (clash: ClashDetail | null, userAddress?: string) => {
  if (!clash || !userAddress) return false;
  return clash.players.some(player => 
    player.player.toLowerCase() === userAddress.toLowerCase()
  );
};

// Constants for state checks - only care about ACCEPTING_PLAYERS
const LOBBY_STATE = [ClashState.ACCEPTING_PLAYERS] as const;

type LobbyState = typeof LOBBY_STATE[number];

// Helper function to check if a clash is in lobby
const isClashInLobby = (clash: ClashDetail | null): clash is ClashDetail & { state: LobbyState } => {
  if (!clash) return false;
  return clash.state === ClashState.ACCEPTING_PLAYERS;
};

// Helper function to get user's lobby clashes - only ACCEPTING_PLAYERS
const getUserLobbyClashes = (
  clashes: (ClashDetail | null)[], 
  userAddress?: string
) => {
  if (!userAddress) return [];
  return clashes
    .filter((clash): clash is ClashDetail => 
      clash !== null && 
      isUserInClash(clash, userAddress) && 
      clash.state === ClashState.ACCEPTING_PLAYERS
    );
};

export default function ClashLobbyPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { isConnected } = useWallet();
  const { showToast } = useToast();
  const { hasCritter, isLoading: isLoadingHasCritter } = useHasCritter(address);
  const { userCritters, isLoading: isLoadingCritters } = useUserCritters();
  const [boostCount, setBoostCount] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedClashSize, setSelectedClashSize] = useState<ClashSize | null>(null);
  const [selectedCritterId, setSelectedCritterId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const { getPlayerBoosts } = useCritterClashCore();
  
  // Check if wagmi is properly initialized
  const [isWeb3Ready, setIsWeb3Ready] = useState(false);
  const config = useConfig();
  
  useEffect(() => {
    // Check if config exists and is properly initialized
    if (config && config.chains && config.chains.length > 0) {
      setIsWeb3Ready(true);
    } else {
      console.warn('Wagmi config not ready yet');
    }
  }, [config]);

  // Only enable contract calls if web3 is ready
  const shouldEnableContractCalls = isWeb3Ready && isConnected;

  // Get active clashes for both sizes - we'll use direct contract calls for this legacy function
  const { data: activeTwoPlayerClashId, refetch: refetchTwoPlayerClash } = useReadContract({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'currentActiveClash' as any, // Use type assertion since this is a legacy function
    args: [ClashSize.Two],
    query: {
      enabled: shouldEnableContractCalls
    }
  });

  const { data: activeFourPlayerClashId, refetch: refetchFourPlayerClash } = useReadContract({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'currentActiveClash' as any, // Use type assertion since this is a legacy function
    args: [ClashSize.Four],
    query: {
      enabled: shouldEnableContractCalls
    }
  });

  // Debug logging for active clash IDs
  useEffect(() => {
    console.log('Active Clash IDs:', {
      twoPlayer: activeTwoPlayerClashId?.toString(),
      fourPlayer: activeFourPlayerClashId?.toString()
    });
  }, [activeTwoPlayerClashId, activeFourPlayerClashId]);

  // Get clash info for both sizes
  const { data: twoPlayerClashData, refetch: refetchTwoPlayerData } = useReadContract({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'getClashInfo',
    args: [typeof activeTwoPlayerClashId === 'bigint' ? activeTwoPlayerClashId : BigInt(0)],
    query: {
      enabled: shouldEnableContractCalls && !!activeTwoPlayerClashId && typeof activeTwoPlayerClashId === 'bigint' && activeTwoPlayerClashId > BigInt(0)
    }
  });

  const { data: fourPlayerClashData, refetch: refetchFourPlayerData } = useReadContract({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'getClashInfo',
    args: [typeof activeFourPlayerClashId === 'bigint' ? activeFourPlayerClashId : BigInt(0)],
    query: {
      enabled: shouldEnableContractCalls && !!activeFourPlayerClashId && typeof activeFourPlayerClashId === 'bigint' && activeFourPlayerClashId > BigInt(0)
    }
  });

  // Debug raw contract data before transformation
  useEffect(() => {
    console.log('Raw contract data before transformation:', {
      twoPlayerClashData,
      fourPlayerClashData,
      twoPlayerClashId: activeTwoPlayerClashId?.toString(),
      fourPlayerClashId: activeFourPlayerClashId?.toString()
    });
  }, [twoPlayerClashData, fourPlayerClashData, activeTwoPlayerClashId, activeFourPlayerClashId]);

  // Transform clash data with better error handling
  const twoPlayerClashInfo = useMemo(() => {
    if (!twoPlayerClashData || !activeTwoPlayerClashId || typeof activeTwoPlayerClashId !== 'bigint') return null;
    try {
      return transformClashData(activeTwoPlayerClashId, twoPlayerClashData as any);
    } catch (error) {
      console.error('Error transforming two-player clash data:', error);
      return null;
    }
  }, [twoPlayerClashData, activeTwoPlayerClashId]);

  const fourPlayerClashInfo = useMemo(() => {
    if (!fourPlayerClashData || !activeFourPlayerClashId || typeof activeFourPlayerClashId !== 'bigint') return null;
    try {
      return transformClashData(activeFourPlayerClashId, fourPlayerClashData as any);
    } catch (error) {
      console.error('Error transforming four-player clash data:', error);
      return null;
    }
  }, [fourPlayerClashData, activeFourPlayerClashId]);

  // Debug logging for transformed clash info
  useEffect(() => {
    console.log('Transformed Clash Info:', {
      twoPlayer: {
        id: activeTwoPlayerClashId?.toString(),
        info: twoPlayerClashInfo,
        state: twoPlayerClashInfo?.state,
        rawData: twoPlayerClashData
      },
      fourPlayer: {
        id: activeFourPlayerClashId?.toString(),
        info: fourPlayerClashInfo,
        state: fourPlayerClashInfo?.state,
        rawData: fourPlayerClashData
      }
    });
  }, [twoPlayerClashInfo, fourPlayerClashInfo, activeTwoPlayerClashId, activeFourPlayerClashId, twoPlayerClashData, fourPlayerClashData]);

  // Filter clashes to only show those in ACCEPTING_PLAYERS state
  const activeTwoPlayerClash = useMemo(() => 
    twoPlayerClashInfo?.state === ClashState.ACCEPTING_PLAYERS ? twoPlayerClashInfo : null,
    [twoPlayerClashInfo]
  );

  const activeFourPlayerClash = useMemo(() => 
    fourPlayerClashInfo?.state === ClashState.ACCEPTING_PLAYERS ? fourPlayerClashInfo : null,
    [fourPlayerClashInfo]
  );

  // Watch for clash state updates
  useWatchContractEvent({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    eventName: 'ClashUpdate',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const { args } = log as unknown as { args: [bigint, ClashSize, ClashState, `0x${string}`, bigint, bigint] };
        if (!args) return;
        
        const [, clashSize, state] = args;
        
        // Refetch data based on clash size
        if (clashSize === ClashSize.Two) {
          refetchTwoPlayerClash();
          refetchTwoPlayerData();
        } else if (clashSize === ClashSize.Four) {
          refetchFourPlayerClash();
          refetchFourPlayerData();
        }

        // Only show toast for ACCEPTING_PLAYERS state
        if (state === ClashState.ACCEPTING_PLAYERS) {
          showToast(`${clashSize === ClashSize.Two ? '2' : '4'} Player Clash is now open for players!`, 'info');
        }
      });
    },
    enabled: shouldEnableContractCalls
  });

  useWatchContractEvent({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    eventName: 'ClashJoined',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const { args } = log as unknown as { args: [`0x${string}`, bigint, bigint, `0x${string}`] };
        if (!args) return;
        
        const [player] = args;
        
        // Refetch data if the current user purchased boosts
        if (player.toLowerCase() === address?.toLowerCase()) {
          refetchTwoPlayerClash();
          refetchTwoPlayerData();
          refetchFourPlayerClash();
          refetchFourPlayerData();
        }
      });
    },
    enabled: shouldEnableContractCalls
  });

  // Debug logging for player counts
  useEffect(() => {
    console.log('Two Player Clash Info:', {
      id: twoPlayerClashInfo?.id.toString(),
      players: twoPlayerClashInfo?.players,
      playerCount: twoPlayerClashInfo?.playerCount,
      rawData: twoPlayerClashData
    });
    console.log('Four Player Clash Info:', {
      id: fourPlayerClashInfo?.id.toString(),
      players: fourPlayerClashInfo?.players,
      playerCount: fourPlayerClashInfo?.playerCount,
      rawData: fourPlayerClashData
    });
  }, [twoPlayerClashInfo, fourPlayerClashInfo, twoPlayerClashData, fourPlayerClashData]);

  // Add debug effect for modal state
  useEffect(() => {
    if (showJoinModal) {
      console.log('Modal state:', {
        showJoinModal,
        selectedClashSize,
        selectedCritterId,
        hasTwoPlayerData: !!twoPlayerClashInfo && !!activeTwoPlayerClashId,
        hasFourPlayerData: !!fourPlayerClashInfo && !!activeFourPlayerClashId
      });
    }
  }, [showJoinModal, selectedClashSize, selectedCritterId, twoPlayerClashInfo, fourPlayerClashInfo, activeTwoPlayerClashId, activeFourPlayerClashId]);

  // Update the loading state check in the UI
  const isLoading = isLoadingHasCritter || isLoadingCritters || !isWeb3Ready;

  // Get all possible clashes - ONLY ACCEPTING_PLAYERS state
  const allClashes = [activeTwoPlayerClash, activeFourPlayerClash].filter((clash): clash is ClashDetail => clash !== null);

  // Get user's lobby clashes - This should already filter for ACCEPTING_PLAYERS state clashes only
  const userLobbyClashes = getUserLobbyClashes(allClashes, address);

  // Show a loading state if web3 isn't ready
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Clash Lobby</h1>
        <div className="bg-gray-800 rounded-xl p-10 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-10 w-10 bg-blue-500 rounded-full mb-4"></div>
            <div className="h-4 w-40 bg-gray-700 rounded mb-2"></div>
            <div className="h-3 w-32 bg-gray-700 rounded"></div>
            <p className="mt-4 text-gray-400">Loading clash data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Clash Lobby</h1>
      
      <div className="space-y-8">
        {/* First Row: Your Critters and Power Boost */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Your Critters Section */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-6">Your Critters</h2>
            {userCritters.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {userCritters.map((critter) => (
                  <CritterCard
                    key={critter.id}
                    critter={critter}
                    isSelected={selectedCritterId === Number(critter.id)}
                    onClick={() => setSelectedCritterId(Number(critter.id))}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400">
                No critters found. Get your first critter to join clashes!
              </div>
            )}
          </div>

          {/* Power Boost Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 flex flex-col">
            <h2 className="text-2xl font-bold mb-2">Power Boost</h2>
            <p className="text-gray-400 mb-6">Apply a power boost strategically to increase your chance of winning.</p>
            <div className="flex-grow flex flex-col justify-center">
              <BoostPurchase />
            </div>
          </div>
        </div>

        {/* Second Row: Clash Cards */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-6">Join Clash To Win</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Two Player Clash Card */}
            <ClashSizeCard
              title="Two Player Clash"
              description="1v1 Battle - Winner Takes All!"
              clashInfo={activeTwoPlayerClash}
              maxPlayers={2}
              userAddress={address}
              isConnected={isConnected}
              hasCritter={hasCritter}
              onJoinClick={() => {
                console.log('Two Player Clash Join Attempt:', {
                  isConnected,
                  hasCritter,
                  clashState: activeTwoPlayerClash?.state,
                  playerCount: activeTwoPlayerClash?.playerCount,
                  clashInfo: activeTwoPlayerClash,
                  activeTwoPlayerClashId
                });

                if (!isConnected) {
                  showToast('Please connect your wallet', 'error');
                  return;
                }
                if (!hasCritter) {
                  showToast('You need a critter to join clashes', 'error');
                  return;
                }
                
                // Special case: No active clash - create a new one automatically
                if (!activeTwoPlayerClash || activeTwoPlayerClash.state !== ClashState.ACCEPTING_PLAYERS) {
                  showToast('No active clash available. Creating a new one...', 'info');
                  if (!selectedCritterId && userCritters.length > 0) {
                    setSelectedCritterId(Number(userCritters[0].id));
                  }
                  setSelectedClashSize(ClashSize.Two);
                  setShowJoinModal(true);
                  return;
                }
                
                // Check if clash is full
                if (activeTwoPlayerClash.playerCount >= 2) {
                  showToast('This clash is full. A new one will start soon!', 'info');
                  return;
                }
                
                // Select first critter if none selected
                if (!selectedCritterId && userCritters.length > 0) {
                  setSelectedCritterId(Number(userCritters[0].id));
                }
                
                // Ready to join
                setSelectedClashSize(ClashSize.Two);
                setShowJoinModal(true);
              }}
            />

            {/* Four Player Clash Card */}
            <ClashSizeCard
              title="Four Player Clash"
              description="Battle Royale - Top 2 Split the Prize!"
              clashInfo={activeFourPlayerClash}
              maxPlayers={4}
              userAddress={address}
              isConnected={isConnected}
              hasCritter={hasCritter}
              onJoinClick={() => {
                console.log('Four Player Clash Join Attempt:', {
                  isConnected,
                  hasCritter,
                  clashState: activeFourPlayerClash?.state,
                  playerCount: activeFourPlayerClash?.playerCount,
                  clashInfo: activeFourPlayerClash,
                  activeFourPlayerClashId
                });

                if (!isConnected) {
                  showToast('Please connect your wallet', 'error');
                  return;
                }
                if (!hasCritter) {
                  showToast('You need a critter to join clashes', 'error');
                  return;
                }
                
                // Special case: No active clash - create a new one automatically
                if (!activeFourPlayerClash || activeFourPlayerClash.state !== ClashState.ACCEPTING_PLAYERS) {
                  showToast('No active clash available. Creating a new one...', 'info');
                  if (!selectedCritterId && userCritters.length > 0) {
                    setSelectedCritterId(Number(userCritters[0].id));
                  }
                  setSelectedClashSize(ClashSize.Four);
                  setShowJoinModal(true);
                  return;
                }
                
                // Check if clash is full
                if (activeFourPlayerClash.playerCount >= 4) {
                  showToast('This clash is full. A new one will start soon!', 'info');
                  return;
                }
                
                // Select first critter if none selected
                if (!selectedCritterId && userCritters.length > 0) {
                  setSelectedCritterId(Number(userCritters[0].id));
                }
                
                // Ready to join
                setSelectedClashSize(ClashSize.Four);
                setShowJoinModal(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && selectedClashSize !== null && (
        <JoinClashModal
          clashSize={selectedClashSize}
          selectedCritterId={selectedCritterId ? BigInt(selectedCritterId) : null}
          onClose={() => {
            setShowJoinModal(false);
            setSelectedClashSize(null);
            setSelectedCritterId(null);
          }}
          onJoined={() => {
            if (selectedClashSize === ClashSize.Two) {
              refetchTwoPlayerClash();
              refetchTwoPlayerData();
            } else {
              refetchFourPlayerClash();
              refetchFourPlayerData();
            }
            setShowJoinModal(false);
            setSelectedClashSize(null);
            setSelectedCritterId(null);
          }}
        />
      )}
    </div>
  );
} 