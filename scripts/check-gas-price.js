require('dotenv').config();
const hre = require("hardhat");
const { formatGwei } = require("viem");

async function main() {
  console.log("Checking gas price on Monad Testnet...");
  
  // Get the public client
  const publicClient = await hre.viem.getPublicClient();
  
  // Get the gas price
  const gasPrice = await publicClient.getGasPrice();
  
  // Convert to Gwei for readability
  const gasPriceInGwei = formatGwei(gasPrice);
  
  console.log(`Current gas price: ${gasPriceInGwei} Gwei`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 