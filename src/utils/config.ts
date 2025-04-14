import { createConfig, http } from '@wagmi/core'
import { monadTestnet } from './chains'
import { useChains } from 'wagmi'
import { createTransport, type HttpTransport } from 'viem'
import { type Chain } from 'viem/chains'
// Contract addresses from environment variables
const MONAD_CRITTER_ADDRESS = process.env.VITE_MONAD_CRITTER_ADDRESS || import.meta.env?.VITE_MONAD_CRITTER_ADDRESS
if (!MONAD_CRITTER_ADDRESS) {
  console.warn('VITE_MONAD_CRITTER_ADDRESS is not defined in environment variables, using fallback');
}

const MONAD_CLASH_CONTRACT_ADDRESS = process.env.VITE_CRITTER_CLASH_CORE_ADDRESS || import.meta.env?.VITE_CRITTER_CLASH_CORE_ADDRESS
if (!MONAD_CLASH_CONTRACT_ADDRESS) {
  console.warn('VITE_CRITTER_CLASH_CORE_ADDRESS is not defined in environment variables, using fallback');
}

const MONAD_CLASH_STATS_ADDRESS = process.env.VITE_CRITTER_CLASH_STATS_ADDRESS || import.meta.env?.VITE_CRITTER_CLASH_STATS_ADDRESS
if (!MONAD_CLASH_STATS_ADDRESS) {
  console.warn('VITE_CRITTER_CLASH_STATS_ADDRESS is not defined in environment variables, using fallback');
}

// RPC Configuration
const MONAD_PRIMARY_RPC = process.env.VITE_MONAD_PRIMARY_RPC || import.meta.env?.VITE_MONAD_PRIMARY_RPC || 'https://lb.drpc.org/ogrpc?network=monad-testnet&dkey=Aqc2SxxCSUZUic_W8QUkq94l8CrHAroR8IETfhHoK236'
const MONAD_ALCHEMY_RPC1 = process.env.VITE_MONAD_ALCHEMY_RPC1 || import.meta.env?.VITE_MONAD_ALCHEMY_RPC1 || 'https://monad-testnet.g.alchemy.com/v2/U9a1eL9onn-ElCqLjV48V74NrDx5jxEi'
const MONAD_ALCHEMY_RPC2 = process.env.VITE_MONAD_ALCHEMY_RPC2 || import.meta.env?.VITE_MONAD_ALCHEMY_RPC2 || 'https://monad-testnet.g.alchemy.com/v2/pADH6KI1Ajlh_1-Fyzc7I30JVHw7lo-F'
const MONAD_BACKUP_RPC = process.env.VITE_MONAD_BACKUP_RPC || import.meta.env?.VITE_MONAD_BACKUP_RPC || 'https://rpc.testnet.monad.xyz/json-rpc'

// Add rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS_PER_WINDOW: 20,
  WINDOW_MS: 60_000,
  REQUEST_QUEUE: new Map<string, number[]>(),
  QUEUE_SIZE: 200,
  QUEUE_TIMEOUT: 30_000
} as const;

// Add request queue management with improved error handling
const requestQueue = new Map<string, Array<() => Promise<any>>>();
const processingQueue = new Map<string, boolean>();

const processQueue = async (endpoint: string) => {
  if (processingQueue.get(endpoint)) return;
  processingQueue.set(endpoint, true);

  try {
    const queue = requestQueue.get(endpoint) || [];
    while (queue.length > 0) {
      const request = queue.shift();
      if (request) {
        try {
          await request();
          // Add adaptive delay between requests based on queue size
          const delay = Math.min(100 + (queue.length * 10), 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
          console.error('Error processing queued request:', error);
          // Don't throw here to continue processing the queue
        }
      }
    }
  } finally {
    processingQueue.set(endpoint, false);
  }
};

// Add transport metrics tracking
const transportMetrics = new Map<string, {
  successes: number;
  failures: number;
  lastSuccess: number;
}>();

// Add error type classification
const ERROR_TYPES = {
  RATE_LIMIT: '429',
  BAD_REQUEST: '400',
  SERVER_ERROR: ['500', '502', '503', '504'],
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
} as const;

// RPC Configuration with purpose-specific endpoints
const RPC_CONFIG = {
  PRIMARY: {
    WRITE: MONAD_ALCHEMY_RPC1,
    READ: MONAD_ALCHEMY_RPC1,
    EVENTS: MONAD_ALCHEMY_RPC2,
  },
  BACKUP: {
    WRITE: MONAD_ALCHEMY_RPC2,
    READ: MONAD_ALCHEMY_RPC2,
    EVENTS: MONAD_BACKUP_RPC,
  },
  FALLBACK: {
    WRITE: MONAD_BACKUP_RPC,
    READ: MONAD_BACKUP_RPC,
    EVENTS: MONAD_PRIMARY_RPC,
  }
} as const;

// Add browser detection
const isBrowser = typeof window !== 'undefined';
const isChrome = isBrowser && window.navigator.userAgent.includes('Chrome');

// Enhanced transport with browser-specific handling
const createRateLimitedTransport = (url: string, config: any) => {
  const cleanupOldRequests = (endpoint: string) => {
    const now = Date.now();
    const requests = RATE_LIMIT.REQUEST_QUEUE.get(endpoint) || [];
    const validRequests = requests.filter(time => now - time < RATE_LIMIT.WINDOW_MS);
    RATE_LIMIT.REQUEST_QUEUE.set(endpoint, validRequests);
    return validRequests.length;
  };

  const canMakeRequest = (endpoint: string): boolean => {
    const currentRequests = cleanupOldRequests(endpoint);
    return currentRequests < RATE_LIMIT.MAX_REQUESTS_PER_WINDOW;
  };

  const addRequest = (endpoint: string) => {
    const requests = RATE_LIMIT.REQUEST_QUEUE.get(endpoint) || [];
    requests.push(Date.now());
    RATE_LIMIT.REQUEST_QUEUE.set(endpoint, requests);
  };

  const classifyError = (error: any): string => {
    const message = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.code;

    if (status === 429 || message.includes('429')) return ERROR_TYPES.RATE_LIMIT;
    if (status === 400 || message.includes('bad request')) return ERROR_TYPES.BAD_REQUEST;
    if (ERROR_TYPES.SERVER_ERROR.some(code => status === Number(code) || message.includes(code))) {
      return ERROR_TYPES.SERVER_ERROR[0];
    }
    if (message.includes('timeout') || message.includes('timed out')) return ERROR_TYPES.TIMEOUT;
    if (message.includes('network') || message.includes('connection')) return ERROR_TYPES.NETWORK;
    return 'UNKNOWN';
  };

  const shouldRetryError = (error: any): boolean => {
    const errorType = classifyError(error);
    
    // Always retry rate limit errors
    if (errorType === ERROR_TYPES.RATE_LIMIT) {
      return true;
    }
    
    // Retry server errors with backoff
    if (Array.isArray(ERROR_TYPES.SERVER_ERROR) && 
        ERROR_TYPES.SERVER_ERROR.some(code => error?.status?.toString() === code)) {
      return true;
    }
    
    // Retry network errors
    if (errorType === ERROR_TYPES.TIMEOUT || errorType === ERROR_TYPES.NETWORK) {
      return true;
    }
    
    // Don't retry bad requests
    if (errorType === ERROR_TYPES.BAD_REQUEST) {
      return false;
    }
    
    // Retry on specific error messages
    if (error?.message?.includes('Too many request') || 
        error?.message?.includes('rate limit') ||
        error?.message?.includes('try again later')) {
      return true;
    }
    
    return false;
  };

  const getBackoff = (attempt: number, errorType: string): number => {
    const baseDelay = 2000;
    
    // More aggressive backoff for rate limits
    if (errorType === ERROR_TYPES.RATE_LIMIT) {
      return Math.min(baseDelay * Math.pow(2, attempt), 30000);
    }
    
    // Moderate backoff for server errors
    if (Array.isArray(ERROR_TYPES.SERVER_ERROR) && 
        ERROR_TYPES.SERVER_ERROR.some(code => errorType === code)) {
      return Math.min(baseDelay * Math.pow(1.5, attempt), 20000);
    }
    
    // Standard backoff for other errors
    return Math.min(baseDelay * attempt, 15000);
  };

  const formatRequestForBrowser = (args: any[]): any[] => {
    try {
      const [request] = args;
      if (!request) return args;

      // Ensure proper JSON-RPC format for DRPC
      const formattedRequest = {
        jsonrpc: '2.0',
        id: typeof request.id === 'number' ? request.id : Math.floor(Math.random() * 1000000),
        method: request.method,
        params: Array.isArray(request.params) ? request.params : [],
      };

      // Special handling for eth_call and eth_estimateGas
      if (request.method === 'eth_call' || request.method === 'eth_estimateGas') {
        // Ensure params are properly formatted
        if (Array.isArray(formattedRequest.params) && formattedRequest.params.length > 0) {
          const [txParams, blockParam] = formattedRequest.params;
          
          // DRPC requires properly formatted transaction objects with gas limits
          if (txParams && typeof txParams === 'object') {
            formattedRequest.params = [
              {
                ...txParams,
                gas: txParams.gas || '0x7A1200', // Default gas limit if not specified
              },
              blockParam || 'latest'
            ];
          }
        }
      }

      // Special handling for transaction methods like eth_sendTransaction
      if (request.method === 'eth_sendTransaction' || request.method === 'eth_sendRawTransaction') {
        // Ensure transaction has all required fields for DRPC
        console.debug('Formatting transaction request for DRPC:', request.method);
      }

      // Add specific headers for DRPC
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(isChrome ? {
          'Origin': window.location.origin,
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'cors',
        } : {}),
        ...config.headers,
      };

      // Log the request specifically for DRPC for debugging purposes
      if (url.includes('drpc')) {
        console.debug('DRPC request before sending:', {
          formattedRequest,
          headers
        });
      }

      return [formattedRequest, { ...config, headers }];
    } catch (error) {
      console.error('Error formatting request:', error);
      return args;
    }
  };

  const validateRequest = (args: any[]): boolean => {
    try {
      const [request] = args;
      if (!request || typeof request !== 'object') {
        console.error('Invalid request format: Request must be an object');
        return false;
      }

      // Stricter validation for DRPC requests to prevent 400 errors
      if (url.includes('drpc')) {
        // Check required JSON-RPC 2.0 fields
        if (!request.jsonrpc || request.jsonrpc !== '2.0') {
          console.error('Invalid DRPC request: jsonrpc version must be "2.0"');
          return false;
        }
        
        if (!request.method || typeof request.method !== 'string') {
          console.error('Invalid DRPC request: method must be a string');
          return false;
        }
        
        if (!request.id && request.id !== 0) {
          console.error('Invalid DRPC request: id is required');
          return false;
        }
        
        if (!request.params) {
          console.error('Invalid DRPC request: params is required');
          return false;
        }
        
        if (!Array.isArray(request.params)) {
          console.error('Invalid DRPC request: params must be an array');
          return false;
        }
        
        // Special validation for specific methods
        if (request.method === 'eth_call' || request.method === 'eth_estimateGas') {
          if (request.params.length === 0) {
            console.error(`Invalid DRPC request: ${request.method} requires at least one parameter`);
            return false;
          }
          
          const [txParams] = request.params;
          if (!txParams || typeof txParams !== 'object') {
            console.error(`Invalid DRPC request: ${request.method} first parameter must be an object`);
            return false;
          }
        }
        
        return true;
      }

      // Standard validation for non-DRPC environments
      if (!request.method || typeof request.method !== 'string') return false;
      if (!request.id && request.id !== 0) return false;
      if (!Array.isArray(request.params)) return false;
      return true;
    } catch (error) {
      console.error('Error validating request:', error);
      return false;
    }
  };

  return http(url, {
    ...config,
    async request(...args) {
      try {
        // Format request specifically for browser environment
        const formattedArgs = isChrome || url.includes('drpc') 
          ? formatRequestForBrowser(args) 
          : args;

        // Log the formatted request for debugging
        if (url.includes('drpc')) {
          console.debug('DRPC Request:', {
            url,
            request: formattedArgs[0],
            headers: formattedArgs[1]?.headers
          });
        }

        if (!validateRequest(formattedArgs)) {
          console.error('Invalid RPC request format:', JSON.stringify(formattedArgs[0]));
          throw new Error('Invalid RPC request format for ' + url);
        }

        if (!canMakeRequest(url)) {
          // Queue the request if we're rate limited
          return new Promise((resolve, reject) => {
            const queue = requestQueue.get(url) || [];
            if (queue.length >= RATE_LIMIT.QUEUE_SIZE) {
              reject(new Error('Request queue is full'));
              return;
            }

            queue.push(async () => {
              try {
                const response = await config.request?.(...formattedArgs);
                resolve(response);
              } catch (error) {
                reject(error);
              }
            });

            requestQueue.set(url, queue);
            processQueue(url);
          });
        }
        
        addRequest(url);
        
        let attempt = 0;
        const maxAttempts = CACHE_CONFIG.RETRY.MAX_ATTEMPTS;
        let lastError: any;

        while (attempt < maxAttempts) {
          try {
            const response = await config.request?.(...formattedArgs);
            const metrics = transportMetrics.get(url) || { successes: 0, failures: 0, lastSuccess: 0 };
            metrics.successes++;
            metrics.lastSuccess = Date.now();
            transportMetrics.set(url, metrics);
            return response;
          } catch (error: any) {
            lastError = error;
            const errorType = classifyError(error);
            const metrics = transportMetrics.get(url) || { successes: 0, failures: 0, lastSuccess: 0 };
            metrics.failures++;
            transportMetrics.set(url, metrics);

            // Special handling for Chrome CORS errors
            if (isChrome && error.message?.includes('Failed to fetch')) {
              console.warn('Chrome CORS issue detected, retrying with modified headers...');
              config.headers = {
                ...config.headers,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
              };
            }

            attempt++;
            
            if (attempt < maxAttempts && shouldRetryError(error)) {
              const backoff = getBackoff(attempt, errorType);
              console.warn(`RPC Error for ${url} (attempt ${attempt}/${maxAttempts}, type: ${errorType}):`, error);
              await new Promise(resolve => setTimeout(resolve, backoff));
              continue;
            }
            
            console.error(`RPC Error Details:
              URL: ${url}
              Error Type: ${errorType}
              Status: ${error?.status || 'N/A'}
              Message: ${error?.message || 'N/A'}
              Browser: ${isChrome ? 'Chrome' : 'Other'}
              Request: ${JSON.stringify(formattedArgs[0] || {}, null, 2)}
            `);
            
            throw lastError;
          }
        }
      } catch (error) {
        console.error('Error in request handler:', error);
        throw error;
      }
    }
  });
};

// Create purpose-specific transports
const createEventTransport = () => http(MONAD_ALCHEMY_RPC1, {
  timeout: 15_000,
  batch: {
    batchSize: 3,
    wait: 100
  },
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  },
});

const createWriteTransport = () => http(MONAD_ALCHEMY_RPC1, {
  timeout: 15_000,
  batch: {
    batchSize: 1,
    wait: 0
  },
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  },
});

const createReadTransport = () => http(MONAD_ALCHEMY_RPC1, {
  timeout: 10_000,
  batch: {
    batchSize: 5,
    wait: 50
  },
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  },
});

// Update monadTransport to use simple http instead of fallback
const monadTransport = createReadTransport();

// Contract configuration types
type NetworkContracts = {
  critter: string;
  clashCore: string;
  clashStats: string;
};

type ContractConfig = {
  monad: NetworkContracts;
};

// Contract addresses by network
export const contracts = {
  monad: {
    critter: MONAD_CRITTER_ADDRESS || '0xD25308c3F5619F7f4fC82cbfa39a38eCd6eC057A',
    clashCore: MONAD_CLASH_CONTRACT_ADDRESS || '0xC51Bd76917638926C4D7f9f1DFC1B74a0049b94f',
    clashStats: MONAD_CLASH_STATS_ADDRESS || '0x4f7fB215FCB6926Cdae216F6E65Cc8ffF7faF185'
  }
} as const;

// Cache and retry configuration
export const CACHE_CONFIG = {
  DURATION: {
    SHORT: 60_000,
    MEDIUM: 180_000,
    LONG: 600_000,
    PERMANENT: 3600_000
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 2000,
    MAX_DELAY: 10000,
    JITTER: 0.3
  },
  BATCH: {
    SIZE: 10,
    INTERVAL: 3000
  },
  PREFETCH: {
    ENABLED: true,
    THRESHOLD: 0.75
  },
  RATE_LIMIT_FALLBACK: {
    DURATION: 120_000,
    MAX_STALE: 300_000
  }
} as const;

// Query configurations for different types of contract reads
export const QUERY_CONFIG = {
  // For data that changes frequently
  realtime: {
    refetchInterval: CACHE_CONFIG.DURATION.SHORT,
    gcTime: CACHE_CONFIG.DURATION.MEDIUM,
    staleTime: CACHE_CONFIG.DURATION.SHORT / 2,
    retry: (failureCount: number, error: any) => {
      if (!error?.message?.includes('429')) return false;
      return failureCount < CACHE_CONFIG.RETRY.MAX_ATTEMPTS;
    },
    retryDelay: (failureCount: number) => {
      const baseDelay = CACHE_CONFIG.RETRY.BASE_DELAY * Math.pow(2, failureCount - 1);
      const maxDelay = CACHE_CONFIG.RETRY.MAX_DELAY;
      const jitter = 1 + (Math.random() * 2 - 1) * CACHE_CONFIG.RETRY.JITTER;
      return Math.min(baseDelay * jitter, maxDelay);
    }
  },
  // For data that changes occasionally
  standard: {
    refetchInterval: CACHE_CONFIG.DURATION.MEDIUM,
    gcTime: CACHE_CONFIG.DURATION.LONG,
    staleTime: CACHE_CONFIG.DURATION.MEDIUM / 2,
    retry: (failureCount: number, error: any) => {
      if (!error?.message?.includes('429')) return false;
      return failureCount < CACHE_CONFIG.RETRY.MAX_ATTEMPTS;
    },
    retryDelay: (failureCount: number) => {
      const baseDelay = CACHE_CONFIG.RETRY.BASE_DELAY * Math.pow(2, failureCount - 1);
      const maxDelay = CACHE_CONFIG.RETRY.MAX_DELAY;
      const jitter = 1 + (Math.random() * 2 - 1) * CACHE_CONFIG.RETRY.JITTER;
      return Math.min(baseDelay * jitter, maxDelay);
    }
  }
} as const;

// Create the chain configuration
export const monadWithTransport = {
  ...monadTestnet,
  rpcUrls: {
    default: {
      http: [MONAD_PRIMARY_RPC],
    },
    public: {
      http: [MONAD_PRIMARY_RPC, MONAD_ALCHEMY_RPC1, MONAD_ALCHEMY_RPC2, MONAD_BACKUP_RPC].filter(Boolean),
    },
  },
} as const

// Create the transport configuration
const createChainTransport = (chain: Chain) => {
  const rpcUrl = chain.rpcUrls.default.http[0]
  return http(rpcUrl)
}

// Create the Wagmi config
export const config = createConfig({
  chains: [monadWithTransport],
  transports: {
    [monadWithTransport.id]: createChainTransport(monadWithTransport),
  },
})

// Export a safe getter function
export const getConfig = () => config

// Game constants
export const gameConfig = {
  mintPrice: 1,
  maxMintsPerWallet: 4,
  maxBoostsPerClash: 2,
  boostPricePercent: 10,
  clashDuration: 60,
  boostMultiplier: 100
} as const;

// Payment configuration
export const PAYMENT_CONFIG = {
  NATIVE_TOKEN: '0x0000000000000000000000000000000000000000', // address(0) for native MON
  TOKENS: {
    NATIVE_MON: {
      address: '0x0000000000000000000000000000000000000000',
      isActive: true,
      entryFeeAmount: 0 // Uses clash type entry fee instead
    }
  }
} as const;

// Clash configuration
export const CLASH_CONFIG = {
  TYPES: {
    TWO_PLAYER: {
      size: 1, // ClashSize.Two
      maxPlayers: 2,
      numWinners: 1,
      entryFee: '1', // 1 MON for 2-player clash
      rewardPercentages: [100], // Winner takes all
      isActive: true
    },
    FOUR_PLAYER: {
      size: 2, // ClashSize.Four
      maxPlayers: 4,
      numWinners: 2,
      entryFee: '2', // 2 MON for 4-player clash
      rewardPercentages: [70, 30], // Split 70/30
      isActive: true
    }
  },
  BOOST: {
    MAX_PER_CLASH: 2,
    FIRST_BOOST_INCREASE: 20, // 20% increase
    SECOND_BOOST_INCREASE: 15, // Additional 15% increase
    COST_CALCULATION: {
      FIRST_BOOST: 5, // 5% of entry fee
      SECOND_BOOST: 5  // 5% of entry fee
    }
  },
  FEES: {
    DAO_PERCENT: 0, // Starts at 0%
    POWER_UP_PERCENT: 5 // 5% of entry fee
  },
  CACHE_KEYS: {
    ACTIVE_CLASHES: 'active_clashes',
    CLASH_INFO: (clashId: string) => `clash_info_${clashId}`,
    USER_CLASH_STATUS: (address: string) => `user_clash_status_${address.toLowerCase()}`,
    CONTRACT_ADDRESSES: {
      CRITTER: 'contract_address_critter',
      CLASH_CORE: 'contract_address_clash_core',
      CLASH_STATS: 'contract_address_clash_stats'
    }
  },
  CACHE_DURATION: {
    ACTIVE_CLASHES: 30_000,  // 30 seconds
    CLASH_INFO: 60_000,      // 1 minute
    USER_STATUS: 30_000      // 30 seconds
  }
} as const;

// Export RPC endpoints for other parts of the application
export const RPC_ENDPOINTS = {
  primary: MONAD_PRIMARY_RPC,
  fallbacks: [MONAD_ALCHEMY_RPC1, MONAD_ALCHEMY_RPC2, MONAD_BACKUP_RPC]
} as const;

// Export chain config
export { monadWithTransport as monadTestnet };

if (process.env.NODE_ENV !== 'production') {
  console.debug('Contract Configuration:', {
    addresses: contracts,
    environment: {
      VITE_MONAD_CRITTER_ADDRESS: process.env.VITE_MONAD_CRITTER_ADDRESS,
      VITE_CRITTER_CLASH_CORE_ADDRESS: process.env.VITE_CRITTER_CLASH_CORE_ADDRESS
    }
  });
}

