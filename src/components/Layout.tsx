import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from './ConnectButton'
import { useWallet } from './WalletProvider'
import { motion } from 'framer-motion'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { MobileMenu } from './MobileMenu'
import { useAccount } from 'wagmi'
import React from 'react'


type NavLink = {
  to: string
  label: string
  comingSoon?: boolean
}

const NAV_LINKS: NavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/mint', label: 'Mint' },
  { to: '/lobby', label: 'Lobby' },
  { to: '/race', label: 'Race' },
  { to: '/leaderboard', label: 'Leaderboard' },
]

type NavLinkProps = {
  to: string
  children: ReactNode
  comingSoon?: boolean
}

function NavLink({ to, children, comingSoon = false }: NavLinkProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <div className="relative group">
      <Link
        to={to}
        className={`
          px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap
          ${comingSoon ? 'opacity-50 cursor-not-allowed' : ''}
          ${isActive
            ? 'bg-purple-500 text-white'
            : 'text-gray-300 hover:text-white hover:bg-purple-500/20'
          }
        `}
        onClick={comingSoon ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </Link>
      {comingSoon && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-purple-500 rounded-full text-[10px] font-medium text-white whitespace-nowrap">
          Coming Soon
        </div>
      )}
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
                  className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 whitespace-nowrap"
                >
                  MonadCritters
                </Link>
              </div>

              {/* Navigation Links - Center */}
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-6">
                  {NAV_LINKS.map(link => (
                    <NavLink key={link.to} to={link.to} comingSoon={link.comingSoon}>
                      {link.label}
                    </NavLink>
                  ))}
                </div>
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
                className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 whitespace-nowrap"
              >
                MonadCritters
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
        links={NAV_LINKS}
      />
    </div>
  )
} 