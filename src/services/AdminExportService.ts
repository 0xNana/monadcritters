import { useCritterClashStats } from '../contracts/CritterClashStats/hooks';
import { serializeWithBigInt } from '../hooks/useClashView';
import { formatRelativeTime } from '../utils/format';
import { PlayerStats } from '../contracts/CritterClashStats/types';

interface UserExportData {
  address: string;
  stats: PlayerStats;
  lastActive: string;
  socialVerifications: {
    platform: string;
    username: string;
    verified: boolean;
    timestamp: string;
  }[];
  clashHistory: {
    clashId: string;
    timestamp: string;
    score: string;
    placement: number;
    reward: string;
  }[];
}

export class AdminExportService {
  private static instance: AdminExportService;
  private stats = useCritterClashStats();

  private constructor() {}

  public static getInstance(): AdminExportService {
    if (!AdminExportService.instance) {
      AdminExportService.instance = new AdminExportService();
    }
    return AdminExportService.instance;
  }

  /**
   * Exports all user data in a structured format
   * @returns Promise<{ users: UserExportData[], metadata: { exportTimestamp: number, totalUsers: number } }>
   */
  public async exportAllUserData() {
    try {
      // Get total number of players
      const totalPlayers = await this.stats.getTotalPlayers();
      
      // Get all player addresses from the contract
      const players = await this.getAllPlayers();
      
      // Fetch stats for all players in batches
      const userDataPromises = players.map(async (address) => {
        const stats = await this.stats.getPlayerStats(address);
        const clashIds = await this.stats.getUserClashIds(address);
        
        // Get clash history
        const clashHistory = await this.getClashHistory(address, clashIds.completedClashes);
        
        // Get social verifications from local storage or context
        const socialVerifications = this.getSocialVerifications(address);
        
        const userData: UserExportData = {
          address,
          stats,
          lastActive: formatRelativeTime(stats.lastUpdated || 0),
          socialVerifications,
          clashHistory
        };
        
        return userData;
      });
      
      const users = await Promise.all(userDataPromises);
      
      const exportData = {
        users,
        metadata: {
          exportTimestamp: Date.now(),
          totalUsers: users.length,
          version: '1.0.0'
        }
      };
      
      // Serialize the data to handle BigInt values
      return serializeWithBigInt(exportData);
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Downloads the exported data as a JSON file
   */
  public async downloadExportData() {
    try {
      const data = await this.exportAllUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `critter-clash-export-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading export:', error);
      throw new Error('Failed to download export data');
    }
  }

  private async getAllPlayers(): Promise<string[]> {
    try {
      const totalPlayers = await this.stats.getTotalPlayers();
      const batchSize = 100;
      const players: string[] = [];
      
      for (let offset = 0; offset < totalPlayers; offset += batchSize) {
        const { players: batchPlayers } = await this.stats.getLeaderboard(offset, Math.min(batchSize, totalPlayers - offset));
        players.push(...batchPlayers);
      }
      
      return players;
    } catch (error) {
      console.error('Error getting all players:', error);
      throw new Error('Failed to get player list');
    }
  }

  private async getClashHistory(address: string, clashIds: bigint[]) {
    const history = [];
    const batchSize = 20;
    
    for (let i = 0; i < clashIds.length; i += batchSize) {
      const batch = clashIds.slice(i, i + batchSize);
      const clashData = await this.stats.getClashInfoBatch(batch, 0, batch.length);
      
      for (let j = 0; j < batch.length; j++) {
        const playerIndex = clashData.players[j].findIndex(p => p.toLowerCase() === address.toLowerCase());
        if (playerIndex !== -1) {
          history.push({
            clashId: batch[j].toString(),
            timestamp: formatRelativeTime(Number(clashData.startTimes[j])),
            score: clashData.scores[j][playerIndex].toString(),
            placement: this.getPlacement(clashData.scores[j], playerIndex),
            reward: '0' // Add actual reward calculation if available
          });
        }
      }
    }
    
    return history;
  }

  private getPlacement(scores: bigint[], playerIndex: number): number {
    const playerScore = scores[playerIndex];
    let placement = 1;
    for (const score of scores) {
      if (score > playerScore) placement++;
    }
    return placement;
  }

  private getSocialVerifications(address: string) {
    // This would need to be implemented based on how social verifications are stored
    // For now, return an empty array or mock data
    return [];
  }
} 