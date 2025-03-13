import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'

type MobileMenuProps = {
  isOpen: boolean
  onClose: () => void
  links: Array<{ to: string; label: string }>
}

export function MobileMenu({ isOpen, onClose, links }: MobileMenuProps) {
  const location = useLocation()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Menu */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed right-0 top-0 bottom-0 w-64 bg-purple-900/95 backdrop-blur-lg border-l border-white/10 z-50"
          >
            <div className="p-4 flex flex-col h-full">
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex flex-col gap-2 mt-8">
                {links.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={`
                      px-4 py-3 rounded-lg font-medium transition-all
                      ${location.pathname === to
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-purple-500/20'
                      }
                    `}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 