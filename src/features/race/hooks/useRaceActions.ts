import { useState } from 'react';
import { useRaceContract } from './useRaceState';
import { RaceSize } from '../../../contracts/CritterRace/types';
import { contracts } from '../../../utils/config';
import { parseEther } from 'viem';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';

export const useRaceActions = () => {
  const { contract, wrapWithErrorHandler } = useRaceContract();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [processing, setProcessing] = useState(false);

  const createRace = async (size: RaceSize) => {
    if (!walletClient) throw new Error('Wallet not connected');

    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'createRace',
        args: [size]
      }),
      'Creating new race...'
    );
  };

  const joinRace = async (
    raceId: number,
    raceSize: RaceSize,
    critterId: number,
    boostAmount: number = 0
  ) => {
    if (!walletClient || !publicClient) throw new Error('Wallet not connected');

    // Get race type info to determine entry fee
    const raceTypeInfo = await publicClient.readContract({
      ...contract,
      functionName: 'getRaceTypeInfo',
      args: [raceSize]
    }) as { entryFee: bigint };

    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'joinRace',
        args: [BigInt(raceId), BigInt(Number(raceSize)), BigInt(critterId), BigInt(boostAmount)],
        value: raceTypeInfo.entryFee
      }),
      'Joining race...'
    );
  };

  const startRace = async (raceId: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    setProcessing(true);
    try {
      await wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'startRaceExternal',
          args: [BigInt(raceId)]
        }),
        'Starting race...'
      );
    } finally {
      setProcessing(false);
    }
  };

  const endRace = async (raceId: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    setProcessing(true);
    try {
      await wrapWithErrorHandler(
        walletClient.writeContract({
          ...contract,
          functionName: 'endRace',
          args: [BigInt(raceId)]
        }),
        'Processing race results...'
      );
    } finally {
      setProcessing(false);
    }
  };

  const buyPowerUps = async (amount: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    const cost = parseEther('0.01') * BigInt(amount); // Assuming 0.01 ETH per power-up
    return wrapWithErrorHandler(
      walletClient.writeContract({
        ...contract,
        functionName: 'buyPowerUps',
        args: [BigInt(amount)],
        value: cost
      }),
      'Purchasing power-ups...'
    );
  };

  return {
    createRace,
    joinRace,
    startRace,
    endRace,
    buyPowerUps,
    processing
  };
}; 