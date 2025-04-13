/// <reference types="vite/client" />

import { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { getAccount, watchAccount, disconnect as wagmiDisconnect } from '@wagmi/core'
import { getConfig } from '../utils/config'
import { monadTestnet } from '../utils/chains'
import { createAppKit, useAppKit, useAppKitState } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Get project ID from environment variables
const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || ''

if (!REOWN_PROJECT_ID) {
  console.warn('Reown project ID not found in environment variables, using fallback')
}

// Create QueryClient instance
const queryClient = new QueryClient()

// Create Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  networks: [monadTestnet],
  projectId: REOWN_PROJECT_ID
})

// Initialize AppKit
const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [monadTestnet],
  projectId: REOWN_PROJECT_ID,
  metadata: {
    name: 'Clash Of Critters',
    description: 'Clash with your critters on Monad testnet!',
    url: window.location.origin || 'https://clashofcritters.com',
    icons: [window.location.origin + '/logo.png' || 'https://clashofcritters.com/logo.png'],
  },
  features: {
    email: true,
    socials: ['google', 'x', 'github', 'discord'],
    emailShowWallets: true
  }
})

// Add WalletConnect and mobile wallet specific event listeners
if (typeof window !== 'undefined') {
  // Handle mobile wallet detection
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isInAppBrowser = window.ethereum && (
    window.ethereum.isMetaMask ||
    window.ethereum.isCoinbaseWallet ||
    window.ethereum.isPhantom ||
    window.ethereum.isTrust
  );

  // Set mobile-specific metadata
  if (isMobile) {
    window.localStorage.setItem('wallet-preference', 'mobile');
    if (isInAppBrowser) {
      window.localStorage.setItem('preferred-wallet', 'injected');
    }
  }

  // Listen for wallet events
  window.addEventListener('message', (event) => {
    if (event.data && typeof event.data === 'object') {
      // Handle WalletConnect QR code scan events
      if (event.data.type === 'walletconnect_modal_closed') {
        console.debug('WalletConnect modal closed');
      }
      
      // Handle WalletConnect connection events
      if (event.data.type === '@w3m-app/CONNECTED_ACCOUNT_DATA' || 
          event.data.type === 'walletconnect_connection_success' ||
          event.data.type === 'wallet_connection_success') {
        const address = event.data.data?.address || event.data.address;
        const walletType = event.data.data?.type || 'walletconnect';
        
        if (address) {
          const customEvent = new CustomEvent('wallet-state-updated', {
            detail: {
              address,
              connected: true,
              type: walletType,
              provider: event.data.data?.provider || 'walletconnect',
              isMobile,
              isInAppBrowser
            }
          });
          window.dispatchEvent(customEvent);
        }
      }
    }
  });

  // Handle in-app browser detection
  if (isInAppBrowser) {
    console.debug('Detected in-app browser wallet');
    window.dispatchEvent(new CustomEvent('in-app-browser-detected', {
      detail: { provider: window.ethereum }
    }));
  }
}

// Add a more targeted fix for the contentScript.ts postMessage error
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Create a MutationObserver to watch for script additions
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is a script element
          if (node.nodeName === 'SCRIPT' && 
              node instanceof HTMLScriptElement && 
              node.src && 
              node.src.includes('contentScript.ts')) {
            
            // Add a script to patch the contentScript's postMessage silently
            const patchScript = document.createElement('script');
            patchScript.textContent = `
              (function() {
                setTimeout(() => {
                  try {
                    const originalPostMessage = window.postMessage;
                    window.postMessage = function() {
                      try {
                        if (arguments[1] === null || arguments[1] === undefined) {
                          arguments[1] = '*';
                        }
                        return originalPostMessage.apply(this, arguments);
                      } catch (e) {}
                    };
                  } catch (error) {}
                }, 100);
              })();
            `;
            document.head.appendChild(patchScript);
          }
        });
      }
    });
  });
  
  // Start observing the document
  observer.observe(document, { childList: true, subtree: true });
}

// Only add error handlers in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Add a more comprehensive error handler for postMessage errors
  window.addEventListener('error', (event) => {
    if (
      event.message && 
      (event.message.includes('postMessage') || 
       event.message.includes('Failed to execute') ||
       event.message.includes('Invalid target origin'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  }, true);
  
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason && 
      event.reason.message && 
      (event.reason.message.includes('postMessage') || 
       event.reason.message.includes('Failed to execute') ||
       event.reason.message.includes('Invalid target origin'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  }, true);
}

type WalletContextType = {
  address?: string
  isConnected: boolean
  isConnecting: boolean
  walletType?: string
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
})

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

function WalletProviderInner({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletType, setWalletType] = useState<string>()
  const appKitState = useAppKitState()

  // Add wallet type to the context
  const contextValue = {
    address,
    isConnected,
    isConnecting,
    walletType,
    connect: async () => {
      try {
        setIsConnecting(true)
        await connect()
      } finally {
        setIsConnecting(false)
      }
    },
    disconnect: async () => {
      try {
        setIsConnecting(true)
        await disconnect()
      } finally {
        setIsConnecting(false)
      }
    }
  }

  // Update the effect to track wallet type
  useEffect(() => {
    const handleWalletStateUpdate = (event: any) => {
      const { address, connected, type } = event.detail;
      if (address && connected) {
        setAddress(address);
        setIsConnected(true);
        setWalletType(type);
        setIsConnecting(false);
      }
    };

    window.addEventListener('wallet-state-updated', handleWalletStateUpdate);
    return () => {
      window.removeEventListener('wallet-state-updated', handleWalletStateUpdate);
    };
  }, []);

  // Add a more aggressive polling mechanism to check connection state
  useEffect(() => {
    let checkInterval: number | null = null;
    
    const checkConnectionState = () => {
      // Get the current AppKit state
      const currentState = appKitState;
      
      // Extract address from various possible locations
      const appKitAddress = 
        (currentState as any)?.address || 
        (currentState as any)?.data?.address ||
        (currentState as any)?.w3mState?.address;
      
      // Check if modal is open - if it's closed and we have an address, we're likely connected
      const modalClosed = (currentState as any)?.open === false;
      
      if (appKitAddress && modalClosed) {
        setAddress(appKitAddress);
        setIsConnected(true);
        
        // If we found a connection, we can stop polling
        if (checkInterval) {
          window.clearInterval(checkInterval);
          checkInterval = null;
        }
      }
    };
    
    // Start polling when component mounts, but with a longer interval
    checkInterval = window.setInterval(checkConnectionState, 3000); // Increased from 1000ms to 3000ms
    
    // Run an initial check
    checkConnectionState();
    
    // Clean up interval on unmount or when appKitState changes
    return () => {
      if (checkInterval) {
        window.clearInterval(checkInterval);
      }
    };
  }, [appKitState]);

  // Force a connection check when AppKit state changes
  useEffect(() => {
    // This will run on every AppKit state change
    const forceConnectionCheck = async () => {
      try {
        // Get the raw AppKit state object
        const rawState = appKitState as any;
        
        // Check for address in all possible locations
        const possibleAddress = 
          rawState?.address || 
          rawState?.data?.address || 
          rawState?.w3mState?.address ||
          (rawState?.session?.namespaces?.eip155?.accounts?.[0]?.split(':')[2]) ||
          rawState?.session?.address;
        
        if (possibleAddress && !isConnected) {
          setAddress(possibleAddress);
          setIsConnected(true);
          
          // Dispatch a custom event that our components can listen for
          const customEvent = new CustomEvent('wallet-state-updated', { 
            detail: { address: possibleAddress, connected: true } 
          });
          window.dispatchEvent(customEvent);
        }
      } catch (error) {
        // Silently handle error
      }
    };
    
    forceConnectionCheck();
  }, [appKitState, isConnected]);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check Wagmi connection
        const account = getAccount(getConfig());
        
        // If Wagmi shows connected, use that
        if (account.isConnected && account.address) {
          setAddress(account.address);
          setIsConnected(true);
          return;
        }
        
        // Force a refresh of the connection state
        const refreshedAccount = getAccount(getConfig());
        if (refreshedAccount.isConnected && refreshedAccount.address) {
          setAddress(refreshedAccount.address);
          setIsConnected(true);
        }
      } catch (error) {
        // Silently handle error
      }
    };
    
    checkConnection();
  }, []);

  useEffect(() => {
    // Watch for account changes from Wagmi
    const unwatch = watchAccount(getConfig(), {
      onChange(account) {
        if (account.address) {
          setAddress(account.address)
          setIsConnected(account.isConnected)
        }
      },
    })

    return () => unwatch()
  }, [])

  // Watch AppKit state changes
  useEffect(() => {
    // More comprehensive check for AppKit connection state
    const appKitConnected = 
      (appKitState as any)?.isConnected || 
      (appKitState as any)?.status === 'connected' ||
      ((appKitState as any)?.data?.address && 
       ((appKitState as any)?.data?.type === 'email' || 
        (appKitState as any)?.data?.type === 'social')) ||
      ((appKitState as any)?.open === false && (appKitState as any)?.data?.address);
    
    // Get address from multiple possible locations
    const appKitAddress = 
      (appKitState as any)?.address || 
      (appKitState as any)?.data?.address;

    // Update connection state if AppKit shows connected
    if (appKitConnected && appKitAddress) {
      setIsConnected(true);
      setAddress(appKitAddress);
    } else if (appKitConnected === false && !appKitAddress) {
      // Only update if AppKit specifically says we're disconnected
      setIsConnected(false);
      setAddress(undefined);
    }
  }, [appKitState])

  // Listen for custom AppKit connection events
  useEffect(() => {
    const handleAppKitConnected = (event: any) => {
      const { address: eventAddress } = event.detail;
      if (eventAddress) {
        setAddress(eventAddress);
        setIsConnected(true);
      }
    };
    
    window.addEventListener('appkit-connected', handleAppKitConnected);
    
    return () => {
      window.removeEventListener('appkit-connected', handleAppKitConnected);
    };
  }, []);

  const connect = async () => {
    try {
      setIsConnecting(true)
      
      // Before opening the modal, check if we're already connected
      const currentState = appKitState as any;
      const existingAddress = 
        currentState?.address || 
        currentState?.data?.address ||
        currentState?.w3mState?.address;
      
      // Check for address in session data
      const sessionAddress = currentState?.session?.namespaces?.eip155?.accounts?.[0]?.split(':')?.[2];
      
      if (existingAddress || sessionAddress) {
        setAddress(existingAddress || sessionAddress);
        setIsConnected(true);
        setIsConnecting(false);
        return;
      }
      
      // Open the modal
      await appKit.open()
      
      // Start polling approach with optimized intervals
      let attempts = 0;
      const maxAttempts = 20; // Reduced from 30
      let pollInterval = 1000; // Start with 1 second
      
      const checkConnection = async () => {
        attempts++;
        
        // Check Wagmi account first
        const account = getAccount(getConfig())
        if (account.address) {
          setAddress(account.address)
          setIsConnected(account.isConnected)
          setIsConnecting(false)
          return true;
        }
        
        // Check AppKit state directly
        const currentAppKitState = appKitState as any;
        
        // Extract address from various possible locations
        const appKitAddress = 
          currentAppKitState?.address || 
          currentAppKitState?.data?.address ||
          currentAppKitState?.w3mState?.address;
        
        // Check for WalletConnect specific state
        const wcAddress = currentAppKitState?.data?.address;
        const wcConnected = currentAppKitState?.data?.type === 'walletconnect';
        const wcSession = currentAppKitState?.session?.namespaces?.eip155?.accounts?.[0];
        
        // Check if modal is closed or we have a WalletConnect session
        const modalClosed = currentAppKitState?.open === false;
        const hasWalletConnectSession = (wcAddress && wcConnected) || wcSession;
        
        if ((appKitAddress && modalClosed) || hasWalletConnectSession) {
          const finalAddress = appKitAddress || wcAddress || wcSession?.split(':')?.[2];
          setAddress(finalAddress);
          setIsConnected(true);
          setIsConnecting(false);
          
          // Dispatch connection event
          window.dispatchEvent(new CustomEvent('wallet-state-updated', {
            detail: {
              address: finalAddress,
              connected: true,
              type: wcConnected ? 'walletconnect' : 'unknown'
            }
          }));
          return true;
        }
        
        if (attempts < maxAttempts) {
          // Increase polling interval progressively
          pollInterval = Math.min(pollInterval * 1.5, 5000); // Cap at 5 seconds
          setTimeout(checkConnection, pollInterval);
        } else {
          setIsConnecting(false);
        }
        
        return false;
      };
      
      // Start checking for connection with initial 1 second delay
      setTimeout(checkConnection, 1000);
      
    } catch (error) {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      setIsConnecting(true)
      await wagmiDisconnect(getConfig())
      await appKit.close()
      setAddress(undefined)
      setIsConnected(false)
      setWalletType(undefined)
      
      // Dispatch disconnect event
      window.dispatchEvent(new CustomEvent('wallet-state-updated', {
        detail: {
          address: undefined,
          connected: false,
          type: undefined
        }
      }))
      
      // Clear any stored session data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wagmi.wallet')
        localStorage.removeItem('wagmi.connected')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletProviderInner>{children}</WalletProviderInner>
      </QueryClientProvider>
    </WagmiProvider>
  )
} 