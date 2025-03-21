import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from './WalletProvider'
import { WalletDropdown } from './WalletDropdown'
import { useAppKitState } from '@reown/appkit/react'

// Simple placeholder avatar using Jazzicon-style background
const getAvatarBackground = (address: string) => {
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export function ConnectButton() {
  const { address, isConnected, connect, isConnecting } = useWallet()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [localAddress, setLocalAddress] = useState<string | undefined>(address)
  const [localConnected, setLocalConnected] = useState(isConnected)
  const appKitState = useAppKitState()
  
  // Force a re-render periodically to ensure we're showing the latest state
  useEffect(() => {
    const forceUpdateInterval = setInterval(() => {
      // This will trigger a re-render
      setIsDropdownOpen(prev => prev);
    }, 2000);
    
    return () => clearInterval(forceUpdateInterval);
  }, []);
  
  // Update local state when wallet state changes
  useEffect(() => {
    setLocalAddress(address);
    setLocalConnected(isConnected);
  }, [address, isConnected]);
  
  // Watch AppKit state for connection changes
  useEffect(() => {
    // Check for address in AppKit state
    const appKitAddress = 
      (appKitState as any)?.address || 
      (appKitState as any)?.data?.address ||
      (appKitState as any)?.w3mState?.address;
    
    // Check if the modal is closed - this is a strong indicator that the user has connected
    const modalClosed = (appKitState as any)?.open === false;
    
    // Check if we have session data
    const hasSession = !!(appKitState as any)?.session?.namespaces?.eip155?.accounts?.[0];
    
    // If we have an address and the modal is closed, or we have session data, we're likely connected
    if ((appKitAddress && modalClosed) || hasSession) {
      setLocalAddress(appKitAddress);
      setLocalConnected(true);
      
      // Try to update the parent state
      connect();
      
      // Force a UI update
      setTimeout(() => {
        setIsDropdownOpen(prev => !prev);
        setTimeout(() => setIsDropdownOpen(prev => !prev), 100);
      }, 500);
    }
  }, [appKitState, localConnected, connect]);

  // Listen for wallet state updated events
  useEffect(() => {
    const handleWalletStateUpdated = (event: any) => {
      const { address: eventAddress, connected } = event.detail;
      if (eventAddress && connected) {
        setLocalAddress(eventAddress);
        setLocalConnected(true);
      }
    };
    
    window.addEventListener('wallet-state-updated', handleWalletStateUpdated);
    
    return () => {
      window.removeEventListener('wallet-state-updated', handleWalletStateUpdated);
    };
  }, []);

  // Listen for custom AppKit connection events
  useEffect(() => {
    const handleAppKitConnected = (event: any) => {
      const { address: eventAddress } = event.detail;
      if (eventAddress) {
        setLocalAddress(eventAddress);
        setLocalConnected(true);
      }
    };
    
    window.addEventListener('appkit-connected', handleAppKitConnected);
    
    return () => {
      window.removeEventListener('appkit-connected', handleAppKitConnected);
    };
  }, []);

  // Check if we're effectively connected (either through parent state or local state)
  const effectivelyConnected = isConnected || localConnected;
  
  // Try to extract address from session data if available
  const sessionAddress = (appKitState as any)?.session?.namespaces?.eip155?.accounts?.[0]?.split(':')?.[2];
  
  const effectiveAddress = address || localAddress || 
    sessionAddress ||
    (appKitState as any)?.address || 
    (appKitState as any)?.data?.address ||
    (appKitState as any)?.w3mState?.address;

  // Handle connect button click
  const handleConnect = useCallback(async () => {
    // Check if we already have an address in AppKit state
    const appKitAddress = 
      (appKitState as any)?.address || 
      (appKitState as any)?.data?.address ||
      (appKitState as any)?.w3mState?.address;
    
    if (appKitAddress) {
      console.debug('Already have address in AppKit state, updating local state:', appKitAddress);
      setLocalAddress(appKitAddress);
      setLocalConnected(true);
    }
    
    // Add a warning about social/email login limitations
    const showSocialLoginWarning = () => {
      // Only show this warning once per session
      if (!sessionStorage.getItem('monad-social-login-warning-shown')) {
        setTimeout(() => {
          alert('Note: Social and email logins are currently disabled.');
          sessionStorage.setItem('monad-social-login-warning-shown', 'true');
        }, 500);
      }
    };
    
    showSocialLoginWarning();
    
    // Call the connect function from WalletProvider
    connect();
  }, [appKitState, connect]);

  if (!effectivelyConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting...' : 'Log In'}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-purple-500/20 p-0.5">
          <img
            src="/monad-icon.png"
            alt="Monad Avatar"
            className="w-full h-full rounded-full"
          />
        </div>
        <span className="text-sm font-medium text-white">
          {effectiveAddress ? `${effectiveAddress.slice(0, 4)}...${effectiveAddress.slice(-4)}` : 'Connected'}
        </span>
      </button>

      <WalletDropdown
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        address={effectiveAddress || ''}
      />
    </div>
  )
} 