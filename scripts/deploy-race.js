const hre = require("hardhat");

async function main() {
  console.log("Starting race contract deployment...");
  
  try {
    // Get the deployer account
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Deploying contracts with account:", deployer.account.address);
    
    // Get the public client
    const publicClient = await hre.viem.getPublicClient();
    
    // Get NFT contract address from .env
    const nftAddress = process.env.MONAD_CRITTER_ADDRESS;
    
    if (!nftAddress) {
      console.error("Error: MONAD_CRITTER_ADDRESS environment variable not set");
      console.log("Please set the environment variable in your .env file:");
      console.log("MONAD_CRITTER_ADDRESS=0xYourNFTContractAddress");
      process.exit(1);
    }
    
    console.log("NFT contract address:", nftAddress);
    
    // Deploy CritterRace contract
    console.log("Deploying CritterRace contract...");
    const critterRaceArtifact = await hre.artifacts.readArtifact("CritterRace");
    
    const hash = await deployer.deployContract({
      abi: critterRaceArtifact.abi,
      bytecode: critterRaceArtifact.bytecode,
      args: [nftAddress],
      gas: 10000000n,
      maxFeePerGas: 100000000000n,
      maxPriorityFeePerGas: 1000000000n
    });
    
    console.log(`Transaction hash: ${hash}`);
    console.log("Waiting for transaction confirmation...");
    
    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const raceContractAddress = receipt.contractAddress;
    
    console.log("CritterRace deployed to:", raceContractAddress);
    console.log("Deployment completed successfully!");
    
    // Save the contract address to deployment log
    const fs = require('fs');
    fs.appendFileSync('deployment-log.txt', `CritterRace: ${raceContractAddress}\n`);
    console.log("Contract address appended to deployment-log.txt");
    
    // Update .env file with the contract address
    try {
      let envContent = fs.readFileSync('.env', 'utf8');
      if (envContent.includes('RACE_CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(/RACE_CONTRACT_ADDRESS=".*"/, `RACE_CONTRACT_ADDRESS="${raceContractAddress}"`);
      } else {
        envContent += `\nRACE_CONTRACT_ADDRESS="${raceContractAddress}"`;
      }
      fs.writeFileSync('.env', envContent);
      console.log("Updated .env file with race contract address");
    } catch (error) {
      console.log("Could not update .env file automatically. Please update it manually.");
    }
    
    // Verify the contract on the block explorer
    console.log("\nWaiting for 30 seconds before verification to ensure the contract is indexed...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log("Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: raceContractAddress,
        constructorArguments: [nftAddress],
        contract: "contracts/CritterRace.sol:CritterRace"
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.error("Error verifying contract:", error.message);
      console.log("\nIf verification failed, you can try manually verifying with:");
      console.log(`npx hardhat verify --network monadTestnet ${raceContractAddress} ${nftAddress}`);
    }
    
    console.log("\nDon't forget to save your contract addresses:");
    console.log(`NFT Contract: ${nftAddress}`);
    console.log(`Race Contract: ${raceContractAddress}`);
    
    console.log("\nNext steps:");
    console.log("1. Test creating a race:");
    console.log(`   npx hardhat run scripts/test-race.js --network monadTestnet`);
    console.log("2. Update entry fee if needed:");
    console.log(`   npx hardhat run scripts/update-race-fee.js --network monadTestnet`);
    console.log("3. Start building the frontend!");
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 