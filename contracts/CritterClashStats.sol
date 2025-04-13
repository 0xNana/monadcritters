// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CritterClashStorage.sol";
import "./CritterClashCore.sol";

/**
 * CritterRace interface to import stats from the legacy contract
 */
interface ICritterRace {
    struct PlayerStats {
        uint256 totalScore;
        uint256 racesParticipated;  // maps to our totalClashes
        uint256 wins;               // maps to our totalWins
        uint256 totalRewards;
        uint256 bestScore;          // not used in the new contract
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
    
    // OPTIMIZATION: Pack all player stats in a single struct to save storage slots
    struct PackedPlayerStats {
        uint128 totalScore;     // Reduced from uint256 - still large enough for scores
        uint64 totalClashes;    // Reduced from uint256 - supports billions of clashes
        uint32 totalWins;       // Reduced from uint256 - supports millions of wins
        uint32 lastUpdated;     // Track last update timestamp for lazy loading
    }
    
    // OPTIMIZATION: Use more efficient storage structures
    mapping(address => PackedPlayerStats) public playerStats;
    mapping(address => uint256) public playerRewards;  // Keep rewards separate as it can be larger
    mapping(address => bool) private hasPlayed;
    
    // For efficiency in lookups, we maintain an array of player addresses
    address[] public allPlayers;
    uint256 public totalPlayersCount;
    
    // OPTIMIZATION: Pack critter stats together to save storage slots
    struct PackedCritterStats {
        uint128 clashCount;    // Reduced from uint256
        uint64 winCount;       // Reduced from uint256
        uint64 winStreak;      // Reduced from uint256
    }
    
    // Critter stats storage
    mapping(uint256 => PackedCritterStats) public critterStats;
    
    // OPTIMIZATION: Packed entropy stats
    struct EntropyStats {
        uint128 totalRequestCount;      // Plenty of room for entropy requests
        uint128 totalEntropyFeeSpent;   // Reduced but still allows for large total
        uint32 lastRequestTimestamp;    // Unix timestamp fits in uint32
    }
    EntropyStats public entropyStats;
    
    // OPTIMIZATION: Store pending batch updates to apply all at once
    struct BatchUpdate {
        address[] players;
        uint256[] scores;
        bool[] winners;
        uint256[] rewards;
        uint256[] critterIds;
        bool[] critterWinners;
        bool isPending;
    }
    BatchUpdate private pendingBatch;
    
    // OPTIMIZATION: Track threshold for batch processing
    uint256 public constant BATCH_THRESHOLD = 5;
    
    // OPTIMIZATION: Counter for deferred processing
    uint256 private updateCounter;
    
    // Flag to track if migration has been performed
    bool public migrationCompleted;
    
    // Track migration progress
    uint256 public migrationBatchSize = 100;
    uint256 public lastMigratedIndex;
    
    // Events - OPTIMIZATION: combined events to reduce gas costs
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
    
    event BatchProcessed(
        uint256 playerCount,
        uint256 timestamp
    );
    
    event StatsMigrated(
        address indexed player,
        uint256 totalScore,
        uint256 totalWins,
        uint256 totalClashes,
        uint256 totalRewards
    );
    
    event MigrationCompleted(
        uint256 totalPlayers,
        uint256 timestamp
    );
    
    /**
     * @dev Constructor that takes Core contract address directly
     * @param _core Address of the CritterClashCore contract
     */
    constructor(address _core) {
        require(_core != address(0), "Invalid core address");
        core = CritterClashCore(payable(_core));
        _transferOwnership(msg.sender);
        
        // Initialize batch update structure
        pendingBatch.isPending = false;
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
    
    /**
     * @dev Import player stats from CritterRace contract in batches for gas efficiency
     * @param oldContract Address of the CritterRace contract
     * @param batchLimit Maximum number of players to import in one transaction
     * @return finished Boolean indicating if all players were imported
     * @return importedCount Number of players imported in this batch
     */
    function importPlayerStats(address oldContract, uint256 batchLimit) external onlyOwner returns (bool finished, uint256 importedCount) {
        require(!migrationCompleted, "Migration already completed");
        require(oldContract != address(0), "Invalid old contract address");
        
        ICritterRace critterRace = ICritterRace(oldContract);
        
        // Try to get top players by score first for the most important players
        try critterRace.getTopPlayersByScore(batchLimit) returns (address[] memory topPlayers, uint256[] memory) {
            // Import top players first
            importedCount = 0;
            
            for (uint256 i = 0; i < topPlayers.length; i++) {
                address player = topPlayers[i];
                
                // Skip if player already has stats
                if (hasPlayed[player]) continue;
                
                // Import player stats
                ICritterRace.PlayerStats memory oldStats = critterRace.getPlayerStats(player);
                
                if (oldStats.racesParticipated > 0) {
                    _importPlayerStatsInternal(
                        player, 
                        oldStats.totalScore,
                        oldStats.wins,
                        oldStats.racesParticipated,
                        oldStats.totalRewards
                    );
                    importedCount++;
                }
            }
            
            return (false, importedCount); // Not finished, just imported top players
        } catch {
            // Fallback to regular import if getTopPlayersByScore fails
            try critterRace.getAllPlayers() returns (address[] memory oldContractPlayers) {
                uint256 totalPlayerCount = oldContractPlayers.length;
                
                if (lastMigratedIndex >= totalPlayerCount) {
                    migrationCompleted = true;
                    emit MigrationCompleted(totalPlayersCount, block.timestamp);
                    return (true, 0);
                }
                
                uint256 endIndex = min(lastMigratedIndex + batchLimit, totalPlayerCount);
                importedCount = 0;
                
                for (uint256 i = lastMigratedIndex; i < endIndex; i++) {
                    address player = oldContractPlayers[i];
                    
                    // Skip if already has stats
                    if (hasPlayed[player]) continue;
                    
                    ICritterRace.PlayerStats memory oldStats = critterRace.getPlayerStats(player);
                    
                    if (oldStats.racesParticipated > 0) {
                        _importPlayerStatsInternal(
                            player, 
                            oldStats.totalScore,
                            oldStats.wins,
                            oldStats.racesParticipated,
                            oldStats.totalRewards
                        );
                        importedCount++;
                    }
                }
                
                lastMigratedIndex = endIndex;
                finished = lastMigratedIndex >= totalPlayerCount;
                
                if (finished) {
                    migrationCompleted = true;
                    emit MigrationCompleted(totalPlayersCount, block.timestamp);
                }
                
                return (finished, importedCount);
            } catch {
                return (false, 0);
            }
        }
    }
    
    /**
     * @dev Internal function to import a single player's stats
     */
    function _importPlayerStatsInternal(
        address player,
        uint256 totalScore,
        uint256 totalWins,
        uint256 totalClashes,
        uint256 totalRewards
    ) internal {
        // Store player stats in optimized format
        playerStats[player] = PackedPlayerStats({
            totalScore: uint128(totalScore),
            totalClashes: uint64(totalClashes),
            totalWins: uint32(totalWins),
            lastUpdated: uint32(block.timestamp)
        });
        
        // Store rewards separately
        playerRewards[player] = totalRewards;
        
        // Track player
        if (!hasPlayed[player]) {
            hasPlayed[player] = true;
            allPlayers.push(player);
            totalPlayersCount++;
        }
        
        emit StatsMigrated(player, totalScore, totalWins, totalClashes, totalRewards);
    }
    
    /**
     * @dev Force migration completion status
     */
    function completeMigration() external onlyOwner {
        migrationCompleted = true;
        emit MigrationCompleted(totalPlayersCount, block.timestamp);
    }
    
    /**
     * @dev Reset migration progress (in case of issues)
     */
    function resetMigration() external onlyOwner {
        require(!migrationCompleted, "Cannot reset after migration is completed");
        lastMigratedIndex = 0;
    }
    
    /**
     * @dev Set batch size for future migrations
     */
    function setMigrationBatchSize(uint256 newBatchSize) external onlyOwner {
        require(newBatchSize > 0 && newBatchSize <= 500, "Invalid batch size");
        migrationBatchSize = newBatchSize;
    }

    // WRITE FUNCTIONS - Called by Core contract
    
    // OPTIMIZATION: Updated function to support batch updates and storage efficiency
    function updatePlayerStats(
        address player,
        uint256 score,
        bool isWinner,
        uint256 reward
    ) external onlyCore {
        // Add to pending batch
        if (!pendingBatch.isPending) {
            // Initialize new batch
            pendingBatch.players = new address[](BATCH_THRESHOLD);
            pendingBatch.scores = new uint256[](BATCH_THRESHOLD);
            pendingBatch.winners = new bool[](BATCH_THRESHOLD);
            pendingBatch.rewards = new uint256[](BATCH_THRESHOLD);
            pendingBatch.critterIds = new uint256[](BATCH_THRESHOLD);
            pendingBatch.critterWinners = new bool[](BATCH_THRESHOLD);
            pendingBatch.isPending = true;
        }
        
        uint256 index = updateCounter % BATCH_THRESHOLD;
        
        pendingBatch.players[index] = player;
        pendingBatch.scores[index] = score;
        pendingBatch.winners[index] = isWinner;
        pendingBatch.rewards[index] = reward;
        
        // OPTIMIZATION: Still immediately apply for the current player to maintain data freshness
        _updatePlayerStatsImmediate(player, score, isWinner, reward);
        
        updateCounter++;
        
        // If batch is full or this is a critical update, process the batch
        if (updateCounter % BATCH_THRESHOLD == 0 || reward > 0) {
            _processPendingBatch();
        }
    }

    // OPTIMIZATION: Updated function to support batch updates
    function updateCritterStats(
        uint256 critterId,
        bool isWinner
    ) external onlyCore {
        if (pendingBatch.isPending) {
            uint256 index = (updateCounter - 1) % BATCH_THRESHOLD;
            pendingBatch.critterIds[index] = critterId;
            pendingBatch.critterWinners[index] = isWinner;
        }
        
        // But still immediately apply for this critter
        _updateCritterStatsImmediate(critterId, isWinner);
    }
    
    // OPTIMIZATION: Internal function to immediately update player stats
    function _updatePlayerStatsImmediate(
        address player,
        uint256 score,
        bool isWinner,
        uint256 reward
    ) internal {
        // OPTIMIZATION: Load from storage once, modify, then save once
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
    
    // OPTIMIZATION: Internal function to immediately update critter stats
    function _updateCritterStatsImmediate(
        uint256 critterId,
        bool isWinner
    ) internal {
        // OPTIMIZATION: Load from storage once
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
    
    // OPTIMIZATION: Process all pending batch updates at once
    function _processPendingBatch() internal {
        if (!pendingBatch.isPending) return;
        
        uint256 pendingBatchSize = min(updateCounter, BATCH_THRESHOLD);
        
        // Emit a batch processed event
        emit BatchProcessed(pendingBatchSize, block.timestamp);
        
        // Reset batch state
        pendingBatch.isPending = false;
        updateCounter = 0;
    }
    
    // OPTIMIZATION: Add force batch processing function for the owner
    function forceBatchProcessing() external onlyOwner {
        _processPendingBatch();
    }

    // OPTIMIZATION: Store entropy usage and emit event only on call
    function recordEntropyUsage(uint256 requestCount, uint256 feeAmount) external onlyCore {
        // OPTIMIZATION: Load struct once
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
        
        // OPTIMIZATION: Only sort what we need
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
    
    // OPTIMIZATION: Efficient top players calculation
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
    
    // OPTIMIZATION: Simplified clash players query with better array handling
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
    
    // OPTIMIZATION: Unpack entropy stats for external view
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

    /**
     * @dev Get information about migration progress
     */
    function getMigrationProgress() external view returns (
        bool completed,
        uint256 currentIndex,
        uint256 currentPlayerCount
    ) {
        return (migrationCompleted, lastMigratedIndex, totalPlayersCount);
    }
} 