/// <reference types="vite/client" />

import { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { getAccount, watchAccount, disconnect as wagmiDisconnect } from '@wagmi/core'
import { config } from '../utils/config'
import { monadTestnet } from '../utils/chains'
import { createAppKit, useAppKit, useAppKitState } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Get project ID from environment variables
const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || '28fcdde9a2c6d9e5c3b9a4e8f7d6b5a4'

if (!REOWN_PROJECT_ID) {
  console.warn('Reown project ID not found in environment variables, using fallback')
}

// Create QueryClient instance
const queryClient = new QueryClient()

// Create Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  networks: [monadTestnet],
  projectId: REOWN_PROJECT_ID,
})

// Initialize AppKit
createAppKit({
  adapters: [wagmiAdapter],
  networks: [monadTestnet],
  metadata: {
    name: 'MonadCritters',
    description: 'Race your critters on Monad testnet!',
    url: window.location.origin || 'https://monadcritters.com',
    icons: [window.location.origin + '/logo.png' || 'https://monadcritters.com/logo.png'],
  },
  projectId: REOWN_PROJECT_ID,
  features: {
    analytics: false, // Disable analytics to avoid 403 errors
    email: false, // Disable email login since WalletConnect doesn't support Monad testnet
    socials: [], // Disable social logins since WalletConnect doesn't support Monad testnet
    emailShowWallets: true, // Show wallet options on first connect screen
  },
  allWallets: 'SHOW', // Show all available wallets
})

// Add error handler for postMessage errors
if (typeof window !== 'undefined') {
  // Add a more comprehensive error handler for postMessage errors
  window.addEventListener('error', (event) => {
    // Check for postMessage errors
    if (
      event.message && 
      (event.message.includes('postMessage') || 
       event.message.includes('Failed to execute') ||
       event.message.includes('Invalid target origin'))
    ) {
      console.warn('AppKit postMessage error suppressed:', event.message);
      // Prevent the error from showing in console
      event.preventDefault();
      event.stopPropagation();
      return true; // Prevents the error from bubbling up
    }
  }, true); // Use capture phase to catch errors early
  
  // Add a global unhandledrejection handler for Promise errors
  window.addEventListener('unhandledrejection', (event) => {
    // Check if the error is related to postMessage
    if (
      event.reason && 
      event.reason.message && 
      (event.reason.message.includes('postMessage') || 
       event.reason.message.includes('Failed to execute') ||
       event.reason.message.includes('Invalid target origin'))
    ) {
      console.warn('AppKit postMessage promise error suppressed:', event.reason.message);
      // Prevent the error from showing in console
      event.preventDefault();
      event.stopPropagation();
      return true; // Prevents the error from bubbling up
    }
  }, true); // Use capture phase to catch errors early
}

// Add event listener for AppKit connection events
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Check if the message is from AppKit
    if (event.data && typeof event.data === 'object' && 'type' in event.data) {
      const { type, data } = event.data;
      
      // Check for connection events
      if (type === '@w3m-app/CONNECTED_ACCOUNT_DATA' && data && data.address) {
        console.debug('AppKit connection event detected:', data);
        
        // Dispatch a custom event that our components can listen for
        const customEvent = new CustomEvent('appkit-connected', { 
          detail: { address: data.address, type: data.type || 'unknown' } 
        });
        window.dispatchEvent(customEvent);
      }
    }
  });
}

// Add a more targeted fix for the contentScript.ts postMessage error
if (typeof window !== 'undefined') {
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
            
            console.debug('Detected contentScript.ts loading, applying patch');
            
            // Add a script to patch the contentScript's postMessage
            const patchScript = document.createElement('script');
            patchScript.textContent = `
              (function() {
                // Wait for the contentScript to load
                setTimeout(() => {
                  try {
                    // Override any postMessage calls with null origin
                    const originalPostMessage = window.postMessage;
                    window.postMessage = function() {
                      try {
                        if (arguments[1] === null || arguments[1] === undefined) {
                          arguments[1] = '*';
                        }
                        return originalPostMessage.apply(this, arguments);
                      } catch (e) {
                        console.warn('Patched postMessage error:', e);
                        return undefined;
                      }
                    };
                    console.debug('Applied postMessage patch for contentScript.ts');
                  } catch (error) {
                    console.error('Failed to patch postMessage:', error);
                  }
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

type WalletContextType = {
  address?: string
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
})

export const useWallet = () => useContext(WalletContext)

function WalletProviderInner({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const appKit = useAppKit()
  const appKitState = useAppKitState()

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
      
      console.debug('Aggressive connection check:', { 
        appKitAddress, 
        modalClosed,
        currentState
      });
      
      if (appKitAddress && modalClosed) {
        console.debug('Found address in aggressive check, updating state:', appKitAddress);
        setAddress(appKitAddress);
        setIsConnected(true);
        
        // If we found a connection, we can stop polling
        if (checkInterval) {
          window.clearInterval(checkInterval);
          checkInterval = null;
        }
      }
    };
    
    // Start polling when component mounts
    checkInterval = window.setInterval(checkConnectionState, 1000);
    
    // Clean up interval on unmount
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
        
        // Log the complete state for debugging
        console.debug('AppKit state changed, raw state:', rawState);
        
        // Check for address in all possible locations
        const possibleAddress = 
          rawState?.address || 
          rawState?.data?.address || 
          rawState?.w3mState?.address ||
          (rawState?.session?.namespaces?.eip155?.accounts?.[0]?.split(':')[2]) ||
          rawState?.session?.address;
        
        if (possibleAddress && !isConnected) {
          console.debug('Found address in AppKit state change, updating:', possibleAddress);
          setAddress(possibleAddress);
          setIsConnected(true);
          
          // Dispatch a custom event that our components can listen for
          const customEvent = new CustomEvent('wallet-state-updated', { 
            detail: { address: possibleAddress, connected: true } 
          });
          window.dispatchEvent(customEvent);
        }
      } catch (error) {
        console.error('Error in force connection check:', error);
      }
    };
    
    forceConnectionCheck();
  }, [appKitState, isConnected]);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check Wagmi connection
        const account = getAccount(config);
        
        // If Wagmi shows connected, use that
        if (account.isConnected && account.address) {
          console.debug('Found connected Wagmi account on mount:', account);
          setAddress(account.address);
          setIsConnected(true);
          return;
        }
        
        // Try to get AppKit state directly
        console.debug('Checking AppKit connection on mount');
        
        // Force a refresh of the connection state
        const refreshedAccount = getAccount(config);
        if (refreshedAccount.isConnected && refreshedAccount.address) {
          console.debug('Found connected account after refresh:', refreshedAccount);
          setAddress(refreshedAccount.address);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error checking wallet connection on mount:', error);
      }
    };
    
    checkConnection();
  }, []);

  // Debug logging for AppKit state
  useEffect(() => {
    console.debug('AppKit state updated:', appKitState);
  }, [appKitState]);

  useEffect(() => {
    // Watch for account changes from Wagmi
    const unwatch = watchAccount(config, {
      onChange(account) {
        console.debug('Wagmi account changed:', account);
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
      // Check standard connection property
      (appKitState as any)?.isConnected || 
      // Check status property
      (appKitState as any)?.status === 'connected' ||
      // Check for social/email login in data
      ((appKitState as any)?.data?.address && 
       ((appKitState as any)?.data?.type === 'email' || 
        (appKitState as any)?.data?.type === 'social')) ||
      // Check for open property being false (indicating connected)
      ((appKitState as any)?.open === false && (appKitState as any)?.data?.address);
    
    // Get address from multiple possible locations
    const appKitAddress = 
      (appKitState as any)?.address || 
      (appKitState as any)?.data?.address;

    console.debug('Processing AppKit state:', { 
      appKitAddress, 
      appKitConnected,
      rawState: appKitState 
    });

    // Update connection state if AppKit shows connected
    if (appKitConnected && appKitAddress) {
      console.debug('AppKit connected with address:', appKitAddress);
      setIsConnected(true);
      setAddress(appKitAddress);
    } else if (appKitConnected === false && !appKitAddress) {
      // Only update if AppKit specifically says we're disconnected
      console.debug('AppKit disconnected');
      setIsConnected(false);
      setAddress(undefined);
    }
  }, [appKitState])

  // Listen for custom AppKit connection events
  useEffect(() => {
    const handleAppKitConnected = (event: any) => {
      const { address: eventAddress, type } = event.detail;
      console.debug('AppKit connected event received:', { address: eventAddress, type });
      
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
      console.debug('Opening AppKit modal');
      
      // Before opening the modal, check if we're already connected
      const currentState = appKitState as any;
      const existingAddress = 
        currentState?.address || 
        currentState?.data?.address ||
        currentState?.w3mState?.address;
      
      // Check for address in session data
      const sessionAddress = currentState?.session?.namespaces?.eip155?.accounts?.[0]?.split(':')?.[2];
      
      if (existingAddress || sessionAddress) {
        console.debug('Already connected with address:', existingAddress || sessionAddress);
        setAddress(existingAddress || sessionAddress);
        setIsConnected(true);
        setIsConnecting(false);
        return;
      }
      
      // Open the modal
      await appKit.open()
      
      // Start an aggressive polling approach to detect connection
      let attempts = 0;
      const maxAttempts = 10;
      const checkConnection = async () => {
        attempts++;
        console.debug(`Connection check attempt ${attempts}/${maxAttempts}`);
        
        // Check Wagmi account first
        const account = getAccount(config)
        if (account.address) {
          console.debug('Found connected account in Wagmi:', account);
          setAddress(account.address)
          setIsConnected(account.isConnected)
          setIsConnecting(false)
          return true;
        }
        
        // Check AppKit state directly
        const currentAppKitState = appKitState as any;
        console.debug('Current AppKit state in polling:', currentAppKitState);
        
        // Extract address from various possible locations
        const appKitAddress = 
          currentAppKitState?.address || 
          currentAppKitState?.data?.address ||
          currentAppKitState?.w3mState?.address;
        
        // Check for address in session data
        const sessionAddress = currentAppKitState?.session?.namespaces?.eip155?.accounts?.[0]?.split(':')?.[2];
        
        // Check if modal is closed - if it's closed and we have an address, we're connected
        const modalClosed = currentAppKitState?.open === false;
        
        if ((appKitAddress && modalClosed) || sessionAddress) {
          console.debug('Found connected address in AppKit:', appKitAddress || sessionAddress);
          setAddress(appKitAddress || sessionAddress);
          setIsConnected(true);
          setIsConnecting(false);
          return true;
        }
        
        if (attempts < maxAttempts) {
          // Try again after a delay
          setTimeout(checkConnection, 1000);
        } else {
          console.debug('Max connection check attempts reached, giving up');
          setIsConnecting(false);
        }
        
        return false;
      };
      
      // Start checking for connection
      setTimeout(checkConnection, 1000);
      
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      console.debug('Disconnecting wallet');
      await wagmiDisconnect(config)
      await appKit.close()
      setAddress(undefined)
      setIsConnected(false)
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }
  }

  return (
    <WalletContext.Provider value={{ address, isConnected, connect, disconnect, isConnecting }}>
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