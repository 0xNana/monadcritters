import { type Chain } from 'viem'

// RPC Configuration
const MONAD_ALCHEMY_RPC = import.meta.env.VITE_MONAD_TESTNET_URL || "https://monad-testnet.g.alchemy.com/v2/H1zC39JXN7BWm5miBv-NBDwsF1INON5w"
const MONAD_PUBLIC_RPC = import.meta.env.VITE_MONAD_TESTNET_RPC_URL || "https://monad-testnet.blockvision.org/v1/2uHzg3cY0Z8zFrfn1kgZVLxihHN"

export const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [MONAD_ALCHEMY_RPC],
    },
    public: {
      http: [MONAD_PUBLIC_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadExplorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
} as const satisfies Chain 