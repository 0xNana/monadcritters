const hre = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("Starting contract verification...");

    // Read deployment info
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    const { critterRaceAddress, monadCritterAddress } = deploymentInfo;

    console.log("Verifying CritterRace at:", critterRaceAddress);
    console.log("MonadCritter address:", monadCritterAddress);

    try {
        await hre.run("verify:verify", {
            address: critterRaceAddress,
            constructorArguments: [monadCritterAddress],
            contract: "CritterRace_flat.sol:CritterRace"
        });
        console.log("Verification successful!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("Contract is already verified!");
        } else {
            console.error("Verification failed:", error);
            throw error;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 