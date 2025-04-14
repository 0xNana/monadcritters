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

    // Debug: Log clash info and state
    console.log('Active Clash Debug:', {
      clashId: clashInfo.id.toString(),
      state: ClashState[clashInfo.state],
      rawPlayers: clashInfo.players,
      maxPlayers: clashInfo.maxPlayers
    });

    // Check if the players array is valid
    const validPlayers = Array.isArray(clashInfo.players) ? 
      clashInfo.players.filter(player => 
        player && 
        player.player && 
        player.player !== '0x0000000000000000000000000000000000000000'
      ) : [];
    
    // Calculate actual player count from valid players
    const actualPlayerCount = validPlayers.length;

    // Debug: Log player information
    console.log('Player Count Debug:', {
      clashId: clashInfo.id.toString(),
      totalPlayers: clashInfo.players?.length || 0,
      validPlayers: validPlayers.length,
      validPlayerAddresses: validPlayers.map(p => p.player),
      isAcceptingPlayers: clashInfo.state === ClashState.ACCEPTING_PLAYERS
    });
    
    // Check user participation only among valid players
    const isUserParticipating = userAddress ? 
      validPlayers.some(player => {
        const isParticipating = player.player.toLowerCase() === userAddress.toLowerCase();
        if (isParticipating) {
          console.log('Found participating user:', {
            clashId: clashInfo.id.toString(),
            userAddress,
            playerAddress: player.player
          });
        }
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

    // Debug: Log final status
    console.log('Clash Status:', {
      clashId: clashInfo.id.toString(),
      ...status,
      state: ClashState[status.state]
    });

    return status;
  }, [clashInfo, userAddress]);

  return status;
}; 