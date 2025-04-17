// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IERC721Stats.sol";
import "./CritterClashCore.sol";
import "./HouseManager.sol";
import "./CritterClashStorage.sol"; 

/**
 * @title ExternalIntegrationManager
 * @dev Provides simplified interface for external NFT collections to integrate with CritterClash
 */
contract ExternalIntegrationManager is Ownable {
    CritterClashCore public immutable core;
    HouseManager public immutable houseManager;

    // Mapping to track if a collection is approved for integration
    mapping(address => bool) public approvedCollections;
    
    // Collection-specific settings
    struct CollectionSettings {
        string name;
        string website;
        address paymentReceiver;     // Address to receive collection's share of fees
        uint256 revenueSharePercent; // Collection's share of platform fees (0-100)
        mapping(CritterClashStorage.ClashSize => mapping(uint8 => uint256)) entryFees;  // Fix: Use fully qualified type
        uint256 boostFeePercent;    // Collection-specific boost fee percentage
        uint256 daoFeePercent;      // Collection-specific DAO fee percentage
        bool isConfigured;          // Whether fees have been configured
    }
    
    mapping(address => CollectionSettings) public collectionSettings;

    // Default revenue share percentage
    uint256 public defaultRevenueShare = 10; // 10% default share

    // Constants for house types
    uint8 public constant HOUSE_COMMON = 0;
    uint8 public constant HOUSE_UNCOMMON = 1;
    uint8 public constant HOUSE_RARE = 2;
    uint8 public constant HOUSE_LEGENDARY = 3;
    uint8 public constant HOUSE_MIXED = 255;

    // Default fee settings
    mapping(CritterClashStorage.ClashSize => mapping(uint8 => uint256)) public defaultEntryFees;
    uint256 public defaultBoostFeePercent = 10;
    uint256 public defaultDaoFeePercent = 5;
    
    // Events
    event CollectionIntegrated(address indexed collection, string name, string website);
    event CollectionSettingsUpdated(address indexed collection, address paymentReceiver);
    event RevenueShareUpdated(address indexed collection, uint256 sharePercent);
    event DefaultRevenueShareUpdated(uint256 newShare);
    event RevenueDistributed(address indexed collection, address receiver, uint256 amount);
    event PlatformFeeCollected(address indexed collection, uint256 amount);
    event CollectionFeesConfigured(
        address indexed collection,
        CritterClashStorage.ClashSize indexed clashSize,
        uint256[] houseEntryFees,
        uint256 boostFeePercent,
        uint256 daoFeePercent
    );

    constructor(address _core, address _houseManager) {
        require(_core != address(0), "Invalid core address");
        require(_houseManager != address(0), "Invalid house manager address");
        core = CritterClashCore(_core);
        houseManager = HouseManager(_houseManager);

        // Initialize default entry fees for each house type to 0.1 MON
        // Two player clashes
        defaultEntryFees[CritterClashStorage.ClashSize.Two][HOUSE_COMMON] = 0.1 ether;     // Common 2x2
        defaultEntryFees[CritterClashStorage.ClashSize.Two][HOUSE_UNCOMMON] = 0.1 ether;   // Uncommon 2x2
        defaultEntryFees[CritterClashStorage.ClashSize.Two][HOUSE_RARE] = 0.1 ether;       // Rare 2x2
        defaultEntryFees[CritterClashStorage.ClashSize.Two][HOUSE_LEGENDARY] = 0.1 ether;  // Legendary 2x2
        defaultEntryFees[CritterClashStorage.ClashSize.Two][HOUSE_MIXED] = 0.1 ether;      // Mixed 2x2
        
        // Four player clashes
        defaultEntryFees[CritterClashStorage.ClashSize.Four][HOUSE_COMMON] = 0.1 ether;    // Common 4x4
        defaultEntryFees[CritterClashStorage.ClashSize.Four][HOUSE_UNCOMMON] = 0.1 ether;  // Uncommon 4x4
        defaultEntryFees[CritterClashStorage.ClashSize.Four][HOUSE_RARE] = 0.1 ether;      // Rare 4x4
        defaultEntryFees[CritterClashStorage.ClashSize.Four][HOUSE_LEGENDARY] = 0.1 ether; // Legendary 4x4
        defaultEntryFees[CritterClashStorage.ClashSize.Four][HOUSE_MIXED] = 0.1 ether;     // Mixed 4x4
    }

    /**
     * @dev External collections can call this to integrate with CritterClash
     * @param name Collection name
     * @param website Collection website
     * @param statsImplementation Optional custom stats implementation
     * @param rarityThresholds Array of rarity thresholds [legendary, rare, uncommon]
     * @param paymentReceiver Address to receive collection's share of fees
     */
    function integrateCollection(
        string calldata name,
        string calldata website,
        address statsImplementation,
        uint256[] calldata rarityThresholds,
        address paymentReceiver
    ) external {
        require(!approvedCollections[msg.sender], "Already integrated");
        require(bytes(name).length > 0, "Name required");
        require(paymentReceiver != address(0), "Invalid payment receiver");
        
        // Register with HouseManager
        houseManager.registerCollection(
            msg.sender,
            rarityThresholds,
            true,
            statsImplementation
        );

        // Store collection settings with default values
        collectionSettings[msg.sender] = CollectionSettings({
            name: name,
            website: website,
            paymentReceiver: paymentReceiver,
            revenueSharePercent: defaultRevenueShare,
            entryFees: defaultEntryFees,
            boostFeePercent: defaultBoostFeePercent,
            daoFeePercent: defaultDaoFeePercent,
            isConfigured: false
        });

        approvedCollections[msg.sender] = true;
        emit CollectionIntegrated(msg.sender, name, website);
        emit CollectionSettingsUpdated(msg.sender, paymentReceiver);
        emit RevenueShareUpdated(msg.sender, defaultRevenueShare);
    }

    /**
     * @dev Admin function to set revenue share for a collection
     */
    function setCollectionRevenueShare(address collection, uint256 sharePercent) external onlyOwner {
        require(approvedCollections[collection], "Collection not integrated");
        require(sharePercent <= 100, "Invalid share percentage");
        
        collectionSettings[collection].revenueSharePercent = sharePercent;
        emit RevenueShareUpdated(collection, sharePercent);
    }

    /**
     * @dev Admin function to set default revenue share for new integrations
     */
    function setDefaultRevenueShare(uint256 sharePercent) external onlyOwner {
        require(sharePercent <= 100, "Invalid share percentage");
        defaultRevenueShare = sharePercent;
        emit DefaultRevenueShareUpdated(sharePercent);
    }

    /**
     * @dev Update collection payment receiver
     */
    function updatePaymentReceiver(address paymentReceiver) external {
        require(approvedCollections[msg.sender], "Collection not integrated");
        require(paymentReceiver != address(0), "Invalid payment receiver");

        CollectionSettings storage settings = collectionSettings[msg.sender];
        settings.paymentReceiver = paymentReceiver;
        emit CollectionSettingsUpdated(msg.sender, paymentReceiver);
    }

    /**
     * @dev Simplified interface for external collections to start a clash
     */
    function startClash(
        uint8 clashSize,
        bool mixedAllowed,
        uint256 tokenId
    ) external returns (uint256 clashId) {
        require(approvedCollections[msg.sender], "Collection not integrated");
        require(clashSize == 2 || clashSize == 4, "Invalid clash size");
        
        return core.startClash(
            CritterClashStorage.ClashSize(clashSize),
            mixedAllowed,
            msg.sender,
            tokenId
        );
    }

    /**
     * @dev Simplified interface for external collections to join a clash
     */
    function joinClash(
        uint256 clashId,
        uint256 tokenId,
        uint256 boostCount
    ) external payable {
        require(approvedCollections[msg.sender], "Collection not integrated");
        
        core.joinClash{value: msg.value}(
            clashId,
            msg.sender,
            tokenId,
            boostCount
        );
    }

    /**
     * @dev View function to get clash details
     */
    function getClashInfo(uint256 clashId) external view returns (
        uint8 clashSize,
        uint8 playerCount,
        address[] memory nftContracts,
        uint256[] memory tokenIds,
        uint256[] memory scores,
        bool isComplete
    ) {
        return core.getClashInfo(clashId);
    }

    /**
     * @dev View function to get collection stats
     */
    function getCollectionStats(address collection) external view returns (
        uint256 totalClashes,
        uint256 totalWinnings,
        uint256 uniquePlayers
    ) {
        return core.getCollectionStats(collection);
    }

    /**
     * @dev Get collection settings including revenue share
     */
    function getCollectionSettings(address collection) external view returns (
        string memory name,
        string memory website,
        address paymentReceiver,
        uint256 revenueSharePercent,
        bool isApproved
    ) {
        CollectionSettings memory settings = collectionSettings[collection];
        return (
            settings.name,
            settings.website,
            settings.paymentReceiver,
            settings.revenueSharePercent,
            approvedCollections[collection]
        );
    }

    /**
     * @dev Distribute revenue to collections
     * Can only be called by core contract
     */
    function distributeRevenue(address collection) external payable {
        require(msg.sender == address(core), "Only core can distribute");
        require(approvedCollections[collection], "Collection not integrated");

        CollectionSettings storage settings = collectionSettings[collection];
        
        // Calculate platform fee first (10% of total)
        uint256 platformFee = (msg.value * defaultRevenueShare) / 100;
        
        // Remaining amount goes to collection
        uint256 collectionShare = msg.value - platformFee;
        
        // Add platform fee to fundAccounting
        core.fundAccounting().platformFees += platformFee;
        emit PlatformFeeCollected(collection, platformFee);
        
        // Send remaining to collection
        if (collectionShare > 0) {
            (bool success, ) = settings.paymentReceiver.call{value: collectionShare}("");
            require(success, "Collection revenue distribution failed");
            emit RevenueDistributed(collection, settings.paymentReceiver, collectionShare);
        }
    }

    /**
     * @dev Collections can configure their own fees per house type and clash size
     */
    function configureCollectionFees(
        CritterClashStorage.ClashSize clashSize,
        uint256[] calldata houseEntryFees,  // Array of 5 fees [Common, Uncommon, Rare, Legendary, Mixed]
        uint256 boostFeePercent,
        uint256 daoFeePercent
    ) external {
        require(approvedCollections[msg.sender], "Collection not integrated");
        require(houseEntryFees.length == 5, "Must provide 5 house fees");
        require(boostFeePercent <= 30, "Boost fee too high"); // Max 30%
        require(daoFeePercent <= 10, "DAO fee too high");     // Max 10%
        
        CollectionSettings storage settings = collectionSettings[msg.sender];
        
        // Set entry fees for each house type
        settings.entryFees[clashSize][HOUSE_COMMON] = houseEntryFees[0];
        settings.entryFees[clashSize][HOUSE_UNCOMMON] = houseEntryFees[1];
        settings.entryFees[clashSize][HOUSE_RARE] = houseEntryFees[2];
        settings.entryFees[clashSize][HOUSE_LEGENDARY] = houseEntryFees[3];
        settings.entryFees[clashSize][HOUSE_MIXED] = houseEntryFees[4];
        
        settings.boostFeePercent = boostFeePercent;
        settings.daoFeePercent = daoFeePercent;
        settings.isConfigured = true;
        
        emit CollectionFeesConfigured(
            msg.sender,
            clashSize,
            houseEntryFees,
            boostFeePercent,
            daoFeePercent
        );
    }

    /**
     * @dev Get collection's fee configuration for a specific clash size
     */
    function getCollectionFees(address collection, CritterClashStorage.ClashSize clashSize) external view returns (
        uint256[] memory houseEntryFees,
        uint256 boostFeePercent,
        uint256 daoFeePercent
    ) {
        CollectionSettings storage settings = collectionSettings[collection];
        houseEntryFees = new uint256[](5); // [Common, Uncommon, Rare, Legendary, Mixed]
        
        // Get fees for each house type including mixed
        houseEntryFees[0] = settings.isConfigured ? settings.entryFees[clashSize][HOUSE_COMMON] : defaultEntryFees[clashSize][HOUSE_COMMON];
        houseEntryFees[1] = settings.isConfigured ? settings.entryFees[clashSize][HOUSE_UNCOMMON] : defaultEntryFees[clashSize][HOUSE_UNCOMMON];
        houseEntryFees[2] = settings.isConfigured ? settings.entryFees[clashSize][HOUSE_RARE] : defaultEntryFees[clashSize][HOUSE_RARE];
        houseEntryFees[3] = settings.isConfigured ? settings.entryFees[clashSize][HOUSE_LEGENDARY] : defaultEntryFees[clashSize][HOUSE_LEGENDARY];
        houseEntryFees[4] = settings.isConfigured ? settings.entryFees[clashSize][HOUSE_MIXED] : defaultEntryFees[clashSize][HOUSE_MIXED];
        
        return (
            houseEntryFees,
            settings.isConfigured ? settings.boostFeePercent : defaultBoostFeePercent,
            settings.isConfigured ? settings.daoFeePercent : defaultDaoFeePercent
        );
    }

    /**
     * @dev Get entry fee for specific clash size and house type
     */
    function getEntryFee(address collection, CritterClashStorage.ClashSize clashSize, uint8 houseType) public view returns (uint256) {
        require(houseType == HOUSE_COMMON || 
                houseType == HOUSE_UNCOMMON || 
                houseType == HOUSE_RARE || 
                houseType == HOUSE_LEGENDARY || 
                houseType == HOUSE_MIXED, "Invalid house type");
                
        CollectionSettings storage settings = collectionSettings[collection];
        return settings.isConfigured ? 
            settings.entryFees[clashSize][houseType] : 
            defaultEntryFees[clashSize][houseType];
    }

    /**
     * @dev Admin can set default fees for new collections
     */
    function setDefaultFees(
        CritterClashStorage.ClashSize clashSize,
        uint256[] calldata houseEntryFees,  // Array of 5 fees [Common, Uncommon, Rare, Legendary, Mixed]
        uint256 _boostFeePercent,
        uint256 _daoFeePercent
    ) external onlyOwner {
        require(houseEntryFees.length == 5, "Must provide 5 house fees");
        require(_boostFeePercent <= 30, "Boost fee too high");
        require(_daoFeePercent <= 10, "DAO fee too high");
        
        defaultEntryFees[clashSize][HOUSE_COMMON] = houseEntryFees[0];
        defaultEntryFees[clashSize][HOUSE_UNCOMMON] = houseEntryFees[1];
        defaultEntryFees[clashSize][HOUSE_RARE] = houseEntryFees[2];
        defaultEntryFees[clashSize][HOUSE_LEGENDARY] = houseEntryFees[3];
        defaultEntryFees[clashSize][HOUSE_MIXED] = houseEntryFees[4];
        
        defaultBoostFeePercent = _boostFeePercent;
        defaultDaoFeePercent = _daoFeePercent;
    }

    receive() external payable {}
}