import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from './ConnectButton'
import { useWallet } from './WalletProvider'
import { motion } from 'framer-motion'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { MobileMenu } from './MobileMenu'
import { useAccount } from 'wagmi'
import React from 'react'

type NavLinkProps = {
  to: string
  children: ReactNode
}

function NavLink({ to, children }: NavLinkProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={`
        px-4 py-2 rounded-lg font-medium transition-all
        ${isActive
          ? 'bg-purple-500 text-white'
          : 'text-gray-300 hover:text-white hover:bg-purple-500/20'
        }
      `}
    >
      {children}
    </Link>
  )
}

const NAV_LINKS = [
  { to: '/mint', label: 'Mint' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/shop', label: 'Shop' },
  { to: '/lobby', label: 'Race' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet()
  const location = useLocation()
  const showNav = location.pathname !== '/' // Hide nav on landing page
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-900 to-black text-white">
      {showNav && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-50 backdrop-blur-lg bg-black/30 border-b border-white/10"
        >
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              MonadCritters
            </Link>

            {isConnected && (
              <div className="hidden md:flex items-center space-x-4">
                {NAV_LINKS.map(link => (
                  <NavLink key={link.to} to={link.to}>{link.label}</NavLink>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4">
              <ConnectButton />
              {isConnected && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Bars3Icon className="w-6 h-6" />
                </button>
              )}
            </div>
          </nav>
        </motion.header>
      )}

      <main className="flex-1">
        {children}
      </main>

      <footer className="py-8 px-4 text-center text-gray-400 text-sm border-t border-white/10">
        <p>Built on Monad Testnet • High Performance L1 Blockchain</p>
      </footer>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        links={NAV_LINKS}
      />
    </div>
  )
} 