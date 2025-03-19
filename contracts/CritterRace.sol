// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MonadCritter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract CritterRace is Ownable, Pausable {
    MonadCritter public immutable critterContract; // Make immutable to save gas
    
    enum RaceSize { 
        None,  // 0
        Two,   // 1
        Five,  // 2
        Ten    // 3
    }
    
    // Packed struct to save gas (multiple values in same storage slot)
    struct RaceType {
        uint256 maxPlayers;
        uint256 numWinners;
        uint256 entryFee;
        bool isActive;
        uint256[] rewardPercentages;
    }
    
    mapping(RaceSize => RaceType) public raceTypes;
    
    // Constants using smaller uint types where possible
    uint256 public constant POWER_UP_PERCENT = 10; // Power-ups cost 10% of entry fee
    uint256 public devFeePercent = 0;

    // Packed struct for race data
    struct Race {
        uint256 id;              // Reduced from uint256 (supports up to 4 billion races)
        RaceSize raceSize;      // enum takes 1 byte
        uint256 playerCount;      // Track count separately to save gas on array length checks
        bool isActive;
        bool hasEnded;
        uint256 prizePool;       // Reduced from uint256 (still supports large amounts)
        uint256 startTime;       // Reduced from uint256 (supports dates until year 2106)
        address[] players;
        uint256[] critterIds;
        mapping(address => PowerUps) powerUps;
        RaceResult[] calculatedResults;  // Store pre-calculated results
    }

    // Packed struct for power-ups
    struct PowerUps {
        uint256 speedBoosts;     // Reduced from uint256 (max 255 boosts is plenty)
    }

    struct RaceResult {
        address player;
        uint256 critterId;      // Reduced from uint256
        uint256 finalPosition;    // Reduced from uint256
        uint256 reward;         // Reduced from uint256
        uint256 score;          // Reduced from uint256
    }

    mapping(uint256 => Race) public races;
    mapping(address => uint256) public playerInventory_SpeedBoost; // Reduced from uint256
    mapping(uint256 => mapping(address => bool)) public isParticipating;
    mapping(RaceSize => uint256[]) private activeRacesByType; // Track active races for each type
    
    uint256 public currentRaceId; // Reduced from uint256

    // Constants
    uint256 public constant BOOST_MULTIPLIER = 100;  // Reduced from uint256
    uint256 public constant MAX_BOOSTS_PER_RACE = 2;

    // Track revenue from power-up purchases
    uint256 public powerUpRevenue; // Reduced from uint256

    // Events with optimized parameter types
    event RaceCreated(uint256 indexed raceId);
    event PlayerJoined(uint256 indexed raceId, address indexed player, uint256 indexed critterId);
    event PowerUpLoaded(uint256 indexed raceId, address indexed player, bool isSpeedBoost, uint256 amount);
    event RaceStarted(uint256 indexed raceId, uint256 startTime);
    event PowerUpsPurchased(address indexed player, uint256 speedBoosts);
    event RaceTypeUpdated(RaceSize indexed raceSize, uint256 maxPlayers, uint256 numWinners, uint256 entryFee);
    event PowerUpRevenueWithdrawn(address indexed owner, uint256 amount);
    event RaceEnded(uint256 indexed raceId, RaceResult[] results);
    event AccidentalTokensWithdrawn(address indexed owner, uint256 amount);
    event DevFeeUpdated(uint256 oldFee, uint256 newFee);

    // Structs for stats and info
    struct CritterStats {
        uint8 speed;
        uint8 stamina;
        uint8 luck;
    }

    struct RaceScore {
        address player;
        uint256 critterId;
        uint256 score;
        uint256 position;
    }

    struct RaceTypeInfo {
        uint256 maxPlayers;
        uint256 numWinners;
        uint256 entryFee;
        uint256[] rewardPercentages;
        bool isActive;
    }

    struct RaceInfo {
        uint256 id;
        RaceSize raceSize;
        address[] players;
        uint256[] critterIds;
        uint256 startTime;
        bool isActive;
        bool hasEnded;
        uint256 prizePool;
    }

    // Add new mapping to track user race history
    mapping(address => uint256[]) private userRaceHistory;

    // Add PlayerStats struct after RaceResult struct
    struct PlayerStats {
        uint256 totalScore;
        uint256 racesParticipated;
        uint256 wins;        // First place finishes
        uint256 totalRewards;
        uint256 bestScore;
    }

    // Add mapping after other mappings
    mapping(address => PlayerStats) public playerStats;

    // Add RaceEndInfo struct after other structs
    struct RaceEndInfo {
        uint256 endTime;
        bool resultsCalculated;
        RaceResult[] results;
    }

    // Add mapping after other mappings
    mapping(uint256 => RaceEndInfo) public raceEndInfo;

    // Add score cache mapping
    mapping(uint256 => uint256) public baseScoreCache;  // critterId => baseScore
    
    // Add LeaderboardEntry struct
    struct LeaderboardEntry {
        address player;
        uint256 position;
        uint256 score;
        uint256 reward;
    }

    constructor(address _critterContract) {
        critterContract = MonadCritter(_critterContract);
        _transferOwnership(msg.sender);
        
        // Initialize race types more efficiently
        _initializeRaceTypes();
    }

    // Separate function to keep constructor gas cost lower
    function _initializeRaceTypes() private {
        // Two player race
        uint256[] memory twoPlayerRewards = new uint256[](1);
        twoPlayerRewards[0] = 100;
        raceTypes[RaceSize.Two] = RaceType({
            maxPlayers: 2,
            numWinners: 1,
            entryFee: 0.1 ether,
            rewardPercentages: twoPlayerRewards,
            isActive: true
        });
        
        // Five player race
        uint256[] memory fivePlayerRewards = new uint256[](2);
        fivePlayerRewards[0] = 70;
        fivePlayerRewards[1] = 30;
        raceTypes[RaceSize.Five] = RaceType({
            maxPlayers: 5,
            numWinners: 2,
            entryFee: 0.1 ether,
            rewardPercentages: fivePlayerRewards,
            isActive: true
        });
        
        // Ten player race
        uint256[] memory tenPlayerRewards = new uint256[](3);
        tenPlayerRewards[0] = 50;
        tenPlayerRewards[1] = 30;
        tenPlayerRewards[2] = 20;
        raceTypes[RaceSize.Ten] = RaceType({
            maxPlayers: 10,
            numWinners: 3,
            entryFee: 0.1 ether,
            rewardPercentages: tenPlayerRewards,
            isActive: true
        });
    }

    // Gas-optimized power-up purchase function
    function buyPowerUps(uint256 speedBoosts) external payable whenNotPaused {
        require(speedBoosts > 0, "Must buy at least 1 boost");
        
        // Calculate price based on 2 player race entry fee
        uint256 pricePerBoost;
        unchecked {
            pricePerBoost = (raceTypes[RaceSize.Two].entryFee * POWER_UP_PERCENT) / 100;
        }
        uint256 totalPrice = pricePerBoost * speedBoosts;
        require(msg.value == totalPrice, "Incorrect payment amount");
        
        unchecked {
            playerInventory_SpeedBoost[msg.sender] += speedBoosts;
            powerUpRevenue += msg.value;
        }
        
        emit PowerUpsPurchased(msg.sender, speedBoosts);
    }

    // Gas-optimized join race function
    function joinRace(
        uint256 raceId,
        uint256 raceTypeIndex,
        uint256 critterId,
        uint256 boost
    ) external payable whenNotPaused {
        Race storage race = races[raceId];
        require(race.id > 0, "Race does not exist");
        require(race.isActive && !race.hasEnded, "Race not available");
        
        RaceType storage raceConfig = raceTypes[RaceSize(raceTypeIndex)];
        require(race.playerCount < raceConfig.maxPlayers, "Race full");
        require(msg.value == raceConfig.entryFee, "Incorrect entry fee");
        require(boost <= MAX_BOOSTS_PER_RACE, "Max 2 boosts per race");
        require(playerInventory_SpeedBoost[msg.sender] >= boost, "Not enough boosts");
        require(!isParticipating[raceId][msg.sender], "Already in race");
        
        // Update state
        isParticipating[raceId][msg.sender] = true;
        race.players.push(msg.sender);
        race.critterIds.push(critterId);
        race.playerCount++;
        race.prizePool += msg.value;
        
        // Handle boosts if any
            if (boost > 0) {
                playerInventory_SpeedBoost[msg.sender] -= boost;
                race.powerUps[msg.sender].speedBoosts = boost;
                emit PowerUpLoaded(raceId, msg.sender, true, boost);
        }
        
        emit PlayerJoined(raceId, msg.sender, critterId);
    }

    // Internal function to start race
    function _startRace(uint256 raceId) private {
        Race storage race = races[raceId];
        race.startTime = block.timestamp;
        emit RaceStarted(raceId, race.startTime);
    }

    function setRaceType(
        RaceSize raceSize,
        uint256 maxPlayers,
        uint256 numWinners,
        uint256 entryFee,
        uint256[] calldata rewardPercentages,
        bool isActive
    ) external onlyOwner {
        require(maxPlayers > 1, "Min 2 players required");
        require(maxPlayers <= 20, "Max 20 players allowed");
        require(numWinners > 0 && numWinners <= maxPlayers, "Invalid number of winners");
        require(rewardPercentages.length == numWinners, "Reward percentages must match number of winners");
        
        uint256 total;
        for (uint256 i = 0; i < rewardPercentages.length; i++) {
            total += rewardPercentages[i];
        }
        require(total == 100, "Percentages must total 100");
        
        raceTypes[raceSize] = RaceType({
            maxPlayers: maxPlayers,
            numWinners: numWinners,
            entryFee: entryFee,
            rewardPercentages: rewardPercentages,
            isActive: isActive
        });
        
        emit RaceTypeUpdated(raceSize, maxPlayers, numWinners, entryFee);
    }

    function createRace(RaceSize raceSize) external whenNotPaused returns (uint256) {
        // Convert enum to player count
        uint256 playerCount;
        if (raceSize == RaceSize.Two) {
            playerCount = 2;
        } else if (raceSize == RaceSize.Five) {
            playerCount = 5;
        } else if (raceSize == RaceSize.Ten) {
            playerCount = 10;
        } else {
            revert("Invalid race size");
        }
        
        RaceType storage raceType = raceTypes[raceSize];
        require(raceType.isActive, "Race type not active");
        
        currentRaceId++;
        Race storage race = races[currentRaceId];
        race.id = currentRaceId;
        race.raceSize = raceSize;
        race.isActive = true;
        race.players = new address[](0);
        race.critterIds = new uint256[](0);
        
        activeRacesByType[raceSize].push(currentRaceId);
        
        emit RaceCreated(currentRaceId);
        return currentRaceId;
    }

    function cancelRace(uint256 raceId) external onlyOwner whenNotPaused {
        Race storage race = races[raceId];
        require(race.id > 0, "Race does not exist");
        require(race.isActive && !race.hasEnded, "Race not available for cancellation");
        
        race.isActive = false;
        race.hasEnded = true;
        
        // Refund entry fees to all players
        for (uint256 i = 0; i < race.players.length; i++) {
            address player = race.players[i];
            
            // Refund power-ups to player inventory
            PowerUps memory playerPowerUps = race.powerUps[player];
            if (playerPowerUps.speedBoosts > 0) {
                playerInventory_SpeedBoost[player] += playerPowerUps.speedBoosts;
            }
        }
        
        // Calculate individual refund amount
        uint256 refundAmount = race.prizePool / race.players.length;
        
        // Refund entry fees
        for (uint256 i = 0; i < race.players.length; i++) {
            payable(race.players[i]).transfer(refundAmount);
        }
        
        emit RaceEnded(raceId, new RaceResult[](0));
    }

    function startRaceExternal(uint256 raceId) external whenNotPaused {
        Race storage race = races[raceId];
        require(race.id > 0, "Race does not exist");
        require(race.isActive && !race.hasEnded, "Race not available for starting");
        require(isParticipating[raceId][msg.sender], "Only race participants can start");
        
        // STRICT: Race must be completely full to start
        RaceType storage raceType = raceTypes[race.raceSize];
        require(race.playerCount == raceType.maxPlayers, "Race must be full to start");
        
        // Calculate all results immediately when race starts
        _calculateRaceResults(raceId);
        
        // Start the race timer
        race.startTime = block.timestamp;
        emit RaceStarted(raceId, race.startTime);
    }

    function withdrawPowerUpRevenue() external onlyOwner {
        uint256 amount = powerUpRevenue;
        require(amount > 0, "No revenue to withdraw");
        
        powerUpRevenue = 0;
        payable(owner()).transfer(amount);
        
        emit PowerUpRevenueWithdrawn(owner(), amount);
    }

    function withdrawAccidentalTokens() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > powerUpRevenue, "No accidental tokens to withdraw");
        
        uint256 amount = balance - powerUpRevenue;
        payable(owner()).transfer(amount);
        
        emit AccidentalTokensWithdrawn(owner(), amount);
    }

    function setDevFeePercent(uint256 _devFeePercent) external onlyOwner {
        require(_devFeePercent <= 20, "Max dev fee is 20%");
        uint256 oldFee = devFeePercent;
        devFeePercent = _devFeePercent;
        emit DevFeeUpdated(oldFee, _devFeePercent);
    }

    function getCritterStats(uint256 critterId) internal view returns (CritterStats memory) {
        // Get stats from MonadCritter contract
        MonadCritter.Stats memory stats = critterContract.getStats(critterId);
        return CritterStats({
            speed: stats.speed,
            stamina: stats.stamina,
            luck: stats.luck
        });
    }

    function calculateCritterScore(
        CritterStats memory stats,
        PowerUps memory powerUps
    ) internal pure returns (uint256) {
        // Base score = Speed * Stamina * (Luck / 100)
        uint256 baseScore = (stats.speed * stats.stamina * stats.luck) / 100;
        
        // Add boost effect (each boost adds BOOST_MULTIPLIER to score)
        uint256 boostScore = powerUps.speedBoosts * BOOST_MULTIPLIER;
        
        return baseScore + boostScore;
    }

    function endRace(uint256 raceId) external whenNotPaused {
        Race storage race = races[raceId];
        require(race.startTime > 0, "Race hasn't started");
        require(!race.hasEnded, "Race already ended");
        require(isParticipating[raceId][msg.sender], "Only race participants can end");
        
        // Ensure we have results to work with
        require(race.calculatedResults.length > 0, "No calculated results found");
        
        // First, sync the results to raceEndInfo
        RaceEndInfo storage endInfo = raceEndInfo[raceId];
        endInfo.endTime = block.timestamp;
        endInfo.resultsCalculated = true;
        
        // Copy all results to raceEndInfo
        uint256 resultCount = race.calculatedResults.length;
        for (uint256 i = 0; i < resultCount; i++) {
            RaceResult memory result = race.calculatedResults[i];
            endInfo.results.push(result);
        }
        
        // Mark race as ended and distribute rewards
        race.hasEnded = true;
        race.isActive = false;  // Set isActive to false when race ends
        _distributeStoredRewards(raceId);
        
        // Update the rewards in raceEndInfo after distribution
        for (uint256 i = 0; i < resultCount; i++) {
            endInfo.results[i].reward = race.calculatedResults[i].reward;
        }
        
        emit RaceEnded(raceId, endInfo.results);
    }

    function _calculateRaceResults(uint256 raceId) internal {
        Race storage race = races[raceId];
        require(race.calculatedResults.length == 0, "Results already calculated");

        uint256 numPlayers = race.players.length;
        RaceScore[] memory scores = new RaceScore[](numPlayers);

        // Calculate scores for each player
        for (uint256 i = 0; i < numPlayers; i++) {
            address player = race.players[i];
            uint256 critterId = race.critterIds[i];
            
            MonadCritter.Stats memory stats = critterContract.getStats(critterId);
            uint256 finalScore = _calculateRaceScore(
                stats,
                race.powerUps[player].speedBoosts
            );

            scores[i] = RaceScore({
                player: player,
                critterId: critterId,
                score: finalScore,
                position: 0
            });
        }

        // Sort and assign positions
        _sortAndAssignPositions(scores);
        
        // Store results
        for (uint256 i = 0; i < scores.length; i++) {
            race.calculatedResults.push(RaceResult({
                player: scores[i].player,
                critterId: scores[i].critterId,
                finalPosition: scores[i].position,
                reward: 0, // Will be set during distribution
                score: scores[i].score
            }));
        }
    }

    function _calculateRaceScore(
        MonadCritter.Stats memory stats,
        uint256 speedBoosts
    ) internal pure returns (uint256) {
        // Get rarity multiplier (1.0, 1.1, 1.25, 1.5)
        uint256[4] memory rarityMultipliers = [uint256(100), 110, 125, 150];
        uint256 rarityMultiplier = rarityMultipliers[uint256(stats.rarity)];
        
        // Weight the stats differently to reduce ties
        // Speed is most important (x1.2), followed by stamina (x1.0), then luck (x0.8)
        uint256 speedWeight = 120;
        uint256 luckWeight = 80;
        
        // Convert uint8 stats to uint256 for calculations
        uint256 speed = uint256(stats.speed);
        uint256 stamina = uint256(stats.stamina);
        uint256 luck = uint256(stats.luck);
        
        // Calculate weighted stats using fixed-point math (18 decimals)
        uint256 weightedSpeed = (speed * speedWeight) / 100;
        uint256 weightedStamina = stamina; // Stamina has weight of 1.0 (100)
        uint256 weightedLuck = (luck * luckWeight) / 100;
        
        // Calculate base score using weighted multiplicative formula
        uint256 baseScore = (weightedSpeed * weightedStamina * weightedLuck) / 10000;
        
        // Add a small luck-based variance (±2% based on luck stat)
        uint256 luckVariance = 100 + ((luck * 4) / 255) - 2;
        baseScore = (baseScore * luckVariance) / 100;
        
        // Apply rarity multiplier
        baseScore = (baseScore * rarityMultiplier) / 100;
        
        // Apply boosts with diminishing returns
        if (speedBoosts > 0) {
            // First boost gives 20% increase
            baseScore = (baseScore * 120) / 100;
            
            // Second boost gives 15% additional increase
            if (speedBoosts > 1) {
                baseScore = (baseScore * 115) / 100;
            }
        }
        
        // Scale the final score
        baseScore = baseScore * 100;
        
        return baseScore;
    }

    function _sortAndAssignPositions(RaceScore[] memory scores) internal pure {
        uint256 numPlayers = scores.length;
        
        // Insertion sort (efficient for small arrays)
        for (uint256 i = 1; i < numPlayers; i++) {
            RaceScore memory key = scores[i];
            int256 j = int256(i) - 1;
            
            while (j >= 0 && scores[uint256(j)].score < key.score) {
                scores[uint256(j + 1)] = scores[uint256(j)];
                j--;
            }
            scores[uint256(j + 1)] = key;
        }
        
        // Assign positions (handling ties)
        uint256 currentPosition = 1;
        uint256 sameScoreCount = 1;
        scores[0].position = currentPosition;
        
        for (uint256 i = 1; i < numPlayers; i++) {
            if (scores[i].score == scores[i-1].score) {
                scores[i].position = currentPosition;
                sameScoreCount++;
            } else {
                currentPosition += sameScoreCount;
                scores[i].position = currentPosition;
                sameScoreCount = 1;
            }
        }
    }

    function _distributeStoredRewards(uint256 raceId) internal {
        Race storage race = races[raceId];
        require(race.calculatedResults.length > 0, "No results to distribute");
        
        // Calculate dev fee
        uint256 devFee = (race.prizePool * devFeePercent) / 100;
        uint256 remainingPrize = race.prizePool - devFee;

        // Transfer dev fee if any
        if (devFee > 0) {
            payable(owner()).transfer(devFee);
        }

        // Get race configuration
        RaceType storage raceType = raceTypes[race.raceSize];
        
        // Distribute rewards based on stored positions
        for (uint256 i = 0; i < race.calculatedResults.length; i++) {
            RaceResult storage result = race.calculatedResults[i];
            if (result.finalPosition <= raceType.numWinners) {
                uint256 reward = (remainingPrize * raceType.rewardPercentages[result.finalPosition - 1]) / 100;
                result.reward = reward; // Store the reward amount
                payable(result.player).transfer(reward);
                
                // Update player stats
                PlayerStats storage winnerStats = playerStats[result.player];
                winnerStats.totalRewards += reward;
                if (result.finalPosition == 1) {
                    winnerStats.wins++;
                }
            }
            
            // Update other player stats
            PlayerStats storage playerStats_ = playerStats[result.player];
            playerStats_.totalScore += result.score;
            playerStats_.racesParticipated++;
            if (result.score > playerStats_.bestScore) {
                playerStats_.bestScore = result.score;
            }
        }
    }

    function _createRaceResults(RaceScore[] memory scores) internal pure returns (RaceResult[] memory) {
        RaceResult[] memory results = new RaceResult[](scores.length);
        for (uint256 i = 0; i < scores.length; i++) {
            results[i] = RaceResult({
                player: scores[i].player,
                critterId: scores[i].critterId,
                finalPosition: scores[i].position,
                reward: 0, // Will be filled in by _distributeRewards
                score: scores[i].score
            });
        }
        return results;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getRaceTypeInfo(RaceSize raceSize) external view returns (RaceTypeInfo memory) {
        RaceType storage raceType = raceTypes[raceSize];
        return RaceTypeInfo({
            maxPlayers: raceType.maxPlayers,
            numWinners: raceType.numWinners,
            entryFee: raceType.entryFee,
            rewardPercentages: raceType.rewardPercentages,
            isActive: raceType.isActive
        });
    }

    function getRaceInfo(uint256 raceId) external view returns (RaceInfo memory) {
        Race storage race = races[raceId];
        return RaceInfo({
            id: race.id,
            raceSize: race.raceSize,
            players: race.players,
            critterIds: race.critterIds,
            startTime: race.startTime,
            isActive: race.isActive,
            hasEnded: race.hasEnded,
            prizePool: race.prizePool
        });
    }

    function getActiveRaces(RaceSize raceSize) external view returns (RaceInfo[] memory) {
        uint256[] storage activeRaces = activeRacesByType[raceSize];
        RaceInfo[] memory raceInfos = new RaceInfo[](activeRaces.length);
        
        for (uint256 i = 0; i < activeRaces.length; i++) {
            Race storage race = races[activeRaces[i]];
            raceInfos[i] = RaceInfo({
                id: race.id,
                raceSize: race.raceSize,
                players: race.players,
                critterIds: race.critterIds,
                startTime: race.startTime,
                isActive: race.isActive,
                hasEnded: race.hasEnded,
                prizePool: race.prizePool
            });
        }
        
        return raceInfos;
    }

    // Add new function to get user's race history
    function getUserRaces(address user) external view returns (RaceInfo[] memory) {
        uint256[] storage userRaces = userRaceHistory[user];
        RaceInfo[] memory raceInfos = new RaceInfo[](userRaces.length);
        
        for (uint256 i = 0; i < userRaces.length; i++) {
            Race storage race = races[userRaces[i]];
            raceInfos[i] = RaceInfo({
                id: race.id,
                raceSize: race.raceSize,
                players: race.players,
                critterIds: race.critterIds,
                startTime: race.startTime,
                isActive: race.isActive,
                hasEnded: race.hasEnded,
                prizePool: race.prizePool
            });
        }
        
        return raceInfos;
    }

    function getLatestAvailableRace(RaceSize raceSize) external view returns (uint256) {
        require(
            raceSize == RaceSize.Two || 
            raceSize == RaceSize.Five || 
            raceSize == RaceSize.Ten, 
            "Invalid race size"
        );
        
        uint256[] storage activeRaces = activeRacesByType[raceSize];
        
        for (uint256 i = 0; i < activeRaces.length; i++) {
            Race storage race = races[activeRaces[i]];
            RaceType storage raceType = raceTypes[raceSize];
            
            if (race.isActive && 
                !race.hasEnded && 
                race.startTime == 0 && 
                race.playerCount < raceType.maxPlayers) {
                return race.id;
            }
        }
        
        return 0; // Return 0 if no available race found
    }

    // Add new view functions at the end of the contract
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function getWinRate(address player) external view returns (uint256) {
        PlayerStats memory stats = playerStats[player];
        if (stats.racesParticipated == 0) return 0;
        return (stats.wins * 100) / stats.racesParticipated;
    }

    function getTopPlayersByWins(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        // Count total players with stats
        uint256 totalPlayers = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                totalPlayers++;
            }
        }

        // Use the smaller of limit or totalPlayers
        uint256 resultSize = limit < totalPlayers ? limit : totalPlayers;
        address[] memory topPlayers = new address[](resultSize);
        uint256[] memory winCounts = new uint256[](resultSize);

        // Initialize with first players found
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length && currentIndex < resultSize; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                topPlayers[currentIndex] = player;
                winCounts[currentIndex] = playerStats[player].wins;
                currentIndex++;
            }
        }

        // Sort by wins (simple bubble sort)
        for (uint256 i = 0; i < resultSize - 1; i++) {
            for (uint256 j = 0; j < resultSize - i - 1; j++) {
                if (winCounts[j] < winCounts[j + 1]) {
                    // Swap wins
                    uint256 tempWins = winCounts[j];
                    winCounts[j] = winCounts[j + 1];
                    winCounts[j + 1] = tempWins;
                    
                    // Swap addresses
                    address tempAddr = topPlayers[j];
                    topPlayers[j] = topPlayers[j + 1];
                    topPlayers[j + 1] = tempAddr;
                }
            }
        }

        return (topPlayers, winCounts);
    }

    function getTopPlayersByScore(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        uint256 totalPlayers = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                totalPlayers++;
            }
        }

        uint256 resultSize = limit < totalPlayers ? limit : totalPlayers;
        address[] memory topPlayers = new address[](resultSize);
        uint256[] memory scores = new uint256[](resultSize);

        uint256 currentIndex = 0;
        for (uint256 i = 0; i < races[currentRaceId].players.length && currentIndex < resultSize; i++) {
            address player = races[currentRaceId].players[i];
            if (playerStats[player].racesParticipated > 0) {
                topPlayers[currentIndex] = player;
                scores[currentIndex] = playerStats[player].totalScore;
                currentIndex++;
            }
        }

        // Sort by total score
        for (uint256 i = 0; i < resultSize - 1; i++) {
            for (uint256 j = 0; j < resultSize - i - 1; j++) {
                if (scores[j] < scores[j + 1]) {
                    uint256 tempScore = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = tempScore;
                    
                    address tempAddr = topPlayers[j];
                    topPlayers[j] = topPlayers[j + 1];
                    topPlayers[j + 1] = tempAddr;
                }
            }
        }

        return (topPlayers, scores);
    }

    // Add batch score fetching
    function getBatchRaceScores(
        uint256[] calldata critterIds,
        uint256[] calldata boosts
    ) external view returns (uint256[] memory scores) {
        require(critterIds.length == boosts.length, "Array lengths must match");
        scores = new uint256[](critterIds.length);
        
        for(uint256 i = 0; i < critterIds.length; i++) {
            uint256 baseScore = baseScoreCache[critterIds[i]];
            if (baseScore == 0) {
                // Calculate and cache if not exists
                MonadCritter.Stats memory stats = critterContract.getStats(critterIds[i]);
                baseScore = _calculateBaseScore(stats);
                // Note: Can't actually cache in view function, would need separate tx
            }
            scores[i] = _applyBoosts(baseScore, boosts[i]);
        }
        return scores;
    }
    
    // Split score calculation into base and boost parts
    function _calculateBaseScore(
        MonadCritter.Stats memory stats
    ) internal pure returns (uint256) {
        uint256[4] memory rarityMultipliers = [uint256(100), 110, 125, 150];
        uint256 rarityMultiplier = rarityMultipliers[uint256(stats.rarity)];
        
        uint256 speedWeight = 120;
        uint256 luckWeight = 80;
        
        uint256 speed = uint256(stats.speed);
        uint256 stamina = uint256(stats.stamina);
        uint256 luck = uint256(stats.luck);
        
        uint256 weightedSpeed = (speed * speedWeight) / 100;
        uint256 weightedStamina = stamina;
        uint256 weightedLuck = (luck * luckWeight) / 100;
        
        uint256 baseScore = (weightedSpeed * weightedStamina * weightedLuck) / 10000;
        
        uint256 luckVariance = 100 + ((luck * 4) / 255) - 2;
        baseScore = (baseScore * luckVariance) / 100;
        
        return (baseScore * rarityMultiplier) / 100 * 100;
    }
    
    function _applyBoosts(uint256 baseScore, uint256 boosts) internal pure returns (uint256) {
        if (boosts > 0) {
            baseScore = (baseScore * 120) / 100;  // First boost: +20%
            if (boosts > 1) {
                baseScore = (baseScore * 115) / 100;  // Second boost: +15%
            }
        }
        return baseScore;
    }
    
    // Add function to pre-calculate and cache base scores
    function cacheBaseScores(uint256[] calldata critterIds) external {
        for(uint256 i = 0; i < critterIds.length; i++) {
            MonadCritter.Stats memory stats = critterContract.getStats(critterIds[i]);
            baseScoreCache[critterIds[i]] = _calculateBaseScore(stats);
        }
    }

    // Add getter for multiple race results at once
    function getBatchRaceResults(uint256[] calldata raceIds) external view returns (
        RaceResult[][] memory results
    ) {
        results = new RaceResult[][](raceIds.length);
        for(uint256 i = 0; i < raceIds.length; i++) {
            results[i] = raceEndInfo[raceIds[i]].results;
        }
        return results;
    }

    // Add comprehensive leaderboard function
    function getRaceLeaderboard(uint256 raceId) external view returns (LeaderboardEntry[] memory) {
        RaceEndInfo storage endInfo = raceEndInfo[raceId];
        require(endInfo.resultsCalculated, "Race results not calculated yet");
        
        RaceResult[] storage results = endInfo.results;
        LeaderboardEntry[] memory leaderboard = new LeaderboardEntry[](results.length);
        
        // Convert results to leaderboard entries
        for(uint256 i = 0; i < results.length; i++) {
            leaderboard[i] = LeaderboardEntry({
                player: results[i].player,
                position: results[i].finalPosition,
                score: results[i].score,
                reward: results[i].reward
            });
        }
        
        // Sort by position (already sorted, but ensure it's correct)
        for(uint256 i = 0; i < leaderboard.length - 1; i++) {
            for(uint256 j = 0; j < leaderboard.length - i - 1; j++) {
                if(leaderboard[j].position > leaderboard[j + 1].position) {
                    LeaderboardEntry memory temp = leaderboard[j];
                    leaderboard[j] = leaderboard[j + 1];
                    leaderboard[j + 1] = temp;
                }
            }
        }
        
        return leaderboard;
    }

    // Add batch leaderboard function for multiple races
    function getBatchRaceLeaderboards(uint256[] calldata raceIds) external view returns (LeaderboardEntry[][] memory) {
        LeaderboardEntry[][] memory allLeaderboards = new LeaderboardEntry[][](raceIds.length);
        
        for(uint256 i = 0; i < raceIds.length; i++) {
            RaceEndInfo storage endInfo = raceEndInfo[raceIds[i]];
            if(endInfo.resultsCalculated) {
                RaceResult[] storage results = endInfo.results;
                LeaderboardEntry[] memory leaderboard = new LeaderboardEntry[](results.length);
                
                for(uint256 j = 0; j < results.length; j++) {
                    leaderboard[j] = LeaderboardEntry({
                        player: results[j].player,
                        position: results[j].finalPosition,
                        score: results[j].score,
                        reward: results[j].reward
                    });
                }
                
                allLeaderboards[i] = leaderboard;
            }
        }
        
        return allLeaderboards;
    }
} 