import { ClashDetail, ClashSize, ClashState } from '../contracts/CritterClashCore/types';
import { utils } from 'ethers';

// Entry fees for different clash sizes (in MON)
const ENTRY_FEES = {
  [ClashSize.Two]: utils.parseEther('0.1'),
  [ClashSize.Four]: utils.parseEther('0.1')
};

// Default entry fee of 0 for any other case
const getEntryFee = (size: ClashSize) => {
  return ENTRY_FEES[size] || utils.parseEther('0');
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
    return null;
  }

  try {
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
      return null;
    }

    // Validate clash size
    if (clashSize !== ClashSize.Two && clashSize !== ClashSize.Four) {
      return null;
    }

    // Convert clash size to maxPlayers
    const maxPlayers = clashSize === ClashSize.Four ? 4 : 2;
    
    // Ensure arrays are initialized and properly handle player count
    if (!players || !Array.isArray(players)) {
      players = [];
    }

    // Calculate actual player count by counting non-zero addresses
    const actualPlayerCount = players.filter(addr => 
      addr && addr !== '0x0000000000000000000000000000000000000000'
    ).length;

    // For ACCEPTING_PLAYERS state (state 0), we need accurate player count
    if (state === ClashState.ACCEPTING_PLAYERS && actualPlayerCount > maxPlayers) {
      return null;
    }
    
    if (!critterIds || !Array.isArray(critterIds)) {
      critterIds = [];
    }
    
    if (!boosts || !Array.isArray(boosts)) {
      boosts = [];
    }

    // Create player objects only for valid players
    const playerObjects: {
      player: `0x${string}`;
      critterId: bigint;
      score: bigint;
      boost: bigint;
    }[] = [];
    
    for (let i = 0; i < players.length; i++) {
      const playerAddress = players[i];
      // Only include valid player addresses
      if (playerAddress && playerAddress !== '0x0000000000000000000000000000000000000000') {
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
    }

    // For ACCEPTING_PLAYERS state, ensure player count matches actual players
    if (state === ClashState.ACCEPTING_PLAYERS) {
      if (playerObjects.length !== actualPlayerCount) {
        // Silent error - no need to log here
      }
    }

    // Get entry fee based on clash size
    const entryFee = getEntryFee(clashSize);
    
    // Calculate total prize based on max players and entry fee
    const totalPrize = BigInt(entryFee.mul(maxPlayers).toString());
    
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
    return null;
  }
}; 