const { ethers } = require("hardhat");

// Simulates the NFT stats generation like in the contract
function generateNFTStats() {
    // Simulate rarity roll (70/20/9/1 distribution)
    const rarityRoll = Math.floor(Math.random() * 100);
    let rarity;
    if (rarityRoll < 70) rarity = 0; // Common
    else if (rarityRoll < 90) rarity = 1; // Uncommon
    else if (rarityRoll < 99) rarity = 2; // Rare
    else rarity = 3; // Legendary

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
        stamina = Math.min(255, Math.floor(stamina * 1.5));
        luck = Math.min(255, Math.floor(luck * 1.5));
    }

    return { speed, stamina, luck, rarity };
}

function calculateRaceScore(stats, boosts) {
    // Get rarity multiplier
    const rarityMultiplier = [1, 1.1, 1.25, 1.5][stats.rarity];
    
    // Weight the stats differently to reduce ties
    // Speed is most important (x1.2), followed by stamina (x1.0), then luck (x0.8)
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
        
        // Second boost gives 15% increase (diminishing returns)
        if (boosts > 1) {
            baseScore *= (1 + (0.15 * (boosts - 1)));
        }
    }
    
    // Scale the final score
    baseScore *= 100;
    
    // Return rounded score with 2 decimal precision to maintain some granularity
    return Math.round(baseScore * 100) / 100;
}

// Update the main calculation function to use the new race simulation
function calculateScore(stats, boosts) {
    // Run multiple race simulations to get a more stable score
    const numSimulations = 3;
    let totalScore = 0;
    
    for (let i = 0; i < numSimulations; i++) {
        totalScore += calculateRaceScore(stats, boosts);
    }
    
    // Return average score
    return Math.floor(totalScore / numSimulations);
}

function analyzeNFTScores() {
    console.log("=== NFT SCORE ANALYSIS (WITH MAX BOOSTS) ===\n");

    // Generate sample size of NFTs
    const sampleSize = 1000;
    const nfts = [];
    
    // Generate NFTs with max boosts (2)
    for (let i = 0; i < sampleSize; i++) {
        const stats = generateNFTStats();
        const score = calculateScore(stats, 2); // Always use 2 boosts
        nfts.push({ stats, score });
    }

    // Analyze by rarity
    const rarityStats = {
        0: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 },
        1: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 },
        2: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 },
        3: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 }
    };

    nfts.forEach(nft => {
        const rarity = nft.stats.rarity;
        rarityStats[rarity].count++;
        rarityStats[rarity].scores.push(nft.score);
        rarityStats[rarity].minScore = Math.min(rarityStats[rarity].minScore, nft.score);
        rarityStats[rarity].maxScore = Math.max(rarityStats[rarity].maxScore, nft.score);
    });

    // Calculate averages and display results
    const rarityNames = ["Common", "Uncommon", "Rare", "Legendary"];
    console.log("=== RARITY ANALYSIS (WITH 2 BOOSTS) ===");
    Object.entries(rarityStats).forEach(([rarity, stats]) => {
        if (stats.count > 0) {
            stats.avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.count;
            console.log(`\n${rarityNames[rarity]} (${stats.count} NFTs):`);
            console.log(`Average Score: ${stats.avgScore.toFixed(2)}`);
            console.log(`Score Range: ${stats.minScore} - ${stats.maxScore}`);
        }
    });

    // Analyze score distribution within each rarity
    console.log("\n=== SCORE DISTRIBUTION BY RARITY (WITH 2 BOOSTS) ===");
    Object.entries(rarityStats).forEach(([rarity, stats]) => {
        if (stats.count > 0) {
            console.log(`\n${rarityNames[rarity]}:`);
            const sortedScores = stats.scores.sort((a, b) => a - b);
            const quartile1 = sortedScores[Math.floor(stats.count * 0.25)];
            const median = sortedScores[Math.floor(stats.count * 0.5)];
            const quartile3 = sortedScores[Math.floor(stats.count * 0.75)];
            
            console.log(`25th percentile: ${quartile1}`);
            console.log(`Median (50th): ${median}`);
            console.log(`75th percentile: ${quartile3}`);
        }
    });

    // Analyze potential overlaps between rarities
    console.log("\n=== RARITY OVERLAP ANALYSIS (WITH 2 BOOSTS) ===");
    for (let i = 0; i < 3; i++) {
        const currentRarity = rarityStats[i];
        const nextRarity = rarityStats[i + 1];
        if (currentRarity.count > 0 && nextRarity.count > 0) {
            const overlap = currentRarity.maxScore >= nextRarity.minScore;
            console.log(`\n${rarityNames[i]} vs ${rarityNames[i + 1]}:`);
            console.log(`Overlap exists: ${overlap}`);
            if (overlap) {
                console.log(`Overlap range: ${nextRarity.minScore} - ${currentRarity.maxScore}`);
            }
        }
    }

    // Find potential tie scenarios
    console.log("\n=== POTENTIAL TIE SCENARIOS (WITH 2 BOOSTS) ===");
    const scoreMap = new Map();
    nfts.forEach(nft => {
        const score = nft.score;
        if (!scoreMap.has(score)) {
            scoreMap.set(score, []);
        }
        scoreMap.get(score).push({
            rarity: rarityNames[nft.stats.rarity],
            stats: nft.stats
        });
    });

    // Display ties
    let tieCount = 0;
    scoreMap.forEach((nfts, score) => {
        if (nfts.length > 1) {
            tieCount++;
            if (tieCount <= 5) { // Show only first 5 tie scenarios
                console.log(`\nScore ${score} achieved by:`);
                nfts.forEach(nft => {
                    console.log(`- ${nft.rarity}: Speed=${nft.stats.speed}, Stamina=${nft.stats.stamina}, Luck=${nft.stats.luck}`);
                });
            }
        }
    });
    console.log(`\nTotal number of tie scenarios found: ${tieCount}`);
}

// Run the analysis
analyzeNFTScores(); 