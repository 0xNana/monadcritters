// ABI for MonadCritter NFT contract
export const abi = [
  // Events
  {
    type: 'event',
    name: 'CritterMinted',
    inputs: [
      { type: 'uint256', name: 'tokenId', indexed: true },
      { type: 'address', name: 'owner', indexed: true },
      { type: 'tuple', name: 'stats', components: [
        { type: 'uint8', name: 'speed' },
        { type: 'uint8', name: 'stamina' },
        { type: 'uint8', name: 'luck' },
        { type: 'uint8', name: 'rarity' }
      ]}
    ]
  },
  {
    type: 'event',
    name: 'MintPriceUpdated',
    inputs: [
      { type: 'uint256', name: 'oldPrice', indexed: false },
      { type: 'uint256', name: 'newPrice', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'BaseImageURIUpdated',
    inputs: [
      { type: 'string', name: 'oldURI', indexed: false },
      { type: 'string', name: 'newURI', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { type: 'address', name: 'from', indexed: true },
      { type: 'address', name: 'to', indexed: true },
      { type: 'uint256', name: 'tokenId', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { type: 'address', name: 'owner', indexed: true },
      { type: 'address', name: 'approved', indexed: true },
      { type: 'uint256', name: 'tokenId', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'ApprovalForAll',
    inputs: [
      { type: 'address', name: 'owner', indexed: true },
      { type: 'address', name: 'operator', indexed: true },
      { type: 'bool', name: 'approved', indexed: false }
    ]
  },

  // Read functions
  {
    name: 'mintPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'baseImageURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'uint256', name: 'index' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [
      { type: 'uint8', name: 'speed' },
      { type: 'uint8', name: 'stamina' },
      { type: 'uint8', name: 'luck' },
      { type: 'uint8', name: 'rarity' }
    ]
  },
  {
    name: 'mintsPerWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'MAX_MINTS_PER_WALLET',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [{ type: 'address' }]
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'getTokensOfOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256[]' }]
  },
  {
    name: 'getAllTokensWithStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256', name: 'startIndex' },
      { type: 'uint256', name: 'endIndex' }
    ],
    outputs: [
      { type: 'uint256[]', name: 'tokenIds' },
      { type: 'tuple[]', name: 'tokenStats', components: [
        { type: 'uint8', name: 'speed' },
        { type: 'uint8', name: 'stamina' },
        { type: 'uint8', name: 'luck' },
        { type: 'uint8', name: 'rarity' }
      ]}
    ]
  },
  {
    name: 'supportsInterface',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'bytes4', name: 'interfaceId' }],
    outputs: [{ type: 'bool' }]
  },

  // Write functions
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  },
  {
    name: 'ownerMint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' }
    ],
    outputs: []
  },
  {
    name: 'setBaseImageURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'string', name: '_baseImageURI' }],
    outputs: []
  },
  {
    name: 'setMintPrice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: '_mintPrice' }],
    outputs: []
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'tokenId' }
    ],
    outputs: []
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'operator' },
      { type: 'bool', name: 'approved' }
    ],
    outputs: []
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'tokenId' }
    ],
    outputs: []
  },
  {
    name: 'safeTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'tokenId' }
    ],
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
  }
] as const;

// Types
export interface CritterStats {
  speed: number;
  stamina: number;
  luck: number;
  rarity: number;
}

export interface CritterMetadata {
  name: string;
  description: string;
  image: string;
  image_512: string;
  image_256: string;
  image_128: string;
  image_64: string;
  image_32: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
}

export enum Rarity {
  Common = 0,
  Uncommon = 1,
  Rare = 2,
  Legendary = 3
}
