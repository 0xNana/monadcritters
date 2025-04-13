import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import CompletedClashCard from '../components/CompletedClashCard';
import PendingResultsCard from '../components/PendingResultsCard';
import { motion, AnimatePresence } from 'framer-motion';
import { ClashDetail, ClashState } from '../contracts/CritterClashCore/types';
import ClashResultsModal from '../components/ClashResultsModal';
import { useClashView } from '../hooks/useClashView';

type TabType = 'pending' | 'completed';

export default function ClashViewPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedClash, setSelectedClash] = useState<ClashDetail | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isCompletingClash, setIsCompletingClash] = useState<string | null>(null);
  const [hasContractUpdateMessage, setHasContractUpdateMessage] = useState(false);

  // Use the updated hook - no need to filter by ClashState.CLASHING since the hook handles that
  const {
    groupedClashes,
    isLoading,
    error,
    refetch
  } = useClashView();

  // Debug logging with more detailed information
  useEffect(() => {
    console.log('ClashViewPage state:', {
      isLoading,
      error: error?.toString(),
      pendingCount: groupedClashes.pendingResults.length,
      completedCount: groupedClashes.completed.length,
      address,
      pendingClashes: groupedClashes.pendingResults.map(item => ({ 
        id: item.id.toString(),
        state: item.clash.state,
        players: item.clash.playerCount,
        startTime: Number(item.clash.startTime),
        playerAddresses: item.clash.players.map(p => p.player)
      })),
      completedClashes: groupedClashes.completed.map(item => ({ 
        id: item.id.toString(), 
        state: item.clash.state,
        isProcessed: item.clash.isProcessed,
        playerAddresses: item.clash.players.map(p => p.player)
      }))
    });

    // Log a warning if we see clashes where the user isn't a participant
    const checkUserParticipation = () => {
      if (!address) return;

      // Check pending clashes
      groupedClashes.pendingResults.forEach(item => {
        const isParticipant = item.clash.players.some(p => 
          p.player && p.player.toLowerCase() === address.toLowerCase()
        );

        if (!isParticipant) {
          console.warn(`Invalid pending clash detected: user ${address} is not participant in clash ${item.id.toString()}`);
        }
      });

      // Check completed clashes
      groupedClashes.completed.forEach(item => {
        const isParticipant = item.clash.players.some(p => 
          p.player && p.player.toLowerCase() === address.toLowerCase()
        );

        if (!isParticipant) {
          console.warn(`Invalid completed clash detected: user ${address} is not participant in clash ${item.id.toString()}`);
        }
      });
    };

    checkUserParticipation();
  }, [groupedClashes, isLoading, error, address]);

  // Show contract update message if:
  // 1. We have an error related to invalid clash IDs, or
  // 2. The user has no clashes but might have had them in a previous contract version
  useEffect(() => {
    const errorString = error?.toString() || '';
    const hasInvalidClashIdError = errorString.includes('Invalid clash ID') || 
      errorString.includes('contract function') || 
      errorString.includes('revert');
    
    if (hasInvalidClashIdError) {
      setHasContractUpdateMessage(true);
      console.warn('Contract update message shown due to error:', errorString);
    }
    
    // Also check console for invalid clash ID errors even if they don't bubble up
    const originalConsoleError = console.error;
    console.error = function(msg, ...args) {
      if (typeof msg === 'string' && (
        msg.includes('Invalid clash ID') || 
        msg.includes('User has no clashes')
      )) {
        setHasContractUpdateMessage(true);
        console.warn('Contract update message shown due to console error:', msg);
      }
      originalConsoleError.apply(console, [msg, ...args]);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
  }, [error]);

  // Helper to get the count for each tab - now with additional logging
  const getCounts = () => {
    const counts = {
      pending: groupedClashes.pendingResults.length,
      completed: groupedClashes.completed.length
    };
    
    console.log('Tab counts:', counts, {
      pendingIds: groupedClashes.pendingResults.map(item => item.id.toString()),
      completedIds: groupedClashes.completed.map(item => item.id.toString())
    });
    return counts;
  };

  const counts = getCounts();

  // Tab configuration
  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending Results', count: counts.pending },
    { id: 'completed', label: 'Completed', count: counts.completed }
  ];

  // Handle refresh with loading state and clear messaging
  const handleRefresh = async () => {
    console.log('Manual refresh requested');
    refetch();
  };

  // Handle completing a clash with better error handling
  const handleCompleteClash = async (clashId: string) => {
    console.log(`Completing clash with ID: ${clashId}`);
    setIsCompletingClash(clashId);
    try {
      // The actual completion logic happens in PendingResultsCard
      // We just need to handle UI state here
      await new Promise(resolve => setTimeout(resolve, 1000));
      refetch(); // Refresh data after completion
    } catch (err) {
      console.error(`Error in complete clash handler for clash ${clashId}:`, err);
    } finally {
      setIsCompletingClash(null);
    }
  };

  // Handle viewing completed clash results
  const handleViewResults = (clash: ClashDetail) => {
    setSelectedClash(clash);
    setShowResultsModal(true);
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-gray-800/50 animate-pulse rounded-xl h-[400px]">
          <div className="h-full flex flex-col p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="w-32 h-6 bg-gray-700/50 rounded mb-2"></div>
                <div className="w-24 h-4 bg-gray-700/50 rounded"></div>
              </div>
              <div className="w-20 h-10 bg-gray-700/50 rounded"></div>
            </div>
            <div className="w-full h-2 bg-gray-700/50 rounded mb-6"></div>
            <div className="flex-grow space-y-4">
              <div className="w-full h-20 bg-gray-700/50 rounded"></div>
              <div className="w-full h-32 bg-gray-700/50 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Empty state component
  const EmptyState = ({ message, type }: { message: string, type: TabType }) => (
    <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center bg-gray-800/30 rounded-xl border border-gray-700/50">
      <div className={`w-16 h-16 mb-4 rounded-full ${type === 'pending' ? 'bg-yellow-500/20' : 'bg-purple-500/20'} flex items-center justify-center`}>
        {type === 'pending' ? (
          <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <h3 className={`text-xl font-semibold ${type === 'pending' ? 'text-yellow-400' : 'text-purple-400'} mb-2`}>
        {type === 'pending' ? 'No Pending Results' : 'No Completed Clashes'}
      </h3>
      <p className="text-gray-500 max-w-sm">{message}</p>
      {type === 'pending' && (
        <button
          onClick={() => window.location.href = '/clash'}
          className="mt-4 px-6 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-all"
        >
          Join a Clash
        </button>
      )}
    </div>
  );

  // Contract Update Message component - to show when the contract has been updated
  const ContractUpdateMessage = () => (
    <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center bg-blue-900/20 rounded-xl border border-blue-700/50">
      <div className="w-16 h-16 mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-blue-400 mb-2">Game Updated!</h3>
      <p className="text-gray-400 max-w-sm mb-4">
        The Monad Critters game has been updated with a new contract. Your previous clashes might not be visible, 
        but don't worry - you can start new clashes right away!
      </p>
      <button
        onClick={() => window.location.href = '/clash'}
        className="mt-2 px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
      >
        Join New Clashes
      </button>
    </div>
  );

  // Error state component
  const ErrorState = () => (
    <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center bg-red-900/20 rounded-xl border border-red-700/50">
      <div className="w-16 h-16 mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-red-400 mb-2">Error Loading Clashes</h3>
      <p className="text-gray-500 max-w-sm">There was an error loading your clashes. Please try refreshing the page.</p>
      <button
        onClick={handleRefresh}
        className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
      >
        Try Again
      </button>
    </div>
  );

  // Show a connection error state if the contract call fails
  const ConnectionErrorState = () => (
    <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center bg-orange-900/20 rounded-xl border border-orange-700/50">
      <div className="w-16 h-16 mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-orange-400 mb-2">Connection Error</h3>
      <p className="text-gray-500 max-w-sm">We encountered a problem connecting to the blockchain. This could happen if the contract was recently updated.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-all"
      >
        Reload Page
      </button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            Clash Results
          </h1>
          <p className="text-gray-400 mt-2">View your pending and completed clash results</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={`px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          {isLoading && (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-8 bg-gray-800/50 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md transition-all duration-200 flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'bg-yellow-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-sm ${
              activeTab === tab.id
                ? 'bg-yellow-600/50'
                : 'bg-gray-700/50'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {hasContractUpdateMessage ? (
          <ContractUpdateMessage />
        ) : error && !error.toString().includes("Invalid clash ID") && !error.toString().includes("contract function") ? (
          <ErrorState />
        ) : isLoading && (!groupedClashes.pendingResults.length && !groupedClashes.completed.length) ? (
          <LoadingSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Pending Results View */}
              {activeTab === 'pending' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedClashes.pendingResults.length > 0 ? (
                    <>
                      {groupedClashes.pendingResults.map(({ id, clash }) => (
                        <motion.div
                          key={id.toString()}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <PendingResultsCard
                            clash={{
                              ...clash,
                              id: id // Ensure ID is correctly passed down
                            }}
                            userAddress={address}
                            onComplete={() => handleCompleteClash(id.toString())}
                            isCompleting={isCompletingClash === id.toString()}
                          />
                        </motion.div>
                      ))}
                    </>
                  ) : (
                    <EmptyState 
                      type="pending"
                      message="You don't have any active clashes in progress. Join a clash to start competing!"
                    />
                  )}
                </div>
              )}

              {/* Completed View */}
              {activeTab === 'completed' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedClashes.completed.length > 0 ? (
                    <>
                      {groupedClashes.completed.map(({ id, clash }) => (
                        <motion.div
                          key={id.toString()}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CompletedClashCard
                            clash={{
                              ...clash,
                              id: id // Ensure ID is correctly passed down
                            }}
                            userAddress={address}
                            onViewResults={() => handleViewResults({
                              ...clash,
                              id: id // Ensure ID is correctly passed to results modal
                            })}
                          />
                        </motion.div>
                      ))}
                    </>
                  ) : (
                    <EmptyState 
                      type="completed"
                      message="You haven't completed any clashes yet. Your clash results will appear here once they're ready!"
                    />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Results Modal */}
      {showResultsModal && selectedClash && (
        <ClashResultsModal
          clash={selectedClash}
          userAddress={address}
          onClose={() => {
            setShowResultsModal(false);
            setSelectedClash(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
