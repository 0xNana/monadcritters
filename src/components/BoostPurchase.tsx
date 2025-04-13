import React, { useState, useEffect, useCallback } from 'react';
import { useBoosts } from '../hooks/useBoosts';
import { motion } from 'framer-motion';
import { CLASH_CONFIG } from '../utils/config';

export const BoostPurchase = () => {
  const [amount, setAmount] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { boostBalance, purchaseBoosts, isLoadingBoosts, refetchBoostBalance } = useBoosts();
  
  // Debug logging - only in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('BoostPurchase component state:', {
        boostBalance,
        isLoadingBoosts,
        amount
      });
    }
  }, [boostBalance, isLoadingBoosts, amount]);

  // Refresh boost balance when component mounts - only once
  useEffect(() => {
    refetchBoostBalance();
  }, [refetchBoostBalance]);

  // Contract limits to 10 boosts per purchase
  const handleIncrement = () => setAmount(prev => Math.min(prev + 1, 10));
  const handleDecrement = () => setAmount(prev => Math.max(prev - 1, 1));

  // Calculate cost based on values from CLASH_CONFIG
  const TWO_PLAYER_ENTRY_FEE = parseFloat(CLASH_CONFIG.TYPES.TWO_PLAYER.entryFee);
  const POWER_UP_PERCENT = CLASH_CONFIG.FEES.POWER_UP_PERCENT;
  const pricePerBoost = (TWO_PLAYER_ENTRY_FEE * POWER_UP_PERCENT) / 100;
  const totalCost = pricePerBoost * amount;

  // Handle purchase with loading state and debounce
  const handlePurchase = useCallback(async () => {
    if (isPurchasing) return;
    
    setIsPurchasing(true);
    try {
      await purchaseBoosts(amount);
      // No need to manually refetch here as the hook handles it
    } finally {
      setIsPurchasing(false);
    }
  }, [amount, purchaseBoosts, isPurchasing]);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={handleDecrement}
          disabled={isPurchasing}
          className="w-10 h-10 flex items-center justify-center bg-purple-900/50 hover:bg-purple-800/50 rounded-lg text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        <input
          type="number"
          value={amount}
          disabled={isPurchasing}
          onChange={(e) => setAmount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
          className="w-20 bg-purple-900/30 text-center rounded-lg py-2 disabled:opacity-50"
        />
        <button 
          onClick={handleIncrement}
          disabled={isPurchasing}
          className="w-10 h-10 flex items-center justify-center bg-purple-900/50 hover:bg-purple-800/50 rounded-lg text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      <div className="space-y-1 mb-4">
        <div className="text-gray-300">
          Total Cost: <span className="text-purple-400 font-bold">{totalCost.toFixed(3)} MON</span>
        </div>
        <div className="text-gray-400 text-sm">
          You currently have: 
          <span className="text-purple-400 font-bold ml-1">
            {isLoadingBoosts ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              boostBalance
            )}
          </span> boosts
        </div>
        <div className="text-gray-400 text-xs">
          Boost increases your clash score up to 35%
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handlePurchase}
        className={`w-full py-2 px-4 bg-gradient-to-r ${
          isPurchasing || isLoadingBoosts
            ? 'from-purple-700/50 to-purple-900/50 cursor-not-allowed'
            : 'from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700'
        } rounded-lg font-semibold transition-colors`}
        disabled={isPurchasing || isLoadingBoosts}
      >
        {isPurchasing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Purchasing...
          </span>
        ) : isLoadingBoosts ? (
          'Loading...'
        ) : (
          'Purchase Boosts'
        )}
      </motion.button>
    </div>
  );
}; 