import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { WalletProvider } from './components/WalletProvider'
import Home from './pages/Home'
import MintingPage from './pages/MintingPage'
import RaceLobbyPage from './pages/RaceLobbyPage'
import RaceView from './features/race/components/RaceView'
import { createConfig, WagmiConfig } from 'wagmi'
import React from 'react'
import { monadTestnet } from './utils/chains'
import { sepolia } from 'viem/chains'
import { http } from 'viem'
import { Layout } from './components/Layout'

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
          <Layout>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/mint" element={<MintingPage />} />
                <Route path="/lobby" element={<RaceLobbyPage />} />
                <Route path="/race" element={<RaceView />} />
              </Routes>
            </AnimatePresence>
          </Layout>
        </Router>
      </WalletProvider>
    </WagmiConfig>
  )
}

export default App 