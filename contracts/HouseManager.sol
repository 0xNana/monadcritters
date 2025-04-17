// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IERC721Stats.sol";

/**
 * @title HouseManager
 * @dev Manages house assignments and validations for NFT collections
 */
contract HouseManager is Initializable, OwnableUpgradeable {
    // Struct to store collection-specific house mapping rules
    struct CollectionConfig {
        bool isRegistered;
        uint256[] rarityThresholds;  // [legendary, rare, uncommon] thresholds
        bool allowMixed;             // Whether collection can participate in mixed battles
        address statsImplementation; // Optional custom stats implementation
    }

    // Mapping of NFT contract address to its configuration
    mapping(address => CollectionConfig) public collections;
    
    // Default stats for non-standard NFTs
    uint256 public constant DEFAULT_STAT = 10;
    
    // Events
    event CollectionRegistered(address indexed collection, uint256[] rarityThresholds, bool allowMixed);
    event CollectionUpdated(address indexed collection, uint256[] rarityThresholds, bool allowMixed);
    event StatsImplementationUpdated(address indexed collection, address implementation);

    function initialize() public initializer {
        __Ownable_init();
    }

    /**
     * @dev Register a new NFT collection with custom house mapping rules
     */
    function registerCollection(
        address collection,
        uint256[] calldata rarityThresholds,
        bool allowMixed,
        address statsImpl
    ) external onlyOwner {
        require(collection != address(0), "Invalid collection address");
        require(rarityThresholds.length == 3, "Invalid thresholds length");
        require(rarityThresholds[0] < rarityThresholds[1] && rarityThresholds[1] < rarityThresholds[2], "Invalid threshold order");

        collections[collection] = CollectionConfig({
            isRegistered: true,
            rarityThresholds: rarityThresholds,
            allowMixed: allowMixed,
            statsImplementation: statsImpl
        });

        emit CollectionRegistered(collection, rarityThresholds, allowMixed);
        if (statsImpl != address(0)) {
            emit StatsImplementationUpdated(collection, statsImpl);
        }
    }

    /**
     * @dev Update an existing collection's configuration
     */
    function updateCollection(
        address collection,
        uint256[] calldata rarityThresholds,
        bool allowMixed,
        address statsImpl
    ) external onlyOwner {
        require(collections[collection].isRegistered, "Collection not registered");
        
        collections[collection].rarityThresholds = rarityThresholds;
        collections[collection].allowMixed = allowMixed;
        collections[collection].statsImplementation = statsImpl;

        emit CollectionUpdated(collection, rarityThresholds, allowMixed);
        if (statsImpl != address(0)) {
            emit StatsImplementationUpdated(collection, statsImpl);
        }
    }

    /**
     * @dev Get stats for a token, handling both standard and custom implementations
     */
    function getStats(
        address collection,
        uint256 tokenId
    ) public view returns (uint256 stamina, uint256 speed, uint256 luck, uint256 rarity) {
        CollectionConfig storage config = collections[collection];
        
        if (config.statsImplementation != address(0)) {
            // Use custom stats implementation
            return IERC721Stats(config.statsImplementation).getStats(tokenId);
        }
        
        try IERC721Stats(collection).getStats(tokenId) returns (
            uint256 s, uint256 sp, uint256 l, uint256 r
        ) {
            return (s, sp, l, r);
        } catch {
            // Return default stats for non-standard NFTs
            return (DEFAULT_STAT, DEFAULT_STAT, DEFAULT_STAT, 10);
        }
    }

    /**
     * @dev Get the house for a given NFT
     */
    function getHouse(address collection, uint256 tokenId) public view returns (uint8) {
        CollectionConfig storage config = collections[collection];
        require(config.isRegistered, "Collection not registered");

        (, , , uint256 rarity) = getStats(collection, tokenId);
        
        // Map rarity to house using collection-specific thresholds
        if (rarity < config.rarityThresholds[0]) return 3; // Legendary
        if (rarity < config.rarityThresholds[1]) return 2; // Rare
        if (rarity < config.rarityThresholds[2]) return 1; // Uncommon
        return 0; // Common
    }

    /**
     * @dev Check if an NFT can join a clash
     */
    function canJoinClash(
        uint256 clashId,
        address collection,
        uint256 tokenId,
        uint8 currentHouse,
        uint8[] calldata existingHouses,
        bool isMixed
    ) external view returns (bool) {
        CollectionConfig storage config = collections[collection];
        require(config.isRegistered, "Collection not registered");
        
        // Get the NFT's house
        uint8 nftHouse = getHouse(collection, tokenId);
        
        // If clash is empty, any house is allowed
        if (existingHouses.length == 0) return true;
        
        // For non-mixed clashes, enforce same house
        if (!isMixed) {
            return nftHouse == currentHouse;
        }
        
        // For mixed clashes, check if collection allows mixed participation
        if (!config.allowMixed) return false;
        
        // Additional mixed clash validations can be added here
            return true;
    }

    /**
     * @dev Check if a collection supports mixed clashes
     */
    function supportsMixed(address collection) external view returns (bool) {
        return collections[collection].allowMixed;
    }
} 