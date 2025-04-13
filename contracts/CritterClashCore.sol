// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "./MonadCritter.sol";
import "./CritterClashStats.sol";
import "./CritterClashStorage.sol";

/**
 * @title CritterClashCore
 * @dev Main contract for CritterClash game logic
 */
contract CritterClashCore is Ownable, Pausable, ReentrancyGuard, IEntropyConsumer, CritterClashStorage {
    MonadCritter public immutable critterContract;
    CritterClashStats public statsContract;
    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    
    // Add new state variable for tracking entropy requests
    mapping(uint256 => uint256) public clashPendingRandomness;
    
    // Convert constants to state variables
    uint256 public clashDuration = 60; // Default 60 seconds
    
    // Events
    event ClashUpdate(
        uint256 indexed clashId,
        CritterClashStorage.ClashSize indexed clashSize,
        CritterClashStorage.ClashState state,
        address player,
        uint256 critterId,
        uint256 timestamp
    );

    event ClashCompleted(
        uint256 indexed clashId,
        address[] players,
        uint256[] scores,
        uint256[] rewards,
        uint256[] boostCounts
    );

    event ClashJoined(uint256 indexed clashId, address indexed player, uint256 critterId, uint256 boostCount, uint256 fee);
    event ClashStarted(uint256 indexed clashId, address[] players, uint256[] critterIds);
    event EntryFeeUpdated(CritterClashStorage.ClashSize indexed clashSize, uint256 newFee);
    event ClashTypeUpdated(CritterClashStorage.ClashSize indexed clashSize, bool isActive);
    event BoostsUsed(address indexed player, uint256 amount);
    event BoostsPurchased(address indexed player, uint256 amount, uint256 cost, address tokenAddress);
    event StatsContractSet(address statsContract);
    event EntropyTimeout(uint256 indexed clashId);
    event DAOFeeWithdrawn(uint256 amount);
    event BoostFeesWithdrawn(uint256 amount);
    event DAOFeeUpdated(uint256 oldFee, uint256 newFee);
    event PowerUpFeeUpdated(uint256 oldFee, uint256 newFee);
    event EntropyFeeDeposited(uint256 amount);
    event EntropyFeeWithdrawn(uint256 amount);
    event InsufficientEntropyFee(uint256 required, uint256 available);
    event EntropyRequested(uint256 indexed clashId, uint256 requestId, uint256 fee);
    event EntropyRequestFailed(uint256 indexed clashId, uint256 fee);
    
    function setRewardPercentages(CritterClashStorage.ClashSize clashSize, uint256[] memory percentages) public onlyOwner {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        require(percentages.length == clashTypes[clashSize].numWinners, "Invalid number of percentages");
        
        uint256 total = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            total += percentages[i];
        }
        require(total == 100, "Percentages must sum to 100");
        
        delete clashTypes[clashSize].rewardPercentages;
        for (uint256 i = 0; i < percentages.length; i++) {
            clashTypes[clashSize].rewardPercentages.push(percentages[i]);
        }
    }

    constructor(
        address _critterContract,
        address _statsContract,
        address _entropyProvider,
        address _entropy
    ) {
        require(_critterContract != address(0), "Invalid critter contract");
        require(_statsContract != address(0), "Invalid stats contract");
        require(_entropyProvider != address(0), "Invalid entropy provider");
        require(_entropy != address(0), "Invalid entropy contract");
        
        critterContract = MonadCritter(_critterContract);
        statsContract = CritterClashStats(_statsContract);
        entropyProvider = _entropyProvider;
        entropy = IEntropy(_entropy);
        
        // Initialize clash types with default values
        clashTypes[CritterClashStorage.ClashSize.Two] = CritterClashStorage.ClashType({
            entryFee: 0.1 ether,
            maxPlayers: 2,
            numWinners: 1,
            isActive: true,
            rewardPercentages: new uint256[](0)
        });
        
        clashTypes[CritterClashStorage.ClashSize.Four] = CritterClashStorage.ClashType({
            entryFee: 0.1 ether,
            maxPlayers: 4,
            numWinners: 2,
            isActive: true,
            rewardPercentages: new uint256[](0)
        });
        
        // Set default reward percentages
        uint256[] memory twoPlayerRewards = new uint256[](1);
        twoPlayerRewards[0] = 100;
        setRewardPercentages(CritterClashStorage.ClashSize.Two, twoPlayerRewards);
        
        uint256[] memory fourPlayerRewards = new uint256[](2);
        fourPlayerRewards[0] = 70;
        fourPlayerRewards[1] = 30;
        setRewardPercentages(CritterClashStorage.ClashSize.Four, fourPlayerRewards);
        
        // Set default clash duration to 5 minutes
        clashDuration = 300;
        
        // Initialize power-up fee percent to 10%
        powerUpFeePercent = 10;
        
        // Initialize game settings
        _initializeClashTypes();
        _initialize();
        
        // Initialize entropy storage
        entropyStorage.nextSequenceNumber = 0;
        entropyStorage.entropyFeeBalance = 0;
        
        emit StatsContractSet(_statsContract);
    }
    
    /**
     * @dev Sets the Stats contract address. Can only be called once by owner.
     * This needs to be set after Stats contract is deployed since Stats needs Core's address.
     */
    function setStatsContract(address _stats) external onlyOwner {
        require(address(statsContract) == address(0), "Stats already set");
        require(_stats != address(0), "Invalid stats address");
        statsContract = CritterClashStats(_stats);
        emit StatsContractSet(_stats);
    }
    
    function _initialize() internal virtual {
        // Initialize fees
        daoFeePercent = 5; // 5% DAO fee
        powerUpFeePercent = 10; // 10% boost fee
    }
    
    function _initializeClashTypes() private {
        // Two player clash - Winner takes all
        uint256[] memory twoPlayerRewards = new uint256[](1);
        twoPlayerRewards[0] = 100;
        clashTypes[CritterClashStorage.ClashSize.Two] = CritterClashStorage.ClashType({
            maxPlayers: 2,
            numWinners: 1,
            entryFee: 0.1 ether,
            rewardPercentages: twoPlayerRewards,
            isActive: true
        });
        
        // Four player clash - Split 70/30
        uint256[] memory fourPlayerRewards = new uint256[](2);
        fourPlayerRewards[0] = 70;
        fourPlayerRewards[1] = 30;
        clashTypes[CritterClashStorage.ClashSize.Four] = CritterClashStorage.ClashType({
            maxPlayers: 4,
            numWinners: 2,
            entryFee: 0.1 ether,
            rewardPercentages: fourPlayerRewards,
            isActive: true
        });
    }
    
    function joinClash(
        CritterClashStorage.ClashSize clashSize,
        uint256 critterId,
        uint256 boostCount,
        bool useInventory
    ) public payable whenNotPaused nonReentrant {
        require(clashTypes[clashSize].isActive, "Clash type not active");
        
        // Get or create clash
        uint256 clashId = _getOrCreateClash(clashSize);
        CritterClashStorage.Clash storage clash = clashes[clashId];
        
        // Verify player can join
        require(clash.state == CritterClashStorage.ClashState.ACCEPTING_PLAYERS, "Clash not accepting players");
        require(!_isPlayerInClash(clash, msg.sender), "Already in clash");
        require(clash.playerCount < clashTypes[clashSize].maxPlayers, "Clash is full");
        
        // Verify critter ownership
        address critterOwner = critterContract.ownerOf(critterId);
        require(critterOwner == msg.sender, "Not owner of critter");
        
        // Handle boost inventory and payment - only for entry fee and boosts
        uint256 totalFee = handlePaymentAndBoosts(clashSize, boostCount, useInventory);
        require(msg.value >= totalFee, "Insufficient payment");
        
        // OPTIMIZATION: Use the playerCount directly as the index for the mappings
        uint8 playerPosition = uint8(clash.playerCount);
        clash.players[playerPosition] = msg.sender;
        clash.critterIds[playerPosition] = critterId;
        clash.boostCount[msg.sender] = boostCount;
        
        // Initialize scores to 0 when player joins
        clash.sortedPlayers[playerPosition] = msg.sender;
        clash.sortedCritterIds[playerPosition] = critterId;
        clash.sortedScores[playerPosition] = 0;
        
        clash.playerCount++;
        
        // OPTIMIZATION: Use the new helper function to store clash ID for user
        _addUserClashId(msg.sender, clashId);

        // Emit join event
        emit ClashJoined(clashId, msg.sender, critterId, boostCount, totalFee);
        emit ClashUpdate(clashId, clashSize, clash.state, msg.sender, critterId, block.timestamp);

        // If clash is full, calculate initial scores and request entropy
        uint256 maxPlayers = clashTypes[clashSize].maxPlayers;
        if (clash.playerCount == maxPlayers) {
            // Set clash state before calculating scores to prevent race conditions
            clash.state = CritterClashStorage.ClashState.CLASHING;
            clash.startTime = uint64(block.timestamp);
            
            // Calculate and store initial scores
            for (uint8 i = 0; i < uint8(maxPlayers); i++) {
                address player = clash.players[i];
                clash.sortedPlayers[i] = player;
                clash.sortedCritterIds[i] = clash.critterIds[i];
                clash.sortedScores[i] = _calculateCritterScore(clash.critterIds[i], clash.boostCount[player]);
            }
            
            // Sort scores and players after initial calculation
            _sortClashArrays(clash);
            
            // Request entropy
            uint256 entropyFee = entropy.getFee(entropyProvider);
            require(entropyStorage.entropyFeeBalance >= entropyFee, "Insufficient entropy fee balance");
            
            // Request entropy once and record it
            _requestSingleEntropyForClash(clashId, uint8(maxPlayers));
            
            // Gather player addresses and critter IDs for the event
            address[] memory playerAddresses = new address[](maxPlayers);
            uint256[] memory clashCritterIds = new uint256[](maxPlayers);
            
            for (uint8 i = 0; i < uint8(maxPlayers); i++) {
                playerAddresses[i] = clash.sortedPlayers[i];
                clashCritterIds[i] = clash.sortedCritterIds[i];
            }
            
            emit ClashStarted(clashId, playerAddresses, clashCritterIds);
            emit ClashUpdate(clashId, clashSize, clash.state, address(0), 0, block.timestamp);
        }
    }
    
    function _isPlayerInClash(CritterClashStorage.Clash storage clash, address player) internal view returns (bool) {
        // OPTIMIZATION: Check if the player is in the clash using player count
        for (uint8 i = 0; i < uint8(clash.playerCount); i++) {
            if (clash.players[i] == player) return true;
        }
        return false;
    }
    
    // OPTIMIZATION: Update entropy callback to use optimized storage
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal override {
        require(provider == entropyProvider, "Invalid entropy provider");
        require(entropyStorage.randomRequests[sequenceNumber] != bytes32(0), "Invalid sequence number");
        
        // Find the clash this callback is for using the mapping
        uint256 clashId = entropyStorage.requestToClash[sequenceNumber];
        require(clashId > 0, "Clash not found");
        
        // Get the clash and verify its state
        CritterClashStorage.Clash storage clash = clashes[clashId];
        require(clash.state == CritterClashStorage.ClashState.CLASHING, "Clash not in progress");

        // Cache player count and entropy source
        uint8 playerCount = uint8(clash.playerCount);
        bytes32 entropySource = randomNumber;
        
        // Create temporary arrays to store scores and maintain relationships
        uint256[] memory tempScores = new uint256[](playerCount);
        address[] memory tempPlayers = new address[](playerCount);
        uint256[] memory tempCritterIds = new uint256[](playerCount);
        
        // Process all players in original order first
        for (uint8 i = 0; i < playerCount; i++) {
            // Use original player order for entropy calculation
            address player = clash.players[i];
            uint256 critterId = clash.critterIds[i];
            
            // Store original order
            tempPlayers[i] = player;
            tempCritterIds[i] = critterId;
            
            // Calculate base score and apply variance
            uint256 baseScore = _calculateCritterScore(critterId, clash.boostCount[player]);
            bytes32 playerSeed = keccak256(abi.encodePacked(entropySource, player));
            uint256 entropyVariance = 75 + (uint256(playerSeed) % 51);
            tempScores[i] = (baseScore * entropyVariance) / 100;
        }
        
        // Sort all arrays together based on scores
        for (uint8 i = 0; i < playerCount - 1; i++) {
            for (uint8 j = 0; j < playerCount - i - 1; j++) {
                if (tempScores[j] < tempScores[j + 1]) {
                    // Swap scores
                    uint256 tempScore = tempScores[j];
                    tempScores[j] = tempScores[j + 1];
                    tempScores[j + 1] = tempScore;
                    
                    // Swap players
                    address tempPlayer = tempPlayers[j];
                    tempPlayers[j] = tempPlayers[j + 1];
                    tempPlayers[j + 1] = tempPlayer;
                    
                    // Swap critter IDs
                    uint256 tempCritterId = tempCritterIds[j];
                    tempCritterIds[j] = tempCritterIds[j + 1];
                    tempCritterIds[j + 1] = tempCritterId;
                }
            }
        }
        
        // Update storage with sorted results
        for (uint8 i = 0; i < playerCount; i++) {
            clash.sortedScores[i] = tempScores[i];
            clash.sortedPlayers[i] = tempPlayers[i];
            clash.sortedCritterIds[i] = tempCritterIds[i];
        }
        
        // Reset all randomness tracking
        delete entropyStorage.randomRequests[sequenceNumber];
        delete entropyStorage.requestToClash[sequenceNumber];
        delete entropyStorage.clashSequenceNumber[clashId];
        clashPendingRandomness[clashId] = 0;
    }
    
    // OPTIMIZATION: Updated sort function to properly maintain player-score-critterId relationships
    function _sortClashArrays(CritterClashStorage.Clash storage clash) internal {
        // Create temporary arrays to store sorted data
        address[] memory tempPlayers = new address[](clash.playerCount);
        uint256[] memory tempCritterIds = new uint256[](clash.playerCount);
        uint256[] memory tempScores = new uint256[](clash.playerCount);
        
        // Copy data to temp arrays - use sorted arrays if they exist
        bool useSortedArrays = clash.state != CritterClashStorage.ClashState.ACCEPTING_PLAYERS;
        
        for (uint256 i = 0; i < clash.playerCount; i++) {
            if (useSortedArrays) {
                tempPlayers[i] = clash.sortedPlayers[uint8(i)];
                tempCritterIds[i] = clash.sortedCritterIds[uint8(i)];
                tempScores[i] = clash.sortedScores[uint8(i)];
            } else {
                tempPlayers[i] = clash.players[uint8(i)];
                tempCritterIds[i] = clash.critterIds[uint8(i)];
                tempScores[i] = clash.sortedScores[uint8(i)];
            }
        }
        
        // Bubble sort all arrays together based on scores (descending order)
        for (uint256 i = 0; i < clash.playerCount - 1; i++) {
            for (uint256 j = 0; j < clash.playerCount - i - 1; j++) {
                if (tempScores[j] < tempScores[j + 1]) {
                    // Swap scores
                    uint256 tempScore = tempScores[j];
                    tempScores[j] = tempScores[j + 1];
                    tempScores[j + 1] = tempScore;
                    
                    // Swap players
                    address tempPlayer = tempPlayers[j];
                    tempPlayers[j] = tempPlayers[j + 1];
                    tempPlayers[j + 1] = tempPlayer;
                    
                    // Swap critterIds
                    uint256 tempCritterId = tempCritterIds[j];
                    tempCritterIds[j] = tempCritterIds[j + 1];
                    tempCritterIds[j + 1] = tempCritterId;
                }
            }
        }
        
        // Copy sorted arrays back to storage
        for (uint256 i = 0; i < clash.playerCount; i++) {
            clash.sortedPlayers[uint8(i)] = tempPlayers[i];
            clash.sortedCritterIds[uint8(i)] = tempCritterIds[i];
            clash.sortedScores[uint8(i)] = tempScores[i];
        }
    }
    
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }
    
    function _getOrCreateClash(CritterClashStorage.ClashSize clashSize) internal returns (uint256) {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        require(clashTypes[clashSize].isActive, "This clash type is not active");
        
        // First check the tracked active clash for this size
        uint256 activeClashId = currentActiveClash[clashSize];
        if (activeClashId > 0) {
            CritterClashStorage.Clash storage clash = clashes[activeClashId];
            if (clash.state == CritterClashStorage.ClashState.ACCEPTING_PLAYERS && 
                clash.playerCount < clashTypes[clashSize].maxPlayers) {
                return activeClashId;
            }
        }
        
        // If the tracked clash is not valid, scan all clashes to find a suitable one
        // (This is a fallback mechanism that should rarely be needed)
        for (uint256 i = 1; i <= currentClashId; i++) {
            // Skip the already checked active clash
            if (i == activeClashId) continue;
            
            CritterClashStorage.Clash storage existingClash = clashes[i];
            if (existingClash.clashSize == clashSize && 
                existingClash.state == CritterClashStorage.ClashState.ACCEPTING_PLAYERS &&
                existingClash.playerCount < clashTypes[clashSize].maxPlayers) {
                // Found an existing clash that can be joined - update the current active clash
                currentActiveClash[clashSize] = i;
                return i;
            }
        }
        
        // No suitable existing clash found, create new one
        uint256 newClashId = currentClashId + 1;
        currentClashId = newClashId;
        
        // Set this as the active clash for this size
        currentActiveClash[clashSize] = newClashId;
        
        CritterClashStorage.Clash storage newClash = clashes[newClashId];
        newClash.id = uint128(newClashId);
        newClash.clashSize = clashSize;
        newClash.state = CritterClashStorage.ClashState.ACCEPTING_PLAYERS;
        newClash.playerCount = 0;
        newClash.startTime = 0;
        newClash.isProcessed = false;
        
        // Initialize all arrays to zero values
        for (uint8 i = 0; i < clashTypes[clashSize].maxPlayers; i++) {
            newClash.players[i] = address(0);
            newClash.critterIds[i] = 0;
            newClash.sortedPlayers[i] = address(0);
            newClash.sortedCritterIds[i] = 0;
            newClash.sortedScores[i] = 0;
        }
        
        return currentClashId;
    }
    
    function _addUserClashId(address user, uint256 clashId) internal override {
        uint256 index = userClashCount[user];
        userClashIdsMap[user][index] = clashId;
        userClashCount[user]++;
    }
    
    // Set the entry fee for a clash size
    function setEntryFee(CritterClashStorage.ClashSize clashSize, uint256 entryFeeInEth) external onlyOwner {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        clashTypes[clashSize].entryFee = uint96(entryFeeInEth);
        emit EntryFeeUpdated(clashSize, clashTypes[clashSize].entryFee);
    }

    function setClashTypeActive(CritterClashStorage.ClashSize clashSize, bool isActive) external onlyOwner {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        clashTypes[clashSize].isActive = isActive;
        emit ClashTypeUpdated(clashSize, isActive);
    }

    function setClashType(
        CritterClashStorage.ClashSize clashSize,
        uint256 maxPlayers,
        uint256 numWinners,
        uint256 entryFeeInEth,
        uint256[] calldata rewardPercentages
    ) external onlyOwner {
        require(maxPlayers > 1 && maxPlayers <= 10, "Invalid max players (2-10)");
        require(numWinners > 0 && numWinners <= maxPlayers, "Invalid number of winners");
        require(rewardPercentages.length == numWinners, "Invalid reward percentages length");
        
        // Validate reward percentages sum to 100
        uint256 totalPercentage;
        for (uint256 i = 0; i < rewardPercentages.length; i++) {
            totalPercentage += rewardPercentages[i];
        }
        require(totalPercentage == 100, "Reward percentages must sum to 100");

        clashTypes[clashSize] = CritterClashStorage.ClashType({
            maxPlayers: uint96(maxPlayers),
            numWinners: uint96(numWinners),
            entryFee: uint96(entryFeeInEth * 1 ether),
            isActive: false, // Start inactive for safety
            rewardPercentages: rewardPercentages
        });

        emit ClashTypeUpdated(clashSize, false);
        emit EntryFeeUpdated(clashSize, entryFeeInEth * 1 ether);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // Override payment functions with direct implementations instead of using super
    function withdrawDAOFee() external onlyOwner nonReentrant {
        uint256 amount = fundAccounting.daoFees;
        require(amount > 0, "No DAO fees to withdraw");
        fundAccounting.daoFees = 0;
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "DAO fee withdrawal failed");
        emit DAOFeeWithdrawn(amount);
    }

    function withdrawBoostFees() external onlyOwner nonReentrant {
        uint256 amount = fundAccounting.boostFees;
        require(amount > 0, "No boost fees to withdraw");
        fundAccounting.boostFees = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Boost fee withdrawal failed");
        emit BoostFeesWithdrawn(amount);
    }

    function setDAOFeePercent(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 20, "Fee too high"); // Max 20%
        uint256 oldFee = daoFeePercent;
        daoFeePercent = uint128(newFeePercent);
        emit DAOFeeUpdated(oldFee, newFeePercent);
    }

    function setPowerUpFeePercent(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 50, "Fee too high"); // Max 50%
        uint256 oldFee = powerUpFeePercent;
        powerUpFeePercent = uint128(newFeePercent);
        emit PowerUpFeeUpdated(oldFee, newFeePercent);
    }

    function withdrawEmergencyFund() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        uint256 reservedFunds = fundAccounting.prizePool + entropyStorage.entropyFeeBalance;
        require(balance > reservedFunds, "No excess funds available");
        
        uint256 emergencyFunds = balance - reservedFunds;
        (bool success, ) = msg.sender.call{value: emergencyFunds}("");
        require(success, "Emergency fund withdrawal failed");
    }

    function getRequiredEntropyFee(uint256 playerCount) public view returns (uint256) {
        return entropy.getFee(entropyProvider) * playerCount;
    }

    // Essential view functions
    function getClashTypeInfo(CritterClashStorage.ClashSize clashSize) external view returns (
        uint256 entryFee,
        uint256 boostFeePercent,
        uint256[] memory rewardPercentages,
        uint256 maxPlayers,
        uint256 numWinners,
        bool isActive
    ) {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        CritterClashStorage.ClashType storage clashType = clashTypes[clashSize];
        
        // Create a new array and copy the reward percentages
        uint256[] memory percentages = new uint256[](clashType.rewardPercentages.length);
        for (uint256 i = 0; i < clashType.rewardPercentages.length; i++) {
            percentages[i] = clashType.rewardPercentages[i];
        }
        
        return (
            clashType.entryFee,
            powerUpFeePercent,
            percentages,
            clashType.maxPlayers,
            clashType.numWinners,
            clashType.isActive
        );
    }

    // View functions for CritterClashView
    function getClashPlayer(uint256 clashId, uint256 index) external view returns (address) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        require(index < clashes[clashId].playerCount, "Invalid player index");
        return clashes[clashId].players[uint8(index)];
    }

    function getClashCritterId(uint256 clashId, uint256 index) external view returns (uint256) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        require(index < clashes[clashId].playerCount, "Invalid player index");
        return clashes[clashId].critterIds[uint8(index)];
    }

    function getClashBoost(uint256 clashId, address player) external view returns (uint256) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        return clashes[clashId].boostCount[player];
    }

    function getClashScore(uint256 clashId, uint256 index) external view returns (uint256) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        require(index < clashes[clashId].playerCount, "Invalid player index");
        return clashes[clashId].sortedScores[uint8(index)];
    }

    function getUserClashIds(address user) external view returns (uint256[] memory) {
        return _getUserClashIds(user);
    }

    // Add new view function to get clash details
    function getClashDetails(uint256 clashId) external view returns (
        uint256 id,
        CritterClashStorage.ClashSize clashSize,
        CritterClashStorage.ClashState state,
        uint256 playerCount,
        uint256 startTime,
        bool isProcessed
    ) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        CritterClashStorage.Clash storage clash = clashes[clashId];
        return (
            clash.id,
            clash.clashSize,
            clash.state,
            clash.playerCount,
            clash.startTime,
            clash.isProcessed
        );
    }

    // Add the missing handlePaymentAndBoosts function
    function handlePaymentAndBoosts(
        CritterClashStorage.ClashSize clashSize,
        uint256 boostCount,
        bool useInventory
    ) internal returns (uint256) {
        uint256 entryFee = clashTypes[clashSize].entryFee;
        uint256 boostFee = 0;

        if (boostCount > 0) {
            if (useInventory) {
                require(playerBoosts[msg.sender] >= boostCount, "Insufficient boost inventory");
                playerBoosts[msg.sender] -= boostCount;
            } else {
                boostFee = (entryFee * powerUpFeePercent * boostCount) / 100;
            }
        }

        uint256 totalFee = entryFee + boostFee;
        require(msg.value >= totalFee, "Insufficient payment");

        // Update fund accounting
        fundAccounting.prizePool += entryFee;
        if (boostFee > 0) {
            fundAccounting.boostFees += boostFee;
        }

        emit BoostsUsed(msg.sender, boostCount);
        return totalFee;
    }

    function purchaseBoosts(uint256 amount) external payable whenNotPaused nonReentrant {
        require(amount > 0, "Must purchase at least 1 boost");
        require(amount <= 10, "Cannot purchase more than 10 boosts at once");

        // Calculate cost (powerUpFeePercent of entry fee per boost for smallest clash size)
        uint256 entryFee = clashTypes[CritterClashStorage.ClashSize.Two].entryFee;
        uint256 pricePerBoost = (entryFee * powerUpFeePercent) / 100;
        uint256 totalCost = pricePerBoost * amount;

        require(msg.value >= totalCost, "Insufficient payment");

        // Update boost inventory and fees
        playerBoosts[msg.sender] += amount;
        fundAccounting.boostFees += totalCost;

        emit BoostsPurchased(msg.sender, amount, totalCost, NATIVE_TOKEN);
    }

    // Add missing functions
    function setClashDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 30 && newDuration <= 3600, "Duration must be between 30s and 1h");
        clashDuration = newDuration;
    }

    function depositEntropyFee() external payable onlyOwner {
        require(msg.value > 0, "Must deposit some ETH");
        entropyStorage.entropyFeeBalance = uint192(uint256(entropyStorage.entropyFeeBalance) + msg.value);
        emit EntropyFeeDeposited(msg.value);
    }

    function withdrawEntropyFee() external onlyOwner nonReentrant {
        uint256 amount = entropyStorage.entropyFeeBalance;
        if (amount == 0) return; // Just return if no fees to withdraw
        entropyStorage.entropyFeeBalance = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Entropy fee withdrawal failed");
        emit EntropyFeeWithdrawn(amount);
    }

    function getClashInfo(uint256 clashId) external view returns (
        ClashSize clashSize,
        ClashState state,
        uint256 playerCount,
        uint256 startTime,
        bool isProcessed,
        address[] memory players,
        uint256[] memory critterIds,
        uint256[] memory boosts,
        uint256[] memory scores,
        uint256[] memory results
    ) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        Clash storage clash = clashes[clashId];
        
        // Create arrays with appropriate sizes
        address[] memory playersArray = new address[](clash.playerCount);
        uint256[] memory critterIdsArray = new uint256[](clash.playerCount);
        uint256[] memory boostsArray = new uint256[](clash.playerCount);
        uint256[] memory scoresArray = new uint256[](clash.playerCount);
        
        // Get clash results using the helper function
        CritterClashStorage.ClashResult[] memory clashResults = _getClashResults(clashId);
        uint256[] memory resultsArray = new uint256[](clashResults.length);
        
        // Fill arrays with data - use sorted arrays if clash is in progress or completed
        bool useSortedArrays = clash.state != ClashState.ACCEPTING_PLAYERS;
        
        for (uint256 i = 0; i < clash.playerCount; i++) {
            if (useSortedArrays) {
                playersArray[i] = clash.sortedPlayers[uint8(i)];
                critterIdsArray[i] = clash.sortedCritterIds[uint8(i)];
                scoresArray[i] = clash.sortedScores[uint8(i)];
                boostsArray[i] = clash.boostCount[clash.sortedPlayers[uint8(i)]];
            } else {
                playersArray[i] = clash.players[uint8(i)];
                critterIdsArray[i] = clash.critterIds[uint8(i)];
                boostsArray[i] = clash.boostCount[clash.players[uint8(i)]];
            }
        }
        
        // Extract only the reward values from ClashResults
        for (uint256 i = 0; i < clashResults.length; i++) {
            resultsArray[i] = clashResults[i].reward;
        }
        
        return (
            clash.clashSize,
            clash.state,
            clash.playerCount,
            clash.startTime,
            clash.isProcessed,
            playersArray,
            critterIdsArray,
            boostsArray,
            scoresArray,
            resultsArray
        );
    }

    receive() external payable {
        // Allow contract to receive ETH
    }

    // Modify handleEntropyCallback to remove test logging
    function handleEntropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external {
        // Only entropy provider can call back
        require(msg.sender == address(entropy), "Only entropy contract can call");
        require(provider == entropyProvider, "Invalid provider");
        entropyCallback(sequenceNumber, provider, randomNumber);
    }

    function _calculateBaseScore(MonadCritter.Stats memory stats) internal pure returns (uint256) {
        // OPTIMIZATION: Use a fixed array in memory to avoid repeated storage access
        // Get rarity multiplier (1.0, 1.1, 1.25, 1.5)
        uint256 rarityMultiplier;
        
        // OPTIMIZATION: Use if/else instead of array lookup to save gas
        uint8 rarity = uint8(stats.rarity);
        if (rarity == 0) rarityMultiplier = 100;      // Common: 1.0x
        else if (rarity == 1) rarityMultiplier = 110; // Uncommon: 1.1x
        else if (rarity == 2) rarityMultiplier = 125; // Rare: 1.25x
        else rarityMultiplier = 150;                  // Legendary: 1.5x
        
        // OPTIMIZATION: Cache converted stats to avoid repeated conversions
        uint256 speed = uint256(stats.speed);
        uint256 stamina = uint256(stats.stamina);
        uint256 luck = uint256(stats.luck);
        
        // OPTIMIZATION: Simplify calculations by pre-computing weights
        // Weight the stats - speed (120%), stamina (100%), luck (80%)
        uint256 weightedSpeed = (speed * 12) / 10;
        uint256 weightedLuck = (luck * 8) / 10;
        
        // OPTIMIZATION: Combine multiplications to reduce computational steps
        // Calculate base score using weighted multiplicative formula
        uint256 baseScore = weightedSpeed * stamina * weightedLuck;
        baseScore = baseScore / 100; // Scale down after multiplications
        
        // OPTIMIZATION: Apply rarity multiplier
        baseScore = (baseScore * rarityMultiplier) / 100;
        
        return baseScore / 10;
    }
    
    function _calculateScoreWithBoosts(uint256 baseScore, uint256 boostCount) internal pure returns (uint256) {
        // OPTIMIZATION: Early return for most common case
        if (boostCount == 0) return baseScore;
        
        // OPTIMIZATION: Simplified boost logic with fewer conditionals
        // First boost gives 20% (1.2x), subsequent boosts give 15% each (1.15x)
        uint256 boostedScore = baseScore * 120 / 100; // Apply first boost
        
        // OPTIMIZATION: Special case for single boost (most common)
        if (boostCount == 1) return boostedScore;
        
        // OPTIMIZATION: Apply additional boosts with a loop for any number of boosts
        for (uint256 i = 1; i < boostCount; i++) {
            boostedScore = boostedScore * 115 / 100;
        }
        
        return boostedScore;
    }
    
    // OPTIMIZATION: Add a combined function to compute the score in one pass for frequently used code paths
    function _calculateCritterScore(uint256 critterId, uint256 boostCount) internal view returns (uint256) {
        MonadCritter.Stats memory stats = critterContract.getStats(critterId);
        uint256 baseScore = _calculateBaseScore(stats);
        return _calculateScoreWithBoosts(baseScore, boostCount);
    }

    // OPTIMIZATION: Updated to work with the new storage structure
    function completeClash(uint256 clashId) external whenNotPaused nonReentrant {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        CritterClashStorage.Clash storage clash = clashes[clashId];
        
        // Basic state checks
        require(clash.state == CritterClashStorage.ClashState.CLASHING, "Clash not in progress");
        require(!clash.isProcessed, "Clash already processed");
        
        // Duration check for non-owner calls
        if (msg.sender != owner()) {
            require(clash.startTime > 0, "Clash not started");
            require(block.timestamp >= clash.startTime + clashDuration, "Clash duration not over");
        }
        
        // Verify clash is full
        uint256 maxPlayers = clashTypes[clash.clashSize].maxPlayers;
        require(clash.playerCount == maxPlayers, "Clash not full");
        
        // Access control: only participants or admin can complete
        if (msg.sender != owner()) {
            bool isParticipant = false;
            for (uint8 i = 0; i < uint8(clash.playerCount); i++) {
                if (clash.players[i] == msg.sender) {
                    isParticipant = true;
                    break;
                }
            }
            require(isParticipant, "Only participants or admin can complete clash");
        }
        
        // Check if we're still waiting for entropy
        if (clashPendingRandomness[clashId] != 0) {
            // If we've waited too long for entropy (over clash duration), use fallback
            if (block.timestamp >= clash.startTime + clashDuration) {
                _calculateFallbackScores(clash, clashId);
                clashPendingRandomness[clashId] = 0;
                emit EntropyTimeout(clashId);
            } else {
                revert("Still waiting for entropy");
            }
        }
        
        // Mark as processed first to prevent reentrancy
        clash.isProcessed = true;
        
        // Calculate prize pool and fees
        uint256 prizePool = clashTypes[clash.clashSize].entryFee * clash.playerCount;
        uint256 daoFeeAmount = (prizePool * daoFeePercent) / 100;
        uint256 distributablePrize = prizePool - daoFeeAmount;
        
        // Update fund accounting
        fundAccounting.prizePool -= prizePool;
        fundAccounting.daoFees += daoFeeAmount;
        
        // OPTIMIZATION: Use memory arrays for return values but optimized mappings for storage
        uint256[] memory rewardArray = new uint256[](clash.playerCount);
        uint256[] memory boostArray = new uint256[](clash.playerCount);
        
        // Clear previous results - reset resultCount
        clash.resultCount = 0;
        
        // Process winners and update stats
        for (uint8 i = 0; i < uint8(clash.playerCount); i++) {
            address payable player = payable(clash.sortedPlayers[i]);
            uint256 critterId = clash.sortedCritterIds[i];
            uint256 reward = 0;
            
            // Calculate reward for winners
            if (i < clashTypes[clash.clashSize].numWinners) {
                reward = (distributablePrize * clashTypes[clash.clashSize].rewardPercentages[i]) / 100;
            }
            
            // Record reward and boost count
            rewardArray[i] = reward;
            boostArray[i] = clash.boostCount[player];
            
            // Store result using the optimized structure
            _addClashResult(clashId, CritterClashStorage.ClashResult({
                player: player,
                critterId: uint128(critterId),
                position: uint32(i + 1),
                reward: uint64(reward),
                score: uint32(clash.sortedScores[i])
            }));
            
            // Update player and critter stats
            statsContract.updatePlayerStats(
                player,
                clash.sortedScores[i],
                i < clashTypes[clash.clashSize].numWinners,
                reward
            );
            
            // Update critter stats
            statsContract.updateCritterStats(
                critterId,
                i < clashTypes[clash.clashSize].numWinners
            );
            
            // Transfer reward
            if (reward > 0) {
                (bool success, ) = player.call{value: reward}("");
                require(success, "Reward transfer failed");
            }
        }
        
        // Update clash state
        clash.state = CritterClashStorage.ClashState.COMPLETED_WITH_RESULTS;
        
        // Reset current active clash for this size since this one is complete
        currentActiveClash[clash.clashSize] = 0;
        
        // OPTIMIZATION: Create arrays for event emission
        address[] memory playerArray = new address[](clash.playerCount);
        uint256[] memory scoreArray = new uint256[](clash.playerCount);
        
        for (uint8 i = 0; i < uint8(clash.playerCount); i++) {
            playerArray[i] = clash.sortedPlayers[i];
            scoreArray[i] = clash.sortedScores[i];
        }
        
        // Emit completion events
        emit ClashCompleted(
            clashId,
            playerArray,
            scoreArray,
            rewardArray,
            boostArray
        );
    }
    
    // OPTIMIZATION: Updated to work with the new storage structure
    function _calculateFallbackScores(CritterClashStorage.Clash storage clash, uint256 clashId) internal {
        uint8 playerCount = uint8(clash.playerCount);
        
        for (uint8 i = 0; i < playerCount; i++) {
            // Copy players to sortedPlayers in same order (will be sorted later)
            clash.sortedPlayers[i] = clash.players[i];
            uint256 baseScore = _calculateBaseScore(critterContract.getStats(clash.critterIds[i]));
            
            // Apply boosts before variance
            baseScore = _calculateScoreWithBoosts(baseScore, clash.boostCount[clash.players[i]]);
            
            // Generate fallback random variance using block data
            bytes32 fallbackRandom = keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                clashId,
                clash.players[i],
                clash.critterIds[i],
                i
            ));
            
            // Convert to a number between 75 and 125 (±25%)
            uint256 variance = (uint256(fallbackRandom) % 51) + 75;
            
            // Apply variance to boosted score
            clash.sortedScores[i] = (baseScore * variance) / 100;
        }
        
        // Sort players by scores after all scores are calculated
        _sortClashArrays(clash);
    }
    
    // OPTIMIZATION: Re-add the _requestSingleEntropyForClash method
    function _requestSingleEntropyForClash(uint256 clashId, uint8 playerCount) internal {
        CritterClashStorage.Clash storage clash = clashes[clashId];
        require(clash.state == CritterClashStorage.ClashState.CLASHING, "Clash not in clashing state");
        
        // OPTIMIZATION: Calculate fee once
        uint256 entropyFee = entropy.getFee(entropyProvider);
        require(entropyStorage.entropyFeeBalance >= entropyFee, "Insufficient entropy fee balance");
        
        // OPTIMIZATION: Deduct fee before the external call to prevent reentrancy issues
        entropyStorage.entropyFeeBalance = uint192(uint256(entropyStorage.entropyFeeBalance) - entropyFee);
        
        // OPTIMIZATION: Generate deterministic random seed including more entropy sources
        bytes32 userRandomNumber = keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            clashId,
            playerCount
        ));
        
        // OPTIMIZATION: Use try/catch for safer external calls
        try entropy.requestWithCallback{value: entropyFee}(
            entropyProvider,
            userRandomNumber
        ) returns (uint64 requestId) {
            // Store minimal mapping data
            entropyStorage.randomRequests[requestId] = userRandomNumber;
            entropyStorage.requestToClash[requestId] = clashId;
            entropyStorage.clashSequenceNumber[clashId] = requestId;
            
            // OPTIMIZATION: Set pending randomness to track overall clash progress
            clashPendingRandomness[clashId] = playerCount;
            
            // Record entropy usage if stats contract is set
            if (address(statsContract) != address(0)) {
                statsContract.recordEntropyUsage(1, entropyFee);
            }
            
            emit EntropyRequested(clashId, requestId, entropyFee);
        } catch {
            // OPTIMIZATION: Refund entropy fee if request fails
            entropyStorage.entropyFeeBalance = uint192(uint256(entropyStorage.entropyFeeBalance) + entropyFee);
            emit EntropyRequestFailed(clashId, entropyFee);
            
            // Use a clear error message
            revert("Entropy request failed");
        }
    }
    
    // OPTIMIZATION: Add helper function to get clash results
    function getClashResults(uint256 clashId) external view returns (CritterClashStorage.ClashResult[] memory) {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        return _getClashResults(clashId);
    }
    
    // OPTIMIZATION: Helper functions that were missing
    function _getUserClashIds(address user) internal view override returns (uint256[] memory) {
        uint256 count = userClashCount[user];
        uint256[] memory ids = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            ids[i] = userClashIdsMap[user][i];
        }
        
        return ids;
    }

    // Add this function after setPowerUpFeePercent or in the admin functions section
    function setClashStartTime(uint256 clashId, uint256 startTime) external onlyOwner {
        require(clashId > 0 && clashId <= currentClashId, "Invalid clash ID");
        clashes[clashId].startTime = uint64(startTime);
    }
}