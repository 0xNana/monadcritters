import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { contracts } from '../../../utils/config';
import { abi as RACE_ABI } from '../../../contracts/CritterRace/abi';
import { useChainId } from 'wagmi';

// Get contract address
function useContractAddress() {
  return contracts.monad.race;
}

export const usePowerUps = () => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [speedBoosts, setSpeedBoosts] = useState(0);
  const [loading, setLoading] = useState(true);

  const contract = {
    address: useContractAddress() as `0x${string}`,
    abi: RACE_ABI,
  };

  const fetchPowerUps = async () => {
    if (!address || !publicClient) return;
    try {
      setLoading(true);
      const boosts = await publicClient.readContract({
        ...contract,
        functionName: 'playerInventory_SpeedBoost',
        args: [address]
      });
      setSpeedBoosts(Number(boosts));
    } catch (error) {
      console.error('Error fetching power-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const buyPowerUps = async (amount: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    const cost = parseEther('0.01') * BigInt(amount); // Assuming 0.01 ETH per power-up
    try {
      const tx = await walletClient.writeContract({
        ...contract,
        functionName: 'buyPowerUps',
        args: [BigInt(amount)],
        value: cost
      });
      await fetchPowerUps(); // Refresh power-ups after purchase
      return tx;
    } catch (error) {
      console.error('Error buying power-ups:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchPowerUps();

    if (!publicClient || !address) return;

    // Watch for power-up purchase events
    const unwatch = publicClient.watchContractEvent({
      ...contract,
      eventName: 'PowerUpsPurchased',
      args: { player: address },
      onLogs: fetchPowerUps
    });
    
    return () => {
      unwatch();
    };
  }, [address, publicClient]);

  return {
    speedBoosts,
    loading,
    buyPowerUps,
    refreshPowerUps: fetchPowerUps
  };
};
