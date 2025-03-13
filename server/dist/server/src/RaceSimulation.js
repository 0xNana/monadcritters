"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceSimulation = void 0;
const ws_1 = require("ws");
const race_config_1 = require("../../shared/race-config");
class RaceSimulation {
    constructor(raceId) {
        this.raceId = raceId;
        this.clients = new Set();
        this.positions = new Map();
        this.speeds = new Map();
        this.effects = new Map();
        this.updateInterval = null;
        this.startUpdateLoop();
    }
    addClient(ws) {
        this.clients.add(ws);
        this.sendSync(ws);
    }
    removeClient(ws) {
        this.clients.delete(ws);
    }
    getClientCount() {
        return this.clients.size;
    }
    startUpdateLoop() {
        if (this.updateInterval)
            return;
        this.updateInterval = setInterval(() => {
            this.updatePositions();
            this.broadcastUpdate();
        }, race_config_1.RACE_TIMING.UPDATE_INTERVAL);
    }
    stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    updatePositions() {
        const now = Date.now();
        // Update each player's position based on their current speed
        for (const [playerId, position] of this.positions) {
            let speed = race_config_1.RACE_MECHANICS.BASE_SPEED;
            const effects = this.effects.get(playerId);
            // Apply active effects
            if (effects) {
                if (effects.speedBoost && effects.speedBoost.endTime > now) {
                    speed *= race_config_1.RACE_MECHANICS.BOOST_MULTIPLIER;
                }
                if (effects.sabotage && effects.sabotage.endTime > now) {
                    speed *= race_config_1.RACE_MECHANICS.SABOTAGE_MULTIPLIER;
                }
            }
            // Update position
            const newPosition = Math.min(100, position + (speed * race_config_1.RACE_TIMING.UPDATE_INTERVAL / 1000));
            this.positions.set(playerId, newPosition);
            this.speeds.set(playerId, speed);
            // Check for race completion
            if (newPosition >= 100) {
                this.handleRaceCompletion();
            }
        }
    }
    broadcastUpdate() {
        const message = JSON.stringify({
            type: 'position_update',
            data: {
                raceId: this.raceId,
                positions: Object.fromEntries(this.positions),
                speeds: Object.fromEntries(this.speeds),
                timestamp: Date.now()
            },
            timestamp: Date.now()
        });
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        }
    }
    handlePowerUp(action) {
        const now = Date.now();
        const effects = this.effects.get(action.playerId) || {};
        if (action.type === 'speedBoost') {
            effects.speedBoost = {
                endTime: now + race_config_1.RACE_TIMING.POWER_UP_DURATION
            };
        }
        else if (action.type === 'sabotage' && action.targetId) {
            const targetEffects = this.effects.get(action.targetId) || {};
            targetEffects.sabotage = {
                endTime: now + race_config_1.RACE_TIMING.POWER_UP_DURATION
            };
            this.effects.set(action.targetId, targetEffects);
        }
        this.effects.set(action.playerId, effects);
        // Broadcast power-up activation
        const message = JSON.stringify({
            type: 'power_up_action',
            data: {
                raceId: this.raceId,
                playerId: action.playerId,
                action,
                success: true
            },
            timestamp: now
        });
        this.broadcast(message);
    }
    handleRaceCompletion() {
        // Sort players by position to determine winners
        const sortedPlayers = Array.from(this.positions.entries())
            .sort(([, posA], [, posB]) => posB - posA);
        const message = JSON.stringify({
            type: 'race_end',
            data: {
                raceId: this.raceId,
                endTime: Date.now(),
                finalPositions: Object.fromEntries(this.positions),
                winners: sortedPlayers.slice(0, 3).map(([id]) => id)
            },
            timestamp: Date.now()
        });
        this.broadcast(message);
        this.stopUpdateLoop();
    }
    sendSync(ws) {
        const message = JSON.stringify({
            type: 'sync_response',
            data: {
                raceId: this.raceId,
                positions: Object.fromEntries(this.positions),
                speeds: Object.fromEntries(this.speeds),
                effects: Object.fromEntries(this.effects)
            },
            timestamp: Date.now()
        });
        ws.send(message);
    }
    broadcast(message) {
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        }
    }
    cleanup() {
        this.stopUpdateLoop();
        this.clients.clear();
        this.positions.clear();
        this.speeds.clear();
        this.effects.clear();
    }
}
exports.RaceSimulation = RaceSimulation;
