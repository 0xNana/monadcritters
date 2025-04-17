import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useMintCritter } from '../contracts/MonadCritter/hooks';
import { ConnectButton } from '../components/ConnectButton';
import { useHasCritter } from '../hooks/useHasCritter';
import { motion, AnimatePresence } from 'framer-motion';
import { parseEther } from 'viem';
import { abi } from '../contracts/MonadCritter/abi';
import { useContractAddress } from '../contracts/MonadCritter/hooks';
import { usePWA } from '../hooks/usePWA';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Footer } from '../components/Footer';

// Import sprite assets
import commonSprite64 from '/assets/sprites/common-64.png';
import uncommonSprite64 from '/assets/sprites/uncommon-64.png';
import rareSprite64 from '/assets/sprites/rare-64.png';
import legendarySprite64 from '/assets/sprites/legendary-64.png';


// Rarity types configuration with video previews
const RARITY_TYPES = [
  { name: 'Common', chance: '70%', boost: '0%', video: '/common.mp4', smallImage: commonSprite64, color: 'from-gray-400 to-gray-600', minStat: 40, maxStat: 100 },
  { name: 'Uncommon', chance: '20%', boost: '+10%', video: '/uncommon.mp4', smallImage: uncommonSprite64, color: 'from-green-400 to-green-600', minStat: 44, maxStat: 110 },
  { name: 'Rare', chance: '9%', boost: '+25%', video: '/rare.mp4', smallImage: rareSprite64, color: 'from-blue-400 to-blue-600', minStat: 50, maxStat: 125 },
  { name: 'Legendary', chance: '1%', boost: '+50%', video: '/legendary.mp4', smallImage: legendarySprite64, color: 'from-yellow-400 to-yellow-600', minStat: 60, maxStat: 150 },
] as const;

/**
 * Homepage for Critter NFT Betting Platform
 * Combines minting functionality with betting information
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const contractAddress = useContractAddress();
  const [activeTab, setActiveTab] = useState<'mint' | 'how-to-play'>('mint');
  const [mintCount, setMintCount] = useState(1);
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentRarityIndex, setCurrentRarityIndex] = useState(0);
  const { hasCritter, isLoading: isCheckingCritter } = useHasCritter(address);
  const { isInstallable, promptToInstall, resetPWAState } = usePWA();
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Mint functionality
  const { writeContractAsync, isPending: isMinting } = useMintCritter();

  // Read contract data
  const { data: mintsUsed = 0n } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'mintsPerWallet',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      staleTime: 30000,
      gcTime: 60000,
      retry: false
    },
  });

  const { data: maxMints = 4n } = useReadContract({
    address: contractAddress,
    abi,
    functionName: 'MAX_MINTS_PER_WALLET',
    query: {
      staleTime: 3_600_000,
      gcTime: 3_600_000,
      retry: false
    },
  });

  // Convert BigInt values to numbers for calculations
  const mintsUsedNumber = Number(mintsUsed);
  const maxMintsNumber = Number(maxMints);
  const remainingMints = maxMintsNumber - mintsUsedNumber;
  
  // Auto-cycle through rarities
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentRarityIndex((prev) => (prev + 1) % RARITY_TYPES.length);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [isHovered]);
  
  const handleMint = async () => {
    if (!isConnected) return;
    
    try {
      const mintPrice = parseEther('1');
      const totalValue = mintPrice * BigInt(mintCount);
      
      await writeContractAsync({
        abi,
        functionName: 'mint',
        address: contractAddress,
        value: totalValue
      });
    } catch (error) {
      // Error handling will be managed by the UI toast notifications
    }
  };
  
  const enterApp = () => {
    navigate('/clashes');
  };

  const currentRarity = RARITY_TYPES[currentRarityIndex];
  
  // Add PWA-related effects
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true';
    setIsDismissed(dismissed);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

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
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-4 pb-12">
          {/* PWA Install Prompt */}
          {(isInstallable && !isDismissed) && (
            <div 
              className={`
                mb-6 relative flex items-center gap-4 p-4 
                ${isMobile ? 'mx-4' : 'mx-auto max-w-2xl'}
                bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-md
                rounded-xl border border-purple-500/20 shadow-2xl
                animate-slideUp
              `}
            >
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">Install Clash of Critters</h3>
                <p className="text-sm text-gray-300">Get the best experience with our app</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Not Now button */}
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Not Now
                </button>

                {/* Install button */}
                <button
                  onClick={promptToInstall}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Install
                </button>

                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Debug Reset Button - Only in development */}
          {import.meta.env.DEV && !isInstallable && (
            <button
              onClick={resetPWAState}
              className="fixed bottom-4 right-4 px-4 py-2 bg-purple-600 text-white rounded-lg z-50"
            >
              Reset PWA State
            </button>
          )}

          {/* Top Actions */}
          <div className="flex justify-end items-center mb-6 gap-3">
            <div className="flex gap-3 items-center">
              {isConnected && (
                <button
                  onClick={enterApp}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-white font-medium text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Start Betting
                </button>
              )}
              <div className="connect-button-wrapper">
              <ConnectButton />
              </div>
            </div>
          </div>
          
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Clash of Critters
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Mint. Bet. Win Big. The First Ever NFT Betting Arena on Monad
            </p>
            <p className="text-sm text-blue-300 mt-2">Powered by Pyth Entropy</p>
          </div>
          
          {/* Live Winners Ticker */}
          <div className="relative w-full mb-6 overflow-hidden bg-gray-800/30 py-3 backdrop-blur-sm rounded-lg border border-purple-800/30">
            <div className="text-xs text-white font-medium absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-purple-800/80 px-2 py-1 rounded">
              LIVE WINS
            </div>
            <div className="marquee-container ml-[90px]">
              <motion.div
                className="flex items-center space-x-8 whitespace-nowrap"
                animate={{ x: "-100%" }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: 20,
                }}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+64 MON</span>
                  <img src={RARITY_TYPES[3].smallImage} alt="Legendary" className="w-8 h-8" />
                  <span className="text-gray-300">129</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+36 MON</span>
                  <img src={RARITY_TYPES[2].smallImage} alt="Rare" className="w-8 h-8" />
                  <span className="text-gray-300">532</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+20 MON</span>
                  <img src={RARITY_TYPES[1].smallImage} alt="Uncommon" className="w-8 h-8" />
                  <span className="text-gray-300">087</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+5 MON</span>
                  <img src={RARITY_TYPES[0].smallImage} alt="Common" className="w-8 h-8" />
                  <span className="text-gray-300">215</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+45 MON</span>
                  <img src={RARITY_TYPES[3].smallImage} alt="Legendary" className="w-8 h-8" />
                  <span className="text-gray-300">082</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+18 MON</span>
                  <img src={RARITY_TYPES[2].smallImage} alt="Rare" className="w-8 h-8" />
                  <span className="text-gray-300">316</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+9 MON</span>
                  <img src={RARITY_TYPES[1].smallImage} alt="Uncommon" className="w-8 h-8" />
                  <span className="text-gray-300">429</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+23 MON</span>
                  <img src={RARITY_TYPES[0].smallImage} alt="Common" className="w-8 h-8" />
                  <span className="text-gray-300">753</span>
                </div>
                {/* Duplicate the items to ensure the animation looks continuous */}
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+53 MON</span>
                  <img src={RARITY_TYPES[3].smallImage} alt="Legendary" className="w-8 h-8" />
                  <span className="text-gray-300">129</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+33 MON</span>
                  <img src={RARITY_TYPES[2].smallImage} alt="Rare" className="w-8 h-8" />
                  <span className="text-gray-300">532</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium"> +20 MON</span>
                  <img src={RARITY_TYPES[1].smallImage} alt="Uncommon" className="w-8 h-8" />
                  <span className="text-gray-300">087</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium"> 112.6 MON</span>
                  <img src={RARITY_TYPES[0].smallImage} alt="Common" className="w-8 h-8" />
                  <span className="text-gray-300">215</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">+12 MON</span>
                  <img src={RARITY_TYPES[3].smallImage} alt="Legendary" className="w-8 h-8" />
                  <span className="text-gray-300">082</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-12 max-w-[850px] mx-auto relative">
            {/* Left Column - Critter Preview */}
            <div className="space-y-4 w-full">
              {/* Buttons moved above preview */}
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setShowFullGuide(!showFullGuide)}
                  className="flex-1 px-6 py-2.5 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium text-base transition-all hover:shadow-lg hover:shadow-purple-500/20"
                >
                  {showFullGuide ? 'Hide Guide' : 'How To Play'}
                </button>
                
                {!isConnected && (
                  <button
                    onClick={() => document.querySelector('.connect-button-wrapper button')?.dispatchEvent(new Event('click', { bubbles: true }))}
                    className="flex-1 px-6 py-2.5 bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-700 hover:to-blue-700 rounded-lg font-bold text-base transition-all hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    Start Winning
                  </button>
                )}
              </div>

              <div className="relative w-full">
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
                    className={`w-full pb-[100%] bg-gradient-to-br ${currentRarity.color} rounded-lg shadow-2xl overflow-hidden relative backdrop-blur-sm`}
                  >
                    {/* Video preview */}
                    <video
                      src={currentRarity.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Glowing effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${currentRarity.color} rounded-2xl blur-xl opacity-20`} />

                    {/* Rarity badge */}
                    <div className="absolute bottom-2 right-2 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm text-sm font-semibold border border-white/10 shadow-xl">
                      {currentRarity.name}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Moved Critter type and description here */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-1 border border-gray-700/30">
                <h2 className="text-2xl font-bold mb-1 text-center">
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${currentRarity.color}`}>
                    {currentRarity.name} Critter
                  </span>
                </h2>
              </div>
            </div>

            {/* Right Column - Minting Controls */}
            <div className="space-y-3 w-full">
              {/* User Minting Stats */}
              {isConnected && (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-gray-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Your Mints:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{mintsUsedNumber}/{maxMintsNumber}</span>
                      {remainingMints > 0 && (
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          {remainingMints} remaining
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-700/30 h-1 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${(mintsUsedNumber / maxMintsNumber) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
              
              {/* Minting Controls */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-base font-medium text-gray-300">Quantity:</span>
                  <div className="flex items-center">
                    <button
                      onClick={() => setMintCount(Math.max(1, mintCount - 1))}
                      disabled={!isConnected || isMinting}
                      className={`w-8 h-8 flex items-center justify-center ${
                        isConnected && !isMinting ? 'bg-purple-900/50 hover:bg-purple-800/50 text-white' : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      } rounded-l-md transition-colors`}
                    >
                      -
                    </button>
                    <div className="w-12 h-8 flex items-center justify-center bg-purple-900/30 text-white font-medium">
                      {mintCount}
                    </div>
                    <button
                      onClick={() => setMintCount(Math.min(4, mintCount + 1))}
                      disabled={!isConnected || isMinting}
                      className={`w-8 h-8 flex items-center justify-center ${
                        isConnected && !isMinting ? 'bg-purple-900/50 hover:bg-purple-800/50 text-white' : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      } rounded-r-md transition-colors`}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-base font-medium text-gray-300">Price:</span>
                  <span className="font-medium text-yellow-400">{(1 * mintCount).toFixed(2)} MON</span>
                </div>
                
                {isConnected ? (
                  <button
                    onClick={handleMint}
                    disabled={isMinting || mintsUsedNumber >= maxMintsNumber}
                    className={`w-full py-3 rounded-lg font-bold text-base text-white transition-all ${
                      isMinting || mintsUsedNumber >= maxMintsNumber
                        ? 'bg-purple-800/50 cursor-not-allowed' 
                        : 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/20'
                    }`}
                  >
                    {isMinting ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Minting...
                      </div>
                    ) : mintsUsedNumber >= maxMintsNumber ? (
                      'Maximum Mints Reached'
                    ) : (
                      `Mint ${mintCount} Critter${mintCount > 1 ? 's' : ''}`
                    )}
                  </button>
                ) : (
                  <div className="text-center text-yellow-400 text-sm bg-yellow-400/10 py-3 px-2 rounded border border-yellow-400/20">
                    Connect Wallet to Mint
                  </div>
                )}
              </div>

              {/* Stats Display */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-base font-medium text-gray-200">Rarity Stats</h3>
                  <div className="flex gap-5">
                    <div className="text-right">
                      <span className="text-sm text-gray-400 block">Chance</span>
                      <span className="text-sm font-medium text-white">{currentRarity.chance}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-400 block">Boost</span>
                      <span className="text-sm font-medium text-white">{currentRarity.boost}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Speed Stat */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-400">Speed</span>
                      <span className="text-white">{currentRarity.minStat}-{currentRarity.maxStat}</span>
                    </div>
                    <div className="w-full bg-gray-700/30 h-1.5 rounded-full overflow-hidden">
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
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-400">Stamina</span>
                      <span className="text-white">{currentRarity.minStat}-{currentRarity.maxStat}</span>
                    </div>
                    <div className="w-full bg-gray-700/30 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full bg-gradient-to-r ${currentRarity.color}`}
                        initial={{ width: '0%' }}
                        animate={{ width: ['0%', '100%', '0%'] }}
                        transition={{ 
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 5
                        }}
                      />
                    </div>
                  </div>

                  {/* Luck Stat */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-400">Luck</span>
                      <span className="text-white">{currentRarity.minStat}-{currentRarity.maxStat}</span>
                    </div>
                    <div className="w-full bg-gray-700/30 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full bg-gradient-to-r ${currentRarity.color}`}
                        initial={{ width: '0%' }}
                        animate={{ width: ['0%', '100%', '0%'] }}
                        transition={{ 
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 5
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="bg-gray-900/30 border border-purple-900/30 p-6 rounded-lg">
              <div className="text-purple-400 text-2xl mb-4">🎲</div>
              <h3 className="text-xl font-medium mb-2">NFT Betting</h3>
              <p className="text-gray-400">Bet with your NFT Critters in high-stakes clashes using their unique stats for better odds.</p>
            </div>
            
            <div className="bg-gray-900/30 border border-purple-900/30 p-6 rounded-lg">
              <div className="text-purple-400 text-2xl mb-4">💰</div>
              <h3 className="text-xl font-medium mb-2">Win Big Rewards</h3>
              <p className="text-gray-400">Earn MON in real-time from the prize pool when your Critter wins in head-to-head or squad clashes.</p>
            </div>
            
            <div className="bg-gray-900/30 border border-purple-900/30 p-6 rounded-lg">
              <div className="text-purple-400 text-2xl mb-4">🔮</div>
              <h3 className="text-xl font-medium mb-2">Provably Fair</h3>
              <p className="text-gray-400">Pyth Entropy ensures transparent outcomes that can't be manipulated.</p>
            </div>
            
            <div className="bg-gray-900/30 border border-purple-900/30 p-6 rounded-lg">
              <div className="text-purple-400 text-2xl mb-4">🎯</div>
              <h3 className="text-xl font-medium mb-2">Active Pools</h3>
              <div className="space-y-2 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Head-to-Head:</span>
                  <span className="text-sm font-medium text-yellow-400">2 MON</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Quad Pool:</span>
                  <span className="text-sm font-medium text-yellow-400">8 MON</span>
                </div>
                <a href="#" onClick={enterApp} className="block mt-3 text-center text-xs text-blue-300 hover:text-blue-200 transition-colors">
                  View All Pools →
                </a>
              </div>
            </div>
          </div>
          
          {/* Prize Statistics Section */}
          <div className="max-w-5xl mx-auto mt-8 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-center text-gray-200">
              Prize Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/30 border border-purple-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">5K+</div>
                <div className="text-sm text-gray-400">Active Players</div>
              </div>
              <div className="bg-gray-900/30 border border-purple-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">4538.7 MON</div>
                <div className="text-sm text-gray-400">Total Distributed</div>
              </div>
              <div className="bg-gray-900/30 border border-purple-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">112.6 MON</div>
                <div className="text-sm text-gray-400">Biggest Win</div>
              </div>
              <div className="bg-gray-900/30 border border-purple-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">10K+</div>
                <div className="text-sm text-gray-400">Total Bets</div>
              </div>
            </div>
          </div>

          {/* How To Play Modal Overlay */}
          <AnimatePresence>
            {showFullGuide && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowFullGuide(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                />
                
                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="absolute top-0 right-0 z-50 bg-gray-800/95 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-2xl overflow-y-auto"
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    maxHeight: '600px'
                  }}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-medium text-purple-400">Quick Start Guide</h3>
                      <button
                        onClick={() => setShowFullGuide(false)}
                        className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <ol className="space-y-4 mb-6">
                      <li className="flex">
                        <div className="flex-shrink-0 w-6 h-6 mr-3 bg-purple-900 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                        <div>
                          <h4 className="font-medium">Mint Your Critter</h4>
                          <p className="text-sm text-gray-400">Each NFT has unique stats that affect your odds</p>
                        </div>
                      </li>
                      <li className="flex">
                        <div className="flex-shrink-0 w-6 h-6 mr-3 bg-purple-900 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                        <div>
                          <h4 className="font-medium">Join a Betting Pool</h4>
                          <p className="text-sm text-gray-400">Enter your Critter in 2-player or 4-player pools</p>
                        </div>
                      </li>
                      <li className="flex">
                        <div className="flex-shrink-0 w-6 h-6 mr-3 bg-purple-900 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                        <div>
                          <h4 className="font-medium">Automatic Results</h4>
                          <p className="text-sm text-gray-400">Your NFT attributes and pyth entropy determines the winners</p>
                        </div>
                      </li>
                      <li className="flex">
                        <div className="flex-shrink-0 w-6 h-6 mr-3 bg-purple-900 rounded-full flex items-center justify-center font-bold text-sm">4</div>
                        <div>
                          <h4 className="font-medium">Collect Winnings</h4>
                          <p className="text-sm text-gray-400">Winners receive MON tokens automatically</p>
                        </div>
                      </li>
                    </ol>

                    {/* Learn More Button */}
                    <button
                      onClick={() => setShowDetailedGuide(!showDetailedGuide)}
                      className="w-full px-4 py-2 bg-purple-900/30 hover:bg-purple-900/50 rounded-lg text-sm font-medium text-purple-300 transition-colors flex items-center justify-center gap-2"
                    >
                      {showDetailedGuide ? 'Show Less' : 'Learn More'}
                      <svg 
                        className={`w-4 h-4 transition-transform ${showDetailedGuide ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Detailed Guide Sections */}
                    <AnimatePresence>
                      {showDetailedGuide && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 space-y-6 border-t border-gray-700/50 pt-6"
                        >
                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Minting Strategy</h3>
                            <p className="text-gray-300 mb-3">Choose your minting approach wisely:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>Flexible minting options:
                                <ul className="ml-4 mt-1 space-y-1">
                                  <li>Mint all 4 at once for quick collection building</li>
                                  <li>Mint one-by-one to analyze each Critter's stats</li>
                                  <li>Mix strategies based on your conviction</li>
                                </ul>
                              </li>
                              <li>Each mint is an independent roll:
                                <ul className="ml-4 mt-1 space-y-1">
                                  <li className="text-gray-300">70% - Common</li>
                                  <li className="text-green-300">20% - Uncommon</li>
                                  <li className="text-blue-300">9% - Rare</li>
                                  <li className="text-yellow-300">1% - Legendary (High Stakes!)</li>
                                </ul>
                              </li>
                              <li>Strategic considerations:
                                <ul className="ml-4 mt-1 space-y-1">
                                  <li>Each mint is a fresh chance at Legendary</li>
                                  <li>Review stats before deciding next mint</li>
                                  <li>No advantage/disadvantage to batch minting</li>
                                </ul>
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Critter Stats Explained</h3>
                            <p className="text-gray-300 mb-3">Each Critter has unique attributes:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li><span className="text-white">Speed:</span> Determines attack power</li>
                              <li><span className="text-white">Stamina:</span> Affects dodging and critical hits</li>
                              <li><span className="text-white">Luck:</span> Improves strategy and counter-attacks</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Boosts</h3>
                            <p className="text-gray-300 mb-3">Boosts are power-ups that enhance your Critter's performance:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>Each boost increases your chance of winning</li>
                              <li>Purchase boosts with MON tokens</li>
                              <li>Use boosts strategically based on your Critter's strengths</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Clash Types</h3>
                            <p className="text-gray-300 mb-3">Different sizes of clashes available:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li><span className="text-white">PvP (2 players):</span> Head-to-head battle, winner takes all</li>
                              <li><span className="text-white">Squad (4 players):</span> Top 2 players get rewards (70%/30% split)</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Leaderboard & Rewards</h3>
                            <p className="text-gray-300 mb-3">Compete for the top spots:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>Earn MON tokens for winning clashes</li>
                              <li>Build your reputation with wins and high scores</li>
                              <li>Track your performance in the Clash History page</li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Betting Mechanics</h3>
                            <p className="text-gray-300 mb-3">Understanding how betting works:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>Entry fees create the prize pool:
                                <ul className="ml-4 mt-1 space-y-1">
                                  <li>2-player pool: Winner takes all (100%)</li>
                                  <li>4-player pool: Split between top 2 (70%/30%)</li>
                                </ul>
                              </li>
                              <li>Rarity affects winning chances:
                                <ul className="ml-4 mt-1 space-y-1">
                                  <li className="text-gray-300">Common: Base stats</li>
                                  <li className="text-green-300">Uncommon: +10% stat boost</li>
                                  <li className="text-blue-300">Rare: +25% stat boost</li>
                                  <li className="text-yellow-300">Legendary: +50% stat boost</li>
                                </ul>
                              </li>
                              <li>Pyth Entropy randomizes outcomes:
                                <ul className="ml-4 mt-1 space-y-1">
                                  <li>Stats determine base score</li>
                                  <li>Entropy adds ±25% random variance</li>
                                  <li>Higher stats increase winning probability</li>
                                </ul>
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Boosting Strategy</h3>
                            <p className="text-gray-300 mb-3">Improve your winning odds with boosts:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>First boost: +20% to your Critter's score</li>
                              <li>Additional boosts: +15% each (stacks multiplicatively)</li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Betting Pools</h3>
                            <p className="text-gray-300 mb-3">Different pool sizes for different strategies:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li><span className="text-white">Head-to-Head (2 players):</span> Winner takes all - higher risk, higher reward</li>
                              <li><span className="text-white">Quad Pool (4 players):</span> Top 2 win prizes - better odds, lower top prize</li>
                            </ul>
                            <p className="text-gray-300 mt-2">Entry fee for all pools: 1 and 2 MON for 2 player and 4 player entry</p>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Rewards & Statistics</h3>
                            <p className="text-gray-300 mb-3">Track your Critter's success:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>All wins are recorded on-chain for transparency</li>
                              <li>Each Critter builds its own win/loss record</li>
                              <li>High-performing Critters may gain additional value</li>
                              <li>Legendary Critters with winning records are extremely valuable</li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-xl font-medium mb-3 text-blue-400">Fair Play Guarantee</h3>
                            <p className="text-gray-300 mb-3">Our platform ensures fair outcomes:</p>
                            <ul className="list-disc pl-6 text-gray-400 space-y-2">
                              <li>Pyth Network's Entropy service provides verifiable randomness</li>
                              <li>All calculations and results are transparent on-chain</li>
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Footer */}
      <Footer />
    </div>
  );
};

export default HomePage; 