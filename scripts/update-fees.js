const hre = require("hardhat");
const { parseEther } = require("viem");
require("dotenv").config();

async function main() {
  console.log("Starting fee update...");
  
  try {
    // Get the deployer account
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Using account:", deployer.account.address);
    
    // Get the public client
    const publicClient = await hre.viem.getPublicClient();
    
    // Get current gas price
    const gasPrice = await publicClient.getGasPrice();
    console.log("Current gas price:", gasPrice.toString(), "wei");
    
    // Get contract address from .env
    const raceAddress = process.env.RACE_CONTRACT_ADDRESS;
    
    if (!raceAddress) {
      throw new Error("Race contract address not found in .env file");
    }
    
    console.log("Race contract:", raceAddress);
    
    // Get contract instance
    const raceContract = await hre.viem.getContractAt("CritterRace", raceAddress);
    
    // Verify ownership
    const owner = await raceContract.read.owner();
    console.log("\nContract owner:", owner);
    console.log("Our address:", deployer.account.address);
    if (owner.toLowerCase() !== deployer.account.address.toLowerCase()) {
      throw new Error("We are not the owner of the contract!");
    }
    console.log("Ownership verified ✓");
    
    // Get current values
    const currentEntryFee = await raceContract.read.entryFee();
    const currentPowerUpPrice = await raceContract.read.powerUpPrice();
    console.log("\nCurrent entry fee:", currentEntryFee / BigInt(1e18), "MON");
    console.log("Current power-up price:", currentPowerUpPrice / BigInt(1e18), "MON");
    
    // Set new entry fee (0.01 MON)
    console.log("\nSetting new entry fee to 0.01 MON...");
    const nonce1 = await publicClient.getTransactionCount({ address: deployer.account.address });
    console.log("Using nonce:", nonce1);
    const entryFeeTx = await raceContract.write.setEntryFee(
      [parseEther("0.01")],
      {
        gas: 200000n, // Increased gas limit
        maxFeePerGas: gasPrice * 2n,
        maxPriorityFeePerGas: gasPrice,
        nonce: nonce1
      }
    );
    console.log("Entry fee tx:", entryFeeTx);
    
    // Wait for transaction to be mined
    console.log("Waiting for entry fee transaction to be mined...");
    const entryFeeReceipt = await publicClient.waitForTransactionReceipt({ hash: entryFeeTx });
    console.log("Entry fee transaction mined in block:", entryFeeReceipt.blockNumber);
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Set new power-up price (0.005 MON)
    console.log("\nSetting new power-up price to 0.005 MON...");
    const nonce2 = await publicClient.getTransactionCount({ address: deployer.account.address });
    console.log("Using nonce:", nonce2);
    const powerUpPriceTx = await raceContract.write.setPowerUpPrice(
      [parseEther("0.005")],
      {
        gas: 200000n, // Increased gas limit
        maxFeePerGas: gasPrice * 2n,
        maxPriorityFeePerGas: gasPrice,
        nonce: nonce2
      }
    );
    console.log("Power-up price tx:", powerUpPriceTx);
    
    // Wait for transaction to be mined
    console.log("Waiting for power-up price transaction to be mined...");
    const powerUpPriceReceipt = await publicClient.waitForTransactionReceipt({ hash: powerUpPriceTx });
    console.log("Power-up price transaction mined in block:", powerUpPriceReceipt.blockNumber);
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify new values
    const newEntryFee = await raceContract.read.entryFee();
    const newPowerUpPrice = await raceContract.read.powerUpPrice();
    console.log("\nNew entry fee:", newEntryFee / BigInt(1e18), "MON");
    console.log("New power-up price:", newPowerUpPrice / BigInt(1e18), "MON");
    
    if (newEntryFee === parseEther("0.01") && newPowerUpPrice === parseEther("0.005")) {
      console.log("\nFee update completed successfully! ✓");
    } else {
      throw new Error("Fee update failed - new values don't match expected values");
    }
    
  } catch (error) {
    console.error("Error during fee update:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 