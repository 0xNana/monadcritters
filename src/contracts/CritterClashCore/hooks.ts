import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { abi } from './abi';
import { ClashInfo, ClashDetails, ClashResult, ClashSize, ClashState, ClashTypeInfo } from './types';

const contractConfig = {
  address: import.meta.env.VITE_CRITTER_CLASH_CORE_ADDRESS as `0x${string}`,
  abi
};

export const useCritterClashCore = () => {
  const publicClient = usePublicClient();
  const { writeContract } = useWriteContract();

  if (!publicClient) {
    throw new Error('Public client not initialized');
  }

  const getClashInfo = async (clashId: number): Promise<ClashInfo> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getClashInfo',
      args: [BigInt(clashId)]
    });

    // Cast result to the expected structure
    const [clashSize, state, playerCount, startTime, isProcessed, players, critterIds, boosts, scores, results] = result as [
      number, number, bigint, bigint, boolean, `0x${string}`[], bigint[], bigint[], bigint[], any[]
    ];

    return {
      id: BigInt(clashId),
      clashSize: clashSize as ClashSize,
      state: state as ClashState,
      playerCount: Number(playerCount),
      startTime,
      isProcessed,
      players,
      critterIds,
      boosts,
      scores,
      results
    };
  };

  const getClashDetails = async (clashId: number): Promise<ClashDetails> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getClashDetails',
      args: [BigInt(clashId)]
    });

    // Cast result to the expected structure
    const [id, clashSize, state, playerCount, startTime, isProcessed] = result as [
      bigint, number, number, bigint, bigint, boolean
    ];

    return {
      id,
      clashSize: clashSize as ClashSize,
      state: state as ClashState,
      playerCount: Number(playerCount),
      startTime,
      isProcessed
    };
  };

  const getClashResults = async (clashId: number): Promise<ClashResult[]> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getClashResults',
      args: [BigInt(clashId)]
    });

    return result as ClashResult[];
  };

  const getClashTypeInfo = async (clashSize: ClashSize): Promise<ClashTypeInfo> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getClashTypeInfo',
      args: [clashSize]
    });

    // Cast result to the expected structure
    const [entryFee, boostFeePercent, rewardPercentages, maxPlayers, numWinners, isActive] = result as [
      bigint, bigint, bigint[], bigint, bigint, boolean
    ];

    return {
      entryFee,
      boostFeePercent,
      rewardPercentages,
      maxPlayers: Number(maxPlayers),
      numWinners: Number(numWinners),
      isActive
    };
  };

  const getUserClashIds = async (user: string): Promise<bigint[]> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'getUserClashIds',
      args: [user as `0x${string}`]
    });

    return result as bigint[];
  };

  const getPlayerBoosts = async (address: string): Promise<bigint> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'playerBoosts',
      args: [address as `0x${string}`]
    });

    return result as bigint;
  };

  const getClashDuration = async (): Promise<bigint> => {
    const result = await publicClient.readContract({
      ...contractConfig,
      functionName: 'clashDuration'
    });

    return result as bigint;
  };

  // Write functions
  const joinClash = async (params: {
    clashSize: ClashSize;
    critterId: number;
    boostCount: number;
    useInventory: boolean;
    value?: bigint; // For the entry fee payment
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: 'joinClash',
      args: [
        params.clashSize,
        BigInt(params.critterId),
        BigInt(params.boostCount),
        params.useInventory
      ],
      value: params.value
    });
  };

  const completeClash = async (clashId: number) => {
    return writeContract({
      ...contractConfig,
      functionName: 'completeClash',
      args: [BigInt(clashId)]
    });
  };

  const purchaseBoosts = async (amount: number, value: bigint) => {
    return writeContract({
      ...contractConfig,
      functionName: 'purchaseBoosts',
      args: [BigInt(amount)],
      value
    });
  };

  return {
    // Read functions
    getClashInfo,
    getClashDetails,
    getClashResults,
    getClashTypeInfo,
    getUserClashIds,
    getPlayerBoosts,
    getClashDuration,
    
    // Write functions
    joinClash,
    completeClash,
    purchaseBoosts
  };
}; 