// Comparison of current and previous scoring formulas
function calculateCurrentScore(speed, stamina, luck, boosts) {
    // Current formula: Weighted average with boost multiplier
    const normalizedSpeed = Math.min(100, Math.max(0, speed));
    const normalizedStamina = Math.min(100, Math.max(0, stamina));
    const normalizedLuck = Math.min(100, Math.max(0, luck));
    
    const baseScore = (
        (normalizedSpeed * 50) +
        (normalizedStamina * 30) +
        (normalizedLuck * 20)
    ) / 100;
    
    const boostMultiplier = 100 + (boosts * 50);
    return Math.floor((baseScore * boostMultiplier) / 100);
}

function calculatePreviousScore(speed, stamina, luck, boosts) {
    // Previous formula: Direct multiplication with diminishing returns
    const normalizedSpeed = Math.min(100, Math.max(0, speed));
    const normalizedStamina = Math.min(100, Math.max(0, stamina));
    const normalizedLuck = Math.min(100, Math.max(0, luck));
    
    // Base score is product of stats with diminishing returns
    const baseScore = Math.floor(
        (normalizedSpeed * 0.5) +
        (normalizedStamina * 0.3) +
        (normalizedLuck * 0.2)
    );
    
    // Boost effect is additive rather than multiplicative
    const boostEffect = boosts * 25; // Each boost adds 25 points
    return baseScore + boostEffect;
}

function compareScores(title, stats) {
    const { speed, stamina, luck, boosts } = stats;
    const currentScore = calculateCurrentScore(speed, stamina, luck, boosts);
    const previousScore = calculatePreviousScore(speed, stamina, luck, boosts);
    
    console.log(`\n=== ${title} ===`);
    console.log(`Stats: Speed=${speed}, Stamina=${stamina}, Luck=${luck}, Boosts=${boosts}`);
    console.log(`Current Formula Score: ${currentScore}`);
    console.log(`Previous Formula Score: ${previousScore}`);
    console.log(`Difference: ${currentScore - previousScore}`);
}

function findTieScenarios() {
    console.log("\n=== ANALYZING TIE SCENARIOS FOR BOTH FORMULAS ===");
    
    // Test various builds to find ties in each formula
    const testBuilds = [
        { speed: 90, stamina: 50, luck: 50, boosts: 0 },
        { speed: 60, stamina: 60, luck: 60, boosts: 1 },
        { speed: 80, stamina: 60, luck: 70, boosts: 1 },
        { speed: 75, stamina: 70, luck: 65, boosts: 1 },
        { speed: 70, stamina: 70, luck: 70, boosts: 0 },
        { speed: 50, stamina: 90, luck: 50, boosts: 1 }
    ];
    
    console.log("\nCurrent Formula Ties:");
    const currentScores = new Map();
    testBuilds.forEach(build => {
        const score = calculateCurrentScore(build.speed, build.stamina, build.luck, build.boosts);
        if (!currentScores.has(score)) {
            currentScores.set(score, []);
        }
        currentScores.get(score).push(build);
    });
    
    currentScores.forEach((builds, score) => {
        if (builds.length > 1) {
            console.log(`\nScore ${score} achieved by:`);
            builds.forEach(build => {
                console.log(`- Speed=${build.speed}, Stamina=${build.stamina}, Luck=${build.luck}, Boosts=${build.boosts}`);
            });
        }
    });
    
    console.log("\nPrevious Formula Ties:");
    const previousScores = new Map();
    testBuilds.forEach(build => {
        const score = calculatePreviousScore(build.speed, build.stamina, build.luck, build.boosts);
        if (!previousScores.has(score)) {
            previousScores.set(score, []);
        }
        previousScores.get(score).push(build);
    });
    
    previousScores.forEach((builds, score) => {
        if (builds.length > 1) {
            console.log(`\nScore ${score} achieved by:`);
            builds.forEach(build => {
                console.log(`- Speed=${build.speed}, Stamina=${build.stamina}, Luck=${build.luck}, Boosts=${build.boosts}`);
            });
        }
    });
}

// Run comparisons
console.log("=== COMPARING SCORING FORMULAS ===");

// Test Case 1: Balanced Build
compareScores("Balanced Build", {
    speed: 70,
    stamina: 70,
    luck: 70,
    boosts: 0
});

// Test Case 2: Speed Focus
compareScores("Speed Focus Build", {
    speed: 90,
    stamina: 50,
    luck: 50,
    boosts: 1
});

// Test Case 3: Stamina Focus
compareScores("Stamina Focus Build", {
    speed: 50,
    stamina: 90,
    luck: 50,
    boosts: 1
});

// Test Case 4: Luck Focus
compareScores("Luck Focus Build", {
    speed: 50,
    stamina: 50,
    luck: 90,
    boosts: 1
});

// Test Case 5: Max Stats
compareScores("Max Stats Build", {
    speed: 100,
    stamina: 100,
    luck: 100,
    boosts: 2
});

// Test Case 6: Min Stats
compareScores("Min Stats Build", {
    speed: 50,
    stamina: 50,
    luck: 50,
    boosts: 0
});

// Analyze tie scenarios
findTieScenarios(); 