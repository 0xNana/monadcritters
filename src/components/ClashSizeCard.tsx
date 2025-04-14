import React from 'react';
import { motion } from 'framer-motion';
import { formatEther } from 'viem';
import { ClashDetail, ClashSize, ClashState } from '../contracts/CritterClashCore/types';
import { useClashStatus } from '../hooks/useClashStatus';
import { CLASH_CONFIG } from '../utils/config';

interface ClashSizeCardProps {
  title: string;
  description: string;
  clashInfo: ClashDetail | null;
  maxPlayers: number;
  userAddress?: string;
  onJoinClick: () => void;
  isConnected: boolean;
  hasCritter: boolean;
}

const ClashSizeCard: React.FC<ClashSizeCardProps> = ({
  title,
  description,
  clashInfo,
  maxPlayers,
  userAddress,
  onJoinClick,
  isConnected,
  hasCritter,
}) => {
  const {
    playerCount,
    maxPlayers: actualMaxPlayers,
    isUserParticipating,
    state
  } = useClashStatus(clashInfo, userAddress);

  // Get entry fee based on clash size
  const entryFee = maxPlayers === 2 ? '1' : '2'; // 1 MON for 2-player, 2 MON for 4-player
  
  // Use fixed prize pool values
  const prizePool = maxPlayers === 2 ? '2' : '8'; // 2 MON for 2-player, 8 MON for 4-player
  
  // We only care about ACCEPTING_PLAYERS state (state === 0)
  const isAcceptingPlayers = state === ClashState.ACCEPTING_PLAYERS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-lg border border-purple-500/30 bg-gradient-to-br from-gray-800 to-purple-900/20 p-6 backdrop-blur-sm shadow-xl"
    >
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          <p className="text-gray-300 text-sm">{description}</p>
        </div>
        
        {/* Player Count Badge */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center bg-gray-900/50 rounded-lg px-3 py-2">
            <div className="text-right">
              <div className="text-sm text-gray-400">Players</div>
              <div className="text-lg font-bold text-purple-300">
                {playerCount}/{actualMaxPlayers || maxPlayers}
              </div>
            </div>
          </div>
          {isAcceptingPlayers && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-900/30 text-purple-300">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
              </span>
              Accepting Players
            </div>
          )}
        </div>
      </div>
      
      {/* Prize Info Section */}
      <div className="bg-gray-900/30 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-400">Entry Fee</div>
            <div className="text-xl font-bold text-yellow-400">{entryFee} MON</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Prize Pool</div>
            <div className="text-xl font-bold text-green-400">
              {prizePool} MON
            </div>
          </div>
        </div>
      </div>

      {/* Action Section */}
      <div className="relative">
        {isUserParticipating && isAcceptingPlayers ? (
          <div className="flex items-center justify-center space-x-2 bg-green-500/20 text-green-300 py-3 px-4 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>You're in this clash!</span>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onJoinClick}
            disabled={!isConnected || !hasCritter}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              !isConnected || !hasCritter
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
            }`}
          >
            {!isConnected 
              ? 'Connect Wallet to Join'
              : !hasCritter
                ? 'Mint a Critter to Join'
                : 'Join Clash to Win'}
          </motion.button>
        )}
      </div>
    </motion.div> 
  );
};

export default ClashSizeCard; 