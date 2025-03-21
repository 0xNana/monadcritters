import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useWallet } from '../components/WalletProvider';
import { motion, AnimatePresence } from 'framer-motion';

// Introduction steps interface and data
interface IntroStep {
  title: string;
  description: string;
  icon: string;
}

const INTRO_STEPS: IntroStep[] = [
  {
    title: "Welcome to Monad Critters! 🎮",
    description: "Race your unique Critters, compete with others, and earn rewards in real-time on Monad.",
    icon: "🎮"
  },
  {
    title: "Mint Your Unique Critter",
    description: "Each Critter is a unique NFT with special racing attributes. Start by minting your first Critter.",
    icon: "🎨"
  },
  {
    title: "Power Up with Speed Boosts",
    description: "Use Speed Boosts strategically to gain an advantage in races and maximize your winning potential.",
    icon: "⚡"
  },
  {
    title: "Join Exciting Races",
    description: "Choose from different race sizes (2, 5, or 10 players) and compete for bigger prizes.",
    icon: "🏁"
  },
  {
    title: "Race View",
    description: "Start races when your lobby is full, watch the action unfold, and end races to distribute rewards.",
    icon: "🎮"
  },
  {
    title: "Earn in Real-Time",
    description: "Experience thrilling race2win experience. Start, compete, and claim rewards instantly.",
    icon: "💰"
  },
  {
    title: "Track Your Success",
    description: "View your position on the leaderboard and showcase your achievements in the community.",
    icon: "🏆"
  }
];

// Introduction Overlay Component
const IntroductionOverlay: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const { address } = useAccount();
  const { connect } = useWallet();

  const handleGetStarted = () => {
    if (!address) {
      connect();
    }
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-4xl bg-gray-800/90 rounded-2xl overflow-hidden border border-purple-500/20 my-2 sm:my-4"
      >
        {/* Welcome Section with Gradient Background */}
        <div className="relative bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-3 sm:p-6 border-b border-purple-500/20">
          <button
            onClick={onSkip}
            className="absolute top-3 right-3 sm:top-6 sm:right-6 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm bg-gray-800/50 px-3 py-1.5 rounded-md hover:bg-gray-700/50"
          >
            Skip Tutorial
          </button>
          
          <div className="flex items-start gap-3 sm:gap-6 mb-3 sm:mb-6">
            <div className="text-2xl sm:text-4xl mt-0.5 sm:mt-0 flex-shrink-0">🏁</div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 mb-1 sm:mb-2">
                Welcome to Monad Critters!
              </h2>
              <p className="text-gray-300 text-xs sm:text-base">
                Your gateway to competitive race2win Monad network.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-3 text-xs sm:text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <span className="text-purple-400">•</span> Mint
            </span>
            <span className="flex items-center gap-1">
              <span className="text-blue-400">•</span> Compete
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-400">•</span> Earn Rewards
            </span>
          </div>
        </div>

        {/* Steps Section */}
        <div className="p-4 sm:p-8">
          <h3 className="text-base sm:text-lg font-semibold text-gray-300 mb-3 sm:mb-4">How it works:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {INTRO_STEPS.slice(1).map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-700/30 rounded-lg p-3 sm:p-4 border border-gray-600/50 hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="text-xl sm:text-2xl">{step.icon}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-white mb-0.5 sm:mb-1">{step.title}</h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed line-clamp-3">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Login Section */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-700/50">
            <p className="text-gray-300 text-xs sm:text-sm text-center px-4">
              {address ? (
                "You're all set! Click below to start your racing journey."
              ) : (
                "Log in with your wallet to start earning."
              )}
            </p>
            <button
              onClick={handleGetStarted}
              className="flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm sm:text-base font-bold rounded-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
            >
              <span className="text-lg sm:text-xl">🎒</span>
              <span>{address ? "Start Racing" : "Log In"}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { connect, isConnecting } = useWallet();
  const [showIntro, setShowIntro] = useState(false);

  // Check if it's the first visit
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('hasSeenIntro');
    if (!hasSeenIntro) {
      setShowIntro(true);
    }
  }, []);

  const handleIntroComplete = () => {
    localStorage.setItem('hasSeenIntro', 'true');
    setShowIntro(false);
  };

  const handleIntroSkip = () => {
    localStorage.setItem('hasSeenIntro', 'true');
    setShowIntro(false);
  };

  // Simplified navigation handlers
  const handlePrimaryAction = () => {
    if (address) {
      navigate('/mint');
    } else {
      connect();
    }
  };

  const handleViewRaces = () => {
    navigate('/lobby');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      <AnimatePresence>
        {showIntro && (
          <IntroductionOverlay
            onComplete={handleIntroComplete}
            onSkip={handleIntroSkip}
          />
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/racing-grid.png')] opacity-10 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 animate-gradient"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-32 sm:pb-40">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 mb-8 animate-text-shimmer">
              Mint. Race. Win.
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Join the ultimate race to win experience on Monad. 
              Mint your unique Critter, compete in thrilling races, and win massive rewards.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handlePrimaryAction}
                disabled={isConnecting}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : address ? 'Mint Your Critter' : 'Log In to Begin'}
              </button>
              {address && (
                <button
                  onClick={handleViewRaces}
                  className="px-8 py-4 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white font-bold rounded-lg transform hover:scale-105 transition-all duration-200"
                >
                  View Active Races
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Mint Feature */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 transform hover:scale-105 transition-all duration-200">
            <div className="h-12 w-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Mint Unique Critters</h3>
            <p className="text-gray-400">
              Each Critter is a unique NFT with special racing attributes. Build your collection and create the ultimate racing team.
            </p>
          </div>

          {/* Race Feature */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 transform hover:scale-105 transition-all duration-200">
            <div className="h-12 w-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Compete in Races</h3>
            <p className="text-gray-400">
              Join races of different sizes, use power-ups strategically, and showcase your Critter's racing prowess.
            </p>
          </div>

          {/* Win Feature */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 transform hover:scale-105 transition-all duration-200">
            <div className="h-12 w-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Win Rewards</h3>
            <p className="text-gray-400">
              Earn MON tokens, climb the leaderboard, and become a legendary racer in the Monad ecosystem.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">10K+</div>
            <div className="text-gray-400">Critters Minted</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">5K+</div>
            <div className="text-gray-400">Active Racers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">100K</div>
            <div className="text-gray-400">MON Distributed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-400 mb-2">24/7</div>
            <div className="text-gray-400">Racing Action</div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-2xl p-12 text-center backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Join the Race?
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Start your racing journey today. Mint your first Critter and compete for glory on the Monad network.
          </p>
          <button
            onClick={handlePrimaryAction}
            disabled={isConnecting}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : address ? 'Start Racing Now' : 'Log In to Begin'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home; 