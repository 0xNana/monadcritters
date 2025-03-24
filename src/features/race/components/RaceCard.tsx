import React, { useState, useEffect } from 'react';
import { Race } from '../types';
import { RaceStatus } from './RaceStatus'; 

interface RaceCardProps {
  race: Race;
  onStartRace: (raceId: number) => void;
  onEndRace: (raceId: number) => void;
  isProcessingRace: boolean;
  userAddress?: string;
}

export const RaceCard: React.FC<RaceCardProps> = ({
  race,
  onStartRace,
  onEndRace,
  isProcessingRace,
  userAddress
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [canEndRace, setCanEndRace] = useState(false);

  // Add countdown effect when race starts
  useEffect(() => {
    if (race.startTime && !canEndRace) {
      const startTimeMs = Number(race.startTime) * 1000;
      const endTimeMs = startTimeMs + 30000; // 30 seconds
      const now = Date.now();
      
      if (now < endTimeMs) {
        setCountdown(Math.ceil((endTimeMs - now) / 1000));
        
        const timer = setInterval(() => {
          const remaining = Math.ceil((endTimeMs - Date.now()) / 1000);
          if (remaining <= 0) {
            setCountdown(null);
            setCanEndRace(true);
            clearInterval(timer);
          } else {
            setCountdown(remaining);
          }
        }, 1000);
        
        return () => clearInterval(timer);
      } else {
        setCanEndRace(true);
      }
    }
  }, [race.startTime]);

  const isUserInRace = race.players.includes(userAddress || '');
  const isFull = race.currentPlayers === race.maxPlayers;
  const canStart = isFull && !race.progressStatus;
  const canEnd = race.progressStatus === 'complete';

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
      <div className={`h-2 ${race.hasEnded ? 'bg-purple-500' : 'bg-green-500'}`} />
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <div className="text-3xl font-bold text-white">
              {race.currentPlayers}/{race.maxPlayers}
            </div>
            <div className="text-gray-400">Players</div>
          </div>
          <RaceStatus race={race} />
        </div>

        {race.progressStatus === 'racing' && (
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2 text-green-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <span className="font-medium">Clash in Progress: {countdown}s</span>
            </div>
          </div>
        )}

        {race.progressStatus === 'complete' && (
          <div className="mb-4 p-3 bg-yellow-500/20 text-yellow-300 rounded-lg text-center">
            Time's up! Please end the clash to see results.
          </div>
        )}

        <div className="mt-4 space-y-2">
          {!race.hasEnded && (
            <>
              <button
                onClick={() => onStartRace(race.id)}
                disabled={!canStart || race.progressStatus === 'racing'}
                className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Clash
              </button>
              <button
                onClick={() => onEndRace(race.id)}
                disabled={!canEndRace}
                className="w-full py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg font-medium hover:from-red-600 hover:to-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                End Clash
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RaceCard;
