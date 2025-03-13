// Load environment variables from .env file
require('dotenv').config();

const hre = require("hardhat");

async function main() {
  console.log("Starting mint price update script...");
  
  try {
    // Get the deployer account
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Using account:", deployer.account.address);
    
    // Get the public client
    const publicClient = await hre.viem.getPublicClient();
    
    // Get contract instance
    const contractAddress = process.env.MONAD_CRITTER_ADDRESS;
    
    if (!contractAddress) {
      console.error("Error: MONAD_CRITTER_ADDRESS environment variable not set");
      console.log("Please set the environment variable in your .env file:");
      console.log("MONAD_CRITTER_ADDRESS=0xYourContractAddress");
      process.exit(1);
    }
    
    console.log("Contract address:", contractAddress);
    
    // Get the contract ABI
    const monadCritterArtifact = await hre.artifacts.readArtifact("MonadCritter");
    
    // Get current mint price
    const currentMintPrice = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'mintPrice'
    });
    
    console.log(`Current mint price: ${hre.viem.formatEther(currentMintPrice)} MON`);
    
    // Set new mint price (0.02 MON)
    const newMintPrice = hre.viem.parseEther("0.02");
    console.log(`Setting new mint price to: ${hre.viem.formatEther(newMintPrice)} MON`);
    
    const hash = await deployer.writeContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'setMintPrice',
      args: [newMintPrice]
    });
    
    console.log(`Transaction hash: ${hash}`);
    console.log("Waiting for transaction confirmation...");
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the update
    const updatedMintPrice = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'mintPrice'
    });
    
    console.log(`Updated mint price: ${hre.viem.formatEther(updatedMintPrice)} MON`);
    
    // Set it back to the original price
    console.log(`Setting mint price back to: ${hre.viem.formatEther(currentMintPrice)} MON`);
    
    const revertHash = await deployer.writeContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'setMintPrice',
      args: [currentMintPrice]
    });
    
    console.log(`Transaction hash: ${revertHash}`);
    console.log("Waiting for transaction confirmation...");
    
    const revertReceipt = await publicClient.waitForTransactionReceipt({ hash: revertHash });
    console.log(`Transaction confirmed in block ${revertReceipt.blockNumber}`);
    
    // Verify the update
    const finalMintPrice = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'mintPrice'
    });
    
    console.log(`Final mint price: ${hre.viem.formatEther(finalMintPrice)} MON`);
    console.log("\nMint price update test completed successfully!");
  } catch (error) {
    console.error("Error during mint price update:", error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 