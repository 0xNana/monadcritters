import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { WalletProvider } from './components/WalletProvider'
import { useWallet } from './components/WalletProvider'
import Home from './pages/Home'
import MintingPage from './pages/MintingPage'
import RaceLobbyPage from './pages/RaceLobbyPage'
import RaceView from './features/race/components/RaceView'
import { createConfig, WagmiConfig } from 'wagmi'
import React from 'react'
import { monadTestnet } from './utils/chains'
import { sepolia } from 'viem/chains'
import { createPublicClient, http } from 'viem'

// Navigation link component with animation
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link to={to}>
      <motion.div
        className={`px-4 py-2 rounded-lg transition-colors relative ${
          isActive ? 'text-blue-400' : 'text-gray-300 hover:text-blue-400'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {children}
        {isActive && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
            layoutId="underline"
          />
        )}
      </motion.div>
    </Link>
  )
}

// Wallet connection button component
function WalletButton() {
  const { isConnected, address, connect, disconnect } = useWallet()

  return (
    <motion.button
      onClick={isConnected ? disconnect : connect}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        px-4 py-2 rounded-lg font-medium
        ${isConnected 
          ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' 
          : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
        }
      `}
    >
      {isConnected 
        ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
        : 'Log In'
      }
    </motion.button>
  )
}

function Navigation() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/30 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-16">
          {/* Logo - 25% width */}
          <div className="w-1/4">
            <Link to="/mint">
              <motion.div
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                MonadCritters
              </motion.div>
            </Link>
          </div>

          {/* Navigation Links - 50% width, centered */}
          <div className="flex items-center justify-center w-1/2 space-x-4">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/mint">Mint</NavLink>
            <NavLink to="/lobby">Lobby</NavLink>
            <NavLink to="/race">Race</NavLink>
          </div>

          {/* Wallet Connection - 25% width, right aligned */}
          <div className="w-1/4 flex justify-end">
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  )
}

// Create wagmi config
const config = createConfig({
  chains: [monadTestnet, sepolia],
  transports: {
    [monadTestnet.id]: http(),
    [sepolia.id]: http(),
  },
})

function App() {
  return (
    <WagmiConfig config={config}>
      <WalletProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
            <Navigation />
            
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/mint" element={<MintingPage />} />
                <Route path="/lobby" element={<RaceLobbyPage />} />
                <Route path="/race" element={<RaceView />} />
              </Routes>
            </AnimatePresence>
          </div>
        </Router>
      </WalletProvider>
    </WagmiConfig>
  )
}

export default App 