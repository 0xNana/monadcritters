// Load environment variables from .env file
require('dotenv').config();
const hre = require("hardhat");
const { formatEther } = require('viem');

async function main() {
  console.log("Starting mint test script for MonadCritterV2...");
  
  try {
    // Get the deployer account
    const [deployer] = await hre.viem.getWalletClients();
    console.log("Using account:", deployer.account.address);
    
    // Get the public client
    const publicClient = await hre.viem.getPublicClient();
    
    // Get contract instance - use the V2 contract address
    const contractAddress = process.env.VITE_MONAD_CRITTER_V2_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    
    console.log("Contract address:", contractAddress);
    
    // Get the contract ABI
    const monadCritterArtifact = await hre.artifacts.readArtifact("MonadCritterV2");
    
    // Get mint price
    const mintPrice = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'mintPrice'
    });
    
    console.log(`Mint price: ${formatEther(mintPrice)} MON`);
    
    // Get current tokens minted
    const tokensMinted = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'tokensMinted'
    });
    
    console.log(`Current tokens minted: ${tokensMinted}`);
    
    // Get mints per wallet for the deployer
    const mintsPerWallet = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'mintsPerWallet',
      args: [deployer.account.address]
    });
    
    console.log(`Mints per wallet for ${deployer.account.address}: ${mintsPerWallet}`);
    
    // Check if we can mint more
    const MAX_MINTS_PER_WALLET = 4n;
    if (mintsPerWallet >= MAX_MINTS_PER_WALLET) {
      console.log(`You've already minted the maximum number of NFTs (${MAX_MINTS_PER_WALLET})`);
      console.log("Testing owner mint instead...");
      
      // Test owner mint
      console.log("Minting 1 NFT as owner...");
      const ownerMintHash = await deployer.writeContract({
        address: contractAddress,
        abi: monadCritterArtifact.abi,
        functionName: 'ownerMint',
        args: [deployer.account.address, 1n]
      });
      
      console.log(`Owner mint transaction hash: ${ownerMintHash}`);
      console.log("Waiting for transaction confirmation...");
      
      const ownerMintReceipt = await publicClient.waitForTransactionReceipt({ hash: ownerMintHash });
      console.log(`Owner mint confirmed in block ${ownerMintReceipt.blockNumber}`);
    } else {
      // Test regular mint
      console.log(`Minting 1 NFT (${mintsPerWallet + 1n}/${MAX_MINTS_PER_WALLET})...`);
      const mintHash = await deployer.writeContract({
        address: contractAddress,
        abi: monadCritterArtifact.abi,
        functionName: 'mint',
        value: mintPrice,
        gas: 10000000n,
        maxFeePerGas: 100000000000n,
        maxPriorityFeePerGas: 1000000000n
      });
      
      console.log(`Mint transaction hash: ${mintHash}`);
      console.log("Waiting for transaction confirmation...");
      
      const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
      console.log(`Mint confirmed in block ${mintReceipt.blockNumber}`);
    }
    
    // Get updated tokens minted
    const newTokensMinted = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'tokensMinted'
    });
    
    console.log(`New tokens minted: ${newTokensMinted}`);
    
    // Get the token ID of the newly minted NFT
    const tokenId = newTokensMinted;
    
    // Get the token URI
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
    
    // Get the stats of the newly minted NFT
    const stats = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'getStats',
      args: [tokenId]
    });
    
    console.log(`\nStats for Token #${tokenId}:`);
    console.log(`Rarity: ${stats.rarity} (${['Common', 'Uncommon', 'Rare', 'Legendary'][stats.rarity]})`);
    console.log(`Speed: ${stats.speed}`);
    console.log(`Stamina: ${stats.stamina}`);
    console.log(`Luck: ${stats.luck}`);
    
    // Test the getImageURL function
    const imageURL = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'getImageURL',
      args: [stats.rarity, 512n]
    });
    
    console.log(`\nImage URL for Token #${tokenId}: ${imageURL}`);
    
    // Get total supply from ERC721Enumerable
    const totalSupply = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'totalSupply'
    });
    
    console.log(`\nTotal supply (from ERC721Enumerable): ${totalSupply}`);
    
    // Test tokenOfOwnerByIndex from ERC721Enumerable
    const tokenIndex = await publicClient.readContract({
      address: contractAddress,
      abi: monadCritterArtifact.abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [deployer.account.address, 0n]
    });
    
    console.log(`Token ID at index 0 for ${deployer.account.address}: ${tokenIndex}`);
    
    console.log("\nMint test completed successfully!");
  } catch (error) {
    console.error("Error during mint test:", error);
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