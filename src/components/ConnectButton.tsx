import React, { useState } from 'react'
import { useWallet } from './WalletProvider'
import { WalletDropdown } from './WalletDropdown'

// Simple placeholder avatar using Jazzicon-style background
const getAvatarBackground = (address: string) => {
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export function ConnectButton() {
  const { address, isConnected, connect, isConnecting } = useWallet()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting...' : 'Log In'}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-purple-500/20 p-0.5">
          <img
            src="/monad-icon.png"
            alt="Monad Avatar"
            className="w-full h-full rounded-full"
          />
        </div>
        <span className="text-sm font-medium text-white">
          {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : ''}
        </span>
      </button>

      <WalletDropdown
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        address={address || ''}
      />
    </div>
  )
} 