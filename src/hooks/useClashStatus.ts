import { useMemo } from 'react';
import { ClashDetail, ClashState } from '../contracts/CritterClashCore/types';
import { formatEther } from 'viem';

export const useClashStatus = (clashInfo: ClashDetail | null, userAddress?: string) => {
  const status = useMemo(() => {
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

    // Check if the players array is valid
    const validPlayers = Array.isArray(clashInfo.players) ? 
      clashInfo.players.filter(player => 
        player && 
        player.player && 
        player.player !== '0x0000000000000000000000000000000000000000'
      ) : [];
    
    // Calculate actual player count from valid players
    const actualPlayerCount = validPlayers.length;
    
    // Check user participation only among valid players
    const isUserParticipating = userAddress ? 
      validPlayers.some(player => {
        const isParticipating = player.player.toLowerCase() === userAddress.toLowerCase();
        return isParticipating;
      }) : false;

    const status = {
      playerCount: actualPlayerCount,
      maxPlayers: clashInfo.maxPlayers,
      prizePool: formatEther(clashInfo.totalPrize),
      isUserParticipating,
      isFull: actualPlayerCount >= clashInfo.maxPlayers,
      state: clashInfo.state as ClashState
    };

    return status;
  }, [clashInfo, userAddress]);

  return status;
}; 