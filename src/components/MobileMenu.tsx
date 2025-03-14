import { ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import React from 'react'

type MobileMenuProps = {
  isOpen: boolean
  onClose: () => void
  links: Array<{ to: string; label: string; comingSoon?: boolean }>
}

export function MobileMenu({ isOpen, onClose, links }: MobileMenuProps) {
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const lastButtonRef = useRef<HTMLAnchorElement>(null)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'Escape':
          onClose()
          break
        case 'Tab':
          if (event.shiftKey && document.activeElement === firstButtonRef.current) {
            event.preventDefault()
            lastButtonRef.current?.focus()
          } else if (!event.shiftKey && document.activeElement === lastButtonRef.current) {
            event.preventDefault()
            firstButtonRef.current?.focus()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus management
  useEffect(() => {
    if (isOpen) {
      firstButtonRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const menuVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: 'spring', damping: 20 } },
    exit: { x: '100%', opacity: 0, transition: { type: 'spring', damping: 20 } }
  }

  const linkVariants = {
    hidden: { x: 20, opacity: 0 },
    visible: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        type: 'spring',
        damping: 20
      }
    })
  }

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
            aria-hidden="true"
          />

          {/* Menu */}
          <motion.div
            ref={menuRef}
            role="dialog"
            aria-label="Mobile menu"
            aria-modal="true"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={menuVariants}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x > 100) {
                onClose()
              }
            }}
            className="fixed right-0 top-0 bottom-0 w-64 bg-purple-900/95 backdrop-blur-lg border-l border-white/10 z-50 shadow-xl"
          >
            <div className="p-4 flex flex-col h-full">
              <div className="flex justify-end">
                <button
                  ref={firstButtonRef}
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-purple-900"
                  aria-label="Close menu"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex flex-col gap-2 mt-8" aria-label="Mobile navigation">
                {links.map(({ to, label, comingSoon }, i) => (
                  <motion.div
                    key={to}
                    custom={i}
                    variants={linkVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative"
                  >
                    <Link
                      to={to}
                      onClick={(e) => {
                        if (comingSoon) {
                          e.preventDefault()
                          return
                        }
                        onClose()
                      }}
                      ref={i === links.length - 1 ? lastButtonRef : undefined}
                      className={`
                        px-4 py-3 rounded-lg font-medium transition-all block
                        focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-purple-900
                        ${comingSoon ? 'opacity-50 cursor-not-allowed' : ''}
                        ${location.pathname === to
                          ? 'bg-purple-500 text-white'
                          : 'text-gray-300 hover:text-white hover:bg-purple-500/20'
                        }
                      `}
                      aria-current={location.pathname === to ? 'page' : undefined}
                    >
                      {label}
                      {comingSoon && (
                        <span className="absolute top-1 right-2 px-2 py-0.5 bg-purple-500 rounded-full text-[10px] font-medium text-white">
                          Coming Soon
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </nav>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 