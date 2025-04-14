import React, { useState } from 'react';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { usePublicClient, useWalletClient } from 'wagmi';
import { ClashDetail, ClashState, ClashSize } from '../contracts/CritterClashCore/types';
import { toast } from 'react-hot-toast';
import JoinClashModal from './JoinClashModal';


// Styles
const styles = {
  card: 'bg-gray-800 rounded-lg overflow-hidden border border-gray-700 transition-all duration-300 hover:border-indigo-500',
  cardHeader: 'p-4 bg-gray-700 flex justify-between items-center',
  title: 'text-lg font-bold text-white',
  status: {
    ready: 'bg-yellow-500 text-white px-2 py-1 rounded text-xs',
    clashing: 'bg-green-500 text-white px-2 py-1 rounded text-xs',
    complete: 'bg-gray-500 text-white px-2 py-1 rounded text-xs'
  },
  cardBody: 'p-4',
  infoRow: 'flex justify-between py-2 border-b border-gray-700 text-sm',
  label: 'text-gray-400',
  value: 'text-white font-medium',
  players: 'mt-4',
  playerCount: 'text-sm text-gray-400 mb-2',
  playersList: 'grid grid-cols-2 gap-2',
  playerItem: 'text-xs bg-gray-700 p-2 rounded flex justify-between',
  joinButton: 'w-full mt-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition',
  disabled: 'opacity-50 cursor-not-allowed',
  actionButton: 'px-3 py-1 text-xs rounded-md ml-2',
  startButton: 'bg-green-600 hover:bg-green-700 text-white',
  endButton: 'bg-red-600 hover:bg-red-700 text-white',
  ownerChip: 'bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded ml-2',
};

interface ClashCardProps {
  clash: ClashDetail;
  onJoined: () => void;
}

const ClashCard: React.FC<ClashCardProps> = ({ clash, onJoined }) => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const hasJoined = clash.players.some(player => player.player.toLowerCase() === address?.toLowerCase());
  
  const getStatusLabel = (state: ClashState) => {
    switch (state) {
      case ClashState.ACCEPTING_PLAYERS:
        return 'Ready';
      case ClashState.CLASHING:
        return 'In Progress';
      case ClashState.COMPLETED_WITH_RESULTS:
        return 'Completed';
      default:
        return 'Unknown';
    }
  };
  
  const getStatusClass = (state: ClashState) => {
    switch (state) {
      case ClashState.ACCEPTING_PLAYERS:
        return styles.status.ready;
      case ClashState.CLASHING:
        return styles.status.clashing;
      case ClashState.COMPLETED_WITH_RESULTS:
        return styles.status.complete;
      default:
        return styles.status.ready;
    }
  };
  
  const formatDate = (timestamp: bigint) => {
    if (timestamp === BigInt(0)) return 'Not set';
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };
  
  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletClient || !publicClient) {
      toast.error('Wallet not connected');
      return;
    }

    setIsStarting(true);
    try {
      // We're just simulating a function call to update UI
      toast.success('Starting clash...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Clash started successfully!');
      onJoined(); // Refresh data
    } catch (error) {
      console.error('Error starting clash:', error);
      toast.error('Failed to start clash');
    } finally {
      setIsStarting(false);
    }
  };
  
  const handleEnd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletClient || !publicClient) {
      toast.error('Wallet not connected');
      return;
    }

    setIsEnding(true);
    try {
      // We're just simulating a function call to update UI
      toast.success('Completing clash...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Clash completed successfully!');
      onJoined(); // Refresh data
    } catch (error) {
      console.error('Error ending clash:', error);
      toast.error('Failed to end clash');
    } finally {
      setIsEnding(false);
    }
  };
  
  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowJoinModal(true);
  };
  
  // Calculate time remaining
  const getTimeRemaining = () => {
    if (clash.state === ClashState.COMPLETED_WITH_RESULTS) return 'Completed';
    if (clash.state === ClashState.ACCEPTING_PLAYERS) return 'Joining...';
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(clash.startTime) + 60 - now; // 60 second clash duration
    
    if (remaining <= 0) return 'Ending...';
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get status color
  const getStatusColor = () => {
    switch (clash.state) {
      case ClashState.ACCEPTING_PLAYERS:
        return 'bg-green-500/10 text-green-400';
      case ClashState.CLASHING:
        return 'bg-yellow-500/10 text-yellow-400';
      case ClashState.COMPLETED_WITH_RESULTS:
        return 'bg-gray-500/10 text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };
  
  // Calculate prize distribution based on clash size
  const getPrizeDistribution = () => {
    if (clash.maxPlayers === 2) {
      return [{ position: 1, percentage: 100 }];
    } else {
      return [
        { position: 1, percentage: 70 },
        { position: 2, percentage: 30 }
      ];
    }
  };

  // Format prize amount with position
  const formatPrize = (percentage: number) => {
    const amount = (clash.totalPrize * BigInt(percentage)) / BigInt(100);
    return formatEther(amount);
  };

  // Helper to convert maxPlayers to ClashSize enum
  const getClashSize = (maxPlayers: number): ClashSize => {
    // Ensure we only return valid clash sizes
    if (maxPlayers === 2) {
      return ClashSize.Two;
    }
    if (maxPlayers === 4) {
      return ClashSize.Four;
    }
    console.warn(`Invalid clash size: ${maxPlayers}, defaulting to None`);
    return ClashSize.none;
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.title}>
            Clash #{clash.id.toString()}
          </h3>
          <div className="flex items-center">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {getStatusLabel(clash.state)}
            </span>
            <span className="text-sm text-gray-400">
              {getTimeRemaining()}
            </span>
            
            {/* Action buttons */}
            {clash.state === ClashState.ACCEPTING_PLAYERS && clash.playerCount > 1 && (
              <button 
                className={`${styles.actionButton} ${styles.startButton}`}
                onClick={handleStart}
                disabled={isStarting}
              >
                {isStarting ? 'Starting...' : 'Start'}
              </button>
            )}
            
            {clash.state === ClashState.CLASHING && (
              <button 
                className={`${styles.actionButton} ${styles.endButton}`}
                onClick={handleEnd}
                disabled={isEnding}
              >
                {isEnding ? 'Ending...' : 'End'}
              </button>
            )}
          </div>
        </div>
        
        <div className={styles.cardBody}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Prize Pool</span>
            <div className="flex flex-col items-end">
              <span className={styles.value}>{formatEther(clash.totalPrize)} MON</span>
              <div className="text-xs text-gray-400">
                {getPrizeDistribution().map((prize, index) => (
                  <div key={prize.position}>
                    {index === 0 ? '1st' : '2nd'}: {formatPrize(prize.percentage)} MON
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className={styles.infoRow}>
            <span className={styles.label}>Players</span>
            <span className={styles.value}>
              {clash.playerCount} / {clash.maxPlayers}
              {clash.playerCount === clash.maxPlayers && (
                <span className="ml-2 text-yellow-400 text-sm">(Full)</span>
              )}
            </span>
          </div>
          
          {clash.state === ClashState.CLASHING && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Started</span>
              <span className={styles.value}>{formatDate(clash.startTime)}</span>
            </div>
          )}
          
          {clash.state === ClashState.COMPLETED_WITH_RESULTS && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Ended</span>
              <span className={styles.value}>{formatDate(clash.startTime)}</span>
            </div>
          )}
          
          {/* Player list for this clash */}
          <div className={styles.players}>
            <p className={styles.playerCount}>
              {clash.playerCount > 0 
                ? `${clash.playerCount} player${clash.playerCount > 1 ? 's' : ''} joined` 
                : 'No players yet'}
            </p>
            
            {clash.playerCount > 0 && (
              <div className={styles.playersList}>
                {clash.players.map((player, index) => (
                  <div key={player.critterId.toString()} className={styles.playerItem}>
                    <div className="flex flex-col">
                      <span className="text-white">
                        {player.player.toLowerCase() === address?.toLowerCase() ? 'You' : `Player ${index + 1}`}
                      </span>
                      {clash.state === ClashState.COMPLETED_WITH_RESULTS && clash.results && (
                        <span className="text-xs text-gray-400">
                          {clash.results[index] && (
                            <>
                              Score: {formatEther(player.score)} pts
                              <br />
                              Position: {clash.results[index].position.toString()}
                              {clash.results[index].reward > BigInt(0) && (
                                <span className="text-green-400 ml-1">
                                  (+{formatEther(clash.results[index].reward)} MON)
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )).slice(0, 6)}
                
                {clash.playerCount > 6 && (
                  <div className="text-xs text-gray-400 mt-1">
                    +{clash.playerCount - 6} more players
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Join button */}
          {clash.state === ClashState.ACCEPTING_PLAYERS && !hasJoined && clash.playerCount < clash.maxPlayers && (
            <button 
              className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mt-4"
              onClick={handleJoin}
            >
              Join Clash
            </button>
          )}
          
          {hasJoined && clash.state !== ClashState.COMPLETED_WITH_RESULTS && (
            <div className="text-center text-green-400 text-sm mt-4">
              You've joined this clash!
            </div>
          )}
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <JoinClashModal
          clashSize={clash.clashSize}
          selectedCritterId={null}
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            onJoined();
            setShowJoinModal(false);
          }}
        />
      )}
    </>
  );
};

export default ClashCard; 