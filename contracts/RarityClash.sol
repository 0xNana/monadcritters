// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CritterClashCore.sol";
import "./MonadCritter.sol";

/**
 * @title RarityClash
 * @dev Extension of CritterClashCore that implements rarity-specific clashes
 */
contract RarityClash is CritterClashCore {
    // Rarity-specific clash types
    mapping(MonadCritter.Rarity => mapping(ClashSize => bool)) public rarityClashEnabled;
    
    // Rarity-specific entry fees (direct value instead of multiplier)
    mapping(MonadCritter.Rarity => mapping(ClashSize => uint256)) public rarityEntryFees;
    
    // Rarity-specific reward multipliers (base reward * multiplier / 100)
    mapping(MonadCritter.Rarity => uint256) public rarityRewardMultiplier;
    
    // Events
    event RarityClashEnabled(MonadCritter.Rarity indexed rarity, ClashSize indexed clashSize, bool enabled);
    event RarityEntryFeeSet(MonadCritter.Rarity indexed rarity, ClashSize indexed clashSize, uint256 entryFee);
    event RarityRewardMultiplierSet(MonadCritter.Rarity indexed rarity, uint256 multiplier);
    event RarityClashJoined(uint256 indexed clashId, address indexed player, uint256 critterId, MonadCritter.Rarity rarity);

    constructor(
        address _critterContract,
        address _statsContract,
        address _entropyProvider,
        address _entropy
    ) CritterClashCore(
        _critterContract,
        _statsContract,
        _entropyProvider,
        _entropy
    ) {
        // Initialize with default values
        _initializeDefaultValues();
    }

    /**
     * @dev Initialize default values
     */
    function _initializeDefaultValues() internal {
        // Set default reward multipliers
        rarityRewardMultiplier[MonadCritter.Rarity.Common] = 100;     // 1x
        rarityRewardMultiplier[MonadCritter.Rarity.Uncommon] = 150;   // 1.5x
        rarityRewardMultiplier[MonadCritter.Rarity.Rare] = 250;       // 2.5x
        rarityRewardMultiplier[MonadCritter.Rarity.Legendary] = 500;  // 5x
        
        // Set default entry fees for Two player clash
        rarityEntryFees[MonadCritter.Rarity.Common][ClashSize.Two] = 0.1 ether;
        rarityEntryFees[MonadCritter.Rarity.Uncommon][ClashSize.Two] = 0.15 ether;
        rarityEntryFees[MonadCritter.Rarity.Rare][ClashSize.Two] = 0.25 ether;
        rarityEntryFees[MonadCritter.Rarity.Legendary][ClashSize.Two] = 0.5 ether;
        
        // Set default entry fees for Four player clash
        rarityEntryFees[MonadCritter.Rarity.Common][ClashSize.Four] = 0.1 ether;
        rarityEntryFees[MonadCritter.Rarity.Uncommon][ClashSize.Four] = 0.15 ether;
        rarityEntryFees[MonadCritter.Rarity.Rare][ClashSize.Four] = 0.25 ether;
        rarityEntryFees[MonadCritter.Rarity.Legendary][ClashSize.Four] = 0.5 ether;
    }

    /**
     * @dev Enable or disable a rarity-specific clash type
     */
    function setRarityClashEnabled(
        MonadCritter.Rarity rarity,
        ClashSize clashSize,
        bool enabled
    ) external onlyOwner {
        require(clashSize != ClashSize.None, "Invalid clash size");
        rarityClashEnabled[rarity][clashSize] = enabled;
        emit RarityClashEnabled(rarity, clashSize, enabled);
    }

    /**
     * @dev Set the entry fee for a specific rarity and clash size
     */
    function setRarityEntryFee(
        MonadCritter.Rarity rarity,
        ClashSize clashSize,
        uint256 entryFee
    ) external onlyOwner {
        require(clashSize != ClashSize.None, "Invalid clash size");
        rarityEntryFees[rarity][clashSize] = entryFee;
        emit RarityEntryFeeSet(rarity, clashSize, entryFee);
    }

    /**
     * @dev Set the reward multiplier for a specific rarity
     */
    function setRarityRewardMultiplier(
        MonadCritter.Rarity rarity,
        uint256 multiplier
    ) external onlyOwner {
        require(multiplier >= 100 && multiplier <= 1000, "Invalid multiplier");
        rarityRewardMultiplier[rarity] = multiplier;
        emit RarityRewardMultiplierSet(rarity, multiplier);
    }

    /**
     * @dev Get the rarity of a critter
     */
    function _getCritterRarity(uint256 critterId) internal view returns (MonadCritter.Rarity) {
        MonadCritter.Stats memory stats = critterContract.getStats(critterId);
        return stats.rarity;
    }

    /**
     * @dev Override to add rarity-specific clash creation
     */
    function _getOrCreateClash(ClashSize clashSize) internal override returns (uint256) {
        require(clashSize != ClashSize.None, "Invalid clash size");
        require(clashTypes[clashSize].isActive, "This clash type is not active");
        
        // First check the tracked active clash for this size
        uint256 activeClashId = currentActiveClash[clashSize];
        if (activeClashId > 0) {
            Clash storage clash = clashes[activeClashId];
            if (clash.state == ClashState.ACCEPTING_PLAYERS && 
                clash.playerCount < clashTypes[clashSize].maxPlayers) {
                return activeClashId;
            }
        }
        
        // Create new clash
        uint256 newClashId = currentClashId + 1;
        currentClashId = newClashId;
        
        // Set this as the active clash for this size
        currentActiveClash[clashSize] = newClashId;
        
        Clash storage newClash = clashes[newClashId];
        newClash.id = uint128(newClashId);
        newClash.clashSize = clashSize;
        newClash.state = ClashState.ACCEPTING_PLAYERS;
        newClash.playerCount = 0;
        newClash.startTime = 0;
        newClash.isProcessed = false;
        
        return newClashId;
    }

    /**
     * @dev Override joinClash to implement rarity-specific logic
     */
    function joinClash(
        ClashSize clashSize,
        uint256 critterId,
        uint256 boostCount,
        bool useInventory
    ) public payable override whenNotPaused nonReentrant {
        require(clashTypes[clashSize].isActive, "Clash type not active");
        
        // Get critter rarity
        MonadCritter.Rarity rarity = _getCritterRarity(critterId);
        
        // Check if this rarity type is enabled for this clash size
        require(rarityClashEnabled[rarity][clashSize], "Rarity clash not enabled");
        
        // Get configured entry fee for this rarity and clash size
        uint256 raritySpecificFee = rarityEntryFees[rarity][clashSize];
        require(raritySpecificFee > 0, "Entry fee not configured");
        
        // Store original entry fee
        uint256 originalEntryFee = clashTypes[clashSize].entryFee;
        
        // Temporarily set rarity-specific entry fee
        clashTypes[clashSize].entryFee = raritySpecificFee;
        
        // Call parent joinClash
        super.joinClash(clashSize, critterId, boostCount, useInventory);
        
        // Restore original entry fee
        clashTypes[clashSize].entryFee = originalEntryFee;
        
        // Emit rarity-specific event
        emit RarityClashJoined(currentClashId, msg.sender, critterId, rarity);
    }

    /**
     * @dev Override completeClash to implement rarity-specific rewards
     */
    function completeClash(uint256 clashId) external override whenNotPaused nonReentrant {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        Clash storage clash = clashes[clashId];
        
        // Get the rarity of the first critter (all critters in clash will be same rarity)
        MonadCritter.Rarity rarity = _getCritterRarity(clash.critterIds[0]);
        
        // Calculate reward multiplier
        uint256 rewardMultiplier = rarityRewardMultiplier[rarity];
        
        // Store original reward percentages
        uint256[] memory originalPercentages = clashTypes[clash.clashSize].rewardPercentages;
        
        // Apply rarity multiplier to reward percentages
        uint256[] memory adjustedPercentages = new uint256[](originalPercentages.length);
        for (uint256 i = 0; i < originalPercentages.length; i++) {
            adjustedPercentages[i] = (originalPercentages[i] * rewardMultiplier) / 100;
        }
        
        // Temporarily set adjusted percentages
        clashTypes[clash.clashSize].rewardPercentages = adjustedPercentages;
        
        // Call parent completeClash
        super.completeClash(clashId);
        
        // Restore original percentages
        clashTypes[clash.clashSize].rewardPercentages = originalPercentages;
    }

    /**
     * @dev Get all active rarity clashes for a specific rarity
     */
    function getActiveRarityClashes(MonadCritter.Rarity rarity) external view returns (uint256[] memory) {
        uint256[] memory activeClashes = new uint256[](currentClashId);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= currentClashId; i++) {
            Clash storage clash = clashes[i];
            if (clash.state == ClashState.ACCEPTING_PLAYERS && 
                clash.playerCount > 0 && 
                _getCritterRarity(clash.critterIds[0]) == rarity) {
                activeClashes[count++] = i;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeClashes[i];
        }
        
        return result;
    }

    /**
     * @dev Get the effective multipliers for a rarity, combining both score and reward effects
     */
    function getEffectiveMultipliers(MonadCritter.Rarity rarity) external view returns (
        uint256 scoreMultiplier,
        uint256 rewardMultiplier,
        uint256 effectiveTotalMultiplier
    ) {
        // Get base score multiplier from core scoring system
        uint256 baseScoreMultiplier;
        if (rarity == MonadCritter.Rarity.Common) baseScoreMultiplier = 100;      // 1.0x
        else if (rarity == MonadCritter.Rarity.Uncommon) baseScoreMultiplier = 110; // 1.1x
        else if (rarity == MonadCritter.Rarity.Rare) baseScoreMultiplier = 125;    // 1.25x
        else baseScoreMultiplier = 150;                                            // 1.5x Legendary

        // Get reward multiplier from this contract
        uint256 rewardMult = rarityRewardMultiplier[rarity];

        // Calculate effective total (multiplicative effect)
        uint256 effectiveTotal = (baseScoreMultiplier * rewardMult) / 100;

        return (baseScoreMultiplier, rewardMult, effectiveTotal);
    }

    /**
     * @dev Get detailed clash info including rarity-specific details
     */
    function getRarityClashInfo(uint256 clashId) external view returns (
        ClashSize clashSize,
        ClashState state,
        MonadCritter.Rarity rarity,
        uint256 entryFee,
        uint256 baseReward,
        uint256 adjustedReward,
        address[] memory players,
        uint256[] memory scores
    ) {
        Clash storage clash = clashes[clashId];
        require(clash.playerCount > 0, "Clash not found or empty");

        // Get rarity from first critter
        rarity = _getCritterRarity(clash.critterIds[0]);

        // Get entry fee for this rarity and clash size
        entryFee = rarityEntryFees[rarity][clash.clashSize];

        // Calculate base and adjusted rewards
        uint256 totalEntryFees = entryFee * clash.playerCount;
        baseReward = totalEntryFees - ((totalEntryFees * daoFeePercent) / 100);
        adjustedReward = (baseReward * rarityRewardMultiplier[rarity]) / 100;

        // Get players and scores
        players = new address[](clash.playerCount);
        scores = new uint256[](clash.playerCount);
        for (uint8 i = 0; i < clash.playerCount; i++) {
            players[i] = clash.sortedPlayers[i];
            scores[i] = clash.sortedScores[i];
        }

        return (
            clash.clashSize,
            clash.state,
            rarity,
            entryFee,
            baseReward,
            adjustedReward,
            players,
            scores
        );
    }
} 