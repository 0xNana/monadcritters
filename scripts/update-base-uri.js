// Load environment variables from .env file
require('dotenv').config();

const hre = require("hardhat");

async function main() {
  console.log("Starting baseImageURI update script...");
  
  // The CID of your IPFS assets directory
  const assetsCID = process.env.IPFS_ASSETS_CID || "QmaXNSb334r7kLEVSVeozMpfUs7UUggPvt4uh5PGzLm6t3";
  
  // Choose an IPFS gateway
  // Options:
  // - https://ipfs.io/ipfs/
  // - https://gateway.pinata.cloud/ipfs/
  // - https://cloudflare-ipfs.com/ipfs/
  // - https://dweb.link/ipfs/
  const ipfsGateway = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/";
  
  // Construct the new baseImageURI
  const newBaseImageURI = `${ipfsGateway}${assetsCID}/`;
  
  console.log(`Using IPFS CID: ${assetsCID}`);
  console.log(`Using IPFS Gateway: ${ipfsGateway}`);
  console.log(`New baseImageURI: ${newBaseImageURI}`);
  
  try {
    // Get deployer account using Viem
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Using account:", deployer.account.address);
    
    // Get contract instance using Viem
    console.log("Loading contract instance...");
    const contractAddress = process.env.MONAD_CRITTER_ADDRESS;
    
    if (!contractAddress) {
      console.error("Error: MONAD_CRITTER_ADDRESS environment variable not set");
      console.log("Please set the environment variable in your .env file:");
      console.log("MONAD_CRITTER_ADDRESS=0xYourContractAddress");
      console.log("\nOr set it directly in your terminal:");
      console.log("For PowerShell: $env:MONAD_CRITTER_ADDRESS = \"0xYourContractAddress\"");
      console.log("For CMD: set MONAD_CRITTER_ADDRESS=0xYourContractAddress");
      console.log("For Bash/MSYS: export MONAD_CRITTER_ADDRESS=0xYourContractAddress");
      process.exit(1);
    }
    
    // Get contract instance
    const publicClient = await hre.viem.getPublicClient();
    const walletClient = deployer;
    
    // Get the contract ABI
    const monadCritterArtifact = await hre.artifacts.readArtifact("MonadCritter");
    
    // Get current baseImageURI
    const currentBaseImageURI = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'baseImageURI'
    });
    console.log(`Current baseImageURI: ${currentBaseImageURI}`);
    
    // Update baseImageURI
    console.log("Updating baseImageURI...");
    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'setBaseImageURI',
      args: [newBaseImageURI],
      gas: 5000000n,
      maxFeePerGas: 100000000000n,
      maxPriorityFeePerGas: 1000000000n,
    });
    
    console.log(`Transaction hash: ${hash}`);
    console.log("Waiting for transaction confirmation...");
    
    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the update
    const updatedBaseImageURI = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'baseImageURI'
    });
    console.log(`Updated baseImageURI: ${updatedBaseImageURI}`);
    
    console.log("\nbaseImageURI update completed successfully!");
    
    // Test tokenURI for a token if any exist
    const totalSupply = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'totalSupply'
    });
    
    if (totalSupply > 0) {
      const tokenId = 1n; // First token
      const tokenURI = await publicClient.readContract({
        address: contractAddress,
        abi: monadCritterArtifact.abi,
        functionName: 'tokenURI',
        args: [tokenId]
      });
      
      console.log(`\nToken #${tokenId} URI: ${tokenURI.substring(0, 64)}...`);
      
      // If it's a data URI, decode and print the JSON
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64 = tokenURI.split(',')[1];
        const json = Buffer.from(base64, 'base64').toString();
        console.log('Metadata:');
        console.log(JSON.parse(json));
      }
    } else {
      console.log("\nNo tokens minted yet. Mint some tokens to test the tokenURI.");
    }
  } catch (error) {
    console.error("Error during baseImageURI update:", error);
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