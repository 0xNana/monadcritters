import React, { useMemo } from 'react';
import { formatAddress, formatRelativeTime } from '../utils/format';
import { formatEther } from 'viem';
import { ClashDetail, ClashSize } from '../contracts/CritterClashCore/types';
import { motion } from 'framer-motion';

interface CompletedClashCardProps {
  clash: ClashDetail;
  userAddress?: `0x${string}`;
  onViewResults: () => void;
}

const CompletedClashCard: React.FC<CompletedClashCardProps> = ({ clash, userAddress, onViewResults }) => {
  // Check if user was a participant in this clash
  const isUserParticipant = useMemo(() => {
    if (!userAddress || !clash.players || !Array.isArray(clash.players) || clash.players.length === 0) {
      console.warn(`Completed clash ${clash.id.toString()}: Invalid player data or user not connected`, {
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
      console.warn(`Completed clash ${clash.id.toString()}: User ${userAddress} is not a participant`, {
        players: clash.players.map(p => p.player),
        user: userAddress
      });
    }

    return participates;
  }, [clash.id, clash.players, userAddress]);
  
  // Don't render anything if user wasn't a participant
  if (!isUserParticipant) {
    return null;
  }

  // Find the user's result if they participated
  const userResult = userAddress
    ? clash.results.find(result => 
        result.player && 
        userAddress && 
        result.player.toLowerCase() === userAddress.toLowerCase()
      )
    : undefined;

  // Sort results by position
  const sortedResults = [...clash.results].sort((a, b) => 
    Number(a.position) - Number(b.position)
  );

  // Calculate total prize pool based on player count and entry fee
  const getTotalPrizePool = () => {
    // If we already have a totalPrize calculated, use it
    if (clash.totalPrize && clash.totalPrize > BigInt(0)) {
      return clash.totalPrize;
    }
    
    // Otherwise calculate it based on player count (1 MON per player)
    const entryFee = BigInt('1000000000000000000'); // 1 MON
    return entryFee * BigInt(clash.playerCount);
  };
  
  // Get a proper timestamp for display
  const getFormattedTime = () => {
    // Use startTime (which is a proper timestamp) instead of isProcessed (which is a boolean)
    if (clash.startTime && clash.startTime > BigInt(0)) {
      // Add 60 seconds to startTime to show when the clash ended
      const endTime = Number(clash.startTime) + 60; // 60 seconds clash duration
      return formatRelativeTime(endTime);
    }
    return "Recently completed";
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col gap-2 mb-6">
          <span className="text-sm text-gray-400">
            {getFormattedTime()}
          </span>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                {clash.maxPlayers === 2 ? 'Two' : 'Four'} Player Clash
              </h3>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-400 font-mono">ID: {clash.id.toString()}</p>
                <span className="text-gray-500 text-sm">•</span>
                <p className="text-sm text-gray-400">
                  {clash.maxPlayers === 2 ? 'Winner Takes All' : 'Top 2 Split Prize'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm">
                Completed
              </span>
              {userResult && (
                <span className={`px-3 py-1 rounded-lg text-sm ${
                  Number(userResult.position) === 1
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : Number(userResult.position) === 2 && clash.maxPlayers > 2
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {Number(userResult.position) === 1
                    ? '🏆 Winner!'
                    : Number(userResult.position) === 2 && clash.maxPlayers > 2
                      ? '🥈 Runner Up'
                      : `#${userResult.position.toString()} Place`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Prize Pool */}
        <div className="flex flex-col items-center justify-center mb-6 py-4">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-400 mb-2">Total Prize Pool</p>
            <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              {formatEther(getTotalPrizePool())} MON
            </p>
          </div>
          {userResult && (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Result</p>
              <p className={`text-xl font-semibold ${
                Number(userResult.position) === 1 
                  ? 'text-green-400' 
                  : Number(userResult.position) === 2 && clash.maxPlayers > 2
                    ? 'text-blue-400'
                    : 'text-red-400'
              }`}>
                {Number(userResult.position) === 1 
                  ? 'You Won!' 
                  : Number(userResult.position) === 2 && clash.maxPlayers > 2
                    ? 'Runner Up!'
                    : 'Better Luck Next Time'}
              </p>
            </div>
          )}
        </div>

        {/* View Results Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewResults}
          className="w-full py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 text-white rounded-xl transition-all border border-purple-500/30 hover:border-purple-500/50 font-medium"
        >
          View Results
        </motion.button>
      </div>
    </div>
  );
};

export default CompletedClashCard;