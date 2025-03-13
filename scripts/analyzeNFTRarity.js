const { ethers } = require("hardhat");

// Reuse the NFT stats generation from our race analysis
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

function calculateRarityScore(stats) {
    // Base weights for each component
    const weights = {
        rarity: 0.4,    // 40% of total score
        stats: 0.6      // 60% of total score (20% each stat)
    };

    // Rarity base scores (exponential scaling)
    const rarityBaseScores = [100, 250, 500, 1000]; // Common, Uncommon, Rare, Legendary
    
    // Calculate rarity component
    const rarityScore = rarityBaseScores[stats.rarity];
    
    // Calculate stats component
    // Normalize each stat to 0-1 range (based on max possible of 255)
    const normalizedSpeed = stats.speed / 255;
    const normalizedStamina = stats.stamina / 255;
    const normalizedLuck = stats.luck / 255;
    
    // Calculate average stat score (0-100)
    const statsScore = ((normalizedSpeed + normalizedStamina + normalizedLuck) / 3) * 100;
    
    // Combine scores using weights
    const totalScore = (rarityScore * weights.rarity) + (statsScore * weights.stats);
    
    // Return rounded score
    return Math.round(totalScore * 100) / 100;
}

function analyzeNFTRarity() {
    console.log("=== NFT RARITY ANALYSIS ===\n");

    // Generate sample size of NFTs
    const sampleSize = 1000;
    const nfts = [];
    
    // Generate NFTs and calculate rarity scores
    for (let i = 0; i < sampleSize; i++) {
        const stats = generateNFTStats();
        const rarityScore = calculateRarityScore(stats);
        nfts.push({ stats, rarityScore });
    }

    // Analyze by rarity level
    const rarityStats = {
        0: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 },
        1: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 },
        2: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 },
        3: { count: 0, scores: [], avgScore: 0, minScore: Infinity, maxScore: 0 }
    };

    // Collect stats
    nfts.forEach(nft => {
        const rarity = nft.stats.rarity;
        rarityStats[rarity].count++;
        rarityStats[rarity].scores.push(nft.rarityScore);
        rarityStats[rarity].minScore = Math.min(rarityStats[rarity].minScore, nft.rarityScore);
        rarityStats[rarity].maxScore = Math.max(rarityStats[rarity].maxScore, nft.rarityScore);
    });

    // Calculate and display results
    const rarityNames = ["Common", "Uncommon", "Rare", "Legendary"];
    console.log("=== RARITY SCORE ANALYSIS ===");
    Object.entries(rarityStats).forEach(([rarity, stats]) => {
        if (stats.count > 0) {
            stats.avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.count;
            console.log(`\n${rarityNames[rarity]} (${stats.count} NFTs):`);
            console.log(`Average Score: ${stats.avgScore.toFixed(2)}`);
            console.log(`Score Range: ${stats.minScore.toFixed(2)} - ${stats.maxScore.toFixed(2)}`);
            
            // Calculate percentiles
            const sortedScores = stats.scores.sort((a, b) => a - b);
            const percentiles = {
                p25: sortedScores[Math.floor(stats.count * 0.25)],
                p50: sortedScores[Math.floor(stats.count * 0.5)],
                p75: sortedScores[Math.floor(stats.count * 0.75)],
                p90: sortedScores[Math.floor(stats.count * 0.9)],
                p99: sortedScores[Math.floor(stats.count * 0.99)]
            };
            
            console.log("\nPercentiles:");
            console.log(`25th: ${percentiles.p25.toFixed(2)}`);
            console.log(`50th (Median): ${percentiles.p50.toFixed(2)}`);
            console.log(`75th: ${percentiles.p75.toFixed(2)}`);
            console.log(`90th: ${percentiles.p90.toFixed(2)}`);
            console.log(`99th: ${percentiles.p99.toFixed(2)}`);
        }
    });

    // Find top 10 rarest NFTs
    console.log("\n=== TOP 10 RAREST NFTs ===");
    const sortedNFTs = [...nfts].sort((a, b) => b.rarityScore - a.rarityScore);
    sortedNFTs.slice(0, 10).forEach((nft, index) => {
        console.log(`\n#${index + 1} - Score: ${nft.rarityScore.toFixed(2)}`);
        console.log(`Rarity: ${rarityNames[nft.stats.rarity]}`);
        console.log(`Speed: ${nft.stats.speed}`);
        console.log(`Stamina: ${nft.stats.stamina}`);
        console.log(`Luck: ${nft.stats.luck}`);
    });

    // Calculate rarity tiers
    console.log("\n=== RARITY TIER DISTRIBUTION ===");
    const allScores = nfts.map(nft => nft.rarityScore).sort((a, b) => a - b);
    const tiers = {
        mythic: allScores[Math.floor(sampleSize * 0.99)],
        legendary: allScores[Math.floor(sampleSize * 0.95)],
        epic: allScores[Math.floor(sampleSize * 0.90)],
        rare: allScores[Math.floor(sampleSize * 0.75)],
        uncommon: allScores[Math.floor(sampleSize * 0.50)],
    };

    console.log("Rarity Tier Thresholds:");
    console.log(`Mythic (Top 1%): ${tiers.mythic.toFixed(2)}+`);
    console.log(`Legendary (Top 5%): ${tiers.legendary.toFixed(2)}+`);
    console.log(`Epic (Top 10%): ${tiers.epic.toFixed(2)}+`);
    console.log(`Rare (Top 25%): ${tiers.rare.toFixed(2)}+`);
    console.log(`Uncommon (Top 50%): ${tiers.uncommon.toFixed(2)}+`);
    console.log(`Common (Bottom 50%): Below ${tiers.uncommon.toFixed(2)}`);
}

// Run the analysis
analyzeNFTRarity(); 