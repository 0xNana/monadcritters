import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { formatEther } from 'viem';
import { useNavigate } from 'react-router-dom';
import { useAccount, useBalance } from 'wagmi';
import { useUserClashStats } from '../hooks/useUserClashStats';
import { useClashPoints } from '../contexts/ClashPointsContext';
import ReferralStats from '../components/ReferralStats';
import { CPActionType, CP_POINT_VALUES } from '../contexts/ClashPointsContext';
import SocialConnectCard from '../components/SocialConnectCard';
import AdminExport from '../components/AdminExport';

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { stats, isLoading } = useUserClashStats();
  const { data: balance } = useBalance({ address });
  const { totalPoints, actionsHistory } = useClashPoints();
  
  // Format a number with comma separators
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };
  
  // Calculate social shares count
  const socialSharesCount = actionsHistory.filter(
    action => action.type === CPActionType.SOCIAL_SHARE
  ).length;
  
  // Calculate referrals count
  const referralsCount = actionsHistory.filter(
    action => action.type === CPActionType.REFERRAL
  ).length;

  // Add state for verification controls
  const [verificationAddress, setVerificationAddress] = useState('');
  const [platform, setPlatform] = useState('');
  const [username, setUsername] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Handle verification
  const handleVerification = async () => {
    if (!verificationAddress || !platform || !username) {
      setVerificationError('Please fill in all fields');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      // Add your verification logic here
      // This could involve calling a smart contract function or API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
      
      // Success message or further actions
      console.log('Verification successful');
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
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
                  Your Profile
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

          {/* User Stats Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Clash Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Clash Stats
              </h2>
              
              {isLoading ? (
                <div className="animate-pulse flex flex-col gap-4">
                  <div className="h-6 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-6 bg-gray-700 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-700 rounded w-2/3"></div>
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Clashes:</span>
                    <span className="text-lg font-semibold text-white">{formatNumber(stats.totalClashes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Wins:</span>
                    <span className="text-lg font-semibold text-green-400">{formatNumber(stats.totalWins)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Win Rate:</span>
                    <span className="text-lg font-semibold text-blue-400">{stats.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Score:</span>
                    <span className="text-lg font-semibold text-purple-400">{formatNumber(stats.totalScore)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Rewards:</span>
                    <span className="text-lg font-semibold text-yellow-400">
                      {formatEther(BigInt(stats.totalRewards.toString()))} MON
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No stats available yet. Join your first clash!</p>
              )}
            </motion.div>

            {/* Clash Points Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Clash Points (CP)
              </h2>
              
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Total Points:</span>
                  <span className="text-2xl font-bold text-yellow-400">{formatNumber(totalPoints)} CP</span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2.5 rounded-full"
                    style={{ width: `${Math.min(100, (totalPoints / 1000) * 100)}%` }}
                  ></div>
                </div>
                
                <div className="text-xs text-gray-400 mt-1 text-right">
                  Next milestone: {Math.ceil(totalPoints / 1000) * 1000} CP
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Social Shares:</span>
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-white">{socialSharesCount}</span>
                    <span className="text-xs text-green-400 ml-2">
                      (+{formatNumber(socialSharesCount * CP_POINT_VALUES[CPActionType.SOCIAL_SHARE])} CP)
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Referrals:</span>
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-white">{referralsCount}</span>
                    <span className="text-xs text-green-400 ml-2">
                      (+{formatNumber(referralsCount * CP_POINT_VALUES[CPActionType.REFERRAL])} CP)
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h3 className="text-lg font-semibold mb-2">Earn More Points</h3>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li className="flex justify-between">
                      <span>Share Your Wins:</span>
                      <span className="text-green-400">+{CP_POINT_VALUES[CPActionType.SOCIAL_SHARE]} CP</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Refer a Friend:</span>
                      <span className="text-green-400">+{CP_POINT_VALUES[CPActionType.REFERRAL]} CP</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Account Info & Referral Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
            >
              <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Account Info
              </h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Address:</span>
                  <span className="text-sm font-mono text-white">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Balance:</span>
                  <span className="text-lg font-semibold text-white">
                    {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '0 MON'}
                  </span>
                </div>
              </div>
              
              <ReferralStats />
            </motion.div>

            {/* Social Connect Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
              className="lg:col-span-3"
            >
              <SocialConnectCard />
            </motion.div>
          </div>
          
          {/* Admin Section */}
          {address && isAdmin(address) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
              className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Verification Controls */}
              <motion.div
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50"
              >
                <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  User Verification Controls
                </h2>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-gray-300 text-sm">User Address</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={verificationAddress}
                      onChange={(e) => setVerificationAddress(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-gray-300 text-sm">Platform</label>
                    <select
                      className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                    >
                      <option value="">Select Platform</option>
                      <option value="twitter">Twitter</option>
                      <option value="discord">Discord</option>
                      <option value="github">GitHub</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-gray-300 text-sm">Username</label>
                    <input
                      type="text"
                      placeholder="username"
                      className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleVerification}
                    disabled={isVerifying}
                    className={`w-full py-3 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                      isVerifying
                        ? 'bg-gray-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    }`}
                  >
                    {isVerifying ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Verify User</span>
                      </>
                    )}
                  </motion.button>
                  
                  {verificationError && (
                    <div className="text-red-400 text-sm p-3 bg-red-400/10 rounded-lg">
                      {verificationError}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Admin Export */}
              <AdminExport />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to check if an address is an admin
const isAdmin = (address: string): boolean => {
  // Replace with your actual admin addresses
  const adminAddresses = [
    '', // Replace with actual admin addresses
  ].map(addr => addr.toLowerCase());
  
  return adminAddresses.includes(address.toLowerCase());
};

export default UserProfilePage; 