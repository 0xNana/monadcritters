// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CritterClashStorage.sol";
import "./CritterClashCore.sol";

// Define the PlayerStats struct for external interface
interface IStatsProvider {
    struct PlayerStats {
        uint256 totalScore;
        uint256 totalWins;
        uint256 totalClashes;
    }
    
    function getPlayerStats(address player) external view returns (PlayerStats memory);
    function getAllPlayers() external view returns (address[] memory);
    function getTopPlayersByScore(uint256 limit) external view returns (address[] memory, uint256[] memory);
}

/**
 * @title CritterClashStats
 * @dev Contract for tracking game statistics and providing read-only views of game state
 */
contract CritterClashStats is Ownable {
    // Core contract reference
    CritterClashCore public core;
    
    // Pack all player stats in a single struct to save storage slots
    struct PackedPlayerStats {
        uint128 totalScore;     // Reduced from uint256 - still large enough for scores
        uint64 totalClashes;    // Reduced from uint256 - supports billions of clashes
        uint32 totalWins;       // Reduced from uint256 - supports millions of wins
        uint32 lastUpdated;     // Track last update timestamp for lazy loading
    }
    
    // Use efficient storage structures
    mapping(address => PackedPlayerStats) public playerStats;
    mapping(address => uint256) public playerRewards;  // Keep rewards separate as it can be larger
    mapping(address => bool) private hasPlayed;
    
    // For efficiency in lookups, we maintain an array of player addresses
    address[] public allPlayers;
    uint256 public totalPlayersCount;
    
    // Pack critter stats together to save storage slots
    struct PackedCritterStats {
        uint128 clashCount;    // Reduced from uint256
        uint64 winCount;       // Reduced from uint256
        uint64 winStreak;      // Reduced from uint256
    }
    
    // Critter stats storage
    mapping(uint256 => PackedCritterStats) public critterStats;
    
    // Packed entropy stats
    struct EntropyStats {
        uint128 totalRequestCount;      // Plenty of room for entropy requests
        uint128 totalEntropyFeeSpent;   // Reduced but still allows for large total
        uint32 lastRequestTimestamp;    // Unix timestamp fits in uint32
    }
    EntropyStats public entropyStats;
    
    // Events
    event StatsUpdated(
        address indexed player,
        uint256 totalScore,
        uint256 totalWins,
        uint256 totalClashes,
        uint256 critterId,
        uint256 critterClashCount,
        uint256 critterWinCount,
        uint256 critterWinStreak
    );
    
    event EntropyUsed(
        uint256 requestCount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    constructor(address _core) {
        require(_core != address(0), "Invalid core address");
        core = CritterClashCore(payable(_core));
        _transferOwnership(msg.sender);
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    /**
     * @dev Update the core contract address. Can only be called by the owner.
     * @param _core New address of the CritterClashCore contract
     */
    function updateCoreAddress(address _core) external onlyOwner {
        require(_core != address(0), "Invalid core address");
        core = CritterClashCore(payable(_core));
    }
    
    modifier onlyCore() {
        require(msg.sender == address(core), "Only core can call this");
        _;
    }
    
    // WRITE FUNCTIONS - Called by Core contract
    
    function updatePlayerStats(
        address player,
        uint256 score,
        bool isWinner,
        uint256 reward
    ) external onlyCore {
        // Load from storage once, modify, then save once
        PackedPlayerStats storage stats = playerStats[player];
        
        // Update all stats at once
        stats.totalScore += uint128(score); // Safe as scores don't exceed 2^128
        if (isWinner) stats.totalWins += 1;
        stats.totalClashes += 1;
        stats.lastUpdated = uint32(block.timestamp);
        
        // Track rewards separately since they can be larger values
        playerRewards[player] += reward;
        
        // Add player to tracking array if this is their first clash
        if (!hasPlayed[player]) {
            hasPlayed[player] = true;
            allPlayers.push(player);
            totalPlayersCount++;
        }
        
        // Emit StatsUpdated event
        emit StatsUpdated(
            player,
            stats.totalScore,
            stats.totalWins,
            stats.totalClashes,
            0, // critterId - not available in this context
            0, // critterClashCount - not available in this context
            0, // critterWinCount - not available in this context
            0  // critterWinStreak - not available in this context
        );
    }

    function updateCritterStats(
        uint256 critterId,
        bool isWinner
    ) external onlyCore {
        // Load from storage once
        PackedCritterStats storage stats = critterStats[critterId];
        
        // Update all at once
        stats.clashCount += 1;
        
        if (isWinner) {
            stats.winCount += 1;
            stats.winStreak += 1;
        } else {
            stats.winStreak = 0;
        }
    }

    function recordEntropyUsage(uint256 requestCount, uint256 feeAmount) external onlyCore {
        // Load struct once
        EntropyStats storage stats = entropyStats;
        
        // Update all fields at once
        stats.totalRequestCount += uint128(requestCount);
        stats.totalEntropyFeeSpent += uint128(feeAmount);
        stats.lastRequestTimestamp = uint32(block.timestamp);
        
        emit EntropyUsed(requestCount, feeAmount, block.timestamp);
    }

    // READ FUNCTIONS - Public Views

    // Clash Info Queries
    function getClashInfo(uint256 clashId) public view returns (
        CritterClashStorage.ClashSize clashSize,
        CritterClashStorage.ClashState state,
        uint256 playerCount,
        uint256 startTime,
        bool isProcessed,
        address[] memory players,
        uint256[] memory critterIds,
        uint256[] memory boosts,
        uint256[] memory scores,
        uint256[] memory results
    ) {
        return core.getClashInfo(clashId);
    }

    // OPTIMIZATION: Lazy load clash info when needed
    function getUserClashIds(address user) external view returns (
        uint256[] memory acceptingPlayersClashes,
        uint256[] memory clashingClashes,
        uint256[] memory completedClashes
    ) {
        uint256[] memory allClashes = core.getUserClashIds(user);
        
        // Count clashes in each state
        uint256 acceptingCount;
        uint256 clashingCount;
        uint256 completedCount;
        
        for (uint256 i = 0; i < allClashes.length; i++) {
            (
                ,
                CritterClashStorage.ClashState clashState,
                ,
                ,
                ,  // isProcessed
                ,
                ,
                ,
                ,
                
            ) = core.getClashInfo(allClashes[i]);
            
            if (clashState == CritterClashStorage.ClashState.ACCEPTING_PLAYERS) acceptingCount++;
            else if (clashState == CritterClashStorage.ClashState.CLASHING) clashingCount++;
            else if (clashState == CritterClashStorage.ClashState.COMPLETED_WITH_RESULTS) completedCount++;
        }
        
        // Allocate arrays
        acceptingPlayersClashes = new uint256[](acceptingCount);
        clashingClashes = new uint256[](clashingCount);
        completedClashes = new uint256[](completedCount);
        
        // Fill arrays
        uint256 a; uint256 b; uint256 c;
        for (uint256 i = 0; i < allClashes.length; i++) {
            (
                ,
                CritterClashStorage.ClashState clashState,
                ,
                ,
                ,  // isProcessed
                ,
                ,
                ,
                ,
                
            ) = core.getClashInfo(allClashes[i]);
            
            if (clashState == CritterClashStorage.ClashState.ACCEPTING_PLAYERS) 
                acceptingPlayersClashes[a++] = allClashes[i];
            else if (clashState == CritterClashStorage.ClashState.CLASHING) 
                clashingClashes[b++] = allClashes[i];
            else if (clashState == CritterClashStorage.ClashState.COMPLETED_WITH_RESULTS) 
                completedClashes[c++] = allClashes[i];
        }
    }

    // OPTIMIZATION: Unpack packed stat structures for external view functions
    function getUserStats(address user) external view returns (
        uint256 totalScore,
        uint256 totalWins,
        uint256 totalClashes,
        uint256 totalRewards
    ) {
        PackedPlayerStats memory stats = playerStats[user];
        return (
            uint256(stats.totalScore),
            uint256(stats.totalWins),
            uint256(stats.totalClashes),
            playerRewards[user]
        );
    }

    // OPTIMIZATION: Unpack packed critter stats for external view
    function getCritterStats(uint256 critterId) external view returns (
        uint256 clashCount,
        uint256 winCount,
        uint256 winStreak
    ) {
        PackedCritterStats memory stats = critterStats[critterId];
        return (
            uint256(stats.clashCount),
            uint256(stats.winCount),
            uint256(stats.winStreak)
        );
    }

    // OPTIMIZATION: Batch query with pagination for efficiency
    function getClashInfoBatch(
        uint256[] calldata clashIds,
        uint256 offset,
        uint256 limit
    ) external view returns (
        CritterClashStorage.ClashSize[] memory clashSizes,
        CritterClashStorage.ClashState[] memory states,
        uint256[] memory playerCounts,
        uint256[] memory startTimes,
        address[][] memory players,
        uint256[][] memory critterIds,
        uint256[][] memory boosts,
        uint256[][] memory scores,
        uint256[][] memory results
    ) {
        uint256 queryBatchSize = min(limit, clashIds.length - offset);
        
        clashSizes = new CritterClashStorage.ClashSize[](queryBatchSize);
        states = new CritterClashStorage.ClashState[](queryBatchSize);
        playerCounts = new uint256[](queryBatchSize);
        startTimes = new uint256[](queryBatchSize);
        players = new address[][](queryBatchSize);
        critterIds = new uint256[][](queryBatchSize);
        boosts = new uint256[][](queryBatchSize);
        scores = new uint256[][](queryBatchSize);
        results = new uint256[][](queryBatchSize);
        
        for (uint256 i = 0; i < queryBatchSize; i++) {
            uint256 clashId = clashIds[offset + i];
            (
                clashSizes[i],
                states[i],
                playerCounts[i],
                startTimes[i],
                ,
                players[i],
                critterIds[i],
                boosts[i],
                scores[i],
                results[i]
            ) = getClashInfo(clashId);
        }
    }
    
    // OPTIMIZATION: Improved leaderboard query with more efficient sorting
    function getLeaderboard(
        uint256 offset,
        uint256 count
    ) external view returns (
        address[] memory players,
        uint256[] memory scores,
        uint256[] memory wins,
        uint256[] memory clashCounts,
        uint256[] memory rewards
    ) {
        uint256 resultSize = min(count, allPlayers.length);
        
        players = new address[](resultSize);
        scores = new uint256[](resultSize);
        wins = new uint256[](resultSize);
        clashCounts = new uint256[](resultSize);
        rewards = new uint256[](resultSize);
        
        // Only sort what we need
        address[] memory topPlayers = _getTopPlayers(offset, resultSize);
        
        // Fill return arrays with top players
        for (uint256 i = 0; i < resultSize && i < topPlayers.length; i++) {
            address player = topPlayers[i];
            PackedPlayerStats memory stats = playerStats[player];
            players[i] = player;
            scores[i] = stats.totalScore;
            wins[i] = stats.totalWins;
            clashCounts[i] = stats.totalClashes;
            rewards[i] = playerRewards[player];
        }
    }
    
    function _getTopPlayers(uint256 offset, uint256 count) internal view returns (address[] memory) {
        uint256 total = totalPlayersCount;
        if (total == 0) return new address[](0);
        
        // Adjust for offset - don't allow offset beyond total players
        uint256 availableCount = offset >= total ? 0 : total - offset;
        uint256 resultSize = min(count, availableCount);
        
        // If after applying offset, there are no results to return
        if (resultSize == 0) return new address[](0);
        
        address[] memory result = new address[](resultSize);
        
        // First, compute the top 'offset + resultSize' players
        address[] memory tempResult = new address[](offset + resultSize);
        
        // Use a simple selection algorithm - more gas efficient than full sort for small result sets
        for (uint256 r = 0; r < offset + resultSize; r++) {
            uint256 highestScore = 0;
            uint256 highestIndex = 0;
            address highestPlayer = address(0);
            
            for (uint256 i = 0; i < allPlayers.length; i++) {
                address player = allPlayers[i];
                
                // Skip already selected players
                bool alreadySelected = false;
                for (uint256 j = 0; j < r; j++) {
                    if (tempResult[j] == player) {
                        alreadySelected = true;
                        break;
                    }
                }
                if (alreadySelected) continue;
                
                uint256 score = playerStats[player].totalScore;
                if (score > highestScore) {
                    highestScore = score;
                    highestIndex = i;
                    highestPlayer = player;
                }
            }
            
            if (highestPlayer != address(0)) {
                tempResult[r] = highestPlayer;
            }
        }
        
        // Copy only the players after the offset
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = tempResult[offset + i];
        }
        
        return result;
    }

    function getTotalPlayers() external view returns (uint256) {
        return totalPlayersCount;
    }
    
    function getClashPlayers(uint256 clashId) external view returns (
        address[] memory players,
        uint256[] memory critterIds,
        uint256[] memory boosts
    ) {
        (
            ,
            ,
            uint256 playerCount,
            ,
            ,
            address[] memory tempPlayers,
            uint256[] memory tempCritterIds,
            uint256[] memory tempBoosts,
            ,
            
        ) = getClashInfo(clashId);
        
        // Resize arrays to actual player count if needed
        if (tempPlayers.length > playerCount) {
            players = new address[](playerCount);
            critterIds = new uint256[](playerCount);
            boosts = new uint256[](playerCount);
            
            for (uint256 i = 0; i < playerCount; i++) {
                players[i] = tempPlayers[i];
                critterIds[i] = tempCritterIds[i];
                boosts[i] = tempBoosts[i];
            }
        } else {
            players = tempPlayers;
            critterIds = tempCritterIds;
            boosts = tempBoosts;
        }
    }
    
    function getEntropyStats() external view returns (
        uint256 totalRequestCount,
        uint256 totalEntropyFeeSpent,
        uint256 lastRequestTimestamp
    ) {
        return (
            uint256(entropyStats.totalRequestCount),
            uint256(entropyStats.totalEntropyFeeSpent),
            uint256(entropyStats.lastRequestTimestamp)
        );
    }
}

    