// ABI for CritterRace contract
export const abi = [
  // Events
  {
    type: 'event',
    name: 'RaceCreated',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'PlayerJoined',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'critterId', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'PowerUpLoaded',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'bool', name: 'isSpeedBoost', indexed: true },
      { type: 'uint256', name: 'amount', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'RaceStarted',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'uint256', name: 'startTime', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'PowerUpsPurchased',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'speedBoosts', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'RaceTypeUpdated',
    inputs: [
      { type: 'uint8', name: 'raceSize', indexed: true },
      { type: 'uint256', name: 'maxPlayers', indexed: false },
      { type: 'uint256', name: 'numWinners', indexed: false },
      { type: 'uint256', name: 'entryFee', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'PowerUpRevenueWithdrawn',
    inputs: [
      { type: 'address', name: 'owner', indexed: true },
      { type: 'uint256', name: 'amount', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'RaceEnded',
    inputs: [
      { type: 'uint256', name: 'raceId', indexed: true },
      { type: 'tuple[]', name: 'results', indexed: false, components: [
        { type: 'address', name: 'player' },
        { type: 'uint256', name: 'critterId' },
        { type: 'uint256', name: 'finalPosition' },
        { type: 'uint256', name: 'reward' },
        { type: 'uint256', name: 'score' }
      ]}
    ]
  },
  {
    type: 'event',
    name: 'AccidentalTokensWithdrawn',
    inputs: [
      { type: 'address', name: 'owner', indexed: true },
      { type: 'uint256', name: 'amount', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'DevFeeUpdated',
    inputs: [
      { type: 'uint256', name: 'oldFee', indexed: false },
      { type: 'uint256', name: 'newFee', indexed: false }
    ]
  },

  // Read functions
  {
    name: 'critterContract',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }]
  },
  {
    name: 'raceTypes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint8', name: 'raceSize' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'maxPlayers' },
        { type: 'uint256', name: 'numWinners' },
        { type: 'uint256', name: 'entryFee' },
        { type: 'bool', name: 'isActive' },
        { type: 'uint256[]', name: 'rewardPercentages' }
      ]
    }]
  },
  {
    name: 'POWER_UP_PERCENT',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'devFeePercent',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'currentRaceId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'powerUpRevenue',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'playerInventory_SpeedBoost',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getRaceTypeInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint8', name: 'raceSize' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'maxPlayers' },
        { type: 'uint256', name: 'numWinners' },
        { type: 'uint256', name: 'entryFee' },
        { type: 'uint256[]', name: 'rewardPercentages' },
        { type: 'bool', name: 'isActive' }
      ]
    }]
  },
  {
    name: 'getRaceInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'raceId' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'id' },
        { type: 'uint8', name: 'raceSize' },
        { type: 'address[]', name: 'players' },
        { type: 'uint256[]', name: 'critterIds' },
        { type: 'uint256', name: 'startTime' },
        { type: 'bool', name: 'isActive' },
        { type: 'bool', name: 'hasEnded' },
        { type: 'uint256', name: 'prizePool' }
      ]
    }]
  },
  {
    name: 'getActiveRaces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint8', name: 'raceSize' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { type: 'uint256', name: 'id' },
        { type: 'uint8', name: 'raceSize' },
        { type: 'address[]', name: 'players' },
        { type: 'uint256[]', name: 'critterIds' },
        { type: 'uint256', name: 'startTime' },
        { type: 'bool', name: 'isActive' },
        { type: 'bool', name: 'hasEnded' },
        { type: 'uint256', name: 'prizePool' }
      ]
    }]
  },
  {
    name: 'getUserRaces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { type: 'uint256', name: 'id' },
        { type: 'uint8', name: 'raceSize' },
        { type: 'address[]', name: 'players' },
        { type: 'uint256[]', name: 'critterIds' },
        { type: 'uint256', name: 'startTime' },
        { type: 'bool', name: 'isActive' },
        { type: 'bool', name: 'hasEnded' },
        { type: 'uint256', name: 'prizePool' }
      ]
    }]
  },
  {
    name: 'getLatestAvailableRace',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint8', name: 'raceSize' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getPlayerStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'totalScore' },
        { type: 'uint256', name: 'racesParticipated' },
        { type: 'uint256', name: 'wins' },
        { type: 'uint256', name: 'totalRewards' },
        { type: 'uint256', name: 'bestScore' }
      ]
    }]
  },
  {
    name: 'getWinRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getTopPlayersByWins',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'limit' }],
    outputs: [
      { type: 'address[]', name: 'players' },
      { type: 'uint256[]', name: 'winCounts' }
    ]
  },
  {
    name: 'getTopPlayersByScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'limit' }],
    outputs: [
      { type: 'address[]', name: 'players' },
      { type: 'uint256[]', name: 'scores' }
    ]
  },
  {
    name: 'getBatchRaceScores',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256[]', name: 'critterIds' },
      { type: 'uint256[]', name: 'boosts' }
    ],
    outputs: [{ type: 'uint256[]', name: 'scores' }]
  },
  {
    name: 'getBatchRaceResults',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256[]', name: 'raceIds' }],
    outputs: [{
      type: 'tuple[][]',
      components: [
        { type: 'address', name: 'player' },
        { type: 'uint256', name: 'critterId' },
        { type: 'uint256', name: 'finalPosition' },
        { type: 'uint256', name: 'reward' },
        { type: 'uint256', name: 'score' }
      ]
    }]
  },
  {
    name: 'getRaceLeaderboard',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'raceId' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { type: 'address', name: 'player' },
        { type: 'uint256', name: 'position' },
        { type: 'uint256', name: 'score' },
        { type: 'uint256', name: 'reward' }
      ]
    }]
  },
  {
    name: 'getBatchRaceLeaderboards',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256[]', name: 'raceIds' }],
    outputs: [{
      type: 'tuple[][]',
      components: [
        { type: 'address', name: 'player' },
        { type: 'uint256', name: 'position' },
        { type: 'uint256', name: 'score' },
        { type: 'uint256', name: 'reward' }
      ]
    }]
  },

  // Write functions
  {
    name: 'buyPowerUps',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ type: 'uint256', name: 'speedBoosts' }],
    outputs: []
  },
  {
    name: 'joinRace',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { type: 'uint256', name: 'raceId' },
      { type: 'uint256', name: 'raceTypeIndex' },
      { type: 'uint256', name: 'critterId' },
      { type: 'uint256', name: 'boost' }
    ],
    outputs: []
  },
  {
    name: 'createRace',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint8', name: 'raceSize' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'startRaceExternal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'raceId' }],
    outputs: []
  },
  {
    name: 'endRace',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'raceId' }],
    outputs: []
  },
  {
    name: 'setRaceType',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint8', name: 'raceSize' },
      { type: 'uint256', name: 'maxPlayers' },
      { type: 'uint256', name: 'numWinners' },
      { type: 'uint256', name: 'entryFee' },
      { type: 'uint256[]', name: 'rewardPercentages' },
      { type: 'bool', name: 'isActive' }
    ],
    outputs: []
  },
  {
    name: 'setDevFeePercent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: '_devFeePercent' }],
    outputs: []
  },
  {
    name: 'withdrawPowerUpRevenue',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'withdrawAccidentalTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'cacheBaseScores',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256[]', name: 'critterIds' }],
    outputs: []
  }
] as const;

// Types
export interface RaceType {
  maxPlayers: bigint;
  numWinners: bigint;
  entryFee: bigint;
  isActive: boolean;
  rewardPercentages: bigint[];
}

export interface Race {
  id: bigint;
  raceSize: number;
  players: `0x${string}`[];
  critterIds: bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: bigint;
}

export interface PlayerStats {
  totalScore: bigint;
  racesParticipated: bigint;
  wins: bigint;
  totalRewards: bigint;
  bestScore: bigint;
}

export interface RaceResult {
  player: `0x${string}`;
  critterId: bigint;
  finalPosition: bigint;
  reward: bigint;
  score: bigint;
}

export interface RaceTypeInfo {
  maxPlayers: bigint;
  numWinners: bigint;
  entryFee: bigint;
  rewardPercentages: bigint[];
  isActive: boolean;
}

export interface RaceInfo {
  id: bigint;
  raceSize: number;
  players: `0x${string}`[];
  critterIds: bigint[];
  startTime: bigint;
  isActive: boolean;
  hasEnded: boolean;
  prizePool: bigint;
}

export interface LeaderboardEntry {
  player: `0x${string}`;
  position: bigint;
  score: bigint;
  reward: bigint;
}
