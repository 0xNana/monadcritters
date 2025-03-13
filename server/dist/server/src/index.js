"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const RaceSimulation_1 = require("./RaceSimulation");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
const PORT = process.env.PORT || 8082;
const simulations = new Map();
// Add a basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', connections: wss.clients.size });
});
// Log when server starts
console.log('Starting race simulation server...');
wss.on('connection', (ws) => {
    console.log(`Client connected. Total connections: ${wss.clients.size}`);
    let currentRaceId = null;
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message.type, message.data);
            switch (message.type) {
                case 'player_join': {
                    const raceId = message.data.raceId;
                    if (typeof raceId !== 'string') {
                        console.error('Invalid or missing race ID');
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Invalid or missing race ID' },
                            timestamp: Date.now()
                        }));
                        return;
                    }
                    currentRaceId = raceId;
                    console.log(`Player joining race: ${currentRaceId}`);
                    let simulation = simulations.get(currentRaceId);
                    if (!simulation) {
                        simulation = new RaceSimulation_1.RaceSimulation(currentRaceId);
                        simulations.set(currentRaceId, simulation);
                        console.log(`Created new simulation for race: ${currentRaceId}`);
                    }
                    simulation.addClient(ws);
                    break;
                }
                case 'player_leave': {
                    if (!currentRaceId)
                        return;
                    const leaveSimulation = simulations.get(currentRaceId);
                    if (leaveSimulation) {
                        leaveSimulation.removeClient(ws);
                        if (leaveSimulation.getClientCount() === 0) {
                            simulations.delete(currentRaceId);
                            console.log(`Removed simulation for race: ${currentRaceId}`);
                        }
                    }
                    break;
                }
                case 'power_up_action': {
                    if (!currentRaceId)
                        return;
                    const powerUpSimulation = simulations.get(currentRaceId);
                    powerUpSimulation?.handlePowerUp(message.data.action);
                    break;
                }
                case 'sync_request': {
                    if (!currentRaceId)
                        return;
                    const syncSimulation = simulations.get(currentRaceId);
                    syncSimulation?.sendSync(ws);
                    break;
                }
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        data: { timestamp: Date.now() },
                        timestamp: Date.now()
                    }));
                    break;
            }
        }
        catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid message format' },
                timestamp: Date.now()
            }));
        }
    });
    ws.on('close', () => {
        console.log(`Client disconnected. Remaining connections: ${wss.clients.size}`);
        if (!currentRaceId)
            return;
        const simulation = simulations.get(currentRaceId);
        if (simulation) {
            simulation.removeClient(ws);
            if (simulation.getClientCount() === 0) {
                simulations.delete(currentRaceId);
                console.log(`Removed simulation for race: ${currentRaceId}`);
            }
        }
    });
});
server.listen(PORT, () => {
    console.log(`Race simulation server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});
