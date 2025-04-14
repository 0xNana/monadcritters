import React, { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from './ConnectButton'
import { useWallet } from './WalletProvider'
import { motion } from 'framer-motion'
import { 
  Bars3Icon, 
  HomeIcon, 
  TrophyIcon,
  FireIcon,
  UsersIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'
import { MobileMenu } from './MobileMenu'
import { useState } from 'react'

export const navigation = [
  { name: 'Lobby', href: '/clashes', icon: UsersIcon },
  { name: 'Clash View', href: '/clash-view', icon: ClipboardDocumentListIcon },
  { name: 'Leaderboard', href: '/clash/leaderboard', icon: TrophyIcon },
]

export function Layout({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-900 to-black text-white">
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 backdrop-blur-lg bg-black/30 border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto">
          <div className="mx-4 sm:mx-6 lg:mx-8 h-16">
            {/* Desktop Navigation */}
            <div className="h-full hidden md:grid grid-cols-[220px_1fr_220px] items-center gap-8">
              {/* Logo Section */}
              <div className="flex items-center">
                <Link 
                  to="/" 
                  className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 hover:scale-105 transition-transform whitespace-nowrap"
                >
                  <FireIcon className="w-5 h-5 text-blue-400" />
                  Clash Of Critters
                </Link>
              </div>

              {/* Navigation Links - Center */}
              <div className="flex items-center justify-center">
                <nav className="flex space-x-4">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isActive 
                            ? 'bg-purple-600/20 text-white' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    )
                  })}
                </nav>
              </div>

              {/* Right Section */}
              <div className="flex items-center justify-end">
                <ConnectButton />
              </div>
            </div>

            {/* Mobile Navigation */}
            <div className="h-full md:hidden flex items-center justify-between">
              <Link 
                to="/" 
                className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 whitespace-nowrap"
              >
                <FireIcon className="w-5 h-5 text-blue-400" />
                Clash Of Critters
              </Link>
              
              <div className="flex items-center gap-4">
                <ConnectButton />
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Bars3Icon className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="py-8 px-4 text-center text-gray-400 text-sm border-t border-white/10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/monad-logo.svg" alt="Monad" className="w-5 h-5" />
          <p>Built on Monad Testnet • High Performance L1 Blockchain</p>
        </div>
        <div className="flex items-center justify-center space-x-6">
          <a
            href="https://x.com/0xElegant"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            𝕏 Twitter
          </a>
          <a
            href="https://t.me/Elegant_CF"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Telegram
          </a>
          <a
            href="https://github.com/0xNana"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://discord.com/users/0xElegant"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Discord
          </a>
        </div>
      </footer>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </div>
  )
} 