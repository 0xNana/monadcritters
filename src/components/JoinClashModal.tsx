import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { ClashSize } from '../contracts/CritterClashCore/types';
import { toast } from 'react-hot-toast';
import { useBoosts } from '../hooks/useBoosts';
import { useUserCritters } from '../hooks/useUserCritters';
import { motion, AnimatePresence } from 'framer-motion';
import abi from '../contracts/CritterClashCore/abi';
import { CLASH_CONFIG } from '../utils/config';

const contractConfig = {
  address: import.meta.env.VITE_CRITTER_CLASH_CORE_ADDRESS as `0x${string}`,
  abi
};

interface JoinClashModalProps {
  clashSize: ClashSize;
  selectedCritterId: bigint | null;
  onClose: () => void;
  onJoined: () => void;
}

const JoinClashModal: React.FC<JoinClashModalProps> = ({ clashSize, selectedCritterId: initialSelectedCritterId, onClose, onJoined }) => {
  const { address } = useAccount();
  const { boostBalance, refetchBoostBalance, isLoadingBoosts } = useBoosts();
  const { userCritters, isLoading: isCrittersLoading } = useUserCritters();
  const { writeContract } = useWriteContract();
  const [isJoining, setIsJoining] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [selectedCritterId, setSelectedCritterId] = useState<bigint | null>(initialSelectedCritterId);
  const [boostsToUse, setBoostsToUse] = useState(0);
  const [isTransacting, setIsTransacting] = useState(false);
  const [useInventory, setUseInventory] = useState(true);

  // Update selected critter when prop changes
  useEffect(() => {
    setSelectedCritterId(initialSelectedCritterId);
  }, [initialSelectedCritterId]);

  // Handle successful join
  useEffect(() => {
    if (isSuccess) {
      toast.success('Successfully joined clash!');
      // Refresh boost balance after joining
      refetchBoostBalance();
      onJoined();
      onClose();
    }
  }, [isSuccess, onJoined, onClose, refetchBoostBalance]);

  // Fetch boost balance when component mounts and refresh periodically
  useEffect(() => {
    refetchBoostBalance();
    const intervalId = setInterval(() => {
      refetchBoostBalance();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [refetchBoostBalance]);

  // Reset boosts if available boosts changes
  useEffect(() => {
    if (useInventory && boostsToUse > boostBalance) {
      setBoostsToUse(0);
      toast.error(`Boost amount reduced: you only have ${boostBalance} boosts available`);
    }
  }, [boostBalance, boostsToUse, useInventory]);

  // Auto-switch to purchasing if player doesn't have enough boosts
  useEffect(() => {
    if (useInventory && boostsToUse > 0 && boostsToUse > boostBalance) {
      // If player wants to use boosts but doesn't have enough, offer to purchase
      if (boostBalance === 0) {
        toast('You have no boosts. Switched to purchasing mode.');
        setUseInventory(false);
      } else if (boostsToUse > boostBalance) {
        // If they have some but not enough, give them options
        const useAvailable = () => {
          setBoostsToUse(boostBalance);
          toast(`Using your ${boostBalance} available boost${boostBalance !== 1 ? 's' : ''}`);
        };
        
        const switchToPurchase = () => {
          setUseInventory(false);
          toast('Switched to purchasing new boosts');
        };
        
        if (window.confirm(`You only have ${boostBalance} boost${boostBalance !== 1 ? 's' : ''} available. Do you want to use what you have or purchase new ones?\n\nClick OK to use your available boost${boostBalance !== 1 ? 's' : ''}. Click Cancel to purchase new boosts.`)) {
          useAvailable();
        } else {
          switchToPurchase();
        }
      }
    }
  }, [useInventory, boostsToUse, boostBalance]);

  // Calculate entry fee based on clash size using fixed values from config
  const entryFee = parseEther(clashSize === ClashSize.Two 
    ? CLASH_CONFIG.TYPES.TWO_PLAYER.entryFee 
    : CLASH_CONFIG.TYPES.FOUR_PLAYER.entryFee);

  // Calculate prize pool based on clash size using fixed values from config
  const prizePool = parseEther(clashSize === ClashSize.Two 
    ? (parseFloat(CLASH_CONFIG.TYPES.TWO_PLAYER.entryFee) * CLASH_CONFIG.TYPES.TWO_PLAYER.maxPlayers).toString()
    : (parseFloat(CLASH_CONFIG.TYPES.FOUR_PLAYER.entryFee) * CLASH_CONFIG.TYPES.FOUR_PLAYER.maxPlayers).toString());

  // Handle joining the clash
  const handleJoin = async () => {
    if (!address || !selectedCritterId) {
      toast.error('Please select a critter');
      return;
    }

    if (useInventory && boostsToUse > boostBalance) {
      toast.error(`You only have ${boostBalance} boosts available`);
      // Automatically set boosts to use to the maximum available
      setBoostsToUse(boostBalance);
      return;
    }

    if (boostsToUse > 2) {
      toast.error('Maximum 2 boosts per clash');
      setBoostsToUse(2);
      return;
    }

    setIsTransacting(true);
    try {
      // Calculate total cost including boosts if not using inventory
      const boostCost = !useInventory ? (entryFee * BigInt(boostsToUse) / BigInt(20)) : BigInt(0);
      const totalCost = entryFee + boostCost;

      // Join the clash with updated parameters
      await writeContract({
        ...contractConfig,
        functionName: 'joinClash',
        args: [
          clashSize,
          selectedCritterId,
          BigInt(boostsToUse),
          useInventory
        ],
        value: totalCost
      });
      
      setIsSuccess(true);
    } catch (error: any) {
      console.error('Error joining clash:', error);
      let errorMessage = 'Failed to join clash';
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient MON balance';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed: Contract execution reverted';
        } else if (error.message.includes('Insufficient boost inventory')) {
          errorMessage = 'Not enough boosts in your inventory';
          // Set useInventory to false if this is the error
          setUseInventory(false);
          toast('Switched to purchasing new boosts');
        }
      }
      toast.error(errorMessage);
      if (error.message && error.message.includes('user rejected')) {
        onClose(); // Close modal on user rejection
      }
    } finally {
      setIsTransacting(false);
      // Refresh boost balance after transaction attempt
      refetchBoostBalance();
    }
  };
  
  if (isCrittersLoading) {
    return (
      <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md mx-4 text-center">
          <div className="inline-block h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-lg w-full mx-auto my-8 shadow-2xl border border-gray-700 max-h-[90vh] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Join {clashSize === ClashSize.Two ? '2-Player' : '4-Player'} Clash</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isTransacting || isJoining}
            >
              ✕
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {/* Clash Info */}
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <div className="text-gray-400 text-sm">Entry Fee</div>
                  <div className="text-white font-medium">{formatEther(entryFee)} MON</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Max Players</div>
                  <div className="text-white font-medium">{clashSize === ClashSize.Two ? '2' : '4'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Prize Pool</div>
                  <div className="text-white font-medium">{formatEther(prizePool)} MON</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Your Boosts</div>
                  <div className="text-white font-medium">
                    {isLoadingBoosts ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      boostBalance
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Critter Selection */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Select Your Critter</label>
              <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                {userCritters.map((critter) => (
                  <motion.button
                    key={critter.id.toString()}
                    onClick={() => setSelectedCritterId(BigInt(critter.id))}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`p-4 rounded-lg border-2 ${
                      selectedCritterId === BigInt(critter.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-white font-medium">Critter #{critter.id}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-gray-400 text-xs">Speed</p>
                        <div className="flex items-center gap-1">
                          <div className="w-full bg-gray-600 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${(critter.stats.speed / 100) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{critter.stats.speed}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Stamina</p>
                        <div className="flex items-center gap-1">
                          <div className="w-full bg-gray-600 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full"
                              style={{ width: `${(critter.stats.stamina / 100) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{critter.stats.stamina}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Luck</p>
                        <div className="flex items-center gap-1">
                          <div className="w-full bg-gray-600 rounded-full h-1.5">
                            <div
                              className="bg-yellow-500 h-1.5 rounded-full"
                              style={{ width: `${(critter.stats.luck / 100) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{critter.stats.luck}</span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Boost Selection */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-400">Power Boosts (Max 2)</label>
                <span className="text-sm text-gray-400">Available: 
                  {isLoadingBoosts ? (
                    <span className="animate-pulse ml-1">Loading...</span>
                  ) : (
                    <span className="ml-1">{boostBalance}</span>
                  )}
                </span>
              </div>
              <div className="flex space-x-4">
                {[0, 1, 2].map((amount) => (
                  <motion.button
                    key={amount}
                    onClick={() => setBoostsToUse(amount)}
                    disabled={useInventory && amount > boostBalance}
                    whileHover={(useInventory && amount <= boostBalance) || !useInventory ? { scale: 1.05 } : {}}
                    whileTap={(useInventory && amount <= boostBalance) || !useInventory ? { scale: 0.95 } : {}}
                    className={`flex-1 py-2 px-4 rounded-lg ${
                      useInventory && amount > boostBalance
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : boostsToUse === amount
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {amount}
                  </motion.button>
                ))}
              </div>
              {boostsToUse > 0 && (
                <div className="mt-2 text-sm">
                  <span className="text-blue-400">+{boostsToUse * 20}%</span>
                  <span className="text-gray-400"> to final clash score</span>
                </div>
              )}

              {/* Add Boost Source Toggle */}
              {boostsToUse > 0 && (
                <div className="mt-4 p-4 bg-gray-700/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400">Boost Source</label>
                    <button
                      onClick={() => setUseInventory(!useInventory)}
                      className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none"
                      style={{ backgroundColor: useInventory ? '#3B82F6' : '#374151' }}
                    >
                      <span
                        className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${
                          useInventory ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-2 text-sm">
                    {useInventory ? (
                      <span className="text-gray-400">Using {boostsToUse} boost{boostsToUse > 1 ? 's' : ''} from inventory</span>
                    ) : (
                      <span className="text-gray-400">Purchase {boostsToUse} new boost{boostsToUse > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Cost Summary */}
            <div className="mb-6 p-4 bg-gray-700/30 rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-white">Entry Fee:</span>
                <span className="text-sm font-medium text-yellow-400">
                  {formatEther(entryFee)} MON
                </span>
              </div>
              {boostsToUse > 0 && !useInventory && (
                <div className="flex justify-between mt-2">
                  <span className="text-sm font-medium text-white">Boost Cost:</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {formatEther(entryFee * BigInt(boostsToUse) / BigInt(20))} MON
                  </span>
                </div>
              )}
              {!useInventory && boostsToUse > 0 && (
                <div className="flex justify-between mt-2 pt-2 border-t border-gray-600">
                  <span className="text-sm font-medium text-white">Total:</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {formatEther(entryFee + (entryFee * BigInt(boostsToUse) / BigInt(20)))} MON
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Join Button - Fixed at bottom */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleJoin}
              disabled={isTransacting || !selectedCritterId || (useInventory && boostsToUse > boostBalance)}
              className={`w-full py-3 ${
                isTransacting || !selectedCritterId || (useInventory && boostsToUse > boostBalance)
                  ? 'bg-gray-700 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800'
              } text-white rounded-lg font-medium transition-colors`}
            >
              {isTransacting ? 'Joining Clash...' : 'Join Clash'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default JoinClashModal;