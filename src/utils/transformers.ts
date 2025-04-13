import { ClashDetail, ClashSize, ClashState } from '../contracts/CritterClashCore/types';
import { parseEther } from 'ethers';

// Entry fees for different clash sizes (in MON)
const ENTRY_FEES = {
  [ClashSize.None]: parseEther('0'),
  [ClashSize.Two]: parseEther('0.1'),
  [ClashSize.Four]: parseEther('0.1')
};

// Helper to check if clash is fully completed
const isClashFullyCompleted = (state: ClashState): boolean => {
  return state === ClashState.COMPLETED_WITH_RESULTS;
};

/**
 * Transform raw clash data from contract into ClashDetail type
 */
export const transformClashData = (
  clashId: bigint,
  data: any
): ClashDetail | null => {
  // If data is undefined or clashId is 0, return null
  if (!data || clashId === BigInt(0)) {
    console.log('No clash data available or invalid clash ID:', {
      clashId: clashId.toString(),
      data
    });
    return null;
  }

  try {
    console.log('Original data structure:', data);
    
    // Handle different response structures from contract
    let clashSize, state, playerCount, startTime, isProcessed, players, critterIds, boosts, scores, results;
    
    if (Array.isArray(data)) {
      // Unpack the data array returned by the contract
      if (data.length >= 1) clashSize = data[0];
      if (data.length >= 2) state = data[1];
      if (data.length >= 3) playerCount = data[2];
      if (data.length >= 4) startTime = data[3];
      if (data.length >= 5) isProcessed = data[4];
      if (data.length >= 6) players = data[5];
      if (data.length >= 7) critterIds = data[6];
      if (data.length >= 8) boosts = data[7];
      if (data.length >= 9) scores = data[8];
      if (data.length >= 10) results = data[9];
    } else if (typeof data === 'object' && 'clashSize' in data) {
      // Fallback - if response is already an object
      ({ clashSize, state, playerCount, startTime, isProcessed, players, critterIds, boosts, scores, results } = data);
    } else {
      console.error('Unrecognized data format:', data);
      return null;
    }
    
    // Debug logging for raw data
    console.log('Raw clash data from contract:', {
      clashId: clashId.toString(),
      clashSize,
      state,
      playerCount: playerCount?.toString(),
      players,
      critterIds,
      boosts,
      scores,
      results: results?.length,
      isProcessed
    });

    // Validate clash size
    if (clashSize !== ClashSize.Two && clashSize !== ClashSize.Four) {
      console.error('Invalid clash size:', clashSize);
      return null;
    }

    // Convert clash size to maxPlayers
    const maxPlayers = clashSize === ClashSize.Four ? 4 : 2;
    
    // Ensure arrays are initialized to prevent errors
    if (!players || !Array.isArray(players)) {
      players = [];
      console.log('No player data received from contract');
    }
    
    if (!critterIds || !Array.isArray(critterIds)) {
      critterIds = [];
      console.log('No critter IDs received from contract');
    }
    
    if (!boosts || !Array.isArray(boosts)) {
      boosts = [];
      console.log('No boost data received from contract');
    }

    // Ensure playerCount is a number
    const actualPlayerCount = typeof playerCount === 'bigint' ? Number(playerCount) : 
                           (typeof playerCount === 'number' ? playerCount : 0);

    // Create player objects directly from the contract data
    const playerObjects: {
      player: `0x${string}`;
      critterId: bigint;
      score: bigint;
      boost: bigint;
    }[] = [];
    
    for (let i = 0; i < actualPlayerCount; i++) {
      const playerAddress = i < players.length ? players[i] : `0x${'0'.repeat(40)}`;
      const critterId = i < critterIds.length ? BigInt(critterIds[i].toString()) : BigInt(0);
      const boost = i < boosts.length ? BigInt(boosts[i].toString()) : BigInt(0);
      const score = i < scores?.length ? BigInt(scores[i].toString()) : BigInt(0);
      
      playerObjects.push({
        player: playerAddress as `0x${string}`,
        critterId,
        score,
        boost
      });
    }

    // Log the player objects for debugging
    console.log('Player objects created from contract data:', playerObjects);

    // Get entry fee based on clash size
    const entryFee = maxPlayers === 2 
      ? ENTRY_FEES[ClashSize.Two] 
      : ENTRY_FEES[ClashSize.Four];
    
    // Calculate total prize based on max players and entry fee
    const totalPrize = entryFee * BigInt(maxPlayers);

    // Debug logging for transformed data
    console.log('Transformed clash data:', {
      clashId: clashId.toString(),
      clashSize,
      maxPlayers,
      playerCount: actualPlayerCount,
      state: typeof state === 'number' ? ClashState[state] : state,
      totalPrize: totalPrize.toString(),
      players: playerObjects.length
    });
    
    // Determine clash status and hasEnded
    const isCompleted = state === ClashState.COMPLETED_WITH_RESULTS;
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const hasEnded = isCompleted || (startTime + BigInt(60) < currentTime); // 60 second clash duration
    
    return {
      id: clashId,
      clashSize: clashSize as ClashSize,
      state: state as ClashState,
      maxPlayers,
      playerCount: actualPlayerCount,
      players: playerObjects,
      results: results && Array.isArray(results) ? [...results] : [], 
      startTime,
      totalPrize,
      status: isCompleted ? 'Completed' : 'Active',
      hasEnded,
      isProcessed: isProcessed || isCompleted
    };
  } catch (error) {
    console.error('Error transforming clash data:', error);
    return null;
  }
}; 