import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useClashLeaderboard } from '../hooks/useClashLeaderboard';
import { formatAddress, formatWeiToMON } from '../utils/formatters';

const TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: 'day', label: 'Today' }
] as const;

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
] as const;

const ClashLeaderboardPage = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const [searchAddress, setSearchAddress] = useState('');
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week' | 'day'>('all');
  const [sortBy, setSortBy] = useState<'score'>('score');

  const { leaderboard, userRank, isLoading, refetch } = useClashLeaderboard();

  // Debug logs
  console.log('Debug: Leaderboard Raw Data', { 
    leaderboardLength: leaderboard.length,
    isLoading,
    userRank,
    sampleEntries: leaderboard.slice(0, 3)
  });

  // Filter leaderboard based on search
  const filteredLeaderboard = React.useMemo(() => {
    // If no search is active, show all entries
    if (!searchAddress) {
      return leaderboard;
    }

    // Only filter if there's an active search
    const filtered = leaderboard.filter(entry => 
      entry.address.toLowerCase().includes(searchAddress.toLowerCase())
    );
    
    return filtered;
  }, [leaderboard, searchAddress]);

  // Safe rendering helpers
  const formatScore = (score: bigint | undefined) => {
    if (!score) return '0';
    return Number(score).toLocaleString();
  };

  const formatBigIntToString = (value: bigint | undefined) => {
    if (!value) return '0';
    return value.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      <div className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/clash-grid.png')] opacity-10 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 animate-gradient"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex justify-between items-center">
              <h1 className="text-4xl sm:text-5xl font-bold">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                  Clash Leaderboard
                </span>
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/clashes')}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-purple-500/25"
              >
                Back to Clashes
              </motion.button>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Search */}
            <input
              type="text"
              placeholder="Search by wallet address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 focus:outline-none focus:border-purple-500/50"
            >
              {TIME_RANGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </motion.div>

          {/* User Stats Card (if connected) */}
          {address && userRank && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-purple-500/10 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20"
            >
              <h2 className="text-xl font-semibold mb-4 text-purple-300">Your Stats</h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Rank</div>
                  <div className="text-2xl font-bold text-purple-400">#{userRank}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Total Score</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {formatScore(leaderboard.find(entry => entry.address === address)?.score)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Win Rate</div>
                  <div className="text-2xl font-bold text-white">
                    {formatBigIntToString(leaderboard.find(entry => entry.address === address)?.wins)}/
                    {formatBigIntToString(leaderboard.find(entry => entry.address === address)?.clashCount)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Total Rewards</div>
                  <div className="text-2xl font-bold text-yellow-500">
                    {formatWeiToMON(leaderboard.find(entry => entry.address === address)?.rewards || 0n)} MON
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Leaderboard Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">RANK</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">PLAYER</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">SCORE</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">REWARDS</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">CLASHES</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400">
                        No entries found
                      </td>
                    </tr>
                  ) : (
                    filteredLeaderboard.map((entry, index) => (
                      <tr 
                        key={entry.address}
                        className={`border-t border-gray-700 ${entry.address === address ? 'bg-purple-900/20' : 'hover:bg-gray-700/50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className={`
                            inline-flex items-center justify-center w-8 h-8 rounded-full
                            ${index === 0 ? 'bg-yellow-500' : 
                              index === 1 ? 'bg-gray-400' :
                              index === 2 ? 'bg-amber-700' : 'bg-gray-700'}
                            text-white font-bold
                          `}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-white">
                          {formatAddress(entry.address)}
                        </td>
                        <td className="px-6 py-4 text-blue-400">
                          {formatScore(entry.score)}
                        </td>
                        <td className="px-6 py-4 text-yellow-500">
                          {formatWeiToMON(entry.rewards)} MON
                        </td>
                        <td className="px-6 py-4 text-white">
                          {formatBigIntToString(entry.clashCount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ClashLeaderboardPage; 