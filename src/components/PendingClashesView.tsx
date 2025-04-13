import React from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCritterClashCore } from '../contracts/CritterClashCore/hooks';
import PendingResultsCard from './PendingResultsCard';
import { ClashState } from '../contracts/CritterClashCore/types';

const PendingClashesView: React.FC = () => {
  const { address } = useAccount();
  const { getClashInfo } = useCritterClashCore();
  const [userClashes, setUserClashes] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUserClashes = async () => {
      if (!address) return;
      setIsLoading(true);
      try {
        // TODO: Implement fetching user clashes
        // This will need to be implemented based on how clashes are stored/retrieved
        setUserClashes([]);
      } catch (error) {
        console.error('Error fetching user clashes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserClashes();
  }, [address, getClashInfo]);

  // Filter clashes that need completion
  const pendingClashes = React.useMemo(() => {
    if (!userClashes) return [];
    
    return userClashes.filter(clash => 
      // Filter clashes that:
      // 1. Are not in COMPLETED_WITH_RESULTS state
      // 2. Have all players joined
      // 3. Are not processed yet
      clash.state !== ClashState.COMPLETED_WITH_RESULTS &&
      clash.playerCount === clash.maxPlayers &&
      !clash.isProcessed
    ).sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0)); // Sort by most recent first
  }, [userClashes]);

  const refetch = React.useCallback(() => {
    // TODO: Implement refetch logic
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!pendingClashes || pendingClashes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No pending clashes found
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
          Pending Clashes
        </h2>
        <button
          onClick={refetch}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>
      
      <AnimatePresence>
        {pendingClashes.map(clash => (
          <PendingResultsCard
            key={clash.id.toString()}
            clash={clash}
            userAddress={address}
            onComplete={refetch}
            isCompleting={false}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default PendingClashesView; 