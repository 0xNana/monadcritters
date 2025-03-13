const hre = require("hardhat");
const { parseEther } = require("viem");
require("dotenv").config();

async function main() {
  console.log("Updating race entry fee...");

  // Get the race contract address from .env
  const raceContractAddress = process.env.RACE_CONTRACT_ADDRESS;
  if (!raceContractAddress) {
    throw new Error("Race contract address not found in .env file");
  }

  // Get the contract instance
  const raceContract = await hre.viem.getContractAt("CritterRace", raceContractAddress);
  
  // Get the public client
  const publicClient = await hre.viem.getPublicClient();
  
  // Get current gas price
  const gasPrice = await publicClient.getGasPrice();
  console.log("Current gas price:", gasPrice.toString(), "wei");
  
  // Set new entry fee to 0.01 MON
  const newEntryFee = parseEther("0.01");
  
  console.log("Setting new entry fee to 0.01 MON...");
  await raceContract.write.setEntryFee(
    [newEntryFee],
    {
      gas: 100000n, // 100k gas should be enough
      maxFeePerGas: gasPrice * 2n, // Double the current gas price
      maxPriorityFeePerGas: gasPrice // Use current gas price as priority fee
    }
  );
  
  // Verify the new entry fee
  const updatedFee = await raceContract.read.entryFee();
  console.log("New entry fee set to:", updatedFee / BigInt(1e18), "MON");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 