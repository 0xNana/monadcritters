import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface Critter {
  id: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  stats: {
    speed: number;
    stamina: number;
    luck: number;
  };
}

interface RaceJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (critterId: string, boostAmount: number) => void;
  critters: Critter[];
  entryFee: string;
  maxPlayers: number;
  currentPlayers: number;
  winners: number;
  availableBoosts: number;
}

export function RaceJoinModal({
  isOpen,
  onClose,
  onJoin,
  critters,
  entryFee,
  maxPlayers,
  currentPlayers,
  winners,
  availableBoosts
}: RaceJoinModalProps) {
  const [selectedCritter, setSelectedCritter] = useState<Critter | null>(critters[0] || null);
  const [speedBoosts, setSpeedBoosts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset speed boosts when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSpeedBoosts(0);
    }
  }, [isOpen]);

  // Reset speed boosts if available boosts changes
  useEffect(() => {
    if (speedBoosts > availableBoosts) {
      setSpeedBoosts(0);
    }
  }, [availableBoosts, speedBoosts]);

  if (!isOpen) return null;

  const handleJoin = async () => {
    if (!selectedCritter) {
      toast.error('Please select a critter');
      return;
    }
    
    if (speedBoosts > availableBoosts) {
      toast.error(`You only have ${availableBoosts} energy boosts available`);
      return;
    }

    if (speedBoosts > 2) {
      toast.error('Maximum 2 energy boosts per clash');
      return;
    }

    setIsSubmitting(true);
    try {
      await onJoin(selectedCritter.id, speedBoosts);
      onClose();
    } catch (error) {
      toast.error('Failed to join clash');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate potential bonus from speed boosts
  const speedBoostBonus = speedBoosts * 100;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-gray-700"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Join Clash</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>

          {/* Clash Info */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-gray-400 text-sm">Entry Fee</div>
                <div className="text-white font-medium">{entryFee} MON</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Players</div>
                <div className="text-white font-medium">{currentPlayers}/{maxPlayers}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Winners</div>
                <div className="text-white font-medium">{winners}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Your Boosts</div>
                <div className="text-white font-medium">{availableBoosts}</div>
              </div>
            </div>
          </div>

          {/* Critter Selection */}
          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-2">Select Your Critter</label>
            <div className="grid grid-cols-2 gap-4">
              {critters.map((critter) => (
                <motion.button
                  key={critter.id}
                  onClick={() => setSelectedCritter(critter)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-lg border ${
                    selectedCritter?.id === critter.id
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium text-white mb-2">
                    Critter #{critter.id}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-gray-400">Speed</div>
                    <div className="text-right text-white">{critter.stats.speed}</div>
                    <div className="text-gray-400">Stamina</div>
                    <div className="text-right text-white">{critter.stats.stamina}</div>
                    <div className="text-gray-400">Luck</div>
                    <div className="text-right text-white">{critter.stats.luck}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Speed Boost Selection */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">Energy Boosts (Max 2)</label>
              <span className="text-sm text-gray-400">Available: {availableBoosts}</span>
            </div>
            <div className="flex space-x-4">
              {[0, 1, 2].map((amount) => (
                <motion.button
                  key={amount}
                  onClick={() => setSpeedBoosts(amount)}
                  disabled={amount > availableBoosts}
                  whileHover={amount <= availableBoosts ? { scale: 1.05 } : {}}
                  whileTap={amount <= availableBoosts ? { scale: 0.95 } : {}}
                  className={`flex-1 py-2 px-4 rounded-lg ${
                    amount > availableBoosts
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : speedBoosts === amount
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {amount}
                </motion.button>
              ))}
            </div>
            {speedBoosts > 0 && (
              <div className="mt-2 text-sm">
                <span className="text-blue-400">+{speedBoostBonus}</span>
                <span className="text-gray-400"> to final clash score</span>
              </div>
            )}
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoin}
            disabled={!selectedCritter || isSubmitting || speedBoosts > availableBoosts}
            className={`w-full py-3 ${
              isSubmitting || !selectedCritter || speedBoosts > availableBoosts
                ? 'bg-gray-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800'
            } text-white rounded-lg font-medium transition-colors`}
          >
            {isSubmitting ? 'Joining Clash...' : 'Join Clash'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 