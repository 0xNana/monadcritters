"use strict";
/**
 * Shared race configuration constants used by both client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBSOCKET_CONFIG = exports.CACHE_CONFIG = exports.RACE_TIMING = exports.RACE_MECHANICS = void 0;
exports.RACE_MECHANICS = {
    // Core mechanics
    BASE_SPEED: 5,
    BOOST_MULTIPLIER: 1.5,
    SABOTAGE_MULTIPLIER: 0.7,
    MAX_POWER_UPS_PER_RACE: 2,
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 10,
    INITIAL_POSITION: 1,
    MAX_POSITION: 287, // Maximum valid position from contract (exclusive upper bound)
};
exports.RACE_TIMING = {
    // Race duration and intervals
    DURATION: 30000, // 30 seconds
    POWER_UP_DURATION: 10000, // 10 seconds
    UPDATE_INTERVAL: 100, // 100ms for smooth updates
};
exports.CACHE_CONFIG = {
    // Cache durations (in milliseconds)
    DURATIONS: {
        ACTIVE_RACE: 30 * 1000, // 30 seconds
        WAITING_RACE: 60 * 1000, // 1 minute
        COMPLETED_RACE: 5 * 60 * 1000, // 5 minutes
        PLAYER_STATUS: 30 * 1000 // 30 seconds
    }
};
exports.WEBSOCKET_CONFIG = {
    // WebSocket configuration
    URL: process.env.RACE_WEBSOCKET_URL || 'ws://localhost:8082',
    RECONNECT: {
        MAX_ATTEMPTS: 5,
        INITIAL_TIMEOUT: 1000,
        MAX_TIMEOUT: 16000
    },
    HEARTBEAT: {
        INTERVAL: 5000,
        TIMEOUT: 10000
    },
    FALLBACK: {
        ENABLED: true,
        UPDATE_INTERVAL: 100, // ms
        SIMULATION_MODE: process.env.NODE_ENV === 'development'
    }
};
