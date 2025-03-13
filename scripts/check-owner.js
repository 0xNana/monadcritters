const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Checking contract ownership...");

  // Get the race contract address from .env
  const raceContractAddress = process.env.RACE_CONTRACT_ADDRESS;
  if (!raceContractAddress) {
    throw new Error("Race contract address not found in .env file");
  }

  // Get the contract instance
  const raceContract = await hre.viem.getContractAt("CritterRace", raceContractAddress);
  
  // Get the current account
  const [deployer] = await hre.viem.getWalletClients();
  console.log("Current account:", deployer.account.address);
  
  // Get the contract owner
  const owner = await raceContract.read.owner();
  console.log("Contract owner:", owner);
  
  // Check if current account is owner
  if (owner.toLowerCase() === deployer.account.address.toLowerCase()) {
    console.log("Current account is the owner");
  } else {
    console.log("Current account is NOT the owner");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 