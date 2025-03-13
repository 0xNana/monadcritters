const { ethers } = require("hardhat");

async function main() {
    // Deploy contracts
    const MonadCritter = await ethers.getContractFactory("MonadCritter");
    const monadCritter = await MonadCritter.deploy();
    await monadCritter.deployed();

    const CritterRace = await ethers.getContractFactory("CritterRace");
    const critterRace = await CritterRace.deploy(monadCritter.address);
    await critterRace.deployed();

    console.log("\n=== CRITTER RACE SCORE ANALYSIS ===\n");

    // Get race simulation results
    const results = await critterRace.simulateRaceScores();
    const [twoPlayerScores, fivePlayerScores, tenPlayerScores] = results;

    // Display Two Player Race Analysis
    console.log("=== TWO PLAYER RACE ANALYSIS ===");
    console.log("Player 1 (High Speed, Medium Stamina, Low Luck, 1 Boost)");
    console.log(`Score: ${twoPlayerScores[0].score}`);
    console.log("Stats: Speed=90, Stamina=70, Luck=50, Boosts=1");
    console.log(`Position: ${twoPlayerScores[0].position}\n`);

    console.log("Player 2 (Balanced Stats, No Boost)");
    console.log(`Score: ${twoPlayerScores[1].score}`);
    console.log("Stats: Speed=70, Stamina=70, Luck=70, Boosts=0");
    console.log(`Position: ${twoPlayerScores[1].position}`);
    console.log("\nScore Difference:", twoPlayerScores[0].score - twoPlayerScores[1].score);

    // Display Five Player Race Analysis
    console.log("\n=== FIVE PLAYER RACE ANALYSIS ===");
    const playerTypes = [
        "Speed Focused (95/60/40, 2 Boosts)",
        "Stamina Focused (60/90/45, 1 Boost)",
        "Luck Focused (50/55/90, No Boost)",
        "Balanced (75/75/75, 1 Boost)",
        "Low Stats (50/50/50, 2 Boosts)"
    ];

    fivePlayerScores.forEach((score, index) => {
        console.log(`\n${playerTypes[index]}`);
        console.log(`Score: ${score.score}`);
        console.log(`Position: ${score.position}`);
    });

    // Display Ten Player Race Analysis with Score Distribution
    console.log("\n=== TEN PLAYER RACE SCORE DISTRIBUTION ===");
    const scores = tenPlayerScores.map(p => Number(p.score));
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    console.log(`Highest Score: ${max}`);
    console.log(`Lowest Score: ${min}`);
    console.log(`Average Score: ${Math.floor(avg)}`);
    console.log(`Score Range: ${max - min}`);

    // Display Boost Impact Analysis
    console.log("\n=== BOOST IMPACT ANALYSIS ===");
    const noBoostScores = tenPlayerScores.filter(p => p.score === _simulateScore(75, 75, 75, 0));
    const oneBoostScores = tenPlayerScores.filter(p => p.score === _simulateScore(75, 75, 75, 1));
    const twoBoostScores = tenPlayerScores.filter(p => p.score === _simulateScore(75, 75, 75, 2));

    if (noBoostScores.length > 0 && oneBoostScores.length > 0 && twoBoostScores.length > 0) {
        const baseScore = noBoostScores[0].score;
        const oneBoostScore = oneBoostScores[0].score;
        const twoBoostScore = twoBoostScores[0].score;

        console.log("Using identical base stats (75/75/75):");
        console.log(`No Boost Score: ${baseScore}`);
        console.log(`One Boost Score: ${oneBoostScore} (+${oneBoostScore - baseScore})`);
        console.log(`Two Boost Score: ${twoBoostScore} (+${twoBoostScore - baseScore})`);
    }

    // Display Stat Weight Analysis
    console.log("\n=== STAT WEIGHT ANALYSIS ===");
    const speedHeavy = await _simulateScore(90, 50, 50, 0);
    const staminaHeavy = await _simulateScore(50, 90, 50, 0);
    const luckHeavy = await _simulateScore(50, 50, 90, 0);
    const balanced = await _simulateScore(70, 70, 70, 0);

    console.log("Base Scores (No Boosts):");
    console.log(`Speed Heavy (90/50/50): ${speedHeavy}`);
    console.log(`Stamina Heavy (50/90/50): ${staminaHeavy}`);
    console.log(`Luck Heavy (50/50/90): ${luckHeavy}`);
    console.log(`Balanced (70/70/70): ${balanced}`);
}

async function _simulateScore(speed, stamina, luck, boosts) {
    const CritterRace = await ethers.getContractFactory("CritterRace");
    const critterRace = await CritterRace.attach("DEPLOYED_ADDRESS"); // This won't be used in simulation
    
    // Create a stats object matching the contract's calculation
    const normalizedSpeed = speed;
    const normalizedStamina = stamina;
    const normalizedLuck = luck;
    
    // Base score calculation with weighted components
    // Speed is primary (50%), Stamina secondary (30%), Luck tertiary (20%)
    const baseScore = (
        (normalizedSpeed * 50) +
        (normalizedStamina * 30) +
        (normalizedLuck * 20)
    ) / 100;
    
    // Boost provides diminishing returns
    const boostMultiplier = 100 + (boosts * 50); // BOOST_MULTIPLIER / 2 = 50
    
    // Apply boost as a percentage increase
    return Math.floor((baseScore * boostMultiplier) / 100);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 