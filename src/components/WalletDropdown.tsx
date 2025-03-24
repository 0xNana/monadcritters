import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from './WalletProvider';
import { useBalance } from 'wagmi';
import { Toast } from './Toast';
import { useAppKitState } from '@reown/appkit/react';

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  walletType?: string;
}

export function WalletDropdown({ isOpen, onClose, address, walletType }: WalletDropdownProps) {
  const { disconnect } = useWallet();
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
  });
  const [showToast, setShowToast] = useState(false);
  const appKitState = useAppKitState();

  // Get wallet icon based on type
  const getWalletIcon = () => {
    switch (walletType?.toLowerCase()) {
      case 'walletconnect':
        return '/walletconnect-icon.png'
      case 'phantom':
        return '/phantom-icon.png'
      case 'metamask':
        return '/metamask-icon.png'
      case 'coinbase':
        return '/coinbase-icon.png'
      default:
        return '/monad-icon.png'
    }
  }

  // Get wallet name for display
  const getWalletName = () => {
    if (!walletType) return 'Connected Wallet'
    return walletType.charAt(0).toUpperCase() + walletType.slice(1).toLowerCase()
  }

  const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setShowToast(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onClose();
      // Force a UI update after disconnect
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('wallet-state-updated', {
          detail: {
            address: undefined,
            connected: false,
            type: undefined
          }
        }));
      }, 100);
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still close the dropdown even if there's an error
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={onClose}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-72 rounded-xl bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
            >
              <div className="p-4 relative">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Profile Section */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 p-1">
                    <img
                      src={getWalletIcon()}
                      alt={`${getWalletName()} Icon`}
                      className="w-full h-full rounded-full"
                    />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{truncatedAddress}</div>
                    <div className="text-sm text-gray-400">{getWalletName()}</div>
                    <div className="text-sm text-gray-400">
                      {balance ? `${Number(balance.formatted).toFixed(3)} ${balance.symbol}` : '0 MON'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={handleCopyAddress}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                      />
                    </svg>
                    Copy Address
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Disconnect
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toast
        message="Address copied to clipboard!"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </>
  );
} 