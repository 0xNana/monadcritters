import { parseEther } from "viem";
import hre from "hardhat";
import "dotenv/config";

// Add delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("\n=== Starting Race Creation Debug Test ===\n");
  
  try {
    // Get the deployer account
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Using account:", deployer.account.address);
    
    // Get contract addresses from .env
    const nftAddress = process.env.VITE_MONAD_CRITTER_ADDRESS;
    const raceAddress = process.env.VITE_RACE_CONTRACT_ADDRESS;
    
    if (!nftAddress || !raceAddress) {
      throw new Error("Contract addresses not found in .env file");
    }
    
    console.log("\nContract Addresses:");
    console.log("NFT:", nftAddress);
    console.log("Race:", raceAddress);
    
    // Get contract instances
    const nftContract = await hre.viem.getContractAt("MonadCritter", nftAddress);
    const raceContract = await hre.viem.getContractAt("CritterRace", raceAddress);
    
    // Get the public client
    const publicClient = await hre.viem.getPublicClient();

    // Check if contract is paused
    console.log("\nChecking contract state...");
    try {
      const isPaused = await raceContract.read.paused();
      console.log("Contract paused:", isPaused);
      if (isPaused) {
        throw new Error("Race contract is paused!");
      }
    } catch (error) {
      console.log("Could not check pause state:", (error as Error).message);
    }

    // Get current race count before creation
    console.log("\nChecking current race state...");
    try {
      const currentRaceId = await raceContract.read.currentRaceId();
      console.log("Current race ID before creation:", currentRaceId.toString());

      const activeRaces = await raceContract.read.getActiveRaces();
      console.log("Active races before creation:", activeRaces.map(id => id.toString()));
    } catch (error) {
      console.error("Error checking race state:", error);
    }
    
    // Create a new race
    console.log("\nCreating new race...");
    let createTx;
    try {
      createTx = await raceContract.write.createRace(
        [],
        {
          gas: 200000n
        }
      );
      console.log("Create race tx hash:", createTx);
    } catch (error) {
      console.error("Error creating race:", error);
      throw error;
    }
    
    // Wait for transaction to be mined
    console.log("\nWaiting for create transaction to be mined...");
    let createReceipt;
    try {
      createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
      console.log("Create transaction status:", createReceipt.status);
      console.log("Gas used:", createReceipt.gasUsed.toString());
      
      // Check for RaceCreated event
      const raceCreatedLog = createReceipt.logs.find(log => 
        log.topics[0] === '0x18522eee5f08f21bd51a3b97e6ece8f4c060eda7c3f4f9f5ae95c9f4e5cc5b9a'
      );
      
      if (raceCreatedLog) {
        const raceId = BigInt(raceCreatedLog.topics[1].slice(2));
        console.log("Race created with ID (from event):", raceId.toString());
      } else {
        console.log("Warning: RaceCreated event not found in logs");
      }
    } catch (error) {
      console.error("Error waiting for transaction:", error);
      throw error;
    }
    
    // Give the blockchain some time to update
    console.log("\nWaiting for blockchain state to update...");
    await delay(5000);
    
    // Get updated race state
    console.log("\nChecking updated race state...");
    try {
      const newCurrentRaceId = await raceContract.read.currentRaceId();
      console.log("Current race ID after creation:", newCurrentRaceId.toString());

      const newActiveRaces = await raceContract.read.getActiveRaces();
      console.log("Active races after creation:", newActiveRaces.map(id => id.toString()));

      // Try to get specific race info
      if (newCurrentRaceId > 0n) {
        console.log("\nFetching created race info...");
        const raceInfo = await raceContract.read.getRaceInfo([newCurrentRaceId]);
        console.log("Race Info:", {
          id: raceInfo[0].toString(),
          players: raceInfo[1],
          critterIds: raceInfo[2].map(id => id.toString()),
          startTime: raceInfo[3].toString(),
          isActive: raceInfo[4],
          hasEnded: raceInfo[5],
          prizePool: raceInfo[6].toString()
        });
      }
    } catch (error) {
      console.error("Error checking updated race state:", error);
    }
    
  } catch (error) {
    console.error("\n=== Test Failed ===");
    console.error("Error during race test:", error);
    process.exit(1);
  }

  console.log("\n=== Test Completed Successfully ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 