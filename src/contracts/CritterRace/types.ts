// Types for CritterRace contract

export enum RaceSize {
    None = 0,
    Two = 1,
    Five = 2,
    Ten = 3
}

export interface RaceType {
    maxPlayers: bigint;
    numWinners: bigint;
    entryFee: bigint;
    isActive: boolean;
    rewardPercentages: bigint[];
}

export interface PowerUps {
    speedBoosts: bigint;
}

export interface RaceResult {
    player: `0x${string}`;
    critterId: bigint;
    finalPosition: bigint;
    reward: bigint;
    score: bigint;
}

export interface RaceInfo {
    calculatedResults: any;
    id: bigint;
    raceSize: RaceSize;
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

export interface RaceEndInfo {
    endTime: bigint;
    resultsCalculated: boolean;
    results: RaceResult[];
}

export interface RaceTypeInfo {
    maxPlayers: bigint;
    numWinners: bigint;
    entryFee: bigint;
    rewardPercentages: bigint[];
    isActive: boolean;
}

export interface LeaderboardEntry {
    player: `0x${string}`;
    position: bigint;
    score: bigint;
    reward: bigint;
}

export interface CritterStats {
    speed: number;
    stamina: number;
    luck: number;
}

export interface RaceScore {
    player: `0x${string}`;
    critterId: bigint;
    score: bigint;
    position: bigint;
}

// Event types
export interface RaceCreatedEvent {
    raceId: bigint;
}

export interface PlayerJoinedEvent {
    raceId: bigint;
    player: `0x${string}`;
    critterId: bigint;
}

export interface PowerUpLoadedEvent {
    raceId: bigint;
    player: `0x${string}`;
    isSpeedBoost: boolean;
    amount: bigint;
}

export interface RaceStartedEvent {
    raceId: bigint;
    startTime: bigint;
}

export interface RaceEndedEvent {
    raceId: bigint;
    results: RaceResult[];
}

export interface PowerUpsPurchasedEvent {
    player: `0x${string}`;
    speedBoosts: bigint;
}

export interface RaceTypeUpdatedEvent {
    raceSize: RaceSize;
    maxPlayers: bigint;
    numWinners: bigint;
    entryFee: bigint;
}

export interface PowerUpRevenueWithdrawnEvent {
    owner: `0x${string}`;
    amount: bigint;
}

export interface AccidentalTokensWithdrawnEvent {
    owner: `0x${string}`;
    amount: bigint;
}

export interface DevFeeUpdatedEvent {
    oldFee: bigint;
    newFee: bigint;
}
