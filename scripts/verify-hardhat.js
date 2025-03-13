const hre = require("hardhat");

async function main() {
    // Read deployment info
    const deploymentInfo = require('../deployment-info.json');
    const { critterRaceAddress, monadCritterAddress } = deploymentInfo;

    console.log("Starting contract verification...");
    console.log("Contract address:", critterRaceAddress);
    console.log("Constructor argument (MonadCritter address):", monadCritterAddress);

    try {
        await hre.run("verify:verify", {
            address: critterRaceAddress,
            constructorArguments: [monadCritterAddress],
            contract: "contracts/CritterRace.sol:CritterRace"
        });
        console.log("Contract verification successful!");
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