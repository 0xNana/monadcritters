import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../components/WalletProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { parseEther, formatEther } from 'viem'
import { useWriteContract, useWatchContractEvent, useReadContract, useChainId, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { gameConfig, QUERY_CONFIG } from '../utils/config'
import { abi as monadCritterAbi } from '../contracts/MonadCritter/abi'
import React from 'react'

// Import all mascot variants
import commonMascot from '@assets/mascot/common/256/common 256x256.png'
import uncommonMascot from '@assets/mascot/uncommon/256/256x256.png'
import rareMascot from '@assets/mascot/rare/256/rare 256x256.png'
import legendaryMascot from '@assets/mascot/legendary/256/legendary 256.png'

// Add type for minting states
type MintingState = 'idle' | 'awaiting_approval' | 'minting' | 'success' | 'failed';

// Rarity types configuration
const RARITY_TYPES = [
  { name: 'Common', chance: '70%', boost: '0%', image: commonMascot, color: 'from-gray-400 to-gray-600', minStat: 40, maxStat: 100 },
  { name: 'Uncommon', chance: '20%', boost: '+10%', image: uncommonMascot, color: 'from-green-400 to-green-600', minStat: 44, maxStat: 110 },
  { name: 'Rare', chance: '9%', boost: '+25%', image: rareMascot, color: 'from-blue-400 to-blue-600', minStat: 50, maxStat: 125 },
  { name: 'Legendary', chance: '1%', boost: '+50%', image: legendaryMascot, color: 'from-yellow-400 to-yellow-600', minStat: 60, maxStat: 150 },
] as const

// Get contract address from environment variable
const CRITTER_CONTRACT_ADDRESS = import.meta.env.VITE_MONAD_CRITTER_ADDRESS as `0x${string}`;
if (!CRITTER_CONTRACT_ADDRESS) {
  throw new Error('VITE_MONAD_CRITTER_ADDRESS is not defined in environment variables');
}

// Contract configuration with static address
function useContractConfig() {
  return {
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi
  } as const;
}

export default function MintingPage() {
  const navigate = useNavigate()
  const { isConnected, address } = useWallet()
  const publicClient = usePublicClient()
  const [isHovered, setIsHovered] = useState(false)
  const [currentRarityIndex, setCurrentRarityIndex] = useState(0)
  const [isMinting, setIsMinting] = useState(false)
  const [isMinted, setIsMinted] = useState(false)
  const [mintSuccess, setMintSuccess] = useState<boolean | null>(null)
  const [newTokenId, setNewTokenId] = useState<string | null>(null)
  const [mintingState, setMintingState] = useState<MintingState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [mintedStats, setMintedStats] = useState<{
    speed: number;
    stamina: number;
    luck: number;
    rarity: number;
  } | null>(null)

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
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi,
    functionName: 'mintsPerWallet',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      staleTime: 30000,
      gcTime: 60000,
      retry: false
    },
  })

  // Read the maximum mints per wallet - this is a constant, so we can cache it longer
  const { data: maxMints = 4n } = useReadContract({
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi,
    functionName: 'MAX_MINTS_PER_WALLET',
    query: {
      staleTime: 3_600_000, // 1 hour
      gcTime: 3_600_000, // 1 hour
      retry: false
    },
  })

  // Read the current mint price from the contract
  const { data: mintPrice = parseEther(gameConfig.mintPrice.toString()) } = useReadContract({
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi,
    functionName: 'mintPrice',
    query: {
      staleTime: 30000,
      gcTime: 60000,
      retry: false
    },
  })

  // Check if contract is paused - using proper type assertion for the ABI
  const { data: isPaused = false } = useReadContract({
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi,
    functionName: 'paused' as any, // Type assertion to handle the paused function
    query: {
      staleTime: 30000,
      gcTime: 60000,
      retry: false
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

  // Add a helper function at the top of the component
  const formatBigInt = (value: bigint) => String(value);

  // Convert BigInt values to numbers for calculations
  const mintsUsedNumber = Number(mintsUsed);
  const maxMintsNumber = Number(maxMints);
  const remainingMints = maxMintsNumber - mintsUsedNumber;

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
      setMintedStats(null)
      const tx = await writeContract({
        address: CRITTER_CONTRACT_ADDRESS,
        abi: monadCritterAbi,
        functionName: 'mint',
        value: mintPrice,
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
      // Handle user rejection
      if (error?.message?.includes('User rejected') || 
          error?.code === 'ACTION_REJECTED' ||
          error?.message?.includes('User denied') ||
          error?.message?.includes('rejected transaction')) {
        setMintingState('failed')
        setErrorMessage('Transaction was rejected. Please try again when ready.')
        
        // Reset to idle state after 3 seconds
        timeoutRef.current = setTimeout(() => {
          setMintingState('idle')
          setErrorMessage('')
        }, 3000)
        return
      }
      
      // Handle insufficient funds
      if (error?.message?.includes('insufficient funds')) {
        setMintingState('failed')
        setErrorMessage('Insufficient MON balance for minting.')
      }
      // Handle other errors
      else {
        setMintingState('failed')
        setErrorMessage(error?.message || 'Transaction failed. Please try again.')
      }

      // Reset to idle state after 3 seconds for non-rejection errors
      timeoutRef.current = setTimeout(() => {
        setMintingState('idle')
        setErrorMessage('')
      }, 3000)
    }
  }

  // Watch for Transfer events with retry logic
  useWatchContractEvent({
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi,
    eventName: 'Transfer',
    enabled: mintingState === 'minting',
    onLogs(logs) {
      // Check if the event is for our address
      const ourEvent = logs.find(log => 
        log.args.to?.toLowerCase() === address?.toLowerCase()
      )
      if (ourEvent) {
        // Only update if we're still in minting state
        if (mintingState === 'minting') {
          setMintingState('success');
          setNewTokenId(ourEvent.args.tokenId ? ourEvent.args.tokenId.toString() : null);
        
          // Set a timeout before navigating to lobby
          timeoutRef.current = setTimeout(() => {
            setIsMinted(true);
          }, 3000);
        }
      }
    },
    onError: (error) => {
      setErrorMessage('Error processing transfer event. Please check your wallet for status.');
    },
  });

  // Watch for CritterMinted events
  useWatchContractEvent({
    address: CRITTER_CONTRACT_ADDRESS,
    abi: monadCritterAbi,
    eventName: 'CritterMinted',
    enabled: mintingState === 'minting',
    onLogs(logs) {
      // Check if the event is for our address
      const ourEvent = logs.find(log => 
        log.args.owner?.toLowerCase() === address?.toLowerCase()
      )
      if (ourEvent && ourEvent.args.stats) {
        setMintedStats(ourEvent.args.stats);
        
        // Only update if we're still in minting state
        if (mintingState === 'minting') {
          setMintingState('success');
          setNewTokenId(ourEvent.args.tokenId ? ourEvent.args.tokenId.toString() : null);
          
          // Set a timeout before navigating to lobby
          timeoutRef.current = setTimeout(() => {
            setIsMinted(true);
          }, 3000);
        }
      }
    },
    onError: (error) => {
      setErrorMessage('Error processing minting event. Please check your wallet for status.');
    }
  });

  // Add a fallback timeout to handle cases where events might be missed
  useEffect(() => {
    if (!publicClient || !address || mintingState !== 'minting') return;
    
    // Check after 15 seconds first
    const quickCheck = setTimeout(async () => {
      if (mintingState === 'minting') {
        try {
          const currentMints = await publicClient.readContract({
            address: CRITTER_CONTRACT_ADDRESS,
            abi: monadCritterAbi,
            functionName: 'mintsPerWallet',
            args: [address as `0x${string}`]
          });
          
          if (currentMints > mintsUsed) {
            setMintingState('success');
            timeoutRef.current = setTimeout(() => {
              setIsMinted(true);
            }, 3000);
          }
        } catch (error) {
          setErrorMessage('Error checking mint status. Please check your wallet.');
        }
      }
    }, 15000);

    // Longer fallback after 45 seconds
    const fallbackTimeout = setTimeout(async () => {
      if (mintingState === 'minting') {
        try {
          const currentMints = await publicClient.readContract({
            address: CRITTER_CONTRACT_ADDRESS,
            abi: monadCritterAbi,
            functionName: 'mintsPerWallet',
            args: [address as `0x${string}`]
          });
          
          if (currentMints > mintsUsed) {
            setMintingState('success');
            timeoutRef.current = setTimeout(() => {
              setIsMinted(true);
            }, 3000);
          } else {
            setMintingState('failed');
            setErrorMessage('Transaction may have failed or is taking too long. Please check your wallet for status.');
            
            timeoutRef.current = setTimeout(() => {
              setMintingState('idle');
              setErrorMessage('');
            }, 5000);
          }
        } catch (error) {
          setErrorMessage('Error checking mint status. Please check your wallet.');
        }
      }
    }, 45000);
    
    return () => {
      clearTimeout(quickCheck);
      clearTimeout(fallbackTimeout);
    };
  }, [mintingState, address, publicClient, mintsUsed, CRITTER_CONTRACT_ADDRESS]);

  // Navigate to lobby after successful mint
  useEffect(() => {
    if (isMinted) {
      navigate('/lobby')
    }
  }, [isMinted, navigate])

  const currentRarity = RARITY_TYPES[currentRarityIndex]

  // Add manual refresh for mints count after successful mint
  const refreshMintsCount = useCallback(() => {
    if (mintingState === 'success') {
      queryClient.invalidateQueries({ 
        queryKey: ['mintsPerWallet', address] 
      })
    }
  }, [mintingState, address, queryClient])

  // Update mints count after successful mint
  useEffect(() => {
    refreshMintsCount()
  }, [mintingState, refreshMintsCount])

  // Render minting status message
  const renderMintingStatus = (): React.ReactNode => {
    switch (mintingState) {
      case 'awaiting_approval':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-2 text-yellow-400 bg-yellow-400/10 px-4 py-3 rounded-lg"
          >
            <div className="flex items-center gap-2">
            <svg className="animate-pulse w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.374-14.666L19.2 4.8a2 2 0 01-1.4 1.4l-1.534.174a2 2 0 00-1.666 1.666l-.174 1.534a2 2 0 01-1.4 1.4l-1.534.174a2 2 0 00-1.666 1.666l-.174 1.534a2 2 0 01-1.4 1.4L4.8 19.2" />
            </svg>
              <span>Please confirm the transaction in your wallet</span>
            </div>
            <div className="text-sm text-yellow-300/70 mt-1">
              Check your wallet extension or mobile app to approve this transaction
            </div>
          </motion.div>
        )
      case 'minting':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-2 text-blue-400 bg-blue-400/10 px-4 py-3 rounded-lg"
          >
            <div className="flex items-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
              <span>Minting your critter...</span>
            </div>
            <div className="w-full bg-blue-400/20 h-2 rounded-full mt-2">
              <motion.div 
                className="h-full bg-blue-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: ["0%", "30%", "60%", "90%"] }}
                transition={{ 
                  duration: 15, 
                  times: [0, 0.3, 0.6, 0.9],
                  ease: "easeInOut" 
                }}
              />
            </div>
            <div className="text-sm text-blue-300/70 mt-1">
              Transaction submitted! Waiting for blockchain confirmation...
            </div>
          </motion.div>
        )
      case 'success':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-2 text-green-400 bg-green-400/10 px-4 py-3 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Mint successful!</span>
            </div>
            
            <div className="w-full bg-green-400/20 h-2 rounded-full mt-1">
              <motion.div 
                className="h-full bg-green-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            {mintedStats && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-green-500/30 w-full"
              >
                <h4 className="text-center font-medium mb-2 text-green-300">Your New Critter Stats</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Speed:</span>
                    <span className="font-medium text-white">{mintedStats.speed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Stamina:</span>
                    <span className="font-medium text-white">{mintedStats.stamina}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Luck:</span>
                    <span className="font-medium text-white">{mintedStats.luck}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rarity:</span>
                    <span className={`font-medium ${
                      mintedStats.rarity === 3 ? 'text-yellow-300' :
                      mintedStats.rarity === 2 ? 'text-purple-300' :
                      mintedStats.rarity === 1 ? 'text-green-300' :
                      'text-gray-300'
                    }`}>
                      {RARITY_TYPES[mintedStats.rarity].name}
                    </span>
                  </div>
              </div>
              </motion.div>
            )}
            
            <div className="text-sm text-green-300/70 mt-2 flex items-center gap-1">
              <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Redirecting to lobby in a moment...
            </div>
          </motion.div>
        )
      case 'failed':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-lg"
          >
            <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
              <span>Minting failed</span>
            </div>
            <div className="text-sm text-red-300/70 mt-1 text-center">
              {errorMessage || 'There was an error processing your transaction. Please try again.'}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setMintingState('idle');
                setErrorMessage('');
              }}
              className="mt-2 px-4 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md text-sm transition-colors"
            >
              Dismiss
            </motion.button>
          </motion.div>
        )
      default:
        return null
    }
  }

  // Add a function to show rarity distribution
  const renderRarityDistribution = () => {
    return (
      <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50 max-w-md mx-auto">
        <h3 className="text-lg font-semibold mb-4 text-center">Rarity Distribution</h3>
        <div className="space-y-4">
          {RARITY_TYPES.map((rarity, index) => (
            <div key={rarity.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className={`${
                  index === 3 ? 'text-yellow-300' :
                  index === 2 ? 'text-blue-300' :
                  index === 1 ? 'text-green-300' :
                  'text-gray-300'
                }`}>{rarity.name}</span>
                <span className="text-gray-400">{rarity.chance}</span>
              </div>
              <div className="w-full bg-gray-700/50 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full bg-gradient-to-r ${rarity.color}`}
                  style={{ 
                    width: `${
                      index === 0 ? '70%' : 
                      index === 1 ? '20%' : 
                      index === 2 ? '9%' : 
                      '1%'
                    }` 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
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
                  Mint Price: <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                    {formatEther(mintPrice)} MON
                  </span>
                </p>
                
                {isConnected && (
                  <p className="text-sm text-gray-400 mt-2">
                    You have minted {mintsUsedNumber}/{maxMintsNumber} critters
                    {remainingMints > 0 ? ` (${remainingMints} remaining)` : ' (max reached)'}
                  </p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMint}
                disabled={Boolean(!isConnected || mintingState === 'minting' || mintingState === 'awaiting_approval' || mintsUsedNumber >= maxMintsNumber || isPaused)}
                className={`
                  w-full px-8 py-4 rounded-lg font-bold transition-all transform
                  ${isConnected && mintsUsedNumber < maxMintsNumber && mintingState === 'idle' && !isPaused
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
                    : 'bg-gray-800/50 text-gray-400 cursor-not-allowed border border-gray-700/50'
                  }
                `}
              >
                {!isConnected 
                  ? 'Connect Wallet to Mint'
                  : isPaused
                  ? 'Minting Paused'
                  : mintsUsedNumber >= maxMintsNumber
                  ? 'Max Mints Reached'
                  : mintingState === 'awaiting_approval'
                  ? 'Confirm in Wallet...'
                  : mintingState === 'minting'
                  ? 'Minting...'
                  : 'Mint Now'
                }
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
} 