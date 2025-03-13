// Score calculation and tie analysis script
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

function findTieScenarios() {
    console.log("=== ANALYZING POTENTIAL TIE SCENARIOS ===\n");
    
    // Test Case 1: Different stats, same score through boosts
    const build1 = { speed: 90, stamina: 50, luck: 50, boosts: 0 };
    const build2 = { speed: 60, stamina: 60, luck: 60, boosts: 1 };
    
    const score1 = calculateScore(build1.speed, build1.stamina, build1.luck, build1.boosts);
    const score2 = calculateScore(build2.speed, build2.stamina, build2.luck, build2.boosts);
    
    console.log("Test Case 1: Different stats, boost compensation");
    console.log(`Build 1 (${build1.speed}/${build1.stamina}/${build1.luck}, Boosts: ${build1.boosts})`);
    console.log(`Score: ${score1}`);
    console.log(`\nBuild 2 (${build2.speed}/${build2.stamina}/${build2.luck}, Boosts: ${build2.boosts})`);
    console.log(`Score: ${score2}`);
    console.log(`Result: ${score1 === score2 ? "TIE!" : "No tie"}\n`);

    // Test Case 2: Different stat distributions with same weighted sum
    const build3 = { speed: 80, stamina: 60, luck: 70, boosts: 1 };
    const build4 = { speed: 75, stamina: 70, luck: 65, boosts: 1 };
    
    const score3 = calculateScore(build3.speed, build3.stamina, build3.luck, build3.boosts);
    const score4 = calculateScore(build4.speed, build4.stamina, build4.luck, build4.boosts);
    
    console.log("Test Case 2: Different stat distributions with same weighted total");
    console.log(`Build 3 (${build3.speed}/${build3.stamina}/${build3.luck}, Boosts: ${build3.boosts})`);
    console.log(`Score: ${score3}`);
    console.log(`\nBuild 4 (${build4.speed}/${build4.stamina}/${build4.luck}, Boosts: ${build4.boosts})`);
    console.log(`Score: ${score4}`);
    console.log(`Result: ${score3 === score4 ? "TIE!" : "No tie"}\n`);

    // Test Case 3: Finding equivalent builds
    console.log("=== FINDING EQUIVALENT BUILDS ===");
    const targetScore = 100;
    const equivalentBuilds = [];

    // Search for builds that give the same score
    for (let speed = 50; speed <= 100; speed += 10) {
        for (let stamina = 50; stamina <= 100; stamina += 10) {
            for (let luck = 50; luck <= 100; luck += 10) {
                for (let boosts = 0; boosts <= 2; boosts++) {
                    const score = calculateScore(speed, stamina, luck, boosts);
                    if (score === targetScore) {
                        equivalentBuilds.push({ speed, stamina, luck, boosts, score });
                    }
                }
            }
        }
    }

    if (equivalentBuilds.length > 0) {
        console.log(`\nFound ${equivalentBuilds.length} builds that score ${targetScore}:`);
        equivalentBuilds.forEach((build, index) => {
            console.log(`\nBuild ${index + 1}:`);
            console.log(`Stats: ${build.speed}/${build.stamina}/${build.luck}, Boosts: ${build.boosts}`);
            console.log(`Score: ${build.score}`);
        });
    }

    // Test Case 4: Analyzing rounding effects
    console.log("\n=== ANALYZING ROUNDING EFFECTS ===");
    const build5 = { speed: 73, stamina: 68, luck: 65, boosts: 1 };
    const build6 = { speed: 72, stamina: 69, luck: 66, boosts: 1 };
    
    const score5 = calculateScore(build5.speed, build5.stamina, build5.luck, build5.boosts);
    const score6 = calculateScore(build6.speed, build6.stamina, build6.luck, build6.boosts);
    
    console.log("Test Case 4: Similar stats with rounding");
    console.log(`Build 5 (${build5.speed}/${build5.stamina}/${build5.luck}, Boosts: ${build5.boosts})`);
    console.log(`Score: ${score5}`);
    console.log(`\nBuild 6 (${build6.speed}/${build6.stamina}/${build6.luck}, Boosts: ${build6.boosts})`);
    console.log(`Score: ${score6}`);
    console.log(`Result: ${score5 === score6 ? "TIE!" : "No tie"}`);
}

// Run the analysis
findTieScenarios(); 