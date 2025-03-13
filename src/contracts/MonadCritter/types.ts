// Types for MonadCritter NFT contract

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
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
}

export interface Critter {
  tokenId: bigint;
  stats: CritterStats;
  metadata?: CritterMetadata;
}

export interface CritterWithOwner extends Critter {
  owner: string;
}

// Event types
export interface TransferEvent {
  from: string;
  to: string;
  tokenId: bigint;
}
