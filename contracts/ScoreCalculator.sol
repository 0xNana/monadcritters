// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MonadCritter.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

/**
 * @title ScoreCalculator
 * @dev Contract to handle all score calculation logic for CritterClash
 */
contract ScoreCalculator is IEntropyConsumer {
    // Constants for house stat caps
    uint256 private constant COMMON_STAT_CAP = 30;
    uint256 private constant UNCOMMON_STAT_CAP = 50;
    uint256 private constant RARE_STAT_CAP = 70;
    uint256 private constant LEGENDARY_STAT_CAP = 90;

    // Constants for house scalers
    uint256 private constant COMMON_SCALER = 12;
    uint256 private constant UNCOMMON_SCALER = 9;
    uint256 private constant RARE_SCALER = 6;
    uint256 private constant LEGENDARY_SCALER = 4;

    // Constants for rarity boosts
    uint256 private constant COMMON_BOOST = 100;    // 1.0x
    uint256 private constant UNCOMMON_BOOST = 120;  // 1.2x
    uint256 private constant RARE_BOOST = 130;      // 1.3x
    uint256 private constant LEGENDARY_BOOST = 150; // 1.5x

    // Boost multipliers
    uint256 private constant FIRST_BOOST_MULTIPLIER = 120;  // 20% boost
    uint256 private constant SECOND_BOOST_MULTIPLIER = 115; // 15% additional boost

    // Underdog bonus for Common/Uncommon in mixed clashes
    uint256 private constant UNDERDOG_BONUS = 110; // 10% bonus

    // Entropy related state
    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    uint192 public entropyFeeBalance;
    
    // Entropy request tracking
    mapping(uint64 => bytes32) public randomRequests;
    mapping(uint64 => uint256) public requestToClash;
    mapping(uint256 => uint64) public clashSequenceNumber;
    
    // Score calculation results
    struct ScoreResult {
        uint256[] scores;
        address[] sortedPlayers;
        uint256[] sortedCritterIds;
    }

    // Events
    event EntropyRequested(uint256 indexed clashId, uint256 requestId, uint256 fee);
    event EntropyRequestFailed(uint256 indexed clashId, uint256 fee);
    event EntropyFeeDeposited(uint256 amount);
    event EntropyFeeWithdrawn(uint256 amount);

    constructor(address _entropy, address _entropyProvider) {
        require(_entropy != address(0), "Invalid entropy address");
        require(_entropyProvider != address(0), "Invalid entropy provider");
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    /**
     * @dev Calculate scores for all players in a clash
     * @param critterIds Array of critter IDs
     * @param players Array of player addresses
     * @param boostCounts Array of boost counts
     * @param isMixedClash Whether this is a mixed house clash
     * @param clashId The ID of the clash
     * @return ScoreResult containing sorted scores, players, and critter IDs
     */
    function calculateClashScores(
        uint256[] memory critterIds,
        address[] memory players,
        uint256[] memory boostCounts,  // Changed from mapping to array
        bool isMixedClash,
        uint256 clashId
    ) external returns (ScoreResult memory) {
        require(critterIds.length == players.length && critterIds.length == boostCounts.length, "Array length mismatch");
        uint256 playerCount = players.length;
        
        ScoreResult memory result;
        result.scores = new uint256[](playerCount);
        result.sortedPlayers = new address[](playerCount);
        result.sortedCritterIds = new uint256[](playerCount);
        
        // Calculate base scores first
        for (uint8 i = 0; i < playerCount; i++) {
            result.sortedPlayers[i] = players[i];
            result.sortedCritterIds[i] = critterIds[i];
            
            // Get base score
            uint256 baseScore = calculateBaseScore(
                MonadCritter(msg.sender).getStats(critterIds[i]),
                uint8(MonadCritter(msg.sender).getHouse(critterIds[i])),
                isMixedClash
            );
            
            // Apply boosts using array instead of mapping
            result.scores[i] = calculateScoreWithBoosts(baseScore, boostCounts[i]);
        }
        
        // Request entropy for final scores
        _requestEntropyForClash(clashId, uint8(playerCount));
        
        return result;
    }

    /**
     * @dev Add sorting function to ScoreCalculator
     */
    function _sortArrays(
        uint256[] memory scores,
        address[] memory players,
        uint256[] memory critterIds
    ) internal pure {
        // Bubble sort all arrays together based on scores (descending order)
        for (uint256 i = 0; i < scores.length - 1; i++) {
            for (uint256 j = 0; j < scores.length - i - 1; j++) {
                if (scores[j] < scores[j + 1]) {
                    // Swap scores
                    uint256 tempScore = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = tempScore;
                    
                    // Swap players
                    address tempPlayer = players[j];
                    players[j] = players[j + 1];
                    players[j + 1] = tempPlayer;
                    
                    // Swap critterIds
                    uint256 tempCritterId = critterIds[j];
                    critterIds[j] = critterIds[j + 1];
                    critterIds[j + 1] = tempCritterId;
                }
            }
        }
    }

    /**
     * @dev Apply entropy variance to scores and return sorted results
     * @param scores Array of base scores
     * @param players Array of player addresses
     * @param critterIds Array of critter IDs
     * @param entropyValue The entropy value
     * @return ScoreResult containing final sorted arrays
     */
    function applyEntropyAndSort(
        uint256[] memory scores,
        address[] memory players,
        uint256[] memory critterIds,
        bytes32 entropyValue
    ) external pure returns (ScoreResult memory) {
        require(
            scores.length == players.length && 
            scores.length == critterIds.length,
            "Array length mismatch"
        );

        ScoreResult memory result;
        result.scores = new uint256[](scores.length);
        result.sortedPlayers = new address[](players.length);
        result.sortedCritterIds = new uint256[](critterIds.length);

        // Copy arrays to maintain original data
        for (uint256 i = 0; i < scores.length; i++) {
            result.sortedPlayers[i] = players[i];
            result.sortedCritterIds[i] = critterIds[i];
            
            // Apply entropy variance
            bytes32 playerSeed = keccak256(abi.encodePacked(entropyValue, i));
            result.scores[i] = applyEntropyVariance(scores[i], playerSeed);
        }

        // Sort all arrays based on final scores
        _sortArrays(result.scores, result.sortedPlayers, result.sortedCritterIds);

        return result;
    }

    /**
     * @dev Handle entropy callback and finalize scores
     */
    function handleEntropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external {
        require(msg.sender == address(entropy), "Only entropy contract");
        require(provider == entropyProvider, "Invalid provider");
        
        uint256 clashId = requestToClash[sequenceNumber];
        require(clashId > 0, "Invalid clash ID");
        
        // Clear request tracking
        delete randomRequests[sequenceNumber];
        delete requestToClash[sequenceNumber];
        delete clashSequenceNumber[clashId];
        
        // The core contract should implement this interface to receive the entropy result
        IScoreReceiver(msg.sender).onEntropyReceived(clashId, randomNumber);
    }

    /**
     * @dev Get the stat cap for a given house
     * @param house The house type (0=Common, 1=Uncommon, 2=Rare, 3=Legendary)
     */
    function getStatCap(uint8 house) public pure returns (uint256) {
        if (house == 0) return COMMON_STAT_CAP;
        if (house == 1) return UNCOMMON_STAT_CAP;
        if (house == 2) return RARE_STAT_CAP;
        return LEGENDARY_STAT_CAP;
    }

    /**
     * @dev Get the house scaler for a given house
     * @param house The house type (0=Common, 1=Uncommon, 2=Rare, 3=Legendary)
     */
    function getHouseScaler(uint8 house) public pure returns (uint256) {
        if (house == 0) return COMMON_SCALER;
        if (house == 1) return UNCOMMON_SCALER;
        if (house == 2) return RARE_SCALER;
        return LEGENDARY_SCALER;
    }

    /**
     * @dev Calculate the base score for a critter
     * @param stats The critter's stats
     * @param house The critter's house
     * @param isMixedClash Whether this is a mixed house clash
     */
    function calculateBaseScore(
        MonadCritter.Stats memory stats,
        uint8 house,
        bool isMixedClash
    ) public pure returns (uint256) {
        // Apply stat caps based on house
        uint256 maxStat = getStatCap(house);
        uint256 stamina = uint256(stats.stamina) > maxStat ? maxStat : uint256(stats.stamina);
        uint256 speed = uint256(stats.speed) > maxStat ? maxStat : uint256(stats.speed);
        uint256 luck = uint256(stats.luck) > maxStat ? maxStat : uint256(stats.luck);

        // Calculate base stats sum
        uint256 baseStatsSum = stamina + speed + luck;

        // Apply house scaler
        uint256 score = baseStatsSum * getHouseScaler(house);

        // Apply rarity boost
        uint256 rarityBoost;
        if (house == 0) rarityBoost = COMMON_BOOST;
        else if (house == 1) rarityBoost = UNCOMMON_BOOST;
        else if (house == 2) rarityBoost = RARE_BOOST;
        else rarityBoost = LEGENDARY_BOOST;

        score = score * rarityBoost / 100;

        // Apply underdog bonus for Common/Uncommon in mixed clashes
        if (isMixedClash && house <= 1) {
            score = score * UNDERDOG_BONUS / 100;
        }

        return score;
    }

    /**
     * @dev Apply boosts to a base score
     * @param baseScore The base score before boosts
     * @param boostCount Number of boosts to apply (0-2)
     */
    function calculateScoreWithBoosts(
        uint256 baseScore,
        uint256 boostCount
    ) public pure returns (uint256) {
        // No boost case
        if (boostCount == 0) return baseScore;
        
        // First boost gives 20%
        uint256 boostedScore = baseScore * FIRST_BOOST_MULTIPLIER / 100;
        
        // Second boost gives additional 15%
        if (boostCount > 1) {
            boostedScore = boostedScore * SECOND_BOOST_MULTIPLIER / 100;
        }
        
        return boostedScore;
    }

    /**
     * @dev Apply entropy variance to a score
     * @param score The score before variance
     * @param entropyValue The entropy value to use for variance
     */
    function applyEntropyVariance(
        uint256 score,
        bytes32 entropyValue
    ) public pure returns (uint256) {
        // Generate entropy variance between 25-175% (±75%)
        uint256 entropyVariance = 25 + (uint256(entropyValue) % 151);
        return (score * entropyVariance) / 100;
    }

    /**
     * @dev Internal function to request entropy for a clash
     */
    function _requestEntropyForClash(uint256 clashId, uint8 playerCount) internal {
        uint256 entropyFee = entropy.getFee(entropyProvider);
        require(entropyFeeBalance >= entropyFee, "Insufficient entropy fee balance");
        
        entropyFeeBalance -= entropyFee;
        
        bytes32 userRandomNumber = keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            clashId,
            playerCount
        ));
        
        try entropy.requestWithCallback{value: entropyFee}(
            entropyProvider,
            userRandomNumber
        ) returns (uint64 requestId) {
            randomRequests[requestId] = userRandomNumber;
            requestToClash[requestId] = clashId;
            clashSequenceNumber[clashId] = requestId;
            
            emit EntropyRequested(clashId, requestId, entropyFee);
        } catch {
            entropyFeeBalance += entropyFee;
            emit EntropyRequestFailed(clashId, entropyFee);
            revert("Entropy request failed");
        }
    }

    // Admin functions
    function depositEntropyFee() external payable {
        entropyFeeBalance += uint192(msg.value);
        emit EntropyFeeDeposited(msg.value);
    }

    function withdrawEntropyFee() external {
        uint256 amount = entropyFeeBalance;
        require(amount > 0, "No balance to withdraw");
        entropyFeeBalance = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit EntropyFeeWithdrawn(amount);
    }

    receive() external payable {}

    /**
     * @dev Request entropy for a clash without calculating initial scores
     */
    function requestEntropyForClash(
        uint256[] memory critterIds,
        address[] memory players,
        uint256[] memory boostCounts,  // Changed from mapping to array
        bool isMixedClash,
        uint256 clashId
    ) external {
        require(critterIds.length == players.length && critterIds.length == boostCounts.length, "Array length mismatch");
        
        // Just request entropy - no score calculation yet
        _requestEntropyForClash(clashId, uint8(players.length));
    }

    /**
     * @dev Calculate final scores with entropy in one step
     */
    function calculateFinalScores(
        uint256[] memory critterIds,
        address[] memory players,
        uint256[] memory boostCounts,  // Changed from mapping to array
        bool isMixedClash,
        bytes32 entropyValue
    ) external view returns (ScoreResult memory) {
        require(critterIds.length == players.length && critterIds.length == boostCounts.length, "Array length mismatch");
        uint256 playerCount = players.length;
        
        ScoreResult memory result;
        result.scores = new uint256[](playerCount);
        result.sortedPlayers = new address[](playerCount);
        result.sortedCritterIds = new uint256[](playerCount);
        
        // Calculate all scores in one pass
        for (uint8 i = 0; i < playerCount; i++) {
            result.sortedPlayers[i] = players[i];
            result.sortedCritterIds[i] = critterIds[i];
            
            // Get base score
            uint256 baseScore = calculateBaseScore(
                MonadCritter(msg.sender).getStats(critterIds[i]),
                uint8(MonadCritter(msg.sender).getHouse(critterIds[i])),
                isMixedClash
            );
            
            // Apply boosts using array instead of mapping
            baseScore = calculateScoreWithBoosts(baseScore, boostCounts[i]);
            
            // Apply entropy variance immediately
            bytes32 playerSeed = keccak256(abi.encodePacked(entropyValue, i));
            result.scores[i] = applyEntropyVariance(baseScore, playerSeed);
        }
        
        // Sort arrays once with final scores
        _sortArrays(result.scores, result.sortedPlayers, result.sortedCritterIds);
        
        return result;
    }
}

interface IScoreReceiver {
    function onEntropyReceived(uint256 clashId, bytes32 entropy) external;
}