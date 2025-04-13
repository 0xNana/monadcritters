import React from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon, HomeIcon } from '@heroicons/react/24/outline'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from './ConnectButton'

// Import the navigation array from Layout
import { navigation } from './Layout'

type MobileMenuProps = {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const location = useLocation();

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-black/90 px-4 pb-4 pt-5 text-left shadow-xl transition-all w-full sm:max-w-sm sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-transparent text-gray-400 hover:text-gray-200"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-10 mb-6 text-center">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500"
                    onClick={onClose}
                  >
                    <HomeIcon className="w-5 h-5 text-blue-400" />
                    Clash Of Critters
                  </Link>
                </div>

                <div className="flex flex-col items-center space-y-6">
                  <div className="flex flex-col items-center w-full space-y-2">
                    {navigation.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`
                            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                            ${isActive 
                              ? 'bg-purple-600/20 text-white' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                          onClick={onClose}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                  
                  <ConnectButton />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 