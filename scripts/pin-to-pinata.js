// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Pinata API credentials
// You'll need to sign up at https://pinata.cloud/ and get your API keys
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

// The CID of your IPFS assets directory that you want to pin
const assetsCID = process.env.IPFS_ASSETS_CID || "QmaXNSb334r7kLEVSVeozMpfUs7UUggPvt4uh5PGzLm6t3";

// Function to pin by hash (CID) - Note: This requires a paid Pinata plan
async function pinByHash() {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    console.error("Error: Pinata API keys not set");
    console.log("Please set the environment variables in your .env file:");
    console.log("PINATA_API_KEY=your-api-key");
    console.log("PINATA_SECRET_API_KEY=your-secret-key");
    console.log("\nOr set them directly in your terminal:");
    console.log("For PowerShell: $env:PINATA_API_KEY = \"your-api-key\"; $env:PINATA_SECRET_API_KEY = \"your-secret-key\"");
    console.log("For CMD: set PINATA_API_KEY=your-api-key && set PINATA_SECRET_API_KEY=your-secret-key");
    console.log("For Bash/MSYS: export PINATA_API_KEY=your-api-key && export PINATA_SECRET_API_KEY=your-secret-key");
    process.exit(1);
  }

  console.log("Using Pinata API Key:", PINATA_API_KEY.substring(0, 3) + "..." + PINATA_API_KEY.substring(PINATA_API_KEY.length - 3));
  console.log("Using Pinata Secret API Key:", "***" + PINATA_SECRET_API_KEY.substring(PINATA_SECRET_API_KEY.length - 3));

  try {
    console.log(`Pinning CID ${assetsCID} to Pinata...`);
    console.log("Note: Pinning by CID requires a paid Pinata plan.");
    
    const url = 'https://api.pinata.cloud/pinning/pinByHash';
    const response = await axios.post(
      url,
      {
        hashToPin: assetsCID,
        pinataMetadata: {
          name: 'MonadCritters-Assets'
        }
      },
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_API_KEY
        }
      }
    );

    console.log('Pin successful!');
    console.log(response.data);
    
    console.log('\nYour assets are now pinned to Pinata and can be accessed at:');
    console.log(`https://gateway.pinata.cloud/ipfs/${assetsCID}/`);
    
    return response.data;
  } catch (error) {
    console.error('Error pinning to Pinata:', error.response ? error.response.data : error.message);
    console.log('\nSince pinning by CID requires a paid plan, try uploading the files directly instead.');
    console.log('Run the script with the upload option enabled:');
    console.log('node scripts/pin-to-pinata.js --upload');
    throw error;
  }
}

// Function to upload and pin a directory
async function pinDirectory(dirPath) {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    console.error("Error: Pinata API keys not set");
    console.log("Please set the environment variables in your .env file:");
    console.log("PINATA_API_KEY=your-api-key");
    console.log("PINATA_SECRET_API_KEY=your-secret-key");
    console.log("\nOr set them directly in your terminal:");
    console.log("For PowerShell: $env:PINATA_API_KEY = \"your-api-key\"; $env:PINATA_SECRET_API_KEY = \"your-secret-key\"");
    console.log("For CMD: set PINATA_API_KEY=your-api-key && set PINATA_SECRET_API_KEY=your-secret-key");
    console.log("For Bash/MSYS: export PINATA_API_KEY=your-api-key && export PINATA_SECRET_API_KEY=your-secret-key");
    process.exit(1);
  }

  try {
    console.log(`Uploading directory ${dirPath} to Pinata...`);
    
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    
    // Create a form data object
    const formData = new FormData();
    
    // Function to recursively read directory
    const addDirectoryToFormData = (dirPath, rootPath) => {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          addDirectoryToFormData(filePath, rootPath);
        } else {
          // Get the relative path from the root directory
          const relativePath = path.relative(rootPath, filePath);
          // Replace backslashes with forward slashes for IPFS paths
          const ipfsPath = relativePath.replace(/\\/g, '/');
          
          console.log(`Adding file: ${ipfsPath}`);
          formData.append('file', fs.createReadStream(filePath), {
            filepath: ipfsPath
          });
        }
      }
    };
    
    // Add all files from the directory
    addDirectoryToFormData(dirPath, path.dirname(dirPath));
    
    // Add metadata
    formData.append('pinataMetadata', JSON.stringify({
      name: 'MonadCritters-Assets'
    }));
    
    // Add options
    formData.append('pinataOptions', JSON.stringify({
      cidVersion: 0
    }));
    
    // Make the request
    const response = await axios.post(url, formData, {
      maxBodyLength: Infinity, // This is needed to prevent axios from limiting the size
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY
      }
    });
    
    console.log('Upload and pin successful!');
    console.log(response.data);
    
    console.log('\nYour assets are now pinned to Pinata and can be accessed at:');
    console.log(`https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}/`);
    
    // Update the .env file with the new CID
    if (fs.existsSync('.env')) {
      let envContent = fs.readFileSync('.env', 'utf8');
      envContent = envContent.replace(/IPFS_ASSETS_CID=.*/, `IPFS_ASSETS_CID=${response.data.IpfsHash}`);
      fs.writeFileSync('.env', envContent);
      console.log('\nUpdated IPFS_ASSETS_CID in .env file');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error uploading to Pinata:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log("Environment variables loaded from .env file");
    console.log(`Using IPFS CID: ${assetsCID}`);
    
    // Check if we should upload instead of pin
    const shouldUpload = process.argv.includes('--upload');
    
    if (shouldUpload) {
      // Upload and pin the directory
      console.log("\nUploading assets directory to Pinata...");
      await pinDirectory(path.join(__dirname, '../dist/assets'));
    } else {
      // Try to pin by hash (CID) first
      console.log("\nOption 1: Pin by hash (CID) - Note: Requires paid Pinata plan");
      try {
        await pinByHash();
      } catch (error) {
        console.log("\nFalling back to direct upload...");
        await pinDirectory(path.join(__dirname, '../dist/assets'));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
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