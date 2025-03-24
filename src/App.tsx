import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { WalletProvider } from './components/WalletProvider'
import Home from './pages/Home'
import MintingPage from './pages/MintingPage'
import RaceLobbyPage from './pages/RaceLobbyPage'
import RaceView from './features/race/components/RaceView'
import { WagmiConfig } from 'wagmi'
import React from 'react'
import { config } from './utils/config'
import { Layout } from './components/Layout'
import LeaderboardPage from './pages/LeaderboardPage'

function App() {
  return (
    <WagmiConfig config={config as any}>
      <WalletProvider>
        <Router>
          <Layout>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/mint" element={<MintingPage />} />
                <Route path="/lobby" element={<RaceLobbyPage />} />
                <Route path="/clash-arena" element={<RaceView />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
              </Routes>
            </AnimatePresence>
          </Layout>
        </Router>
      </WalletProvider>
    </WagmiConfig>
  )
}

export default App 