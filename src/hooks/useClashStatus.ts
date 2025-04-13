import { useMemo } from 'react';
import { ClashDetail, ClashState } from '../contracts/CritterClashCore/types';
import { formatEther } from 'viem';

export const useClashStatus = (clashInfo: ClashDetail | null, userAddress?: string) => {
  const status = useMemo(() => {
    // Debug logging
    console.log('useClashStatus input:', { 
      clashInfo: clashInfo ? {
        id: clashInfo.id.toString(),
        players: clashInfo.players,
        playerCount: clashInfo.playerCount,
        state: clashInfo.state
      } : null, 
      userAddress 
    });

    if (!clashInfo) {
      return {
        playerCount: 0,
        maxPlayers: 0,
        prizePool: '0',
        isUserParticipating: false,
        isFull: false,
        state: ClashState.ACCEPTING_PLAYERS
      };
    }

    // Check if the players array is valid - handle edge cases
    const validPlayers = Array.isArray(clashInfo.players) && clashInfo.players.length > 0;
    
    // Safe check for user participation
    const isUserParticipating = userAddress && validPlayers ? 
      clashInfo.players.some(player => 
        player && player.player && 
        player.player.toLowerCase() === userAddress.toLowerCase()
      ) : false;

    // Safe player count calculation
    const actualPlayerCount = validPlayers ? clashInfo.players.length : clashInfo.playerCount;

    const result = {
      playerCount: actualPlayerCount,
      maxPlayers: clashInfo.maxPlayers,
      prizePool: formatEther(clashInfo.totalPrize),
      isUserParticipating,
      isFull: actualPlayerCount >= clashInfo.maxPlayers,
      state: clashInfo.state as ClashState
    };

    // Debug output
    console.log('useClashStatus output:', result);

    return result;
  }, [clashInfo, userAddress]);

  return status;
}; 