import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClashDetail, ClashState, ClashSize } from '../contracts/CritterClashCore/types';
import { formatEther } from 'viem';
import { useWriteContract } from 'wagmi';
import { useCritterClashCore } from '../contracts/CritterClashCore/hooks';
import { toast } from 'react-hot-toast';
import ClashResultsModal from './ClashResultsModal';

interface PendingResultsCardProps {
  clash: ClashDetail;
  userAddress?: `0x${string}`;
  onComplete: () => void;
  isCompleting: boolean;
}

const PendingResultsCard: React.FC<PendingResultsCardProps> = ({
  clash,
  userAddress,
  onComplete,
  isCompleting: isCompletingFromProps
}) => {
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [completedClash, setCompletedClash] = useState<ClashDetail | null>(null);
  const { writeContract } = useWriteContract();
  const { getClashInfo, completeClash: completeClashContract } = useCritterClashCore();
  const [isCompletingClash, setIsCompletingClash] = useState(false);
  const [clashData, setClashData] = useState<ClashDetail | null>(null);
  const [isLoadingClash, setIsLoadingClash] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Check if user was a participant in this clash - with improved logging
  const isUserParticipant = React.useMemo(() => {
    if (!userAddress || !clash.players || !Array.isArray(clash.players) || clash.players.length === 0) {
      console.warn(`Clash ${clash.id.toString()}: Invalid player data or user not connected`, {
        userAddress,
        playerCount: clash.players?.length || 0,
        clashId: clash.id.toString()
      });
      return false;
    }

    // Check if ANY player matches the user address
    const participates = clash.players.some(p => 
      p && p.player && typeof p.player === 'string' && 
      userAddress && 
      p.player.toLowerCase() === userAddress.toLowerCase()
    );

    if (!participates) {
      console.warn(`Clash ${clash.id.toString()}: User ${userAddress} is not a participant`, {
        players: clash.players.map(p => p.player),
        user: userAddress
      });
    }

    return participates;
  }, [clash.id, clash.players, userAddress]);

  // Effect to update time remaining with better tracking for debugging
  useEffect(() => {
    if (!clash.startTime) {
      console.log(`Clash ${clash.id.toString()} has no start time`);
      return;
    }
    
    const CLASH_DURATION = 60; // 60 seconds
    let timerInterval: NodeJS.Timeout;
    
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTime = Number(clash.startTime) + CLASH_DURATION;
      if (now < endTime) {
        setTimeRemaining(endTime - now);
      } else {
        setTimeRemaining(0);
        clearInterval(timerInterval);
      }
    };
    
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    
    console.log(`Timer started for clash ${clash.id.toString()}: startTime=${Number(clash.startTime)}, endTime=${Number(clash.startTime) + CLASH_DURATION}`);
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
      console.log(`Timer cleared for clash ${clash.id.toString()}`);
    };
  }, [clash.startTime, clash.id]);

  // Don't render anything if user wasn't a participant
  if (!isUserParticipant) {
    return null;
  }

  // Ensure we only show STATE 1 (CLASHING) clashes
  if (clash.state !== ClashState.CLASHING) {
    console.log(`Clash ${clash.id.toString()} is not in CLASHING state (state=${clash.state})`);
    return null;
  }

  // Check if clash can be completed (60 seconds have passed)
  const canComplete = React.useMemo(() => {
    if (!clash.startTime) return false;
    const CLASH_DURATION = 60; // 60 seconds
    const now = Math.floor(Date.now() / 1000);
    return now > Number(clash.startTime) + CLASH_DURATION;
  }, [clash.startTime]);

  // Get clash status text based on state and time
  const getClashStatus = () => {
    if (clash.state !== ClashState.CLASHING) {
      return "Waiting for state update...";
    }
    
    if (!clash.startTime) return "Waiting to start...";
    
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(clash.startTime) + 60;
    
    if (now < endTime) {
      const remaining = endTime - now;
      return `Clash in progress... ${remaining}s remaining`;
    }
    
    return "Ready to complete! Click the button below.";
  };

  // Format time elapsed since clash ended or time remaining
  const getTimeElapsed = () => {
    if (!clash.startTime) return "Not started";
    
    const endTime = Number(clash.startTime) + 60; // 60 seconds clash duration
    const now = Math.floor(Date.now() / 1000);
    
    if (now < endTime) {
      return `${timeRemaining ?? (endTime - now)}s remaining`;
    }
    
    const elapsed = now - endTime;
    if (elapsed < 60) return `${elapsed}s ago`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
  };

  const handleCompleteClash = async () => {
    if (!canComplete) {
      toast.error("Clash cannot be completed yet");
      return;
    }

    setIsCompletingClash(true);
    const loadingToast = toast.loading(`Completing clash ${clash.id.toString()}...`);
    try {
      console.log('Completing clash:', clash.id.toString());
      
      // Complete the clash first
      await completeClashContract(Number(clash.id));
      
      // Show modal with loading state
      setShowResultsModal(true);
      
      // Poll for results with exponential backoff
      let attempts = 0;
      const maxAttempts = 10;
      const baseInterval = 2000; // 2 seconds base interval
      const maxInterval = 10000; // Max 10 seconds between polls
      
      const pollForResults = async () => {
        const cache = new Map();
        
        while (attempts < maxAttempts) {
          try {
            const updatedClash = await getClashInfo(Number(clash.id));
            const cacheKey = `${updatedClash.state}-${updatedClash.results?.length}`;
            
            // Check cache to avoid processing duplicate data
            if (cache.has(cacheKey)) {
              await new Promise(resolve => setTimeout(resolve, Math.min(baseInterval * Math.pow(1.5, attempts), maxInterval)));
              attempts++;
              continue;
            }
            
            cache.set(cacheKey, true);
            
            console.log('Polling for results:', {
              clashId: clash.id.toString(),
              state: updatedClash.state,
              results: updatedClash.results?.length,
              attempt: attempts,
              interval: Math.min(baseInterval * Math.pow(1.5, attempts), maxInterval)
            });
            
            if (updatedClash && 
                updatedClash.results && 
                updatedClash.results.length > 0 && 
                updatedClash.results.some(result => result.score > BigInt(0))) {
              const formattedClash: ClashDetail = {
                ...clash,
                id: updatedClash.id,
                clashSize: updatedClash.clashSize,
                state: updatedClash.state,
                playerCount: Number(updatedClash.playerCount),
                maxPlayers: Number(updatedClash.clashSize === ClashSize.Two ? 2 : 4),
                players: updatedClash.players.map((player, index) => ({
                  player,
                  critterId: updatedClash.critterIds[index],
                  score: updatedClash.scores[index],
                  boost: updatedClash.boosts[index] || BigInt(0)
                })),
                results: updatedClash.results,
                startTime: updatedClash.startTime,
                totalPrize: getTotalPrizePool(), // Calculate based on entry fees
                status: 'Completed',
                hasEnded: true,
                isProcessed: updatedClash.isProcessed
              };
              
              setCompletedClash(formattedClash);
              toast.dismiss(loadingToast);
              toast.success(`Clash ${clash.id.toString()} completed successfully!`);
              onComplete();
              return;
            }
          } catch (error) {
            console.error(`Error polling clash ${clash.id.toString()} (attempt ${attempts}):`, error);
          }
          
          // Exponential backoff with max interval
          await new Promise(resolve => setTimeout(resolve, Math.min(baseInterval * Math.pow(1.5, attempts), maxInterval)));
          attempts++;
        }
        
        console.log('Failed to get results after', attempts, 'attempts for clash', clash.id.toString());
        toast.dismiss(loadingToast);
        toast.error('Results are taking longer than expected. Please check back in a moment.');
        setShowResultsModal(false);
        onComplete(); // Still call onComplete to refresh the list
      };
      
      pollForResults();
    } catch (error) {
      console.error(`Error completing clash ${clash.id.toString()}:`, error);
      toast.dismiss(loadingToast);
      
      let errorMessage = `Failed to complete clash ${clash.id.toString()}`;
      if (error.message) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed: Contract execution reverted';
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsCompletingClash(false);
    }
  };

  // Get clash size name
  const getClashSizeName = () => {
    return clash.maxPlayers === 2 ? 'Two Player Clash' : 'Four Player Clash';
  };

  // Calculate total prize pool based on entry fee and player count
  const getTotalPrizePool = () => {
    const entryFee = BigInt('100000000000000000'); // 0.1 MON
    // Use actual player count from clash rather than maxPlayers to ensure accurate prize pool
    return entryFee * BigInt(clash.playerCount);
  };

  // Get prize distribution text based on actual player count and clash size
  const getPrizeDistribution = () => {
    if (clash.clashSize === ClashSize.Two) {
      return `Winner Takes ${formatEther(getTotalPrizePool())} MON`;
    } else {
      const totalPrize = getTotalPrizePool();
      const firstPlace = (totalPrize * BigInt(70)) / BigInt(100); // 70%
      const secondPlace = (totalPrize * BigInt(30)) / BigInt(100); // 30%
      return `1st: ${formatEther(firstPlace)} MON • 2nd: ${formatEther(secondPlace)} MON`;
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20 overflow-hidden p-6"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold text-yellow-400 flex items-center gap-2">
                {getClashSizeName()}
                {timeRemaining !== null && timeRemaining > 0 ? (
                  <motion.div
                    className="w-2 h-2 bg-yellow-400 rounded-full"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ) : (
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                )}
              </h3>
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-sm">{getTimeElapsed()}</p>
                <span className="text-gray-500 text-sm">•</span>
                <p className="text-gray-400 text-sm font-mono">ID: {clash.id.toString()}</p>
                {canComplete && (
                  <span className="text-yellow-400 text-xs bg-yellow-400/20 px-2 py-0.5 rounded-full">
                    Ready to Complete
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-3 py-1 bg-yellow-500/20 rounded-lg">
            <span className="text-yellow-400 font-medium">
              {clash.playerCount}/{clash.maxPlayers} Players
            </span>
          </div>
        </div>
        
        {/* Status Bar */}
        <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden mb-6">
          {Number(clash.startTime) > 0 && (
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ 
                width: `${Math.min(100, ((60 - (timeRemaining !== null && timeRemaining > 0 ? timeRemaining : 0)) / 60) * 100)}%` 
              }}
              className={`h-full ${
                canComplete 
                  ? 'bg-green-500' 
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500'
              }`}
            />
          )}
        </div>
        
        {/* Prize Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-gray-400 text-sm mb-2">Prize Pool</h4>
          <div className="flex justify-between items-center">
            <div className="text-yellow-400 font-semibold">{formatEther(getTotalPrizePool())} MON</div>
            <div className="text-gray-400 text-sm">{getPrizeDistribution()}</div>
          </div>
        </div>
        
        {/* Action Button */}
        <button
          onClick={handleCompleteClash}
          disabled={!canComplete || isCompletingClash || isCompletingFromProps}
          className={`w-full py-3 rounded-lg transition-all ${
            !canComplete
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : isCompletingClash || isCompletingFromProps
                ? 'bg-yellow-500/50 text-yellow-800 cursor-wait'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
          } flex justify-center items-center`}
        >
          {isCompletingClash || isCompletingFromProps ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Completing Clash...
            </>
          ) : !canComplete ? (
            `${getTimeElapsed()}`
          ) : (
            'Complete Clash'
          )}
        </button>
      </motion.div>
      
      {/* Results Modal */}
      {showResultsModal && completedClash && (
        <ClashResultsModal
          clash={completedClash}
          userAddress={userAddress}
          onClose={() => {
            setShowResultsModal(false);
            setCompletedClash(null);
            onComplete();
          }}
        />
      )}
    </>
  );
};

export default PendingResultsCard;