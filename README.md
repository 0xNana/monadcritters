# MonadCritters 🏃‍♂️

MonadCritters is an exciting blockchain-based racing game where players can mint, collect, and race unique creatures called Critters in competitive races to win rewards.

## Overview

MonadCritters combines NFT collecting with competitive racing mechanics. Each Critter is a unique NFT with special racing attributes that determine their performance in races.

### Key Features

- **Mint Unique Critters**: Each Critter is an NFT with unique stats:
  - Speed: Determines base racing speed
  - Stamina: Affects race endurance
  - Luck: Influences race variance and outcomes
  - Rarity: Common, Uncommon, Rare, or Legendary (with multipliers)

- **Multiple Race Types**:
  - Two Player Races
  - Five Player Races
  - Ten Player Races
  Each with different entry fees and reward structures

- **Power-Up System**:
  - Speed Boosts: Enhance your Critter's performance
  - Strategic power-up usage with diminishing returns
  - Power-ups cost 10% of race entry fee

- **Reward System**:
  - Prize pools from entry fees
  - Multiple winners based on race type
  - Performance-based reward distribution
  - Leaderboard tracking

### Game Mechanics

#### Racing
- Races are skill-based competitions where Critters compete based on their stats
- Race outcomes are determined by:
  - Base Critter stats (Speed, Stamina, Luck)
  - Rarity multipliers (1.0x - 1.5x)
  - Strategic power-up usage
  - Luck-based variance

#### Scoring System
- Speed has the highest weight (1.2x)
- Stamina has standard weight (1.0x)
- Luck has lower weight (0.8x) but adds variance
- Rarity multipliers boost overall performance
- Power-ups provide diminishing returns:
  - First boost: 20% increase
  - Second boost: Additional 15% increase

### Getting Started

1. **Connect Wallet**: Use a Web3 wallet to interact with the game
2. **Mint a Critter**: Get your first Critter to start racing
3. **Join Races**: Enter races that match your Critter's strengths
4. **Use Power-ups**: Strategically apply boosts to improve performance
5. **Win Rewards**: Compete for prizes and climb the leaderboard

### Player Stats

Track your performance with detailed statistics:
- Total Score
- Races Participated
- Wins (First Place Finishes)
- Total Rewards
- Best Score

## Technical Stack

- Frontend: React with TypeScript
- Smart Contracts: Solidity
- Styling: Modern UI with Framer Motion animations
- Web3 Integration: Viem/Wagmi

## Development

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
npm run build
```

## Security

- Smart contracts follow OpenZeppelin standards
- Implements Ownable and Pausable patterns
- Secure reward distribution system
- Fair and transparent race mechanics

## License

[MIT](LICENSE)

---

Built with ❤️ for the Monad ecosystem 

## Wallet Connection Information

### Supported Wallet Types

Currently, MonadCritters supports the following wallet connection methods:

- MetaMask
- Other injected wallets (Brave, etc.)
- WalletConnect (for supported chains)

### Known Limitations

**Social/Email Logins**: Social and email logins are currently disabled because WalletConnect's Cloud infrastructure does not yet officially support Monad testnet (chainId 10143). This is a limitation of the WalletConnect platform, not of the MonadCritters application.

When WalletConnect adds official support for Monad testnet, we will re-enable these login options.

### Connecting Your Wallet

1. Click the "Log In" button in the top right corner
2. Select your preferred wallet from the options
3. Follow the prompts to connect your wallet to the application 