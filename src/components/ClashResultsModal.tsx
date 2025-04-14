import React, { useMemo } from 'react';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAddress } from '../utils/format';
import { ClashDetail, ClashState } from '../contracts/CritterClashCore/types';
import { useClashResults } from '../hooks/useClashResults';

interface ClashResult {
  player: `0x${string}`;
  critterId: bigint;
  position: bigint;
  reward: bigint;
  score: bigint;
}

interface FormattedResult {
  player: `0x${string}`;
  critterId: bigint;
  position: number;
  reward: bigint;
  score: number;
  formattedAddress: string;
  formattedReward: string;
  isUser: boolean;
}

interface ClashResultsModalProps {
  clash: ClashDetail;
  onClose: () => void;
  userAddress?: `0x${string}`;
}

// Loading state component
const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-8 space-y-4">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"
    />
    <p className="text-gray-400">Calculating clash results...</p>
  </div>
);

const ClashResultsModal: React.FC<ClashResultsModalProps> = ({ clash, onClose, userAddress }) => {
  // Use the useClashResults hook for consistent data handling
  const { clashInfo, isLoading: isLoadingResults } = useClashResults(clash.id);

  // Helper function to safely check if a player matches the user address
  const isUserPlayer = (playerAddress: string | null | undefined) => {
    if (!userAddress || !playerAddress) return false;
    return playerAddress.toLowerCase() === userAddress.toLowerCase();
  };

  // Helper function to calculate total prize pool
  const calculateTotalPrize = (maxPlayers: number, playerCount: number): bigint => {
    const entryFee = maxPlayers === 2 
      ? BigInt('1000000000000000000') // 1 MON for 2 player clash
      : BigInt('2000000000000000000'); // 2 MON for 4 player clash
    return entryFee * BigInt(playerCount);
  };

  // Helper function to calculate rewards based on position and clash type
  const calculateReward = (position: number, maxPlayers: number, totalPrize: bigint): bigint => {
    if (maxPlayers === 2) {
      // 2-player: Winner takes all (2 MON total)
      return position === 0 ? totalPrize : BigInt(0);
    } else {
      // 4-player: Top 2 split 70/30 (8 MON total)
      if (position === 0) return (totalPrize * BigInt(70)) / BigInt(100); // 5.6 MON
      if (position === 1) return (totalPrize * BigInt(30)) / BigInt(100); // 2.4 MON
      return BigInt(0);
    }
  };

  // Format results with memoization for performance
  const formattedResults = useMemo<FormattedResult[]>(() => {
    if (isLoadingResults) return [];

    try {
      // Use the most up-to-date data source
      const currentClash = clashInfo || clash;
      
      // Early return if no players
      if (!currentClash?.players?.length) return [];

      // Calculate total prize pool based on clash type
      const totalPrize = calculateTotalPrize(currentClash.maxPlayers, currentClash.playerCount);

      // Get sorted results based on scores
      const sortedResults = currentClash.results?.length > 0 
        ? [...currentClash.results].sort((a, b) => Number(a.position) - Number(b.position))
        : currentClash.players
            .filter(player => player && player.player) // Ensure player exists and has an address
            .map((player, index) => ({
              player: player.player,
              critterId: player.critterId,
              position: index + 1,
              reward: calculateReward(index, currentClash.maxPlayers, totalPrize),
              score: Number(player.score || 0)
            }))
            .sort((a, b) => b.score - a.score);

      // Format results
      return sortedResults.map(result => {
        if (!result?.player) return null;
        
        // Ensure reward is a valid BigInt
        const reward = result.reward ? BigInt(result.reward.toString()) : BigInt(0);
        
        return {
          player: result.player,
          critterId: result.critterId,
          position: Number(result.position),
          reward,
          score: Number(result.score),
          formattedAddress: formatAddress(result.player),
          formattedReward: formatEther(reward),
          isUser: isUserPlayer(result.player)
        };
      }).filter((result): result is FormattedResult => result !== null);
    } catch (error) {
      console.error('Error formatting results:', error);
      return [];
    }
  }, [clashInfo, clash, userAddress, isLoadingResults]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-gray-700/50 shadow-xl"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                Clash Results ({clash.maxPlayers} Players)
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Total Prize Pool: {formatEther(clash.totalPrize || BigInt(0))} MON
                {clash.maxPlayers > 2 ? ' • Split: 70/30' : ' • Winner Takes All'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors group"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="relative max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingResults ? (
              <LoadingState />
            ) : formattedResults.length > 0 ? (
              <div className="space-y-4">
                {/* Results list */}
                <div className="space-y-2">
                  {formattedResults.map((result, index) => (
                    <motion.div
                      key={`${result.player}-${result.critterId}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        result.isUser 
                          ? 'bg-purple-500/20 border border-purple-500/50' 
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          index === 0 ? 'bg-yellow-400/20 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/20 text-gray-400' :
                          index === 2 ? 'bg-amber-600/20 text-amber-600' :
                          'bg-gray-500/20 text-gray-500'
                        }`}>
                          <span className="text-2xl font-bold">#{String(index + 1)}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-gray-200">
                              {result.formattedAddress}
                            </p>
                            {result.isUser && (
                              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-400">
                            <p>Score: {Number(result.score).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      {/* Show reward if it exists and is greater than 0 */}
                      {typeof result.reward !== 'undefined' && result.reward > BigInt(0) && (
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Reward</p>
                          <p className="font-medium text-green-400">
                            +{result.formattedReward} MON
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No results available
              </div>
            )}
          </div>

          {/* Bottom close button */}
          <div className="mt-6 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 text-white rounded-xl transform transition-all border border-purple-500/30 hover:border-purple-500/50 font-medium"
            >
              Close Results
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClashResultsModal;