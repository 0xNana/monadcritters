const hre = require("hardhat");
const { parseEther } = require("viem");
require("dotenv").config();

async function main() {
  console.log("Updating race entry fee...");
  
  try {
    // Get the deployer account
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Using account:", deployer.account.address);
    
    // Get contract address from .env
    const raceAddress = process.env.RACE_CONTRACT_ADDRESS;
    
    if (!raceAddress) {
      throw new Error("Race contract address not found in .env file");
    }
    
    // Get contract instance
    const raceContract = await hre.viem.getContractAt("CritterRace", raceAddress);
    
    // Get the public client
    const publicClient = await hre.viem.getPublicClient();
    
    // Get current entry fee
    const currentFee = await raceContract.read.entryFee();
    console.log("\nCurrent entry fee:", currentFee / BigInt(1e18), "MON");
    
    // Update entry fee to 0.01 MON
    console.log("\nUpdating entry fee to 0.01 MON...");
    const updateTx = await raceContract.write.setEntryFee(
      [parseEther("0.01")],
      {
        gas: 200000n
      }
    );
    console.log("Update tx:", updateTx);
    
    // Wait for transaction to be mined
    console.log("Waiting for transaction to be mined...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: updateTx });
    console.log("Transaction status:", receipt.status);
    
    // Verify new entry fee
    const newFee = await raceContract.read.entryFee();
    console.log("\nNew entry fee:", newFee / BigInt(1e18), "MON");
    
  } catch (error) {
    console.error("Error updating entry fee:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 