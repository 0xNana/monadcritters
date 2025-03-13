const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Updating race fees with account:", deployer.address);

  const CritterRace = await ethers.getContractFactory("CritterRace");
  const raceContract = await CritterRace.attach("YOUR_CONTRACT_ADDRESS");

  // Convert 0.1 MON to Wei
  const entryFee = ethers.utils.parseEther("0.1");

  // Update TWO player race
  await raceContract.setRaceType(
    0, // RaceSize.TWO
    2, // maxPlayers
    1, // numWinners
    entryFee,
    [100], // rewardPercentages - 100% to winner
    true // isActive
  );
  console.log("Updated 2/2 race type");

  // Update FIVE player race
  await raceContract.setRaceType(
    1, // RaceSize.FIVE
    5, // maxPlayers
    2, // numWinners
    entryFee,
    [70, 30], // rewardPercentages - 70% to 1st, 30% to 2nd
    true // isActive
  );
  console.log("Updated 5/5 race type");

  // Update TEN player race
  await raceContract.setRaceType(
    2, // RaceSize.TEN
    10, // maxPlayers
    3, // numWinners
    entryFee,
    [50, 30, 20], // rewardPercentages - 50% to 1st, 30% to 2nd, 20% to 3rd
    true // isActive
  );
  console.log("Updated 10/10 race type");

  console.log("All race types updated to 0.1 MON entry fee");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 