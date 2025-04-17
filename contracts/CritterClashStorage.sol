// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CritterClashStats.sol";  

/**
 * @title CritterClashStorage
 * @dev Abstract contract containing all storage structures and types for CritterClash
 */
abstract contract CritterClashStorage is Ownable {
    enum ClashSize { 
        None,  // 0
        Two,   // 1
        Four   // 2
    }

    enum ClashState {
        ACCEPTING_PLAYERS,    // Players can join
        CLASHING,            // Full players, scores calculated, waiting for completion
        COMPLETED_WITH_RESULTS // Results distributed
    }
    
    // Constants for house types
    uint8 public constant HOUSE_COMMON = 0;
    uint8 public constant HOUSE_UNCOMMON = 1;
    uint8 public constant HOUSE_RARE = 2;
    uint8 public constant HOUSE_LEGENDARY = 3;
    uint8 public constant HOUSE_MIXED = 255;
    
    struct TokenInfo {
        bool isActive;
        uint248 entryFeeAmount;
    }
    
    struct ClashType {
        uint96 maxPlayers;
        uint96 numWinners;
        mapping(uint8 => uint96) entryFees;  // Entry fees per house type
        bool isActive;
        uint256[] rewardPercentages;
    }
    
    struct Clash {
        uint128 id;
        ClashSize clashSize;
        ClashState state;
        uint8 playerCount;
        uint8 house;  // 0=Common, 1=Uncommon, 2=Rare, 3=Legendary, 255=mixed
        uint64 startTime;
        bool isProcessed;
        
        mapping(uint8 => address) players;
        mapping(uint8 => uint256) critterIds;
        mapping(uint8 => address) sortedPlayers;
        mapping(uint8 => uint256) sortedCritterIds;
        mapping(uint8 => uint256) sortedScores;
        mapping(address => uint256) boostCount;
        
        uint8 resultCount;
        mapping(uint8 => ClashResult) results;
    }

    struct ClashResult {
        address player;
        uint128 critterId;
        uint32 position;
        uint64 reward;
        uint32 score;
    }

    struct PlayerStats {
        uint256 totalScore;
        uint256 totalWins;
        uint256 totalClashes;
        uint256 totalRewards;
    }

    struct FundAccounting {
        uint256 prizePool;       // Total funds available for prizes
        uint256 daoFees;        // Accumulated DAO fees
        uint256 boostFees;      // Accumulated boost fees
        uint256 entropyFees;    // Accumulated entropy fees
        uint256 platformFees;   // Accumulated platform fees from external collections
    }

    struct EntropyStorage {
        mapping(uint64 => bytes32) randomRequests;
        mapping(uint256 => uint64) clashSequenceNumber;
        mapping(uint64 => uint256) requestToClash;
        uint64 nextSequenceNumber;
        uint192 entropyFeeBalance;
    }

    // Revenue tracking
    struct RevenueInfo {
        uint256 totalFees;           // Total fees collected
        uint256 platformShare;       // Platform's share
        uint256 collectionShare;     // Collection's share
        uint256 lastDistributed;     // Last distribution timestamp
    }

    // Revenue mapping per collection
    mapping(address => RevenueInfo) public collectionRevenue;
    
    // Platform fee percentages
    uint256 public platformFeePercent;     // Base platform fee
    uint256 public collectionFeePercent;   // Base collection fee
    
    // Minimum amounts for distribution
    uint256 public constant MIN_DISTRIBUTION = 0.1 ether;

    mapping(ClashSize => ClashType) public clashTypes;
    mapping(uint256 => Clash) public clashes;
    mapping(ClashSize => mapping(uint8 => uint256)) public currentActiveClashByHouse;  // Track active clashes by size and house
    uint256 public currentClashId;
    
    mapping(address => uint256) public playerBoosts;
    
    mapping(address => mapping(uint256 => uint256)) public userClashIdsMap;
    mapping(address => uint256) public userClashCount;
    
    FundAccounting public fundAccounting;
    
    uint128 public daoFeePercent;
    uint128 public powerUpFeePercent;
    
    EntropyStorage public entropyStorage;

    address public constant NATIVE_TOKEN = address(0);

    // Add shared contract references
    CritterClashStats public statsContract;

    function _getClashResult(uint256 clashId, uint8 index) internal view returns (ClashResult storage) {
        return clashes[clashId].results[index];
    }
    
    function _addClashResult(uint256 clashId, ClashResult memory result) internal {
        uint8 index = clashes[clashId].resultCount;
        clashes[clashId].results[index] = result;
        clashes[clashId].resultCount++;
    }
    
    function _getClashResults(uint256 clashId) internal view returns (ClashResult[] memory) {
        uint8 count = clashes[clashId].resultCount;
        ClashResult[] memory results = new ClashResult[](count);
        
        for (uint8 i = 0; i < count; i++) {
            results[i] = clashes[clashId].results[i];
        }
        
        return results;
    }
    
    function _addUserClashId(address user, uint256 clashId) internal virtual {
        uint256 index = userClashCount[user];
        userClashIdsMap[user][index] = clashId;
        userClashCount[user]++;
    }
    
    function _getUserClashIds(address user) internal view virtual returns (uint256[] memory) {
        uint256 count = userClashCount[user];
        uint256[] memory ids = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            ids[i] = userClashIdsMap[user][i];
        }
        
        return ids;
    }
}