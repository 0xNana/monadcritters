const fs = require('fs').promises;
const path = require('path');
const { optimize } = require('svgo');
const sharp = require('sharp');

const MASCOT_DIR = path.join(__dirname, '../assets/mascot');
const OPTIMIZED_DIR = path.join(__dirname, '../assets/optimized');

// SVGO configuration for different rarity levels
const svgoConfigs = {
  common: {
    plugins: [
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeEditorsNSData',
      'cleanupAttrs',
      'minifyStyles',
      'convertStyleToAttrs',
      'cleanupIds',
      'removeRasterImages',
      {
        name: 'removeViewBox',
        active: false
      }
    ]
  },
  uncommon: {
    plugins: [
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeEditorsNSData',
      'cleanupAttrs',
      'minifyStyles',
      'convertStyleToAttrs',
      'cleanupIds',
      {
        name: 'removeViewBox',
        active: false
      }
    ]
  },
  rare: {
    plugins: [
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeEditorsNSData',
      'cleanupAttrs',
      'minifyStyles',
      'convertStyleToAttrs',
      'cleanupIds',
      {
        name: 'removeViewBox',
        active: false
      }
    ]
  },
  legendary: {
    plugins: [
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeEditorsNSData',
      'cleanupAttrs',
      'minifyStyles',
      'convertStyleToAttrs',
      'cleanupIds',
      {
        name: 'removeViewBox',
        active: false
      }
    ]
  }
};

async function optimizeSVG(inputPath, outputPath, config) {
  const svg = await fs.readFile(inputPath, 'utf8');
  const result = optimize(svg, {
    path: inputPath,
    ...config
  });
  await fs.writeFile(outputPath, result.data);
}

async function convertToWebP(svgPath, outputPath, size) {
  await sharp(svgPath)
    .resize(size, size)
    .webp({ quality: 90 })
    .toFile(outputPath);
}

async function processAssets() {
  // Create optimized directory structure
  const rarities = ['common', 'uncommon', 'rare', 'legendary'];
  const sizes = ['512', '256', '128', '64', '32'];

  for (const rarity of rarities) {
    for (const size of sizes) {
      const dir = path.join(OPTIMIZED_DIR, rarity, size);
      await fs.mkdir(dir, { recursive: true });

      // Source SVG path
      const sourcePath = path.join(MASCOT_DIR, rarity, size, 'mascot.svg');
      
      // Optimize SVG
      const optimizedSvgPath = path.join(dir, 'mascot.min.svg');
      await optimizeSVG(sourcePath, optimizedSvgPath, svgoConfigs[rarity]);

      // Convert to WebP
      const webpPath = path.join(dir, 'mascot.webp');
      await convertToWebP(sourcePath, webpPath, parseInt(size));
    }
  }
}

processAssets().catch(console.error); 