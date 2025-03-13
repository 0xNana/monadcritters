"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { viem } = require("hardhat");
const { parseEther } = require("viem");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function main() {
    console.log("Deploying CritterRace contract...");
    
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    
    // Get current gas price and add 20% for safety
    const gasPrice = await publicClient.getGasPrice();
    const maxFeePerGas = gasPrice * BigInt(12) / BigInt(10); // 20% higher than current gas price
    const maxPriorityFeePerGas = parseEther("0.1"); // 0.1 MON priority fee
    
    const monadCritterAddress = process.env.VITE_MONAD_CRITTER_ADDRESS;
    if (!monadCritterAddress) {
        throw new Error("VITE_MONAD_CRITTER_ADDRESS not set in environment");
    }
    // Deploy CritterRace contract
    const CritterRace = await viem.deployContract("CritterRace", [monadCritterAddress], {
        client: deployer,
        publicClient,
        maxFeePerGas,
        maxPriorityFeePerGas
    });
    console.log("CritterRace deployed to:", CritterRace.address);
    // Wait for deployment to be mined
    console.log("Waiting for deployment to be mined...");
    await sleep(5000);
    // Initialize race types
    console.log("Initializing race types...");
    try {
        // All races now have 0.1 MON entry fee
        const entryFee = parseEther("0.1");
        // Race type 1: 2/2 race (0.1 MON entry fee)
        console.log("Setting up TWO player race type...");
        await CritterRace.write.setRaceType([
            BigInt(0), // RaceSize.TWO
            BigInt(2), // maxPlayers
            BigInt(1), // numWinners
            entryFee, // entryFee (0.1 MON)
            [BigInt(100)], // rewardPercentages (100% for winner)
            true // isActive
        ], {
            client: deployer,
            maxFeePerGas,
            maxPriorityFeePerGas
        });
        await sleep(5000);
        // Race type 2: 5/5 race (0.1 MON entry fee)
        console.log("Setting up FIVE player race type...");
        await CritterRace.write.setRaceType([
            BigInt(1), // RaceSize.FIVE
            BigInt(5), // maxPlayers
            BigInt(2), // numWinners
            entryFee, // entryFee (0.1 MON)
            [BigInt(70), BigInt(30)], // rewardPercentages (70% for 1st, 30% for 2nd)
            true // isActive
        ], {
            client: deployer,
            maxFeePerGas,
            maxPriorityFeePerGas
        });
        await sleep(5000);
        // Race type 3: 10/10 race (0.1 MON entry fee)
        console.log("Setting up TEN player race type...");
        await CritterRace.write.setRaceType([
            BigInt(2), // RaceSize.TEN
            BigInt(10), // maxPlayers
            BigInt(3), // numWinners
            entryFee, // entryFee (0.1 MON)
            [BigInt(50), BigInt(30), BigInt(20)], // rewardPercentages (50% for 1st, 30% for 2nd, 20% for 3rd)
            true // isActive
        ], {
            client: deployer,
            maxFeePerGas,
            maxPriorityFeePerGas
        });
        console.log("Race types initialized successfully");
        console.log("Deployment complete!");
        // Save deployment info
        console.log("Saving deployment info...");
        const deploymentInfo = {
            critterRaceAddress: CritterRace.address,
            monadCritterAddress,
            timestamp: new Date().toISOString()
        };
        const fs = require('fs');
        fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
        console.log("Deployment info saved to deployment-info.json");
    }
    catch (error) {
        console.error("Error during race type initialization:", error);
        throw error;
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
