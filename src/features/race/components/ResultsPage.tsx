import React from 'react';
import { motion } from 'framer-motion';
import { formatEther } from 'ethers';
import { useWallet } from '../../../components/WalletProvider';

interface RaceResult {
  position: number;
  player: {
    address: string;
    critter: {
      rarity: string;
      position: number;
    };
  };
  reward: bigint;
}

interface ResultsPageProps {
  results: RaceResult[];
  raceId?: string;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ results, raceId }) => {
  const { address } = useWallet();

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      <div className="max-w-4xl mx-auto mt-12">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-white">
            Race Results
          </h1>
          <p className="text-lg text-gray-300">
            Race #{raceId} has concluded! Here are the winners:
          </p>
        </motion.div>

        {/* Podium */}
        <div className="relative h-80 mb-12">
          {/* Second Place */}
          <motion.div
            className="absolute left-1/4 bottom-0 w-48 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {results[1] && (
              <>
                <img
                  src={`/assets/sprites/${results[1].player.critter.rarity}-128.png`}
                  alt="Second Place"
                  className="w-24 h-24 object-contain mb-4"
                />
                <div className="bg-silver-500/20 backdrop-blur-sm w-full h-32 rounded-t-lg border border-white/20" />
                <div className="text-xl font-bold text-gray-300 mt-2">2nd</div>
                <div className="text-sm text-gray-400">
                  {formatEther(results[1].reward)} MON
                </div>
              </>
            )}
          </motion.div>

          {/* First Place */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 bottom-0 w-48 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            {results[0] && (
              <>
                <img
                  src={`/assets/sprites/${results[0].player.critter.rarity}-128.png`}
                  alt="First Place"
                  className="w-32 h-32 object-contain mb-4"
                />
                <div className="bg-yellow-500/20 backdrop-blur-sm w-full h-40 rounded-t-lg border border-yellow-500/20" />
                <div className="text-2xl font-bold text-yellow-400 mt-2">1st</div>
                <div className="text-sm text-yellow-300">
                  {formatEther(results[0].reward)} MON
                </div>
              </>
            )}
          </motion.div>

          {/* Third Place */}
          <motion.div
            className="absolute right-1/4 bottom-0 w-48 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {results[2] && (
              <>
                <img
                  src={`/assets/sprites/${results[2].player.critter.rarity}-128.png`}
                  alt="Third Place"
                  className="w-20 h-20 object-contain mb-4"
                />
                <div className="bg-bronze-500/20 backdrop-blur-sm w-full h-24 rounded-t-lg border border-white/20" />
                <div className="text-xl font-bold text-gray-300 mt-2">3rd</div>
                <div className="text-sm text-gray-400">
                  {formatEther(results[2].reward)} MON
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => window.location.href = '/lobby'}
            className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 
              transition-colors text-white/80"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}; 