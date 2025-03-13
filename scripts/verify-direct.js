const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
    console.log("Starting direct contract verification...");

    // Read the flattened contract
    const contractCode = fs.readFileSync('CritterRace_flat.sol', 'utf8');
    
    // Read deployment info
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    const { critterRaceAddress, monadCritterAddress } = deploymentInfo;

    const verificationData = {
        address: critterRaceAddress,
        name: "CritterRace",
        sourceCode: contractCode,
        compilerVersion: "v0.8.24+commit.e11b9d8a",
        optimizationUsed: true,
        runs: 200,
        constructorArguments: monadCritterAddress,
        libraries: {}
    };

    try {
        console.log("Submitting verification request...");
        const response = await axios.post(
            'https://explorer-api-monad.blockvision.org/api/contract/verify',
            verificationData
        );

        console.log("Verification response:", response.data);
        console.log("Verification submitted successfully!");
    } catch (error) {
        console.error("Verification failed:", error.response?.data || error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 