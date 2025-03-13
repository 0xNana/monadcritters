import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../components/WalletProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { parseEther } from 'viem'
import { useWriteContract, useWatchContractEvent, useReadContract, useChainId } from 'wagmi'
import { contracts, gameConfig } from '../utils/config'


// Import all mascot variants
import commonMascot from '@assets/mascot/common/256/common 256x256.png'
import uncommonMascot from '@assets/mascot/uncommon/256/256x256.png'
import rareMascot from '@assets/mascot/rare/256/rare 256x256.png'
import legendaryMascot from '@assets/mascot/legendary/256/legendary 256.png'
import React from 'react'

// Rarity types configuration
const RARITY_TYPES = [
  { name: 'Common', chance: '70%', boost: '0%', image: commonMascot, color: 'from-gray-400 to-gray-600', minStat: 40, maxStat: 100 },
  { name: 'Uncommon', chance: '20%', boost: '+10%', image: uncommonMascot, color: 'from-green-400 to-green-600', minStat: 44, maxStat: 110 },
  { name: 'Rare', chance: '9%', boost: '+25%', image: rareMascot, color: 'from-blue-400 to-blue-600', minStat: 50, maxStat: 125 },
  { name: 'Legendary', chance: '1%', boost: '+50%', image: legendaryMascot, color: 'from-yellow-400 to-yellow-600', minStat: 60, maxStat: 150 },
] as const

// ABI for the mint function
const mintAbi = [{
  name: 'mint',
  type: 'function',
  stateMutability: 'payable',
  inputs: [],
  outputs: [{ type: 'uint256' }],
}] as const

// ABI for the Transfer event
const transferAbi = [{
  type: 'event',
  name: 'Transfer',
  inputs: [
    { type: 'address', name: 'from', indexed: true },
    { type: 'address', name: 'to', indexed: true },
    { type: 'uint256', name: 'tokenId', indexed: true },
  ],
}] as const

// ABI for getting mints per wallet
const mintsPerWalletAbi = [{
  name: 'mintsPerWallet',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ type: 'address' }],
  outputs: [{ type: 'uint256' }],
}] as const

// ABI for max mints constant
const maxMintsAbi = [{
  name: 'MAX_MINTS_PER_WALLET',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'uint256' }],
}] as const

// Add contract address hook
function useContractAddress() {
  const chainId = useChainId();
  return chainId === 11155111 
    ? contracts.sepolia.critter 
    : contracts.monad.critter;
}

export default function MintingPage() {
  const navigate = useNavigate()
  const { isConnected, address } = useWallet()
  const contractAddress = useContractAddress()
  const [isHovered, setIsHovered] = useState(false)
  const [currentRarityIndex, setCurrentRarityIndex] = useState(0)
  const [isMinting, setIsMinting] = useState(false)
  const [isMinted, setIsMinted] = useState(false)
  const [mintSuccess, setMintSuccess] = useState<boolean | null>(null)
  const [newTokenId, setNewTokenId] = useState<string | null>(null)

  // Read the number of mints the user has already done
  const { data: mintsUsed = 0n } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: mintsPerWalletAbi,
    functionName: 'mintsPerWallet',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Read the maximum mints per wallet
  const { data: maxMints = 4n } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: maxMintsAbi,
    functionName: 'MAX_MINTS_PER_WALLET',
  })

  // Auto-cycle through rarities
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentRarityIndex((prev) => (prev + 1) % RARITY_TYPES.length)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [isHovered])

  // Contract interaction
  const { writeContract } = useWriteContract()

  // Watch for Transfer events
  useWatchContractEvent({
    address: contractAddress as `0x${string}`,
    abi: transferAbi,
    eventName: 'Transfer',
    onLogs(logs) {
      // Check if the event is for our address
      const ourEvent = logs.find(log => 
        log.args.to?.toLowerCase() === address?.toLowerCase()
      )
      if (ourEvent) {
        setIsMinting(false)
        setMintSuccess(true)
        setNewTokenId(ourEvent.args.tokenId ? ourEvent.args.tokenId.toString() : null)
        
        // Set a timeout before navigating to gallery
        setTimeout(() => {
          setIsMinted(true)
        }, 3000)
      }
    },
  })

  // Handle mint with proper value
  const handleMint = async () => {
    if (mintsUsed >= maxMints) {
      alert(`You've already minted the maximum number of critters (${maxMints.toString()})`)
      return
    }
    
    try {
      setIsMinting(true)
      setMintSuccess(null)
      await writeContract({
        address: contractAddress as `0x${string}`,
        abi: mintAbi,
        functionName: 'mint',
        value: parseEther(gameConfig.mintPrice.toString()),
      })
    } catch (error) {
      console.error('Failed to mint:', error)
      setIsMinting(false)
      setMintSuccess(false)
    }
  }

  // Navigate to gallery after successful mint
  useEffect(() => {
    if (isMinted) {
      navigate('/gallery')
    }
  }, [isMinted, navigate])

  const currentRarity = RARITY_TYPES[currentRarityIndex]
  const remainingMints = Number(maxMints - mintsUsed)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      {/* Background elements */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/racing-grid.png')] opacity-10 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 animate-gradient"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl"
          >
            <h1 className="text-4xl sm:text-5xl font-bold mb-8">
              Mint Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 animate-text-shimmer">
                MonadCritter
              </span>
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="relative w-80 h-80 mx-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentRarity.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: 1,
                      scale: isHovered ? 1.05 : 1,
                      rotate: isHovered ? [0, -5, 5, 0] : 0,
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => setIsHovered(false)}
                    className={`w-full h-full bg-gradient-to-br ${currentRarity.color} rounded-2xl shadow-2xl overflow-hidden relative backdrop-blur-sm`}
                  >
                    {/* NFT preview */}
                    <img
                      src={currentRarity.image}
                      alt={`${currentRarity.name} MonadCritter`}
                      className="absolute inset-0 w-full h-full object-contain p-4"
                    />

                    {/* Glowing effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${currentRarity.color} rounded-2xl blur-xl opacity-20`} />

                    {/* Rarity badge */}
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-sm font-medium">
                      {currentRarity.name}
                    </div>
                  </motion.div>
                </AnimatePresence>
                
                {mintSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-2 left-0 right-0 mx-auto text-center"
                  >
                    <span className="px-4 py-2 bg-green-500 text-white rounded-full text-sm font-bold shadow-lg shadow-green-500/20">
                      Mint Success! #{newTokenId}
                    </span>
                  </motion.div>
                )}
              </div>

              <div className="space-y-6 text-left">
                <div>
                  <h2 className="text-2xl font-bold mb-4">
                    <span className={`text-transparent bg-clip-text bg-gradient-to-r ${currentRarity.color}`}>
                      {currentRarity.name} Critter
                    </span>
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50">
                      <h3 className="text-lg font-semibold mb-2">Rarity</h3>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Chance</span>
                        <span className="font-medium text-gray-200">{currentRarity.chance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Stats Boost</span>
                        <span className="font-medium text-gray-200">{currentRarity.boost}</span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50">
                      <h3 className="text-lg font-semibold mb-2">Potential Stats</h3>
                      <div className="space-y-2">
                        <div className="w-full bg-gray-700/50 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full rounded-full bg-gradient-to-r ${currentRarity.color}`}
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                          />
                        </div>
                        <div className="flex justify-between text-sm text-gray-300">
                          <span>Speed: {currentRarity.minStat}-{currentRarity.maxStat}</span>
                          <span>Stamina: {currentRarity.minStat}-{currentRarity.maxStat}</span>
                          <span>Luck: {currentRarity.minStat}-{currentRarity.maxStat}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <p className="text-xl text-gray-200">
                    Mint Price: <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">{gameConfig.mintPrice} MON</span>
                  </p>
                  
                  {isConnected && (
                    <p className="text-sm text-gray-400">
                      You have minted {mintsUsed.toString()}/{maxMints.toString()} critters
                      {remainingMints > 0 ? ` (${remainingMints} remaining)` : ' (max reached)'}
                    </p>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMint}
                    disabled={!isConnected || isMinting || mintsUsed >= maxMints}
                    className={`
                      w-full px-8 py-4 rounded-lg font-bold transition-all transform
                      ${isConnected && mintsUsed < maxMints
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
                        : 'bg-gray-800/50 text-gray-400 cursor-not-allowed border border-gray-700/50'
                      }
                    `}
                  >
                    {!isConnected ? (
                      'Connect Wallet to Mint'
                    ) : mintsUsed >= maxMints ? (
                      'Max Mints Reached'
                    ) : isMinting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Minting...
                      </div>
                    ) : (
                      'Mint Now'
                    )}
                  </motion.button>
                  
                  {mintSuccess === false && (
                    <p className="text-sm text-red-400">
                      Minting failed. Please try again.
                    </p>
                  )}
                  
                  {isMinting && (
                    <p className="text-sm text-gray-400 animate-pulse">
                      Please confirm the transaction in your wallet...
                    </p>
                  )}
                  
                  {mintSuccess && (
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-green-400"
                    >
                      Mint successful! Redirecting to your gallery...
                    </motion.p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
} 