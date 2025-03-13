import { useWallet } from './WalletProvider'
import { motion } from 'framer-motion'
import React from 'react'

export function ConnectButton() {
  const { address, isConnected, connect, disconnect, isConnecting } = useWallet()

  // Format address for display
  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  return (
    <motion.button
      onClick={isConnected ? disconnect : connect}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        px-4 py-2 rounded-lg font-medium transition-colors
        ${isConnecting
          ? 'bg-gray-700 text-gray-400 cursor-wait'
          : isConnected
          ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
          : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
        }
      `}
    >
      {isConnecting
        ? 'Connecting...'
        : isConnected
        ? displayAddress
        : 'Connect Wallet'}
    </motion.button>
  )
} 