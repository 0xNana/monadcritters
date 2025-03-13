import { viem } from "hardhat";
import { parseEther } from "viem";

async function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    console.log("Deploying CritterRace contract...");

    const monadCritterAddress = process.env.VITE_MONAD_CRITTER_ADDRESS;
    if (!monadCritterAddress) {
        throw new Error("VITE_MONAD_CRITTER_ADDRESS not set in environment");
    }

    // Deploy CritterRace contract
    const CritterRace = await viem.deployContract("CritterRace", [monadCritterAddress]);
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
        ]);
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
        ]);
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
        ]);

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

    } catch (error) {
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
