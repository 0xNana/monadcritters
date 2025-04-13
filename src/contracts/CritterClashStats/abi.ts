// ABI for CritterClashStats contract
export const abi = [
  // Events
  {
    type: 'event',
    name: 'StatsUpdated',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'totalScore', indexed: false },
      { type: 'uint256', name: 'totalWins', indexed: false },
      { type: 'uint256', name: 'totalClashes', indexed: false },
      { type: 'uint256', name: 'critterId', indexed: false },
      { type: 'uint256', name: 'critterClashCount', indexed: false },
      { type: 'uint256', name: 'critterWinCount', indexed: false },
      { type: 'uint256', name: 'critterWinStreak', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'StatsMigrated',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'totalScore', indexed: false },
      { type: 'uint256', name: 'totalWins', indexed: false },
      { type: 'uint256', name: 'totalClashes', indexed: false },
      { type: 'uint256', name: 'totalRewards', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'MigrationCompleted',
    inputs: [
      { type: 'uint256', name: 'totalPlayers', indexed: false },
      { type: 'uint256', name: 'timestamp', indexed: false }
    ]
  },

  // Read functions
  {
    name: 'getUserClashIds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      { type: 'uint256[]', name: 'acceptingPlayersClashes' },
      { type: 'uint256[]', name: 'clashingClashes' },
      { type: 'uint256[]', name: 'completedClashes' }
    ]
  },
  {
    name: 'getClashInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'clashId' }],
    outputs: [
      { type: 'uint8', name: 'clashSize' },
      { type: 'uint8', name: 'state' },
      { type: 'uint256', name: 'playerCount' },
      { type: 'uint256', name: 'startTime' },
      { type: 'bool', name: 'isProcessed' },
      { type: 'address[]', name: 'players' },
      { type: 'uint256[]', name: 'critterIds' },
      { type: 'uint256[]', name: 'boosts' },
      { type: 'uint256[]', name: 'scores' },
      { type: 'uint256[]', name: 'results' }
    ]
  },
  {
    name: 'getClashInfoBatch',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256[]', name: 'clashIds' },
      { type: 'uint256', name: 'offset' },
      { type: 'uint256', name: 'limit' }
    ],
    outputs: [
      { type: 'uint8[]', name: 'clashSizes' },
      { type: 'uint8[]', name: 'states' },
      { type: 'uint256[]', name: 'playerCounts' },
      { type: 'uint256[]', name: 'startTimes' },
      { type: 'address[][]', name: 'players' },
      { type: 'uint256[][]', name: 'critterIds' },
      { type: 'uint256[][]', name: 'boosts' },
      { type: 'uint256[][]', name: 'scores' },
      { type: 'uint256[][]', name: 'results' }
    ]
  },
  {
    name: 'getUserStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      { type: 'uint256', name: 'totalScore' },
      { type: 'uint256', name: 'totalWins' },
      { type: 'uint256', name: 'totalClashes' },
      { type: 'uint256', name: 'totalRewards' }
    ]
  },
  {
    name: 'getCritterStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'critterId' }],
    outputs: [
      { type: 'uint256', name: 'clashCount' },
      { type: 'uint256', name: 'winCount' },
      { type: 'uint256', name: 'winStreak' }
    ]
  },
  {
    name: 'getLeaderboard',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256', name: 'offset' },
      { type: 'uint256', name: 'count' }
    ],
    outputs: [
      { type: 'address[]', name: 'players' },
      { type: 'uint256[]', name: 'scores' },
      { type: 'uint256[]', name: 'wins' },
      { type: 'uint256[]', name: 'clashCounts' },
      { type: 'uint256[]', name: 'rewards' }
    ]
  },
  {
    name: 'getMigrationProgress',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'bool', name: 'completed' },
      { type: 'uint256', name: 'currentIndex' },
      { type: 'uint256', name: 'currentPlayerCount' }
    ]
  },
  {
    name: 'getTotalPlayers',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },

  // Write functions
  {
    name: 'updatePlayerStats',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'player' },
      { type: 'uint256', name: 'score' },
      { type: 'bool', name: 'isWinner' },
      { type: 'uint256', name: 'reward' }
    ],
    outputs: []
  },
  {
    name: 'updateCritterStats',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'critterId' },
      { type: 'bool', name: 'isWinner' }
    ],
    outputs: []
  },
  {
    name: 'importPlayerStats',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'oldContract' },
      { type: 'uint256', name: 'batchLimit' }
    ],
    outputs: [
      { type: 'bool', name: 'finished' },
      { type: 'uint256', name: 'importedCount' }
    ]
  }
] as const;

export default abi; 