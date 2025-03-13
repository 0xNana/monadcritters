import React from 'react';
import { motion } from 'framer-motion';
import { Tooltip } from '../Tooltip';

interface RaceCardProps {
  type: string;
  currentPlayers: number;
  maxPlayers: number;
  winners: number;
  entryFee: string;
  prizePool: string;
  isLoading?: boolean;
  error?: Error | null;
  isRaceActive: boolean;
  isUserInRace: boolean;
  onJoin?: () => void;
  onCreateRace?: () => void;
  isCreatingRace: boolean;
}

export const RaceCard: React.FC<RaceCardProps> = ({
  type,
  currentPlayers,
  maxPlayers,
  winners,
  entryFee,
  prizePool,
  isLoading,
  error,
  isRaceActive,
  isUserInRace,
  onJoin,
  onCreateRace,
  isCreatingRace
}) => {
  const progress = (currentPlayers / maxPlayers) * 100;
  const isFull = currentPlayers >= maxPlayers;
  
  return (
    <motion.div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 shadow-xl border border-gray-700"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-blue-400">{type} Race</h3>
        <div className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-300">
          {currentPlayers}/{maxPlayers}
        </div>
      </div>

      {error ? (
        <div className="text-red-400 text-sm mb-4">
          Error loading races. Please try again.
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-gray-400">Entry Fee</div>
          <div className="text-right text-white">{entryFee} MON</div>
          
          <div className="text-gray-400">Prize Pool</div>
          <div className="text-right text-white">{prizePool} MON</div>
          
          <div className="text-gray-400">Winners</div>
          <div className="text-right text-white">{winners}</div>
        </div>

        <div className="flex space-x-2">
          {/* Join Race Button */}
          <Tooltip 
            content={
              isUserInRace ? "You're already in a race of this type" :
              !isRaceActive ? "No active race available" :
              isFull ? "This race is full" :
              isLoading ? "Loading race data..." :
              "Join this race"
            }
          >
            <button
              onClick={onJoin}
              disabled={!onJoin || isUserInRace}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                !onJoin || isUserInRace
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:from-blue-600 hover:to-blue-800'
              }`}
            >
              {isUserInRace ? 'Already Joined' : 'Join Race'}
            </button>
          </Tooltip>
          
          {/* Create Race Button */}
          <Tooltip
            content={
              isRaceActive ? "A race is already active" :
              isCreatingRace ? "Creating a new race..." :
              isLoading ? "Loading race data..." :
              "Create a new race"
            }
          >
            <button
              onClick={onCreateRace}
              disabled={!onCreateRace || isCreatingRace}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                !onCreateRace || isCreatingRace
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800'
              }`}
            >
              {isCreatingRace ? 'Creating...' : 'Create Race'}
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}; 