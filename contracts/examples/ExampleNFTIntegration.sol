// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../interfaces/IERC721Stats.sol";
import "../ExternalIntegrationManager.sol";

/**
 * @title ExampleNFTIntegration
 * @dev Example of how to integrate an NFT collection with CritterClash
 */
contract ExampleNFTIntegration is ERC721, IERC721Stats {
    ExternalIntegrationManager public immutable integrationManager;
    
    // Example: Store token stats
    struct TokenStats {
        uint256 stamina;
        uint256 speed;
        uint256 luck;
        uint256 rarity;
    }
    
    mapping(uint256 => TokenStats) public tokenStats;
    
    constructor(
        address _integrationManager,
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        integrationManager = ExternalIntegrationManager(_integrationManager);
    }
    
    /**
     * @dev Implement IERC721Stats interface
     */
    function getStats(uint256 tokenId) external view override returns (
        uint256 stamina,
        uint256 speed,
        uint256 luck,
        uint256 rarity
    ) {
        require(_exists(tokenId), "Token does not exist");
        TokenStats memory stats = tokenStats[tokenId];
        return (stats.stamina, stats.speed, stats.luck, stats.rarity);
    }
    
    function supportsStatsInterface() external pure override returns (bool) {
        return true;
    }
    
    /**
     * @dev Example: Integrate collection with CritterClash
     */
    function integrateWithCritterClash(
        string calldata collectionName,
        string calldata website,
        address statsImpl,
        uint256[] calldata rarityThresholds,
        address paymentReceiver,
        uint256 revenueSharePercent
    ) external {
        integrationManager.integrateCollection(
            collectionName,
            website,
            statsImpl,
            rarityThresholds,
            paymentReceiver,
            revenueSharePercent
        );
    }
    
    /**
     * @dev Example: Start a clash
     */
    function startClash(
        uint8 clashSize,
        bool mixedAllowed,
        uint256 tokenId
    ) external returns (uint256 clashId) {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        return integrationManager.startClash(clashSize, mixedAllowed, tokenId);
    }
    
    /**
     * @dev Example: Join a clash
     */
    function joinClash(
        uint256 clashId,
        uint256 tokenId,
        uint256 boostCount
    ) external payable {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        integrationManager.joinClash{value: msg.value}(clashId, tokenId, boostCount);
    }
    
    /**
     * @dev Example: Set token stats (in practice, this might be done during minting)
     */
    function setTokenStats(
        uint256 tokenId,
        uint256 stamina,
        uint256 speed,
        uint256 luck,
        uint256 rarity
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        
        tokenStats[tokenId] = TokenStats({
            stamina: stamina,
            speed: speed,
            luck: luck,
            rarity: rarity
        });
    }
    
    /**
     * @dev Example: View clash info
     */
    function viewClashInfo(uint256 clashId) external view returns (
        uint8 clashSize,
        uint8 playerCount,
        address[] memory nftContracts,
        uint256[] memory tokenIds,
        uint256[] memory scores,
        bool isComplete
    ) {
        return integrationManager.getClashInfo(clashId);
    }
    
    /**
     * @dev Example: View collection stats
     */
    function viewCollectionStats() external view returns (
        uint256 totalClashes,
        uint256 totalWinnings,
        uint256 uniquePlayers
    ) {
        return integrationManager.getCollectionStats(address(this));
    }
} 