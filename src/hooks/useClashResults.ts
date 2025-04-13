import { useEffect, useState } from 'react';
import { useContractRead, usePublicClient, useWatchContractEvent } from 'wagmi';
import { CRITTER_CLASH_CORE_ADDRESS, CRITTER_CLASH_CORE_ABI } from '../constants/contracts';
import { ClashDetail, ClashState, ClashResult } from '../contracts/CritterClashCore/types';

type ClashDataTuple = [
  number, // clashSize
  number, // state
  bigint, // playerCount
  bigint, // startTime
  boolean, // isProcessed
  `0x${string}`[], // players
  bigint[], // critterIds
  bigint[], // boosts
  bigint[], // scores
  bigint[] // results - this is actually an array of uint256, not ClashResult objects
];

type ProcessedPlayer = {
  player: `0x${string}`;
  critterId: bigint;
  score: bigint;
  boost: bigint;
};

// Helper function to calculate total prize pool
const calculateTotalPrize = (maxPlayers: number, playerCount: number): bigint => {
  const entryFee = maxPlayers === 2 
    ? BigInt('1000000000000000000') // 1 MON for 2 player clash
    : BigInt('2000000000000000000'); // 2 MON for 4 player clash
  return entryFee * BigInt(playerCount);
};

// Helper function to calculate rewards
const calculateReward = (position: number, playerCount: number, maxPlayers: number): bigint => {
  const totalPrize = calculateTotalPrize(maxPlayers, playerCount);
  
  if (maxPlayers === 2) {
    // 2-player: Winner takes all (2 MON total)
    return position === 0 ? totalPrize : BigInt(0);
  } else {
    // 4-player: Top 2 split 70/30 (8 MON total)
    if (position === 0) return (totalPrize * BigInt(70)) / BigInt(100); // 5.6 MON
    if (position === 1) return (totalPrize * BigInt(30)) / BigInt(100); // 2.4 MON
    return BigInt(0);
  }
};

export const useClashResults = (clashId: bigint) => {
  const [clashInfo, setClashInfo] = useState<ClashDetail | null>(null);

  // Get clash info - this includes all necessary data including sorted scores and results
  const { data: clashData, refetch: refetchClashInfo } = useContractRead({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'getClashInfo',
    args: [clashId],
  });

  // Watch for clash state updates
  useWatchContractEvent({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    eventName: 'ClashUpdate',
    onLogs() {
      refetchClashInfo();
    },
  });

  // Transform contract data into ClashDetail
  useEffect(() => {
    if (!clashData) return;

    try {
      // Extract data from tuple and ensure all array values are actually arrays
      const [
        clashSize,
        state,
        playerCount,
        startTime,
        isProcessed,
        players,
        critterIds,
        boosts,
        scores,
        results
      ] = clashData as unknown as ClashDataTuple;
      
      // Validate and process arrays
      const validPlayers = Array.isArray(players) ? players : [];
      const validCritterIds = Array.isArray(critterIds) ? critterIds : [];
      const validBoosts = Array.isArray(boosts) ? boosts : [];
      const validScores = Array.isArray(scores) ? scores : [];
      const validResults = Array.isArray(results) ? results : [];

      // Process players with their associated data
      const processedPlayers: ProcessedPlayer[] = validPlayers.map((player, index) => ({
        player,
        critterId: validCritterIds[index] || BigInt(0),
        score: validScores[index] || BigInt(0),
        boost: validBoosts[index] || BigInt(0)
      }));

      // Process results if available
      let processedResults: ClashResult[] = [];
      
      if (state === ClashState.COMPLETED_WITH_RESULTS && validResults.length > 0) {
        // Process raw results array (5 elements per result)
        const resultsPerPlayer = 5;
        for (let i = 0; i < validResults.length; i += resultsPerPlayer) {
          if (i + resultsPerPlayer <= validResults.length) {
            const playerIndex = Number(validResults[i]);
            const player = playerIndex < validPlayers.length ? validPlayers[playerIndex] : "0x0" as `0x${string}`;
            const position = Number(validResults[i + 2]);
            
            processedResults.push({
              player,
              critterId: validResults[i + 1],
              position,
              reward: validResults[i + 3] || calculateReward(position - 1, Number(playerCount), clashSize === 1 ? 2 : 4),
              score: Number(validResults[i + 4])
            });
          }
        }
      } else if (state === ClashState.COMPLETED_WITH_RESULTS) {
        // Create results from scores if no explicit results available
        processedResults = processedPlayers
          .map((player, index) => ({
            player: player.player,
            critterId: player.critterId,
            position: index + 1,
            reward: calculateReward(index, Number(playerCount), clashSize === 1 ? 2 : 4),
            score: Number(player.score)
          }))
          .sort((a, b) => b.score - a.score);
      }

      // Create ClashDetail object
      const clashDetail: ClashDetail = {
        id: clashId,
        clashSize,
        state,
        playerCount: Number(playerCount),
        startTime,
        maxPlayers: clashSize === 1 ? 2 : 4,
        totalPrize: calculateTotalPrize(clashSize === 1 ? 2 : 4, Number(playerCount)),
        players: processedPlayers,
        results: processedResults,
        isProcessed: state === ClashState.COMPLETED_WITH_RESULTS,
        status: state === ClashState.COMPLETED_WITH_RESULTS ? 'Completed' : 'Active',
        hasEnded: state === ClashState.COMPLETED_WITH_RESULTS
      };

      setClashInfo(clashDetail);
    } catch (error) {
      console.error('Error processing clash data:', error);
    }
  }, [clashData, clashId]);

  return {
    clashInfo,
    isLoading: !clashData,
    refetch: refetchClashInfo
  };
};

// Hook to monitor multiple clashes for results
export const useMultipleClashResults = (clashIds: bigint[]) => {
  const [pendingClashes, setPendingClashes] = useState<ClashDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get clash info for each clash ID
  const { data: multiClashData, refetch: refetchMultiClash } = useContractRead({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    functionName: 'getClashInfo',
    args: clashIds.length > 0 ? [clashIds[0]] : undefined,
  });

  // Watch for clash updates
  useWatchContractEvent({
    address: CRITTER_CLASH_CORE_ADDRESS,
    abi: CRITTER_CLASH_CORE_ABI,
    eventName: 'ClashUpdate',
    onLogs() {
      refetchMultiClash();
    },
  });

  // Process multiple clash data
  useEffect(() => {
    if (!multiClashData || clashIds.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      // Extract data and ensure all array values are actually arrays
      let [
        clashSize,
        state,
        playerCount,
        startTime,
        isProcessed,
        players,
        critterIds,
        boosts,
        scores,
        results
      ] = multiClashData as unknown as ClashDataTuple;
      
      // Safety checks for array values
      players = Array.isArray(players) ? players : [];
      critterIds = Array.isArray(critterIds) ? critterIds : [];
      boosts = Array.isArray(boosts) ? boosts : [];
      scores = Array.isArray(scores) ? scores : [];
      results = Array.isArray(results) ? results : [];

      // Only process completed clashes
      if (state === ClashState.COMPLETED_WITH_RESULTS) {
        // Use the same logic as single clash processing
        let mappedPlayers = [] as any[];
        
        if (Array.isArray(players)) {
          mappedPlayers = players.map((player, index) => {
            const score = Array.isArray(scores) && index < scores.length ? 
              scores[index] : BigInt(0);
            const critterId = Array.isArray(critterIds) && index < critterIds.length ? 
              critterIds[index] : BigInt(0);
            const boost = Array.isArray(boosts) && index < boosts.length ? 
              boosts[index] : BigInt(0);
              
            return {
              player,
              critterId,
              score,
              boost
            };
          });
        }

        if (results.length > 0) {
          // Process raw results array from contract (same as in main hook)
          // The contract returns results as a flattened array of bigints
          const rawResults = results;
          const structuredResults: ClashResult[] = [];
          
          // Each result is 5 elements in the array
          const resultsPerPlayer = 5;
          
          // Process the results in chunks of 5
          for (let i = 0; i < rawResults.length; i += resultsPerPlayer) {
            if (i + resultsPerPlayer <= rawResults.length) {
              // Find the player address from the player index
              const playerIndex = Number(rawResults[i]); // First value is player index
              const player = playerIndex < players.length ? players[playerIndex] : "0x0" as `0x${string}`;
              
              // Extract the other values and ensure correct types
              const critterId = rawResults[i+1]; // Second value is critterId as BigInt
              const position = Number(rawResults[i+2]); // Third value needs to be number for ClashResult
              const reward = rawResults[i+3]; // Fourth value is reward as BigInt
              const score = Number(rawResults[i+4]); // Fifth value needs to be number for ClashResult
              
              // Create a ClashResult object with proper types
              structuredResults.push({
                player: player,
                critterId: critterId,
                position: position,
                reward: reward,
                score: score
              });
            }
          }
          
          // Use structured results to create mappedPlayers
          mappedPlayers = structuredResults.map(result => ({
            player: result.player,
            critterId: result.critterId,
            score: BigInt(result.score),
            boost: Array.isArray(boosts) && players.findIndex(p => p === result.player) >= 0 ? 
                  boosts[players.findIndex(p => p === result.player)] : 
                  BigInt(0)
          }));
          
          // Create the clash detail with the structured results
          const clash: ClashDetail = {
            id: clashIds[0],
            clashSize,
            state,
            playerCount: Number(playerCount),
            startTime,
            maxPlayers: clashSize === 1 ? 2 : 4,
            // Ensure totalPrize is always a BigInt
            totalPrize: structuredResults[0]?.reward ? 
                       BigInt(structuredResults[0].reward.toString()) : 
                       BigInt(0),
            players: mappedPlayers,
            results: structuredResults,
            isProcessed: true,
            status: 'Completed',
            hasEnded: true
          } as ClashDetail; // Type assertion to avoid type issues
          
          setPendingClashes([clash]);
          setIsLoading(false);
          return;
        }

        const clash: ClashDetail = {
          id: clashIds[0],
          clashSize,
          state,
          playerCount: Number(playerCount),
          startTime,
          maxPlayers: clashSize === 1 ? 2 : 4,
          totalPrize: BigInt(0), // No results available, set to 0
          players: mappedPlayers,
          results: [], // No results available
          isProcessed: true,
          status: 'Completed',
          hasEnded: true
        } as ClashDetail; // Type assertion

        setPendingClashes([clash]);
      } else {
        setPendingClashes([]);
      }
    } catch (error) {
      console.error('Error processing multi-clash data:', error);
    }

    setIsLoading(false);
  }, [multiClashData, clashIds]);

  return {
    pendingClashes,
    isLoading,
    refetch: refetchMultiClash
  };
}; 