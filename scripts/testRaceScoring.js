const { ethers } = require("hardhat");

// Helper function to generate NFT stats like the contract
function generateNFTStats(rarity) {
    // Generate base stats (40-100)
    let speed = Math.floor(Math.random() * 60) + 40;
    let stamina = Math.floor(Math.random() * 60) + 40;
    let luck = Math.floor(Math.random() * 60) + 40;

    // Apply rarity boosts
    if (rarity === 1) { // Uncommon: +10%
        speed = Math.min(255, Math.floor(speed * 1.1));
        stamina = Math.min(255, Math.floor(stamina * 1.1));
        luck = Math.min(255, Math.floor(luck * 1.1));
    } else if (rarity === 2) { // Rare: +25%
        speed = Math.min(255, Math.floor(speed * 1.25));
        stamina = Math.min(255, Math.floor(stamina * 1.25));
        luck = Math.min(255, Math.floor(luck * 1.25));
    } else if (rarity === 3) { // Legendary: +50%
        speed = Math.min(255, Math.floor(speed * 1.5));
        stamina = Math.min(255, Math.floor(speed * 1.5));
        luck = Math.min(255, Math.floor(speed * 1.5));
    }

    return { speed, stamina, luck, rarity };
}

// Our optimized scoring formula
function calculateRaceScore(stats, boosts) {
    // Get rarity multiplier
    const rarityMultipliers = [1, 1.1, 1.25, 1.5];
    const rarityMultiplier = rarityMultipliers[stats.rarity];
    
    // Weight the stats differently to reduce ties
    const speedWeight = 1.2;
    const staminaWeight = 1.0;
    const luckWeight = 0.8;
    
    // Calculate weighted stats
    const weightedSpeed = Math.pow(stats.speed, speedWeight);
    const weightedStamina = Math.pow(stats.stamina, staminaWeight);
    const weightedLuck = Math.pow(stats.luck, luckWeight);
    
    // Calculate base score using weighted multiplicative formula
    let baseScore = (weightedSpeed * weightedStamina * weightedLuck) / 100;
    
    // Add a small luck-based variance (±2% based on luck stat)
    const luckVariance = 1 + ((stats.luck / 255) * 0.04 - 0.02);
    baseScore *= luckVariance;
    
    // Apply rarity multiplier
    baseScore *= rarityMultiplier;
    
    // Apply boosts with diminishing returns
    if (boosts > 0) {
        // First boost gives 20% increase
        baseScore *= (1 + (0.2 * Math.min(boosts, 1)));
        
        // Second boost gives 15% increase
        if (boosts > 1) {
            baseScore *= (1 + (0.15 * (boosts - 1)));
        }
    }
    
    // Scale the final score
    baseScore *= 100;
    
    return Math.round(baseScore * 100) / 100;
}

async function testRaceScoring() {
    console.log("=== RACE SCORING TEST CASES ===\n");

    // Test Case 1: Same Stats, Different Rarities
    console.log("Test Case 1: Same Stats, Different Rarities");
    const baseStats = { speed: 70, stamina: 70, luck: 70 };
    const rarities = ["Common", "Uncommon", "Rare", "Legendary"];
    
    for (let i = 0; i < 4; i++) {
        const stats = { ...baseStats, rarity: i };
        const score = calculateRaceScore(stats, 0);
        console.log(`${rarities[i]}: Score = ${score}`);
    }

    // Test Case 2: Boost Impact
    console.log("\nTest Case 2: Boost Impact");
    const testStats = { speed: 80, stamina: 80, luck: 80, rarity: 0 };
    for (let boost = 0; boost <= 2; boost++) {
        const score = calculateRaceScore(testStats, boost);
        console.log(`With ${boost} boost(s): Score = ${score}`);
    }

    // Test Case 3: Stat Weight Testing
    console.log("\nTest Case 3: Stat Weight Impact");
    const baseScore = calculateRaceScore({ speed: 70, stamina: 70, luck: 70, rarity: 0 }, 0);
    console.log(`Base Score (70/70/70): ${baseScore}`);
    
    const speedFocused = calculateRaceScore({ speed: 100, stamina: 55, luck: 55, rarity: 0 }, 0);
    const staminaFocused = calculateRaceScore({ speed: 55, stamina: 100, luck: 55, rarity: 0 }, 0);
    const luckFocused = calculateRaceScore({ speed: 55, stamina: 55, luck: 100, rarity: 0 }, 0);
    
    console.log(`Speed Focused (100/55/55): ${speedFocused}`);
    console.log(`Stamina Focused (55/100/55): ${staminaFocused}`);
    console.log(`Luck Focused (55/55/100): ${luckFocused}`);

    // Test Case 4: Tie Analysis
    console.log("\nTest Case 4: Tie Analysis");
    const sampleSize = 1000;
    const scores = new Map();
    let tieCount = 0;

    for (let i = 0; i < sampleSize; i++) {
        const rarity = Math.random() < 0.7 ? 0 : Math.random() < 0.67 ? 1 : Math.random() < 0.75 ? 2 : 3;
        const stats = generateNFTStats(rarity);
        const boosts = Math.floor(Math.random() * 3); // 0-2 boosts
        const score = calculateRaceScore(stats, boosts);
        
        if (scores.has(score)) {
            tieCount++;
        }
        scores.set(score, (scores.get(score) || 0) + 1);
    }

    console.log(`Total Races: ${sampleSize}`);
    console.log(`Number of Ties: ${tieCount}`);
    console.log(`Tie Rate: ${(tieCount / sampleSize * 100).toFixed(2)}%`);

    // Test Case 5: Edge Cases
    console.log("\nTest Case 5: Edge Cases");
    
    // Minimum stats
    const minStats = { speed: 40, stamina: 40, luck: 40, rarity: 0 };
    console.log(`Minimum Stats Score: ${calculateRaceScore(minStats, 0)}`);
    
    // Maximum stats
    const maxStats = { speed: 255, stamina: 255, luck: 255, rarity: 3 };
    console.log(`Maximum Stats Score: ${calculateRaceScore(maxStats, 2)}`);
    
    // Perfect Legendary with max boosts
    const perfectLegendary = { speed: 150, stamina: 150, luck: 150, rarity: 3 };
    console.log(`Perfect Legendary with Max Boosts: ${calculateRaceScore(perfectLegendary, 2)}`);
}

// Run the tests
testRaceScoring()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    }); 