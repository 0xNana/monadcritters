// Export all contract-related types and hooks

// MonadCritter exports
export * from './MonadCritter/abi';
export * from './MonadCritter/types';
export * from './MonadCritter/hooks';
// CritterRace exports
export * as CritterRaceABI from './CritterRace/abi';
export * as CritterRaceTypes from './CritterRace/types';
export * as CritterRaceHooks from './CritterRace/hooks';

// MonadCritter exports
import * as MonadCritterABI from './MonadCritter/abi';
import * as MonadCritterTypes from './MonadCritter/types';
import * as MonadCritterHooks from './MonadCritter/hooks';

import * as CritterRaceABI from './CritterRace/abi';
import * as CritterRaceTypes from './CritterRace/types';
import * as CritterRaceHooks from './CritterRace/hooks';

export const MonadCritter = {
  abi: MonadCritterABI,
  types: MonadCritterTypes,
  hooks: MonadCritterHooks,
};

export const CritterRace = {
  abi: CritterRaceABI,
  types: CritterRaceTypes,
  hooks: CritterRaceHooks,
}; 