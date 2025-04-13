// Contract addresses
const MONAD_CRITTER_ADDRESS_ENV = process.env.VITE_MONAD_CRITTER_ADDRESS;
const CRITTER_CLASH_CORE_ADDRESS_ENV = process.env.VITE_CRITTER_CLASH_CORE_ADDRESS;
const CRITTER_CLASH_STATS_ADDRESS_ENV = process.env.VITE_CRITTER_CLASH_STATS_ADDRESS;

export const MONAD_CRITTER_ADDRESS = MONAD_CRITTER_ADDRESS_ENV as `0x${string}`;
export const CRITTER_CLASH_CORE_ADDRESS = CRITTER_CLASH_CORE_ADDRESS_ENV as `0x${string}`;
export const CRITTER_CLASH_STATS_ADDRESS = CRITTER_CLASH_STATS_ADDRESS_ENV as `0x${string}`;

// Import ABIs from structured TypeScript files
import { abi as MONAD_CRITTER_ABI } from '../contracts/MonadCritter/abi';
import { abi as CRITTER_CLASH_CORE_ABI } from '../contracts/CritterClashCore/abi';
import { abi as CRITTER_CLASH_STATS_ABI } from '../contracts/CritterClashStats/abi';

// Export to maintain interface compatibility
export { MONAD_CRITTER_ABI, CRITTER_CLASH_CORE_ABI, CRITTER_CLASH_STATS_ABI };

