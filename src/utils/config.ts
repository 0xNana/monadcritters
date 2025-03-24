import { createConfig, http, fallback } from '@wagmi/core'
import { monadTestnet } from './chains'
import { useChains } from 'wagmi'
// Contract addresses from environment variables
const MONAD_CRITTER_ADDRESS = process.env.VITE_MONAD_CRITTER_ADDRESS
if (!MONAD_CRITTER_ADDRESS) {
  throw new Error('VITE_MONAD_CRITTER_ADDRESS is not defined in environment variables');
}

const MONAD_RACE_CONTRACT_ADDRESS = process.env.VITE_RACE_CONTRACT_ADDRESS
if (!MONAD_RACE_CONTRACT_ADDRESS) {
  throw new Error('VITE_RACE_CONTRACT_ADDRESS is not defined in environment variables');
}

// RPC Configuration
const MONAD_PRIMARY_RPC = 'https://lb.drpc.org/ogrpc?network=monad-testnet&dkey=Aqc2SxxCSUZUic_W8QUkq94l8CrHAroR8IETfhHoK236'
const MONAD_ALCHEMY_RPC1 = 'https://monad-testnet.g.alchemy.com/v2/U9a1eL9onn-ElCqLjV48V74NrDx5jxEi'
const MONAD_ALCHEMY_RPC2 = 'https://monad-testnet.g.alchemy.com/v2/pADH6KI1Ajlh_1-Fyzc7I30JVHw7lo-F'
const MONAD_BACKUP_RPC = 'https://rpc.testnet.monad.xyz/json-rpc'

// Add rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS_PER_WINDOW: 15,
  WINDOW_MS: 30_000,
  REQUEST_QUEUE: new Map<string, number[]>()
} as const;

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
    
    if (errorType === ERROR_TYPES.RATE_LIMIT) {
      return true;
    }
    
    if (Array.isArray(ERROR_TYPES.SERVER_ERROR) && 
        ERROR_TYPES.SERVER_ERROR.some(code => error?.status?.toString() === code)) {
      return true;
    }
    
    if (errorType === ERROR_TYPES.TIMEOUT) {
      return true;
    }
    
    if (errorType === ERROR_TYPES.NETWORK) {
      return true;
    }
    
    if (errorType === ERROR_TYPES.BAD_REQUEST) {
      return false;
    }
    
    if (error?.message?.includes('Too many request') || 
        error?.message?.includes('rate limit') ||
        error?.message?.includes('try again later')) {
      return true;
    }
    
    return false;
  };

  const getBackoff = (attempt: number, errorType: string): number => {
    const baseDelay = 1000;
    
    if (errorType === ERROR_TYPES.RATE_LIMIT) {
      return Math.min(baseDelay * Math.pow(2, attempt), 10000);
    }
    
    if (Array.isArray(ERROR_TYPES.SERVER_ERROR) && 
        ERROR_TYPES.SERVER_ERROR.some(code => errorType === code)) {
      return Math.min(baseDelay * Math.pow(1.5, attempt), 8000);
    }
    
    return baseDelay * attempt;
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
          const metrics = transportMetrics.get(url) || { successes: 0, failures: 0, lastSuccess: 0 };
          metrics.failures++;
          transportMetrics.set(url, metrics);
          throw new Error('Rate limit exceeded');
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
const createEventTransport = () => fallback([
  createRateLimitedTransport(RPC_CONFIG.PRIMARY.EVENTS, {
    timeout: 15_000,
    retryCount: 3,
    retryDelay: 1000,
    onError: (error) => {
      console.warn('Event transport error:', error);
      // Don't throw to allow fallback to work
      return undefined;
    }
  }),
  createRateLimitedTransport(RPC_CONFIG.BACKUP.EVENTS, {
    timeout: 20_000,
    retryCount: 2,
    retryDelay: 1500,
    onError: (error) => {
      console.warn('Backup event transport error:', error);
      return undefined;
    }
  })
], { rank: true });

const createWriteTransport = () => fallback([
  createRateLimitedTransport(RPC_CONFIG.PRIMARY.WRITE, {
    timeout: 12_000,
    retryCount: 2,
    retryDelay: 800,
    onError: (error) => {
      console.warn('Write transport error:', error);
      return undefined;
    }
  }),
  createRateLimitedTransport(RPC_CONFIG.BACKUP.WRITE, {
    timeout: 12_000,
    retryCount: 2,
    retryDelay: 800,
    onError: (error) => {
      console.warn('Backup write transport error:', error);
      return undefined;
    }
  }),
  createRateLimitedTransport(RPC_CONFIG.FALLBACK.WRITE, {
    timeout: 15_000,
    retryCount: 1,
    retryDelay: 1000,
    onError: (error) => {
      console.warn('Fallback write transport error:', error);
      return undefined;
    }
  })
], { rank: true });

const createReadTransport = () => fallback([
  createRateLimitedTransport(RPC_CONFIG.PRIMARY.READ, {
    timeout: 8_000,
    retryCount: 2,
    retryDelay: 500,
    onError: (error) => {
      console.warn('Read transport error:', error);
      return undefined;
    }
  }),
  createRateLimitedTransport(RPC_CONFIG.BACKUP.READ, {
    timeout: 12_000,
    retryCount: 2,
    retryDelay: 1000,
    onError: (error) => {
      console.warn('Backup read transport error:', error);
      return undefined;
    }
  })
], { rank: true });

// Update monadTransport to use purpose-specific configuration
const monadTransport = fallback([
  createEventTransport(),
  createWriteTransport(),
  createReadTransport()
], { rank: true });

// Contract configuration types
type NetworkContracts = {
  race: string;
  critter: string;
};

type ContractConfig = {
  monad: NetworkContracts;
};

// Contract addresses by network
export const contracts = {
  monad: {
    critter: MONAD_CRITTER_ADDRESS,
    race: MONAD_RACE_CONTRACT_ADDRESS
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
  // For data that changes frequently (e.g., race status)
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
  // For data that changes occasionally (e.g., race participants)
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
  },
  // For static or rarely changing data (e.g., race configuration)
  static: {
    refetchInterval: CACHE_CONFIG.DURATION.LONG,
    gcTime: CACHE_CONFIG.DURATION.PERMANENT,
    staleTime: CACHE_CONFIG.DURATION.LONG / 2,
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

// Create custom Monad chain config with Alchemy as primary
const monadWithPrimary = {
  ...monadTestnet,
  rpcUrls: {
    ...monadTestnet.rpcUrls,
    default: {
      http: [MONAD_ALCHEMY_RPC1],
    },
    public: {
      http: [MONAD_ALCHEMY_RPC1, MONAD_ALCHEMY_RPC2, MONAD_BACKUP_RPC, MONAD_PRIMARY_RPC],
    },
  },
};

// Wagmi config with Monad network
export const config = createConfig({
  chains: [monadWithPrimary],
  transports: {
    [monadWithPrimary.id]: monadTransport,
  },
});

// Game constants
export const gameConfig = {
  mintPrice: 0.1,
  maxMintsPerWallet: 4,
  maxBoostsPerRace: 2,
  boostPricePercent: 10, // 10% of race entry fee
} as const;

// Race types configuration
export const RACE_TYPES = [
  { type: 'TWO', maxPlayers: 2, winners: 1, raceSize: 1, entryFee: '0.1' },
  { type: 'FIVE', maxPlayers: 5, winners: 2, raceSize: 2, entryFee: '0.1' },
  { type: 'TEN', maxPlayers: 10, winners: 3, raceSize: 3, entryFee: '0.1' },
] as const;

// Export RPC endpoints for other parts of the application
export const RPC_ENDPOINTS = {
  primary: MONAD_PRIMARY_RPC,
  fallbacks: [MONAD_ALCHEMY_RPC1, MONAD_ALCHEMY_RPC2, MONAD_BACKUP_RPC]
} as const;

// Export chain config
export { monadWithPrimary as monadTestnet };

// Update cache configuration for race state
export const RACE_STATE_CONFIG = {
  CACHE_KEYS: {
    ACTIVE_RACES: 'active_races',
    RACE_INFO: (raceId: string) => `race_info_${raceId}`,
    USER_RACE_STATUS: (address: string) => `user_race_status_${address.toLowerCase()}`
  },
  CACHE_DURATION: {
    ACTIVE_RACES: 30_000,  // 30 seconds
    RACE_INFO: 60_000,     // 1 minute
    USER_STATUS: 30_000    // 30 seconds
  }
} as const;

// Add race state validation
export const validateRaceState = (race: any) => {
  if (!race) return false;
  
  // Check if race is properly initialized
  if (!race.id || !race.players || !Array.isArray(race.players)) {
    console.warn('Invalid race structure:', race);
    return false;
  }

  // Check if race is actually active (has players and not ended)
  const hasPlayers = race.players.some((p: string) => p !== '0x0000000000000000000000000000000000000000');
  const isActive = race.isActive && !race.hasEnded;
  
  if (!hasPlayers || !isActive) {
    console.debug('Race validation failed:', { 
      raceId: race.id,
      hasPlayers,
      isActive,
      players: race.players,
      status: race.isActive ? 'active' : 'inactive',
      ended: race.hasEnded
    });
    return false;
  }

  return true;
};

// Add function to clear race cache
export const clearRaceCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('race_') || 
          key === RACE_STATE_CONFIG.CACHE_KEYS.ACTIVE_RACES ||
          key.startsWith('user_race_status_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('Race cache cleared successfully');
  } catch (error) {
    console.error('Error clearing race cache:', error);
  }
};

if (process.env.NODE_ENV !== 'production') {
  console.debug('Contract addresses:', contracts);
}

