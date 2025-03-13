"use strict";
/**
 * Shared type definitions for power-ups across client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POWER_UP_CONFIGS = void 0;
// Constants
exports.POWER_UP_CONFIGS = [
    {
        name: 'Speed Boost',
        description: '+20 Speed for 10 seconds',
        image: '🚀',
        color: 'from-blue-500 to-blue-700',
        type: 'speedBoost'
    },
    {
        name: 'Sabotage',
        description: '-10 Stamina for 10 seconds',
        image: '💥',
        color: 'from-red-500 to-red-700',
        type: 'sabotage'
    }
];
