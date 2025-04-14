// ABI for CritterClashCore contract
export const abi = [
  // Events
  {
    type: 'event',
    name: 'ClashCompleted',
    inputs: [
      { type: 'uint256', name: 'clashId', indexed: true },
      { type: 'address[]', name: 'players', indexed: false },
      { type: 'uint256[]', name: 'scores', indexed: false },
      { type: 'uint256[]', name: 'rewards', indexed: false },
      { type: 'uint256[]', name: 'boostCounts', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'ClashJoined',
    inputs: [
      { type: 'uint256', name: 'clashId', indexed: true },
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'critterId', indexed: false },
      { type: 'uint256', name: 'boostCount', indexed: false },
      { type: 'uint256', name: 'fee', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'ClashStarted',
    inputs: [
      { type: 'uint256', name: 'clashId', indexed: true },
      { type: 'address[]', name: 'players', indexed: false },
      { type: 'uint256[]', name: 'critterIds', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'ClashUpdate',
    inputs: [
      { type: 'uint256', name: 'clashId', indexed: true },
      { type: 'uint8', name: 'clashSize', indexed: true },
      { type: 'uint8', name: 'state', indexed: false },
      { type: 'address', name: 'player', indexed: false },
      { type: 'uint256', name: 'critterId', indexed: false },
      { type: 'uint256', name: 'timestamp', indexed: false }
    ]
  },

  // Read functions
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
    name: 'getClashDetails',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'clashId' }],
    outputs: [
      { type: 'uint256', name: 'id' },
      { type: 'uint8', name: 'clashSize' },
      { type: 'uint8', name: 'state' },
      { type: 'uint256', name: 'playerCount' },
      { type: 'uint256', name: 'startTime' },
      { type: 'bool', name: 'isProcessed' }
    ]
  },
  {
    name: 'getClashResults',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'clashId' }],
    outputs: [
      { 
        type: 'tuple[]', 
        components: [
          { type: 'address', name: 'player' },
          { type: 'uint128', name: 'critterId' },
          { type: 'uint32', name: 'position' },
          { type: 'uint64', name: 'reward' },
          { type: 'uint32', name: 'score' }
        ]
      }
    ]
  },
  {
    name: 'getUserClashIds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [{ type: 'uint256[]' }]
  },
  {
    name: 'getClashTypeInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint8', name: 'clashSize' }],
    outputs: [
      { type: 'uint256', name: 'entryFee' },
      { type: 'uint256', name: 'boostFeePercent' },
      { type: 'uint256[]', name: 'rewardPercentages' },
      { type: 'uint256', name: 'maxPlayers' },
      { type: 'uint256', name: 'numWinners' },
      { type: 'bool', name: 'isActive' }
    ]
  },
  {
    name: 'playerBoosts',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'clashDuration',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'currentActiveClash',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint8', name: 'clashSize' }],
    outputs: [{ type: 'uint256' }]
  },

  // Write functions
  {
    name: 'joinClash',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { type: 'uint8', name: 'clashSize' },
      { type: 'uint256', name: 'critterId' },
      { type: 'uint256', name: 'boostCount' },
      { type: 'bool', name: 'useInventory' }
    ],
    outputs: []
  },
  {
    name: 'completeClash',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'clashId' }],
    outputs: []
  },
  {
    name: 'purchaseBoosts',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ type: 'uint256', name: 'amount' }],
    outputs: []
  }
] as const;

export default abi; 