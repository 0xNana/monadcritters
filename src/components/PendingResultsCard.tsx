import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClashDetail, ClashState, ClashSize } from '../contracts/CritterClashCore/types';
import { formatEther } from 'viem';
import { useWriteContract } from 'wagmi';
import { useCritterClashCore } from '../contracts/CritterClashCore/hooks';
import { toast } from 'react-hot-toast';
import { abi } from '../contracts/CritterClashCore/abi';

// Define constants at the top of the file
const DEGEN_MESSAGES = [
  "Calculating your gains (or losses) ",
  "May the odds be in your favor 🍀",
  "Go all in or go home 💎",
  "WAGMI - We're All Gonna Make It 🚀",
  "No risk no reward 💪",
  "To the moon! 🌙",
  "Diamond hands activated 💎🙌",
  "Checking if you're gonna make it...",
  "HODL the line! ⚔️",
  "Wen lambo? Soon™ 🏎️",
  "Fortune favors the bold 🎯",
  "This is the way 🗺️",
  "Summoning the profit gods 🙏",
  "Copium reserves: FULL 🌿",
  "Based results incoming... 📈"
];

// Constants for timing
const DEGEN_OVERLAY_DURATION = 15000; // 15 seconds
const MESSAGE_CHANGE_INTERVAL = 2000; // 2 seconds per message

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
  const [completedClash, setCompletedClash] = useState<ClashDetail | null>(null);
  const { writeContract } = useWriteContract();
  const { getClashInfo, completeClash: completeClashContract } = useCritterClashCore();
  const [isCompletingClash, setIsCompletingClash] = useState(false);
  const [isLoadingClash, setIsLoadingClash] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [currentDegenMessage, setCurrentDegenMessage] = useState(DEGEN_MESSAGES[0]);
  const [showDegenOverlay, setShowDegenOverlay] = useState(false);

  // Check if user was a participant in this clash - using the same pattern as CompletedClashCard
  const isUserParticipant = useMemo(() => {
    if (!userAddress || !clash.players || !Array.isArray(clash.players) || clash.players.length === 0) {
      return false;
    }

    const participates = clash.players.some(p => 
      p && p.player && typeof p.player === 'string' && 
      userAddress && 
      p.player.toLowerCase() === userAddress.toLowerCase()
    );

    return participates;
  }, [clash.id, clash.players, userAddress]);

  // Early return if not a participant or not in CLASHING state
  if (!isUserParticipant || clash.state !== ClashState.CLASHING) {
    return null;
  }

  // Effect to update time remaining
  useEffect(() => {
    if (!clash.startTime) {
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
    
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [clash.startTime, clash.id]);

  // Rotate degen messages
  useEffect(() => {
    if (!showDegenOverlay) return;
    
    let messageIndex = 0;
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % DEGEN_MESSAGES.length;
      setCurrentDegenMessage(DEGEN_MESSAGES[messageIndex]);
    }, MESSAGE_CHANGE_INTERVAL);
    
    return () => clearInterval(messageInterval);
  }, [showDegenOverlay]);

  // Check if clash can be completed (60 seconds have passed)
  const canComplete = useMemo(() => {
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
    
    // Store toast ID so we can dismiss it properly in all cases
    const loadingToastId = toast.loading(`Completing clash ${clash.id.toString()}...`);
    
    try {
      // Use writeContract directly instead of the wrapper function
      // This ensures proper wallet integration for signing
      await writeContract({
        address: import.meta.env.VITE_CRITTER_CLASH_CORE_ADDRESS as `0x${string}`,
        abi,
        functionName: 'completeClash',
        args: [BigInt(clash.id)]
      });
      
      // Record the time we started the process - AFTER successful transaction
      const processStartTime = Date.now();
      
      // Show degen messages overlay only AFTER successful transaction submission
      setShowDegenOverlay(true);
      
      // Dismiss the loading toast after transaction is complete
      toast.dismiss(loadingToastId);
      
      // Get clash info with results
      let updatedClash;
      let hasResults = false;
      
      try {
        // Single attempt to get clash info immediately
        updatedClash = await getClashInfo(Number(clash.id));
        
        // Check if it already has results
        hasResults = !!(updatedClash && 
                      updatedClash.results && 
                      updatedClash.results.length > 0 && 
                      updatedClash.results.some(result => result.score > BigInt(0)));
      } catch (error) {
        console.error(`Error getting initial clash info:`, error);
      }
      
      // Process the clash and transform into proper format if we have results
      let formattedClash: ClashDetail | null = null;
      
      if (hasResults && updatedClash) {
        formattedClash = {
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
          totalPrize: getTotalPrizePool(),
          status: 'Completed',
          hasEnded: true,
          isProcessed: updatedClash.isProcessed
        };
        
        // Store formatted clash for later access
        setCompletedClash(formattedClash);
      }
      
      // Calculate how long to show the degen overlay
      const currentTime = Date.now();
      const timeElapsed = currentTime - processStartTime;
      const remainingOverlayTime = Math.max(0, DEGEN_OVERLAY_DURATION - timeElapsed);
      
      // Show degen overlay for at least DEGEN_OVERLAY_DURATION milliseconds (15 seconds)
      setTimeout(() => {
        // Hide the overlay
        setShowDegenOverlay(false);
        
        // Show success message with direction to check completed tab
        toast.success("Your results are ready! Check the Completed tab to view details.", {
          duration: 5000,
          icon: '🏆'
        });
        
        // Notify parent component that we're done
        onComplete();
      }, remainingOverlayTime);
    } catch (error) {
      console.error(`Error completing clash ${clash.id.toString()}:`, error);
      // Make sure we dismiss the loading toast
      toast.dismiss(loadingToastId);
      
      // Ensure overlay is not showing in case of error
      setShowDegenOverlay(false);
      
      let errorMessage = `Failed to complete clash ${clash.id.toString()}`;
      if (error.message) {
        if (error.message.includes('user rejected') || 
            error.message.includes('User denied') || 
            error.message.includes('rejected transaction')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('insufficient funds') || 
                  error.message.includes('Insufficient funds')) {
          errorMessage = 'Insufficient funds to complete transaction';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed: Contract execution reverted';
        }
      }
      toast.error(errorMessage);
      onComplete(); // Still call onComplete to refresh the list
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
    // Different entry fees based on clash size
    const entryFee = clash.clashSize === ClashSize.Four 
      ? BigInt('2000000000000000000') // 2 MON for 4-player clashes
      : BigInt('1000000000000000000'); // 1 MON for 2-player clashes
    
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
      
      {/* Degen Messages Overlay */}
      <AnimatePresence>
        {showDegenOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/80"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="w-full max-w-lg mx-4 bg-gray-900/90 backdrop-blur-xl p-8 rounded-2xl border border-yellow-500/20 shadow-lg"
            >
              {/* Loading animation */}
              <div className="flex justify-center mb-6">
                <motion.div 
                  animate={{ 
                    rotate: 360,
                    transition: { 
                      duration: 2,
                      ease: "linear",
                      repeat: Infinity 
                    }
                  }}
                  className="w-20 h-20 rounded-full border-4 border-yellow-500/30 border-t-yellow-500"
                />
              </div>
              
              {/* Animated degen messages */}
              <motion.div 
                className="text-center mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={currentDegenMessage} // This makes the animation trigger on message change
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-2xl font-bold text-yellow-400 mb-2">Processing Clash</h3>
                <p className="text-lg text-white">{currentDegenMessage}</p>
              </motion.div>
              
              <div className="w-full bg-gray-800/50 rounded-full h-2.5 mb-4">
                <motion.div 
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2.5 rounded-full"
                  initial={{ width: "10%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: DEGEN_OVERLAY_DURATION / 1000, ease: "easeInOut" }}
                />
              </div>
              
              <p className="text-gray-400 text-center text-sm">Please wait while we calculate the clash results...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* We no longer show the modal, instead directing users to the Completed tab */}
    </>
  );
};

export default PendingResultsCard;