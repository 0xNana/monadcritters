import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useReadContracts, useReadContract } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useBatchRaceResults } from '../contracts/CritterRace/hooks';
import { RaceSize, RaceInfo, RaceResult } from '../contracts/CritterRace/types';
import { LeaderboardService, LeaderboardFilters } from '../services/LeaderboardService';
import { formatEther } from 'viem';
import { contracts } from '../utils/config';
import { abi as raceContractAbi } from '../contracts/CritterRace/abi';

const TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: 'day', label: 'Today' }
] as const;

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'totalRaces', label: 'Battles' }
] as const;

type ContractRaceInfo = {
  id: bigint;
  raceSize: number;
  players: readonly `0x${string}`[];
  critterIds: readonly bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: bigint;
};

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<LeaderboardFilters['timeRange']>('all');
  const [sortBy, setSortBy] = useState<LeaderboardFilters['sortBy']>('score');
  const [minRaces, setMinRaces] = useState<number>(0);

  // Get current race ID
  const { data: currentRaceId } = useReadContract({
    address: contracts.monad.race as `0x${string}`,
    abi: raceContractAbi,
    functionName: 'currentRaceId'
  });

  // Create array of race IDs to fetch
  const raceIds = React.useMemo(() => {
    if (!currentRaceId) return [];
    const ids: bigint[] = [];
    for (let i = 1n; i <= currentRaceId; i++) {
      ids.push(i);
    }
    return ids;
  }, [currentRaceId]);

  // Fetch all races using batch contract reads
  const { data: races, isLoading: loadingRaces } = useReadContracts({
    contracts: raceIds.map(id => ({
      address: contracts.monad.race as `0x${string}`,
      abi: raceContractAbi,
      functionName: 'getRaceInfo',
      args: [id] as const
    }))
  });

  // Type guard for ContractRaceInfo
  const isContractRaceInfo = (value: unknown): value is ContractRaceInfo => {
    if (!value || typeof value !== 'object') return false;
    const race = value as Partial<ContractRaceInfo>;
    return (
      'id' in race &&
      'raceSize' in race &&
      'players' in race &&
      'critterIds' in race &&
      'startTime' in race &&
      'isActive' in race &&
      'hasEnded' in race &&
      'prizePool' in race
    );
  };

  // Get completed race IDs
  const completedRaceIds = React.useMemo(() => {
    if (!races) return [];
    return races
      .filter(result => 
        result.status === 'success' && 
        result.result !== undefined &&
        isContractRaceInfo(result.result) &&
        result.result.hasEnded
      )
      .map(result => {
        // We can safely assert the type here because we've already checked it in the filter
        const race = result.result as unknown as ContractRaceInfo;
        return race.id;
      });
  }, [races]);

  // Fetch results for completed races
  const { data: raceResults } = useBatchRaceResults(
    completedRaceIds.length > 0 ? completedRaceIds : undefined
  );

  // Convert contract race info to our RaceInfo type
  const convertToRaceInfo = (race: ContractRaceInfo): RaceInfo => ({
      id: race.id,
      raceSize: race.raceSize as RaceSize,
      players: [...race.players],
      critterIds: [...race.critterIds],
      startTime: race.startTime,
      isActive: race.isActive,
      hasEnded: race.hasEnded,
      prizePool: race.prizePool,
      calculatedResults: undefined
  });

  // Process races and their results
  const processedRaces = React.useMemo(() => {
    if (!races || !raceResults) return [];

    return races
      .filter(result => 
        result.status === 'success' && 
        result.result !== undefined &&
        isContractRaceInfo(result.result)
      )
      .map((result) => {
        // We can safely assert the type here because we've already checked it in the filter
        const race = result.result as unknown as ContractRaceInfo;
        const raceIndex = completedRaceIds.findIndex(id => id === race.id);
        return {
          ...convertToRaceInfo(race),
          calculatedResults: race.hasEnded && raceIndex !== -1 ? (raceResults[raceIndex] || []) : []
        };
      });
  }, [races, raceResults, completedRaceIds]);

  const isLoading = loadingRaces;

  // Compute leaderboard with filters
  const leaderboard = React.useMemo(() => {
    if (isLoading) return [];

    const leaderboardService = LeaderboardService.getInstance();
    return leaderboardService.computeLeaderboard(processedRaces, {
      timeRange,
      sortBy: 'score'
    });
  }, [processedRaces, isLoading, timeRange]);

  // Filter leaderboard based on search
  const filteredLeaderboard = React.useMemo(() => {
    if (!searchQuery) return leaderboard;
    return leaderboard.filter(entry => 
      entry.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [leaderboard, searchQuery]);

  // Get user's stats
  const userStats = React.useMemo(() => {
    if (!address) return null;
    return LeaderboardService.getInstance().getPlayerStats(address);
  }, [address, leaderboard]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      <div className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('/racing-grid.png')] opacity-10 animate-pulse"></div>
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
                  Leaderboard
                </span>
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/lobby')}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-purple-500/25"
              >
                Back to Lobby
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />

            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as LeaderboardFilters['timeRange'])}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 focus:outline-none focus:border-purple-500/50"
            >
              {TIME_RANGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </motion.div>

          {/* User Stats Card (if connected) */}
          {userStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-purple-500/10 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20"
            >
              <h2 className="text-xl font-semibold mb-4 text-purple-300">Your Stats</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Rank</div>
                  <div className="text-2xl font-bold text-purple-400">#{userStats.rank}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Score</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {userStats.score.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Total Clashes</div>
                  <div className="text-2xl font-bold text-green-400">
                    {userStats.stats.totalRaces}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Rewards</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {Number(formatEther(userStats.stats.totalRewards)).toFixed(2)} MON
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
                  <tr className="bg-gray-700/30">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rewards
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Clashes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  <AnimatePresence>
                    {filteredLeaderboard.map((entry, index) => (
                      <motion.tr
                        key={entry.address}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`${
                          entry.address.toLowerCase() === address?.toLowerCase()
                            ? 'bg-purple-500/10'
                            : 'hover:bg-gray-700/20'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-300' :
                            index === 1 ? 'bg-gray-400/20 text-gray-300' :
                            index === 2 ? 'bg-amber-600/20 text-amber-400' :
                            'bg-gray-700/20 text-gray-400'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-blue-400 font-medium">
                            {entry.score.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-yellow-400 font-medium">
                            {Number(formatEther(entry.stats.totalRewards)).toFixed(2)} MON
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {entry.stats.totalRaces}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
