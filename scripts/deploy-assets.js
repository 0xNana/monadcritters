const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SPRITES_DIR = path.join(__dirname, '../assets/sprites');
const OUTPUT_DIR = path.join(__dirname, '../dist/assets');
const METADATA_DIR = path.join(OUTPUT_DIR, 'metadata');

// Ensure output directories exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Copy sprite files to output directory
function copySprites() {
  console.log('Copying sprite files...');
  ensureDirectoryExists(OUTPUT_DIR);
  
  // Copy all PNG files
  const files = fs.readdirSync(SPRITES_DIR);
  const pngFiles = files.filter(file => file.endsWith('.png'));
  
  pngFiles.forEach(file => {
    const sourcePath = path.join(SPRITES_DIR, file);
    const destPath = path.join(OUTPUT_DIR, file);
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file}`);
  });
  
  // Copy CSS file if it exists
  const cssPath = path.join(SPRITES_DIR, 'sprites.css');
  if (fs.existsSync(cssPath)) {
    fs.copyFileSync(cssPath, path.join(OUTPUT_DIR, 'sprites.css'));
    console.log('Copied sprites.css');
  }
}

// Generate sample metadata for testing
function generateSampleMetadata() {
  console.log('Generating sample metadata...');
  ensureDirectoryExists(METADATA_DIR);
  
  const rarities = ['common', 'uncommon', 'rare', 'legendary'];
  const sizes = [512, 256, 128, 64, 32];
  
  // Create a sample token for each rarity
  rarities.forEach((rarity, rarityIndex) => {
    const tokenId = rarityIndex + 1;
    const stats = {
      speed: 50 + (rarityIndex * 10),
      stamina: 50 + (rarityIndex * 10),
      luck: 50 + (rarityIndex * 10)
    };
    
    // Create image URLs for different sizes
    const imageURLs = {};
    sizes.forEach(size => {
      imageURLs[`image_${size}`] = `/assets/${rarity}-${size}.png`;
    });
    
    // Create metadata JSON
    const metadata = {
      name: `MonadCritter #${tokenId}`,
      description: `A ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} MonadCritter for racing on the Monad blockchain.`,
      attributes: [
        { trait_type: "Rarity", value: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
        { trait_type: "Speed", value: stats.speed },
        { trait_type: "Stamina", value: stats.stamina },
        { trait_type: "Luck", value: stats.luck }
      ],
      image: imageURLs.image_512,
      ...imageURLs
    };
    
    // Write metadata to file
    fs.writeFileSync(
      path.join(METADATA_DIR, `${tokenId}.json`),
      JSON.stringify(metadata, null, 2)
    );
    console.log(`Generated metadata for token #${tokenId} (${rarity})`);
  });
}

// Create a simple HTML page to view the sprites
function createViewerPage() {
  console.log('Creating sprite viewer page...');
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MonadCritters Sprite Viewer</title>
  <link rel="stylesheet" href="sprites.css">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #1a1a2e;
      color: #e6e6e6;
    }
    h1, h2 {
      color: #00d9ff;
      text-align: center;
    }
    .container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .section {
      background-color: #16213e;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    .sprites {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      justify-content: center;
    }
    .sprite-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background-color: #0f3460;
      border-radius: 8px;
      padding: 15px;
      transition: transform 0.3s;
    }
    .sprite-card:hover {
      transform: scale(1.05);
    }
    .sprite-info {
      margin-top: 10px;
      text-align: center;
    }
    .metadata-section {
      margin-top: 40px;
    }
    pre {
      background-color: #0a1931;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      color: #00d9ff;
    }
  </style>
</head>
<body>
  <h1>MonadCritters Sprite Viewer</h1>
  
  <div class="container">
    <div class="section">
      <h2>Sprite Assets</h2>
      <div class="sprites">
        <div class="sprite-card">
          <img src="common-128.png" alt="Common Critter">
          <div class="sprite-info">Common (128px)</div>
        </div>
        <div class="sprite-card">
          <img src="uncommon-128.png" alt="Uncommon Critter">
          <div class="sprite-info">Uncommon (128px)</div>
        </div>
        <div class="sprite-card">
          <img src="rare-128.png" alt="Rare Critter">
          <div class="sprite-info">Rare (128px)</div>
        </div>
        <div class="sprite-card">
          <img src="legendary-128.png" alt="Legendary Critter">
          <div class="sprite-info">Legendary (128px)</div>
        </div>
      </div>
    </div>
    
    <div class="section metadata-section">
      <h2>Sample Metadata</h2>
      <p>This is an example of the metadata that will be returned by the tokenURI function:</p>
      <pre id="metadata-example"></pre>
    </div>
  </div>

  <script>
    // Fetch and display sample metadata
    fetch('metadata/1.json')
      .then(response => response.json())
      .then(data => {
        document.getElementById('metadata-example').textContent = JSON.stringify(data, null, 2);
      })
      .catch(error => {
        console.error('Error fetching metadata:', error);
        document.getElementById('metadata-example').textContent = 'Error loading metadata';
      });
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), htmlContent);
  console.log('Created sprite viewer page at dist/assets/index.html');
}

// Main function
async function main() {
  try {
    console.log('Starting asset deployment...');
    
    // Create dist directory if it doesn't exist
    ensureDirectoryExists(path.join(__dirname, '../dist'));
    
    // Copy sprites
    copySprites();
    
    // Generate sample metadata
    generateSampleMetadata();
    
    // Create viewer page
    createViewerPage();
    
    console.log('\nAsset deployment complete!');
    console.log('To view the assets, serve the dist directory with a local server:');
    console.log('npx http-server ./dist -p 8080');
    console.log('Then open http://localhost:8080/assets/ in your browser');
    
    // Update contract baseImageURI after deployment
    console.log('\nAfter deploying to a production server, update the contract\'s baseImageURI:');
    console.log('await monadCritter.setBaseImageURI("https://your-server.com/assets/");');
  } catch (error) {
    console.error('Error deploying assets:', error);
    process.exit(1);
  }
}

// Run the script
main(); 