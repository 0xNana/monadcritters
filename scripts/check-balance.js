require('dotenv').config();
const hre = require("hardhat");
const { formatEther } = require("viem");

async function main() {
  console.log("Checking account balance...");
  
  // Get the current account
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log("Account:", deployer.account.address);
  
  // Get the balance
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log("Balance:", formatEther(balance), "MON");
  
  // Get gas price
  const gasPrice = await publicClient.getGasPrice();
  console.log("Current gas price:", formatEther(gasPrice), "MON");
  
  // Estimate cost for a simple transaction (21000 gas)
  const simpleTxCost = gasPrice * 21000n;
  console.log("Estimated cost for simple transaction:", formatEther(simpleTxCost), "MON");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 