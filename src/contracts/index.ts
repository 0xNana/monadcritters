// Export all contract-related types and hooks

// MonadCritter exports
export { CritterMetadata, CritterStats } from './MonadCritter/abi';
export * from './MonadCritter/types';
export * from './MonadCritter/hooks';



// CritterClash exports
export * as CritterClashCore from './CritterClashCore';
export * as CritterClashStats from './CritterClashStats';

// MonadCritter exports
import * as MonadCritterABI from './MonadCritter/abi';
import * as MonadCritterTypes from './MonadCritter/types';
import * as MonadCritterHooks from './MonadCritter/hooks';

import * as CritterRaceABI from '../filter/CritterClash/filter/CritterRace/abi';
import * as CritterRaceTypes from '../filter/CritterClash/filter/CritterRace/types';
import * as CritterRaceHooks from '../filter/CritterClash/filter/CritterRace/hooks';

import * as CritterClashCore from './CritterClashCore';
import * as CritterClashStats from './CritterClashStats';

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

export const CritterClash = {
  core: CritterClashCore,
  stats: CritterClashStats,
}; 