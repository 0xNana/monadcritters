import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../components/WalletProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { parseEther } from 'viem'
import { useWriteContract, useWatchContractEvent, useReadContract, useChainId } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { contracts, gameConfig } from '../utils/config'
import React from 'react'

// Import all mascot variants
import commonMascot from '@assets/mascot/common/256/common 256x256.png'
import uncommonMascot from '@assets/mascot/uncommon/256/256x256.png'
import rareMascot from '@assets/mascot/rare/256/rare 256x256.png'
import legendaryMascot from '@assets/mascot/legendary/256/legendary 256.png'

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

// Add this type for minting states
type MintingState = 'idle' | 'awaiting_approval' | 'minting' | 'success' | 'failed';

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
  const [mintingState, setMintingState] = useState<MintingState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const queryClient = useQueryClient()

  // Reset states when wallet is disconnected
  useEffect(() => {
    if (!isConnected) {
      setIsMinting(false)
      setIsMinted(false)
      setMintSuccess(null)
      setNewTokenId(null)
      setMintingState('idle')
      setErrorMessage('')
      
      // Clear any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isConnected])

  // Read the number of mints the user has already done
  const { data: mintsUsed = 0n } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: mintsPerWalletAbi,
    functionName: 'mintsPerWallet',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      gcTime: 60_000, // 1 minute
      staleTime: 30_000, // 30 seconds
      refetchInterval: 30_000, // 30 seconds
      retry: (failureCount, error: any) => {
        // Don't retry if error is not related to rate limiting
        if (!error?.message?.includes('429')) return false;
        return failureCount < 5; // Maximum 5 retries
      },
      retryDelay: (failureCount) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        return Math.min(1000 * Math.pow(2, failureCount - 1), 16000);
      },
    },
  })

  // Read the maximum mints per wallet - this is a constant, so we can cache it longer
  const { data: maxMints = 4n } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: maxMintsAbi,
    functionName: 'MAX_MINTS_PER_WALLET',
    query: {
      gcTime: 3_600_000, // 1 hour
      staleTime: 3_600_000, // 1 hour
      refetchInterval: 3_600_000, // 1 hour
      retry: (failureCount, error: any) => {
        if (!error?.message?.includes('429')) return false;
        return failureCount < 5;
      },
      retryDelay: (failureCount) => {
        return Math.min(1000 * Math.pow(2, failureCount - 1), 16000);
      },
    },
  })

  // Auto-cycle through rarities
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentRarityIndex((prev) => (prev + 1) % RARITY_TYPES.length)
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [isHovered])

  // Contract interaction
  const { writeContract } = useWriteContract()

  // Add timeout ref to clear timeout when needed
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle mint with proper value
  const handleMint = async () => {
    if (mintsUsed >= maxMints) {
      alert(`You've already minted the maximum number of critters (${maxMints.toString()})`)
      return
    }
    
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      setMintingState('awaiting_approval')
      setErrorMessage('')
      const tx = await writeContract({
        address: contractAddress as `0x${string}`,
        abi: mintAbi,
        functionName: 'mint',
        value: parseEther(gameConfig.mintPrice.toString()),
      })
      
      // Set a timeout to revert to idle if no confirmation after 30 seconds
      setMintingState('minting')
      timeoutRef.current = setTimeout(() => {
        if (mintingState === 'minting') {
          setMintingState('failed')
          setErrorMessage('Transaction taking too long. Please try again.')
          timeoutRef.current = setTimeout(() => {
            setMintingState('idle')
            setErrorMessage('')
          }, 3000)
        }
      }, 30000)

    } catch (error: any) {
      console.error('Failed to mint:', error)
      setMintingState('failed')
      
      // Handle user rejection
      if (error?.message?.includes('User rejected') || error?.code === 'ACTION_REJECTED') {
        setErrorMessage('Transaction was rejected. Please try again.')
      } 
      // Handle insufficient funds
      else if (error?.message?.includes('insufficient funds')) {
        setErrorMessage('Insufficient MON balance for minting.')
      }
      // Handle other errors
      else {
        setErrorMessage(error?.message || 'Transaction failed. Please try again.')
      }

      // Reset to idle state after 3 seconds
      timeoutRef.current = setTimeout(() => {
        setMintingState('idle')
        setErrorMessage('')
      }, 3000)
    }
  }

  // Watch for Transfer events with retry logic
  useWatchContractEvent({
    address: contractAddress as `0x${string}`,
    abi: transferAbi,
    eventName: 'Transfer',
    enabled: mintingState === 'minting',
    onLogs(logs) {
      // Clear any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Check if the event is for our address
      const ourEvent = logs.find(log => 
        log.args.to?.toLowerCase() === address?.toLowerCase()
      )
      if (ourEvent) {
        setMintingState('success')
        setNewTokenId(ourEvent.args.tokenId ? ourEvent.args.tokenId.toString() : null)
        
        // Set a timeout before navigating to gallery
        timeoutRef.current = setTimeout(() => {
          setIsMinted(true)
        }, 3000)
      }
    },
    onError: (error) => {
      if (error?.message?.includes('429')) {
        // If we hit rate limit, we'll retry with exponential backoff
        console.warn('Rate limit hit, retrying with backoff...');
      }
    },
  })

  // Navigate to gallery after successful mint
  useEffect(() => {
    if (isMinted) {
      navigate('/gallery')
    }
  }, [isMinted, navigate])

  const currentRarity = RARITY_TYPES[currentRarityIndex]
  const remainingMints = Number(maxMints - mintsUsed)

  // Add manual refresh for mints count after successful mint
  const refreshMintsCount = useCallback(() => {
    if (mintingState === 'success') {
      queryClient.invalidateQueries({ 
        queryKey: ['mintsPerWallet', address] 
      })
    }
  }, [mintingState, address])

  // Update mints count after successful mint
  useEffect(() => {
    refreshMintsCount()
  }, [mintingState, refreshMintsCount])

  // Render minting status message
  const renderMintingStatus = () => {
    switch (mintingState) {
      case 'awaiting_approval':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-lg"
          >
            <svg className="animate-pulse w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.374-14.666L19.2 4.8a2 2 0 01-1.4 1.4l-1.534.174a2 2 0 00-1.666 1.666l-.174 1.534a2 2 0 01-1.4 1.4l-1.534.174a2 2 0 00-1.666 1.666l-.174 1.534a2 2 0 01-1.4 1.4l-1.534.174a2 2 0 00-1.666 1.666l-.174 1.534a2 2 0 01-1.4 1.4L4.8 19.2" />
            </svg>
            Please confirm the transaction in your wallet...
          </motion.div>
        )
      case 'minting':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-blue-400 bg-blue-400/10 px-4 py-2 rounded-lg"
          >
            <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Minting your critter...
          </motion.div>
        )
      case 'success':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-green-400 bg-green-400/10 px-4 py-2 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mint successful! Redirecting to gallery...
          </motion.div>
        )
      case 'failed':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {errorMessage || 'Minting failed. Please try again.'}
          </motion.div>
        )
      default:
        return null
    }
  }

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Left Column - Critter Preview */}
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

              {/* Right Column - Stats */}
              <div>
                <h2 className="text-2xl font-bold mb-4">
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${currentRarity.color}`}>
                    {currentRarity.name} Critter
                  </span>
                </h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Rarity Card */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50 h-full">
                    <h3 className="text-lg font-semibold mb-4">Rarity</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Chance</span>
                        <span className="font-medium text-gray-200">{currentRarity.chance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Stats Boost</span>
                        <span className="font-medium text-gray-200">{currentRarity.boost}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Potential Stats Card */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50 h-full">
                    <h3 className="text-lg font-semibold mb-4">Potential Stats</h3>
                    <div className="space-y-4">
                      {/* Speed Stat */}
                      <div>
                        <div className="flex justify-between text-sm text-gray-300 mb-1">
                          <span>Speed</span>
                          <span>{currentRarity.minStat}-{currentRarity.maxStat}</span>
                        </div>
                        <div className="w-full bg-gray-700/50 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full rounded-full bg-gradient-to-r ${currentRarity.color}`}
                            initial={{ width: '0%' }}
                            animate={{ width: ['0%', '100%', '0%'] }}
                            transition={{ 
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        </div>
                      </div>

                      {/* Stamina Stat */}
                      <div>
                        <div className="flex justify-between text-sm text-gray-300 mb-1">
                          <span>Stamina</span>
                          <span>{currentRarity.minStat}-{currentRarity.maxStat}</span>
                        </div>
                        <div className="w-full bg-gray-700/50 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full rounded-full bg-gradient-to-r ${currentRarity.color}`}
                            initial={{ width: '0%' }}
                            animate={{ width: ['0%', '100%', '0%'] }}
                            transition={{ 
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 1
                            }}
                          />
                        </div>
                      </div>

                      {/* Luck Stat */}
                      <div>
                        <div className="flex justify-between text-sm text-gray-300 mb-1">
                          <span>Luck</span>
                          <span>{currentRarity.minStat}-{currentRarity.maxStat}</span>
                        </div>
                        <div className="w-full bg-gray-700/50 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full rounded-full bg-gradient-to-r ${currentRarity.color}`}
                            initial={{ width: '0%' }}
                            animate={{ width: ['0%', '100%', '0%'] }}
                            transition={{ 
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 2
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Minting Controls - Below Both Columns */}
            <div className="mt-8 max-w-md mx-auto w-full space-y-4">
              <div className="text-center">
                <p className="text-xl text-gray-200">
                  Mint Price: <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">{gameConfig.mintPrice} MON</span>
                </p>
                
                {isConnected && (
                  <p className="text-sm text-gray-400 mt-2">
                    You have minted {mintsUsed.toString()}/{maxMints.toString()} critters
                    {remainingMints > 0 ? ` (${remainingMints} remaining)` : ' (max reached)'}
                  </p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMint}
                disabled={!isConnected || mintingState === 'minting' || mintingState === 'awaiting_approval' || mintsUsed >= maxMints}
                className={`
                  w-full px-8 py-4 rounded-lg font-bold transition-all transform
                  ${isConnected && mintsUsed < maxMints && mintingState === 'idle'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
                    : 'bg-gray-800/50 text-gray-400 cursor-not-allowed border border-gray-700/50'
                  }
                `}
              >
                {!isConnected 
                  ? 'Connect Wallet to Mint'
                  : mintsUsed >= maxMints 
                  ? 'Max Mints Reached'
                  : mintingState === 'awaiting_approval'
                  ? 'Confirm in Wallet...'
                  : mintingState === 'minting'
                  ? 'Minting...'
                  : 'Mint Now'
                }
              </motion.button>
              
              {/* Status Messages */}
              <div className="mt-4">
                {renderMintingStatus()}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
} 