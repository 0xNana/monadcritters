import { artifacts, viem } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const publicClient = await viem.getPublicClient();
  const [account] = await viem.getWalletClients();
  console.log("Deploying contracts with account:", account.account.address);

  // Deploy MonadCritter NFT contract
  console.log("\nDeploying MonadCritter NFT contract...");
  const MonadCritterArtifact = await artifacts.readArtifact("MonadCritter");
  const critterDeployHash = await account.deployContract({
    abi: MonadCritterArtifact.abi,
    bytecode: MonadCritterArtifact.bytecode,
    args: []
  });
  
  console.log("Waiting for MonadCritter deployment transaction...");
  const critterReceipt = await publicClient.waitForTransactionReceipt({ hash: critterDeployHash });
  const critterAddress = critterReceipt.contractAddress;
  if (!critterAddress) throw new Error("Failed to get MonadCritter contract address");
  console.log("MonadCritter deployed to:", critterAddress);

  // Deploy CritterRace contract
  console.log("\nDeploying CritterRace contract...");
  const CritterRaceArtifact = await artifacts.readArtifact("CritterRace");
  const raceDeployHash = await account.deployContract({
    abi: CritterRaceArtifact.abi,
    bytecode: CritterRaceArtifact.bytecode,
    args: [critterAddress]
  });

  console.log("Waiting for CritterRace deployment transaction...");
  const raceReceipt = await publicClient.waitForTransactionReceipt({ hash: raceDeployHash });
  const raceAddress = raceReceipt.contractAddress;
  if (!raceAddress) throw new Error("Failed to get CritterRace contract address");
  console.log("CritterRace deployed to:", raceAddress);

  // Save deployment info
  const network = await publicClient.getChainId();
  const networkName = network === 11155111 ? 'sepolia' : 
                     network === 10143 ? 'monadTestnet' : 'hardhat';
  
  const deploymentInfo = {
    network: networkName,
    chainId: network,
    contracts: {
      MonadCritter: critterAddress,
      CritterRace: raceAddress
    },
    timestamp: new Date().toISOString()
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment info to network-specific file
  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to:", deploymentPath);
  console.log("\nDeployment completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Update your .env file with these values:");
  console.log(`VITE_${networkName.toUpperCase()}_CRITTER_ADDRESS=${critterAddress}`);
  console.log(`VITE_${networkName.toUpperCase()}_RACE_CONTRACT_ADDRESS=${raceAddress}`);
  console.log("\n2. Verify contracts on block explorer:");
  console.log(`npx hardhat verify --network ${networkName} ${critterAddress}`);
  console.log(`npx hardhat verify --network ${networkName} ${raceAddress} ${critterAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });