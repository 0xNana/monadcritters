import React, { useMemo, useEffect } from 'react';
import { formatUnits } from 'ethers';
import { useRaceResults } from '../hooks/useRaceResults';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAddress } from '../../../utils/format';

interface LeaderboardEntry {
  player: `0x${string}`;
  position: bigint;
  score: bigint;
  reward: bigint;
}

interface FormattedResult extends LeaderboardEntry {
  formattedAddress: string;
  formattedReward: string;
  isUser: boolean;
}

interface ResultsModalProps {
  race: {
    id: bigint;
    size: number;
    currentPlayers: number;
    status: 'Active' | 'Completed';
    startTime?: Date;
    endTime?: Date;
    results?: LeaderboardEntry[];
    progressStatus?: 'ready' | 'clashing' | 'complete';
    raceStartedAt?: number;
    participants?: {
      player: `0x${string}`;
      tokenId: bigint;
    }[];
    players: readonly `0x${string}`[];
    hasEnded: boolean;
    raceSize?: number;
    maxPlayers?: number;
  };
  onClose: () => void;
  userAddress?: `0x${string}`;
}

const ResultsModal: React.FC<ResultsModalProps> = ({ race, onClose, userAddress }) => {
  // Use our useRaceResults hook with proper error handling
  const { 
    results: contractResults, 
    isLoading, 
    error, 
    refetch,
    retryCount,
    resultSource 
  } = useRaceResults({
    raceId: race.id,
    userAddress: userAddress as `0x${string}` | undefined,
    isCompleted: race.hasEnded
  });

  // Format results with memoization for performance
  const formattedResults = useMemo(() => {
    // Prioritize contract results, fallback to race.results
    const sourceResults = contractResults || race.results;
    if (!sourceResults) return [];
    
    try {
      return [...sourceResults].map(result => ({
        ...result,
        position: BigInt(result.position),
        score: BigInt(result.score),
        reward: BigInt(result.reward),
        formattedAddress: formatAddress(result.player),
        formattedReward: Number(formatUnits(result.reward, 18)).toFixed(2),
        isUser: result.player.toLowerCase() === userAddress?.toLowerCase()
      })).sort((a, b) => Number(a.position) - Number(b.position));
    } catch (err) {
      console.error('Error formatting results:', err);
      return [];
    }
  }, [contractResults, race.results, userAddress]);

  // Determine if we should show retry button
  const shouldShowRetry = error || (race.hasEnded && !formattedResults.length);
  const isRateLimit = Boolean(error?.message?.includes('429'));
  const isBadRequest = Boolean(error?.message?.includes('400'));
  const isCalculating = Boolean(error?.message?.includes('still calculating'));
  const retryDelay = isRateLimit ? 2000 : isBadRequest ? 5000 : isCalculating ? 3000 : 1000;

  // Get status message based on error and result source
  const getStatusMessage = () => {
    if (isLoading) return "Loading clash results...";
    if (isRateLimit) return "The server is experiencing high traffic. Please wait a moment and try again.";
    if (isBadRequest) return "Unable to fetch results. The clash data might not be available yet.";
    if (isCalculating) return `${error?.message || 'Calculating results...'} Please wait.`;
    if (error) return `Error: ${error.message}`;
    if (!formattedResults.length) return "No results available yet. Please try again in a moment.";
    return "";
  };

  // Auto-retry for certain error conditions
  useEffect(() => {
    if (shouldShowRetry && retryCount < 5) {
      const timer = setTimeout(() => {
        console.log('Auto-retrying fetch...', { retryCount });
        refetch();
      }, retryDelay);
      return () => clearTimeout(timer);
    }
  }, [shouldShowRetry, retryCount, retryDelay, refetch]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={(e) => {
          // Close modal when clicking the backdrop
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
                 Clash Results ({race.size} Players)
              </h2>
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
          {isLoading ? (
              <LoadingState />
          ) : shouldShowRetry ? (
              <RetryState 
                message={getStatusMessage()} 
                onRetry={() => {
                  toast.success(`Retrying in ${retryDelay/1000}s...`);
                  setTimeout(() => {
                    refetch();
                    toast.success('Fetching latest results...');
                  }, retryDelay);
                }}
                retryCount={retryCount}
                maxRetries={5}
              />
            ) : formattedResults.length > 0 ? (
              <div className="space-y-4">
                {/* Results list */}
                <div className="space-y-2">
                  {formattedResults.map((result, index) => (
                    <motion.div
                      key={result.player}
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
                        <span className={`text-2xl font-bold ${
                          index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-gray-400' :
                          index === 2 ? 'text-amber-600' :
                          'text-gray-500'
                        }`}>
                          #{index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-200">
                            {result.formattedAddress}
                            {result.isUser && (
                              <span className="ml-2 text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-400">
                            Score: {result.score.toString()}
                          </p>
                        </div>
                      </div>
                      {result.reward > BigInt(0) && (
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

// Loading state component
const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-8 space-y-4">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"
    />
    <p className="text-gray-400">Loading clash results...</p>
  </div>
);

// Retry state component
const RetryState = ({ message, onRetry, retryCount, maxRetries }: { 
  message: string; 
  onRetry: () => void;
  retryCount: number;
  maxRetries: number;
}) => (
  <div className="flex flex-col items-center justify-center py-8 space-y-4">
    <p className="text-gray-400 text-center">{message}</p>
    {retryCount < maxRetries && (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onRetry}
        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
      >
        Retry ({retryCount}/{maxRetries})
      </motion.button>
              )}
            </div>
);

export default ResultsModal;
