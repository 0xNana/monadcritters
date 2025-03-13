import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useAccount();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
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
              Join the ultimate blockchain racing experience on Monad. 
              Mint your unique Critter, compete in thrilling races, and win big rewards!
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/mint')}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
              >
                Mint Your Critter
              </button>
              <button
                onClick={() => navigate('/races')}
                className="px-8 py-4 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white font-bold rounded-lg transform hover:scale-105 transition-all duration-200"
              >
                View Active Races
              </button>
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
            onClick={() => navigate(address ? '/mint' : '/connect')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
          >
            {address ? 'Start Racing Now' : 'Connect Wallet to Begin'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home; 