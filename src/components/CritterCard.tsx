import React from 'react';
import { motion } from 'framer-motion';
import { Critter } from '../contracts/MonadCritter/types';
import { UserCritter } from '../hooks/useUserCritters';

type CritterCardProps = {
  critter: Critter | UserCritter;
  isSelected: boolean;
  onClick: () => void;
}

const CritterCard: React.FC<CritterCardProps> = ({ critter, isSelected, onClick }) => {
  const getRarityColor = (rarity: number) => {
    switch (rarity) {
      case 0: return 'bg-gray-500';
      case 1: return 'bg-green-500';
      case 2: return 'bg-blue-500';
      case 3: return 'bg-purple-500';
      default: return 'bg-yellow-500';
    }
  };

  const getRarityText = (rarity: number) => {
    switch (rarity) {
      case 0: return 'Common';
      case 1: return 'Uncommon';
      case 2: return 'Rare';
      case 3: return 'Epic';
      default: return 'Legendary';
    }
  };

  // Helper to get the ID regardless of critter type
  const getCritterId = (critter: Critter | UserCritter) => {
    if ('tokenId' in critter) {
      return critter.tokenId.toString();
    }
    return critter.id.toString();
  };

  // Helper to get rarity with a default value
  const getRarity = (critter: Critter | UserCritter) => {
    if ('stats' in critter && 'rarity' in critter.stats) {
      return critter.stats.rarity;
    }
    return 0; // Default to common if rarity is not present
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-1 gap-1">
        <h3 className="text-sm font-semibold truncate">#{getCritterId(critter)}</h3>
        <span className={`px-1.5 py-0.5 rounded text-xs ${getRarityColor(getRarity(critter))}`}>
          {getRarityText(getRarity(critter))}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <div>
          <div className="flex justify-between">
            <p className="text-gray-400 text-xs">Speed</p>
            <p className="text-xs font-medium text-blue-400">{critter.stats.speed}</p>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-0.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${(critter.stats.speed / 100) * 100}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <p className="text-gray-400 text-xs">Stamina</p>
            <p className="text-xs font-medium text-green-400">{critter.stats.stamina}</p>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-0.5">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: `${(critter.stats.stamina / 100) * 100}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <p className="text-gray-400 text-xs">Luck</p>
            <p className="text-xs font-medium text-yellow-400">{critter.stats.luck}</p>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-0.5">
            <div
              className="bg-yellow-500 h-1.5 rounded-full"
              style={{ width: `${(critter.stats.luck / 100) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CritterCard; 