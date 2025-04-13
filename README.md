# Clash Of Critters 🎮

A blockchain based game where you can mint, clash, and earn with your critters on the Monad testnet.

[Live Demo](https://clashofcritters.vercel.app) • [Report Bug](https://github.com/0xNana/monadcritters/issues) • [Request Feature](https://github.com/0xNana/monadcritters/issues)

## Features

- Mint and collect unique critters as NFTs
- Join or create clashes with your critters
- Purchase and use boosts to improve your chances of winning
- Win MON rewards by participating in clashes
- Support for both native token (MON) and ERC20 token payments
- Social points system for loyal players

## Contracts

The following smart contracts power the application:

- **CritterNFT**: The ERC-721 NFT contract for the critters
- **CritterClash**: The main game contract that handles clashes, boosts, and rewards
- **SocialPointsTracker**: A contract for tracking and rewarding player engagement

## Getting Started

### Prerequisites

- Node.js v18+
- npm or yarn
- A wallet with Monad Testnet tokens (for testnet deployment)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/0xNana/monadcritters.git
cd monadcritters
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the required configurations (see `.env.example`).

### Running Locally

```bash
npm run dev
```

This will start the development server at http://localhost:5173.

### Building for Production

```bash
npm run build
```

### Deploying to Production

To deploy the frontend:

```bash
npm run deploy:frontend
```

This will build the application and prepare it for deployment.

### Deploying Contracts

To deploy contracts to the Monad testnet:

```bash
npm run deploy:testnet
```

To deploy only the NFT contract:

```bash
npm run deploy:critter
```

To deploy the social points tracker:

```bash
npm run deploy:points
```

## Contract Verification

After deploying contracts, you can verify them on the Monad explorer:

```bash
npx hardhat verify CONTRACT_ADDRESS --network monad
```

For contracts with constructor arguments:

```bash
npx hardhat verify CONTRACT_ADDRESS --network monad --constructor-args scripts/points-tracker-args.js
```

## Game Mechanics

### Clashes

Clashes are battles between critters. Players join clashes by paying an entry fee and can optionally use boosts to increase their chances of winning.

### Boost Inventory

Players can purchase boosts using either ETH or ERC20 tokens. These boosts can be used in clashes to increase a critter's score.

### Rewards

After a clash ends, rewards are distributed among participants based on their final scores.

### Social Points

Players earn social points for participating in the ecosystem. These points can be used for exclusive rewards and features.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Monad blockchain team for the high-performance L1
- OpenZeppelin for secure contract implementations

## 🎮 Features

- 🎨 **Mint Rare Critters**: Each Critter is a unique NFT with special attributes that determine their clash performance
- ⚔️ **PvP Clashes**: Enter competitive arenas with 2-10 players in epic battles
- ⚡ **Power-Up System**: Use Speed Boosts strategically to enhance your performance
- 💰 **Score-Based Rewards**: Top performers earn bigger rewards based on their clash scores
- 🏆 **Leaderboard System**: Track your position and prove your Critter's dominance
- 👛 **Multi-Wallet Support**: Connect with MetaMask, WalletConnect, Phantom, or Coinbase
- 📱 **Responsive Design**: Modern UI with smooth animations and mobile-friendly interface
- 🔒 **Secure Integration**: Built with industry-standard Web3 security practices

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Web3 wallet (MetaMask, WalletConnect, etc.)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/0xnana/monadcritters.git
   cd clashofcritters
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables
   ```bash
   # Create a .env file in the root directory
   VITE_REOWN_PROJECT_ID=your_project_id_here
   ```

4. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🛠️ Built With

- [React](https://reactjs.org/) - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Wagmi](https://wagmi.sh/) - Ethereum Hooks
- [AppKit](https://reown.appkit.dev/) - Web3 Integration
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Vite](https://vitejs.dev/) - Build Tool

## 👛 Wallet Support

- [MetaMask](https://metamask.io/)
- [WalletConnect](https://walletconnect.com/)
- [Phantom](https://phantom.app/)
- [Coinbase Wallet](https://www.coinbase.com/wallet)

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👥 Authors

- Dev - [@0xNana](https://github.com/0xNana)

## 🙏 Acknowledgments

- [Monad](https://monad.xyz) - For the amazing blockchain platform
- [Reown](https://reown.appkit.dev/) - For the Web3 integration tools
- [Wagmi](https://wagmi.sh/) - For the Ethereum hooks
- [TailwindCSS](https://tailwindcss.com/) - For the styling framework

## 📞 Contact

Author/Dev - [@0xNana](https://github.com/0xNana)

Project Link: [https://github.com/0xNana/monadcritters](https://github.com/0xNana/monadcritters)

# Critter Clash - Minimalist UI Design

A DRY and KISS approach to the Critter Clash game interface.

## Minimalist Layout

```
+-----------------------------------------------------+
|                                                     |
|  Critter Clash                [Boosts: 5] [+1]      |  <- Header with boost counter
|                                                     |
|  +-------------------+  +----------------------+    |
|  | [+] Create Clash  |  | [↗] Buy Boosts      |    |  <- Main action buttons
|  +-------------------+  +----------------------+    |
|                                                     |
|  +---------------------------------------------------+
|  | Create Clash                                     | |  <- Collapsible form
|  |                                                  | |
|  | [2 Players ▼]  [0.1 MON ▼]                      | |
|  |                                                  | |
|  | Duration: 30s [==========] 300s (60s)           | |
|  |                                                  | |
|  | [       Create Clash       ]                     | |
|  +---------------------------------------------------+
|                                                     |
|  PvP Clashes (2 Players)                            |  <- Category header
|  +----------+  +----------+  +----------+           |
|  |•Lobby #12|  |•Lobby #14|  |•Lobby #15|           |  <- Clash cards (simplified)
|  |2/2 0.1MON|  |1/2 0.2MON|  |0/2 0.1MON|           |
|  |[  Join  ]|  |[  Join  ]|  |[  Join  ]|           |
|  +----------+  +----------+  +----------+           |
|                                                     |
|  Squad Clashes (4 Players)                          |  <- Category header
|  +----------+  +----------+                         |
|  |•Live  #11|  |•Lobby #16|                         |  <- Clash cards (simplified)
|  |4/4 0.5MON|  |2/4 0.3MON|                         |
|  |[ Watch  ]|  |[  Join  ]|                         |
|  +----------+  +----------+                         |
|                                                     |
|  ▼ How to Play                                      |  <- Collapsible help
|                                                     |
+-----------------------------------------------------+

JOIN MODAL:
+---------------------------------------------------+
|                                                   |
| Join Clash #12                                [X] |
|                                                   |
| Select Critter                        Required    |
| +----------+ +----------+ +----------+            |
| |[Critter 1]| |[Critter 2]| |[Critter 3]|         |
| +----------+ +----------+ +----------+            |
|                                                   |
| Boosts                          Available: 5      |
| +-------------------------------------------+     |
| | [-] 0 [+]                  +20% per boost |     |
| +-------------------------------------------+     |
|                                                   |
| +-------------------------------------------+     |
| | Entry Fee:                       0.1 MON  |     |
| | Prize pot is distributed to winner(s)     |     |
| +-------------------------------------------+     |
|                                                   |
| [               Join Clash                ]       |
|                                                   |
+---------------------------------------------------+
```

## Design Principles

1. **Minimalist UI**: Focus on function over form
2. **Visual Hierarchy**: Clear organization of information
3. **Progressive Disclosure**: Show only what's needed
4. **Color Coding**: Status indicators with minimal text
5. **Consistent Components**: Reusable design patterns

## Components

1. **MinimalClashCard**: Compact display of clash info
2. **BoostInventory**: Simplified boost management
3. **JoinClashModal**: Streamlined joining process

## Implementation Benefits

- Reduced visual clutter
- Improved loading performance
- Less cognitive load for users
- More efficient screen space usage
- Consistent look and feel 