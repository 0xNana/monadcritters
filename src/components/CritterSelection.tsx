import React, { useState } from 'react';
import CritterCard from './CritterCard';
import { Critter } from '../contracts/MonadCritter/types';
import { UserCritter } from '../hooks/useUserCritters';

type CritterSelectionProps = {
  critters: (Critter | UserCritter)[];
  selectedCritters: (Critter | UserCritter)[];
  onCritterSelect: (critter: Critter | UserCritter) => void;
  maxSelections?: number;
  title?: string;
};

const CritterSelection: React.FC<CritterSelectionProps> = ({
  critters,
  selectedCritters,
  onCritterSelect,
  maxSelections = 1,
  title = 'Select your critters',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCritters = critters.filter((critter) => {
    const critterId = 'tokenId' in critter 
      ? critter.tokenId.toString() 
      : critter.id.toString();
    
    return critterId.includes(searchTerm);
  });

  const isCritterSelected = (critter: Critter | UserCritter) => {
    return selectedCritters.some((selected) => {
      const selectedId = 'tokenId' in selected ? selected.tokenId : selected.id;
      const critterId = 'tokenId' in critter ? critter.tokenId : critter.id;
      return selectedId.toString() === critterId.toString();
    });
  };

  const isSelectionDisabled = (critter: Critter | UserCritter) => {
    if (isCritterSelected(critter)) return false;
    return selectedCritters.length >= maxSelections;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by critter ID..."
          className="w-full p-2 bg-gray-700 rounded-md text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {filteredCritters.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No critters found</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredCritters.map((critter) => {
            const critterId = 'tokenId' in critter ? critter.tokenId : critter.id;
            return (
              <div key={critterId.toString()} className={isSelectionDisabled(critter) ? 'opacity-50' : ''}>
                <CritterCard
                  critter={critter}
                  isSelected={isCritterSelected(critter)}
                  onClick={() => {
                    if (!isSelectionDisabled(critter)) {
                      onCritterSelect(critter);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      
      <div className="mt-4 text-right text-gray-400">
        Selected {selectedCritters.length} / {maxSelections} critters
      </div>
    </div>
  );
};

export default CritterSelection; 