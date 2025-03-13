const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { createCanvas } = require('canvas');

const MASCOT_DIR = path.join(__dirname, '../assets/mascot');
const SPRITE_DIR = path.join(__dirname, '../assets/sprites');

// Animation configurations for each rarity
const RARITY_CONFIGS = {
  common: {
    frames: 1, // Static
    duration: 0,
    generateFrame: (i) => ({
      colorMatrix: '0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0'
    })
  },
  uncommon: {
    frames: 4, // Subtle edge pulse
    duration: 2000,
    generateFrame: (i) => {
      const edgeIntensity = 3 + Math.sin((i / 4) * Math.PI) * 1;
      return {
        colorMatrix: `0.8 0 0 0 0 0 ${1.2 + Math.sin((i / 4) * Math.PI) * 0.1} 0 0 0.1 0 0 0.8 0 0 0 0 0 1 0`,
        edgeKernel: `0 -1 0 -1 ${edgeIntensity} -1 0 -1 0`
      };
    }
  },
  rare: {
    frames: 6, // Pulsing blue glow
    duration: 2000,
    generateFrame: (i) => {
      const blueIntensity = 1.2 + Math.sin((i / 6) * Math.PI) * 0.2;
      const glowRadius = 2 + Math.sin((i / 6) * Math.PI);
      return {
        colorMatrix: `0.8 0 0 0 0 0 0.8 0 0 0 0 0 ${blueIntensity} 0 0.2 0 0 0 1 0`,
        glowRadius
      };
    }
  },
  legendary: {
    frames: 8, // Complex tail glow
    duration: 2000,
    generateFrame: (i) => {
      const opacity = 0.6 + (0.4 * Math.sin((i / 8) * Math.PI));
      const blur = 4 + (2 * Math.sin((i / 8) * Math.PI));
      return { opacity, blur };
    }
  }
};

async function generateFrames(svgPath, size, rarity) {
  const frames = [];
  const config = RARITY_CONFIGS[rarity];

  for (let i = 0; i < config.frames; i++) {
    const frameConfig = config.generateFrame(i);
    const svgContent = await fs.readFile(svgPath, 'utf8');
    
    // Apply rarity-specific modifications
    let modifiedSvg = svgContent;
    switch (rarity) {
      case 'common':
        modifiedSvg = modifiedSvg.replace(
          /<feColorMatrix[^>]+>/,
          `<feColorMatrix type="matrix" values="${frameConfig.colorMatrix}"/>`
        );
        break;
      case 'uncommon':
        modifiedSvg = modifiedSvg
          .replace(
            /<feColorMatrix[^>]+>/,
            `<feColorMatrix type="matrix" values="${frameConfig.colorMatrix}"/>`
          )
          .replace(
            /kernelMatrix="[^"]+"/,
            `kernelMatrix="${frameConfig.edgeKernel}"`
          );
        break;
      case 'rare':
        modifiedSvg = modifiedSvg
          .replace(
            /<feColorMatrix[^>]+>/,
            `<feColorMatrix type="matrix" values="${frameConfig.colorMatrix}"/>`
          )
          .replace(
            /stdDeviation="[\d.]+"/,
            `stdDeviation="${frameConfig.glowRadius}"`
          );
        break;
      case 'legendary':
        modifiedSvg = modifiedSvg
          .replace(/flood-opacity="[\d.]+"/, `flood-opacity="${frameConfig.opacity}"`)
          .replace(/stdDeviation="[\d.]+"/, `stdDeviation="${frameConfig.blur}"`);
        break;
    }

    const frame = await sharp(Buffer.from(modifiedSvg))
      .resize(size, size)
      .png()
      .toBuffer();
    
    frames.push(frame);
  }

  return frames;
}

async function createSpriteSheet(frames, size) {
  const spriteWidth = size * frames.length;
  const spriteHeight = size;
  
  return await sharp({
    create: {
      width: spriteWidth,
      height: spriteHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(frames.map((frame, index) => ({
    input: frame,
    left: index * size,
    top: 0
  })))
  .png()
  .toBuffer();
}

async function generateSprites() {
  const sizes = ['512', '256', '128', '64', '32'];
  const rarities = Object.keys(RARITY_CONFIGS);
  
  await fs.mkdir(SPRITE_DIR, { recursive: true });
  
  // Generate CSS animation keyframes and base styles
  let cssContent = `
/* Base sprite styles */
[class^="critter-"] {
  background-repeat: no-repeat;
}

/* Animation keyframes for each rarity */
`;

  // Add keyframes for animated rarities
  for (const rarity of rarities) {
    const config = RARITY_CONFIGS[rarity];
    if (config.frames > 1) {
      cssContent += `
@keyframes ${rarity}-animation {
  0% { background-position: 0 0; }
  100% { background-position: -100% 0; }
}
`;
    }
  }

  cssContent += `\n/* Sprite classes for different sizes and rarities */\n`;

  // Process each rarity and size
  for (const rarity of rarities) {
    for (const size of sizes) {
      const sizeNum = parseInt(size);
      const sourcePath = path.join(MASCOT_DIR, rarity, size, 'mascot.svg');
      
      console.log(`Generating ${rarity} ${size}px frames...`);
      const frames = await generateFrames(sourcePath, sizeNum, rarity);
      
      console.log(`Creating ${rarity} ${size}px sprite sheet...`);
      const spriteSheet = await createSpriteSheet(frames, sizeNum);
      
      const outputPath = path.join(SPRITE_DIR, `${rarity}-${size}.png`);
      await fs.writeFile(outputPath, spriteSheet);
      
      // Add CSS for this variant
      const config = RARITY_CONFIGS[rarity];
      cssContent += `
.critter-${rarity}-${size} {
  width: ${size}px;
  height: ${size}px;
  background-image: url('sprites/${rarity}-${size}.png');
  ${config.frames > 1 ? `animation: ${rarity}-animation ${config.duration}ms steps(${config.frames}) infinite;` : ''}
}
`;
    }
  }

  // Save CSS file
  await fs.writeFile(path.join(SPRITE_DIR, 'sprites.css'), cssContent);
  
  // Create HTML preview with all variants
  const previewContent = `
<!DOCTYPE html>
<html>
<head>
  <title>MonadCritters Sprite Preview</title>
  <link rel="stylesheet" href="sprites.css">
  <style>
    body { background: #1a1a1a; color: white; font-family: Arial, sans-serif; }
    .container { display: flex; flex-wrap: wrap; gap: 20px; padding: 20px; }
    .sprite-demo { text-align: center; }
    .sprite-demo p { margin: 10px 0; }
    .rarity-group { 
      border: 1px solid #333; 
      padding: 20px;
      margin: 10px;
      border-radius: 8px;
    }
    .rarity-title {
      font-size: 1.2em;
      margin-bottom: 15px;
      text-transform: capitalize;
    }
  </style>
</head>
<body>
  <div class="container">
    ${rarities.map(rarity => `
      <div class="rarity-group">
        <div class="rarity-title">${rarity}</div>
        <div style="display: flex; flex-wrap: wrap; gap: 15px;">
          ${sizes.map(size => `
            <div class="sprite-demo">
              <div class="critter-${rarity}-${size}"></div>
              <p>${size}x${size}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  await fs.writeFile(path.join(SPRITE_DIR, 'preview.html'), previewContent);
}

generateSprites().catch(console.error); 