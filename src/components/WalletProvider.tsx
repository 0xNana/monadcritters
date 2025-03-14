/// <reference types="vite/client" />

import { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { getAccount, watchAccount, disconnect as wagmiDisconnect } from '@wagmi/core'
import { config } from '../utils/config'
import { monadTestnet } from '../utils/chains'
import { createAppKit, useAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Get project ID from environment variables
const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID

if (!REOWN_PROJECT_ID) {
  throw new Error('Reown project ID not found in environment variables')
}

// Create QueryClient instance
const queryClient = new QueryClient()

// Create Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  networks: [monadTestnet],
  projectId: REOWN_PROJECT_ID,
})

// Initialize AppKit
createAppKit({
  adapters: [wagmiAdapter],
  networks: [monadTestnet],
  metadata: {
    name: 'MonadCritters',
    description: 'Race your critters on Monad testnet!',
    url: 'https://monadcritters.com',
    icons: ['https://monadcritters.com/logo.png'],
  },
  projectId: REOWN_PROJECT_ID,
  features: {
    analytics: true,
  },
})

type WalletContextType = {
  address?: string
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
})

export const useWallet = () => useContext(WalletContext)

function WalletProviderInner({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const appKit = useAppKit()

  useEffect(() => {
    // Initial account state
    const account = getAccount(config)
    setAddress(account.address)
    setIsConnected(account.isConnected)

    // Watch for account changes
    const unwatch = watchAccount(config, {
      onChange(account) {
        setAddress(account.address)
        setIsConnected(account.isConnected)
      },
    })

    return () => unwatch()
  }, [])

  const connect = async () => {
    try {
      setIsConnecting(true)
      await appKit.open()
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      await wagmiDisconnect(config)
      await appKit.close()
      setAddress(undefined)
      setIsConnected(false)
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }
  }

  return (
    <WalletContext.Provider value={{ address, isConnected, connect, disconnect, isConnecting }}>
      {children}
    </WalletContext.Provider>
  )
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletProviderInner>{children}</WalletProviderInner>
      </QueryClientProvider>
    </WagmiProvider>
  )
} 