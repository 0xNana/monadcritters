// Development mode flag
const isDevelopment = process.env.NODE_ENV === 'development';

// Logging configuration
const LOG_CONFIG = {
  hmr: false, // Set to true to show HMR messages
  debug: false, // Set to true to show debug messages
  error: true, // Always show errors
  warn: true, // Always show warnings
};

// Custom logger
export const logger = {
  hmr: (...args: any[]) => {
    if (isDevelopment && LOG_CONFIG.hmr) {
      console.log('[HMR]', ...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment && LOG_CONFIG.debug) {
      console.log('[Debug]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (LOG_CONFIG.error) {
      console.error('[Error]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (LOG_CONFIG.warn) {
      console.warn('[Warning]', ...args);
    }
  },
  info: (...args: any[]) => {
    console.log('[Info]', ...args);
  }
};

// Override console methods
if (isDevelopment) {
  const originalConsole = { ...console };
  
  console.log = (...args) => {
    if (!args[0]?.includes('[vite] hot updated:')) {
      originalConsole.log(...args);
    }
  };
  
  console.warn = (...args) => {
    if (!args[0]?.includes('[vite] hot updated:')) {
      originalConsole.warn(...args);
    }
  };
  
  console.error = (...args) => {
    if (!args[0]?.includes('[vite] hot updated:')) {
      originalConsole.error(...args);
    }
  };
} 