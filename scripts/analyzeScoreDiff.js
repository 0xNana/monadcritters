// Score calculation analysis script
function calculateScore(speed, stamina, luck, boosts) {
    // Normalize stats (assuming max 100)
    const normalizedSpeed = Math.min(100, Math.max(0, speed));
    const normalizedStamina = Math.min(100, Math.max(0, stamina));
    const normalizedLuck = Math.min(100, Math.max(0, luck));
    
    // Base score calculation with weighted components
    // Speed is primary (50%), Stamina secondary (30%), Luck tertiary (20%)
    const baseScore = (
        (normalizedSpeed * 50) +
        (normalizedStamina * 30) +
        (normalizedLuck * 20)
    ) / 100;
    
    // Boost provides 50% increase per boost
    const boostMultiplier = 100 + (boosts * 50);
    
    // Apply boost as a percentage increase
    return Math.floor((baseScore * boostMultiplier) / 100);
}

function displayScoreComparison(title, stats1, stats2) {
    const { speed: s1, stamina: st1, luck: l1, boosts: b1 } = stats1;
    const { speed: s2, stamina: st2, luck: l2, boosts: b2 } = stats2;
    
    const score1 = calculateScore(s1, st1, l1, b1);
    const score2 = calculateScore(s2, st2, l2, b2);
    
    console.log(`\n=== ${title} ===`);
    console.log(`Build 1 (${s1}/${st1}/${l1}, Boosts: ${b1})`);
    console.log(`Score: ${score1}`);
    console.log(`\nBuild 2 (${s2}/${st2}/${l2}, Boosts: ${b2})`);
    console.log(`Score: ${score2}`);
    console.log(`\nDifference: ${score1 - score2}`);
    console.log(`Percentage Difference: ${((score1 - score2) / score2 * 100).toFixed(2)}%`);
}

function analyzeBoostImpact(baseSpeed, baseStamina, baseLuck) {
    console.log(`\n=== BOOST IMPACT ANALYSIS (${baseSpeed}/${baseStamina}/${baseLuck}) ===`);
    const baseScore = calculateScore(baseSpeed, baseStamina, baseLuck, 0);
    const oneBoostScore = calculateScore(baseSpeed, baseStamina, baseLuck, 1);
    const twoBoostScore = calculateScore(baseSpeed, baseStamina, baseLuck, 2);
    
    console.log(`Base Score (No Boost): ${baseScore}`);
    console.log(`One Boost: ${oneBoostScore} (+${oneBoostScore - baseScore}, +${((oneBoostScore - baseScore) / baseScore * 100).toFixed(2)}%)`);
    console.log(`Two Boosts: ${twoBoostScore} (+${twoBoostScore - baseScore}, +${((twoBoostScore - baseScore) / baseScore * 100).toFixed(2)}%)`);
}

function analyzeStatWeights() {
    console.log("\n=== STAT WEIGHT ANALYSIS ===");
    const speedHeavy = calculateScore(90, 50, 50, 0);
    const staminaHeavy = calculateScore(50, 90, 50, 0);
    const luckHeavy = calculateScore(50, 50, 90, 0);
    const balanced = calculateScore(70, 70, 70, 0);
    
    console.log("Base Scores (No Boosts):");
    console.log(`Speed Heavy (90/50/50): ${speedHeavy}`);
    console.log(`Stamina Heavy (50/90/50): ${staminaHeavy}`);
    console.log(`Luck Heavy (50/50/90): ${luckHeavy}`);
    console.log(`Balanced (70/70/70): ${balanced}`);
    
    const maxScore = Math.max(speedHeavy, staminaHeavy, luckHeavy, balanced);
    console.log(`\nBest Build Score: ${maxScore}`);
}

// Run analysis
console.log("=== CRITTER RACE SCORE ANALYSIS ===\n");

// Compare speed-focused vs balanced builds
displayScoreComparison("SPEED VS BALANCED",
    { speed: 90, stamina: 70, luck: 50, boosts: 1 },
    { speed: 70, stamina: 70, luck: 70, boosts: 0 }
);

// Compare stamina-focused vs balanced builds
displayScoreComparison("STAMINA VS BALANCED",
    { speed: 60, stamina: 90, luck: 45, boosts: 1 },
    { speed: 70, stamina: 70, luck: 70, boosts: 0 }
);

// Compare luck-focused vs balanced builds
displayScoreComparison("LUCK VS BALANCED",
    { speed: 50, stamina: 55, luck: 90, boosts: 0 },
    { speed: 70, stamina: 70, luck: 70, boosts: 0 }
);

// Analyze boost impact on different base stats
analyzeBoostImpact(75, 75, 75); // Balanced build
analyzeBoostImpact(90, 50, 50); // Speed-focused build
analyzeBoostImpact(50, 90, 50); // Stamina-focused build

// Analyze stat weights
analyzeStatWeights();

// Compare max stats builds
displayScoreComparison("MAX STATS COMPARISON",
    { speed: 100, stamina: 100, luck: 100, boosts: 2 },
    { speed: 100, stamina: 100, luck: 100, boosts: 0 }
);

// Compare min vs max builds
displayScoreComparison("MIN VS MAX BUILD",
    { speed: 100, stamina: 100, luck: 100, boosts: 2 },
    { speed: 50, stamina: 50, luck: 50, boosts: 0 }
); 