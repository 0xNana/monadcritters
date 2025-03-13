import { createConfig, http, fallback } from '@wagmi/core'
import { monadTestnet } from './chains'
import { sepolia } from 'viem/chains'
import { useChains } from 'wagmi'

// Contract addresses from environment variables
const MONAD_CRITTER_ADDRESS = import.meta.env.VITE_MONAD_CRITTER_ADDRESS
const MONAD_RACE_CONTRACT_ADDRESS = import.meta.env.VITE_RACE_CONTRACT_ADDRESS
const SEPOLIA_CRITTER_ADDRESS = import.meta.env.VITE_SEPOLIA_CRITTER_ADDRESS
const SEPOLIA_RACE_CONTRACT_ADDRESS = import.meta.env.VITE_SEPOLIA_RACE_CONTRACT_ADDRESS

// RPC Configuration
const MONAD_ALCHEMY_RPC = import.meta.env.VITE_MONAD_TESTNET_URL
const MONAD_PUBLIC_RPC = 'https://monad-testnet.g.alchemy.com/v2/H1zC39JXN7BWm5miBv-NBDwsF1INON5w'
const SEPOLIA_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL

// Create transports with fallback and retries
const monadTransport = fallback([
  http(MONAD_ALCHEMY_RPC, {
    timeout: 10_000,
    retryCount: 3,
    retryDelay: 1000,
  }),
  http(MONAD_PUBLIC_RPC, {
    timeout: 10_000,
    retryCount: 2,
    retryDelay: 1000,
  })
])

const sepoliaTransport = http(SEPOLIA_RPC, {
  timeout: 10_000,
  retryCount: 3,
  retryDelay: 1000,
})

// Contract configuration types
type NetworkContracts = {
  race: string;
  critter: string;
};

type ContractConfig = {
  monad: NetworkContracts;
  sepolia: NetworkContracts;
};

// Contract addresses by network
export const contracts: ContractConfig = {
  monad: {
    race: MONAD_RACE_CONTRACT_ADDRESS,
    critter: MONAD_CRITTER_ADDRESS,
  },
  sepolia: {
    race: SEPOLIA_RACE_CONTRACT_ADDRESS,
    critter: SEPOLIA_CRITTER_ADDRESS,
  }
} as const;

// Add debug logging
console.debug('Contract addresses:', contracts);

// Cache configuration
export const CACHE_CONFIG = {
  DURATION: {
    SHORT: 30 * 1000,
    MEDIUM: 5 * 60 * 1000,
    LONG: 30 * 60 * 1000,
  },
  PREFETCH: {
    ENABLED: true,
    INTERVAL: 10 * 1000,
  },
  BATCH_SIZE: 10,
};

// Create custom Monad chain config with Alchemy RPC
const monadWithAlchemy = {
  ...monadTestnet,
  rpcUrls: {
    ...monadTestnet.rpcUrls,
    default: {
      http: [MONAD_ALCHEMY_RPC],
    },
    public: {
      http: [MONAD_PUBLIC_RPC],
    },
  },
};

// Wagmi config with multiple networks
export const config = createConfig({
  chains: [monadWithAlchemy, sepolia],
  transports: {
    [monadWithAlchemy.id]: monadTransport,
    [sepolia.id]: sepoliaTransport
  },
});

// Game constants
export const gameConfig = {
  mintPrice: 0.01,
  maxPowerUps: 2,
  raceSize: 10,
  raceDuration: 60,
  rewardPercentages: [50, 30, 20],
} as const;

export { monadTestnet, sepolia };
