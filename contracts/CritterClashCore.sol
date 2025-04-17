// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MonadCritter.sol";
import "./CritterClashStats.sol";
import "./CritterClashStorage.sol";
import "./HouseManager.sol";
import "./ScoreCalculator.sol";
import "./modules/CritterClashRevenue.sol";
import "./modules/CritterClashEntropy.sol";
import "./modules/CritterClashAdmin.sol";
import "./modules/CritterClashExternal.sol";

/**
 * @title CritterClashCore
 * @dev Main contract for CritterClash game logic, now modularized
 */
contract CritterClashCore is 
    ReentrancyGuard,    
    Pausable,           
    Ownable,            
    CritterClashStorage,      
    CritterClashRevenue,      
    CritterClashEntropy,      
    CritterClashAdmin,        
    CritterClashExternal      
{
    MonadCritter public immutable critterContract;
    HouseManager public immutable houseManager;  
    
    // Core events
    event ClashJoined(uint256 indexed clashId, address indexed player, uint256 critterId, uint256 boostCount, uint256 fee);
    event ClashStarted(uint256 indexed clashId, address[] players, uint256[] critterIds);
    event ClashCompleted(uint256 indexed clashId, address[] players, uint256[] scores, uint256[] rewards, uint256[] boostCounts);
    event ClashUpdate(uint256 indexed clashId, ClashSize indexed clashSize, ClashState state, address player, uint256 critterId, uint256 timestamp);

    constructor(
        address _critterContract,
        address _statsContract,
        address _entropyProvider,
        address _entropy,
        address _houseManager,
        address _scoreCalculator
    ) 
        CritterClashRevenue()
        CritterClashEntropy(_entropyProvider, _entropy)
        CritterClashAdmin()
        CritterClashExternal()
    {
        require(_critterContract != address(0), "Invalid critter contract");
        require(_statsContract != address(0), "Invalid stats contract");
        require(_houseManager != address(0), "Invalid house manager");
        require(_scoreCalculator != address(0), "Invalid score calculator");
        
        critterContract = MonadCritter(_critterContract);
        statsContract = CritterClashStats(_statsContract);
        houseManager = HouseManager(_houseManager);
        scoreCalculator = ScoreCalculator(_scoreCalculator);
        
        // Initialize game settings
        _initializeClashTypes();
        _initialize();
        
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
        // Remove revenue initialization
        // daoFeePercent = 5; // 5% DAO fee
        // powerUpFeePercent = 10; // 10% boost fee
    }
    
    function _initializeClashTypes() private {
        // Two player clash - Winner takes all
        uint256[] memory twoPlayerRewards = new uint256[](1);
        twoPlayerRewards[0] = 100;
        clashTypes[CritterClashStorage.ClashSize.Two] = CritterClashStorage.ClashType({
            maxPlayers: 2,
            numWinners: 1,
            isActive: true,
            rewardPercentages: twoPlayerRewards
        });
        
        // Set entry fees for each house type (2x2)
        clashTypes[CritterClashStorage.ClashSize.Two].entryFees[HOUSE_COMMON] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Two].entryFees[HOUSE_UNCOMMON] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Two].entryFees[HOUSE_RARE] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Two].entryFees[HOUSE_LEGENDARY] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Two].entryFees[HOUSE_MIXED] = uint96(0.1 ether);
        
        // Four player clash - Split 70/30
        uint256[] memory fourPlayerRewards = new uint256[](2);
        fourPlayerRewards[0] = 70;
        fourPlayerRewards[1] = 30;
        clashTypes[CritterClashStorage.ClashSize.Four] = CritterClashStorage.ClashType({
            maxPlayers: 4,
            numWinners: 2,
            isActive: true,
            rewardPercentages: fourPlayerRewards
        });
        
        // Set entry fees for each house type (4x4)
        clashTypes[CritterClashStorage.ClashSize.Four].entryFees[HOUSE_COMMON] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Four].entryFees[HOUSE_UNCOMMON] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Four].entryFees[HOUSE_RARE] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Four].entryFees[HOUSE_LEGENDARY] = uint96(0.1 ether);
        clashTypes[CritterClashStorage.ClashSize.Four].entryFees[HOUSE_MIXED] = uint96(0.1 ether);
    }
    
    // Update joinClash to use Revenue module
    function joinClash(
        CritterClashStorage.ClashSize clashSize,
        uint256 critterId,
        uint256 boostCount,
        bool useInventory,
        uint8 preferredHouse  // 255 for mixed, 0-3 for specific house
    ) external payable whenNotPaused nonReentrant {
        require(clashTypes[clashSize].isActive, "Clash type not active");
        require(preferredHouse <= 255, "Invalid house preference");
        require(preferredHouse == 255 || preferredHouse <= 3, "Invalid house value");
        
        // Get critter's house before creating/joining clash
        uint8 critterHouse = uint8(critterContract.getHouse(critterId));
        
        // Get or create clash with house preference
        uint256 clashId = _getOrCreateClash(clashSize, preferredHouse);
        CritterClashStorage.Clash storage clash = clashes[clashId];
        
        require(clash.state == CritterClashStorage.ClashState.ACCEPTING_PLAYERS, "Clash not accepting players");
        require(!_isPlayerInClash(clash, msg.sender), "Already in clash");
        require(clash.playerCount < clashTypes[clashSize].maxPlayers, "Clash is full");
        
        // Verify critter ownership
        address critterOwner = critterContract.ownerOf(critterId);
        require(critterOwner == msg.sender, "Not owner of critter");
        
        // Validate house rules
        bool canJoin = houseManager.canJoinClash(
            clashId,
            clashSize,
            _getExistingCritterIds(clash),
            critterId
        );
        require(canJoin, "House rules prevent joining");
        
        // Use Revenue module to handle payment and boosts
        uint256 totalFee = CritterClashRevenue.handlePaymentAndBoosts(clashSize, boostCount, useInventory);
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
            
            // Request entropy using Entropy module
            CritterClashEntropy.requestEntropyForClash(clashId, uint8(maxPlayers));
    
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
    
    // Helper function to get existing critter IDs in a clash
    function _getExistingCritterIds(CritterClashStorage.Clash storage clash) internal view returns (uint256[] memory) {
        uint256[] memory existingCritterIds = new uint256[](clash.playerCount);
        for (uint8 i = 0; i < clash.playerCount; i++) {
            existingCritterIds[i] = clash.critterIds[i];
        }
        return existingCritterIds;
    }
    
    function _calculateCritterScore(uint256 critterId, uint256 boostCount) internal view returns (uint256) {
        MonadCritter.Stats memory stats = critterContract.getStats(critterId);
        uint8 house = uint8(critterContract.getHouse(critterId));
        
        // Determine if this is a mixed clash by checking the clash state
        bool isMixedClash = false;
        for (uint256 i = 1; i <= currentClashId; i++) {
            CritterClashStorage.Clash storage clash = clashes[i];
            if (clash.state == CritterClashStorage.ClashState.CLASHING) {
                for (uint8 j = 0; j < clash.playerCount; j++) {
                    if (clash.critterIds[j] == critterId) {
                        isMixedClash = (clash.house == 255);
                        break;
                    }
                }
                break;
            }
        }
        
        uint256 baseScore = scoreCalculator.calculateBaseScore(stats, house, isMixedClash);
        return scoreCalculator.calculateScoreWithBoosts(baseScore, boostCount);
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
    
    function _getOrCreateClash(
        CritterClashStorage.ClashSize clashSize,
        uint8 preferredHouse
    ) internal returns (uint256) {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        require(clashTypes[clashSize].isActive, "This clash type is not active");
        
        // First check the tracked active clash for this size and house
        uint256 activeClashId = currentActiveClashByHouse[clashSize][preferredHouse];
        if (activeClashId > 0) {
            CritterClashStorage.Clash storage clash = clashes[activeClashId];
            if (clash.state == CritterClashStorage.ClashState.ACCEPTING_PLAYERS && 
                clash.playerCount < clashTypes[clashSize].maxPlayers &&
                clash.house == preferredHouse) {
                return activeClashId;
            }
        }
        
        // If no active clash found for this house preference, scan recent clashes
        for (uint256 i = currentClashId; i > currentClashId - 10 && i > 0; i--) {
            CritterClashStorage.Clash storage existingClash = clashes[i];
            if (existingClash.clashSize == clashSize && 
                existingClash.state == CritterClashStorage.ClashState.ACCEPTING_PLAYERS &&
                existingClash.playerCount < clashTypes[clashSize].maxPlayers &&
                existingClash.house == preferredHouse) {
                // Found an existing clash that matches preferences
                currentActiveClashByHouse[clashSize][preferredHouse] = i;
                return i;
            }
        }
        
        // No suitable existing clash found, create new one
        uint256 newClashId = currentClashId + 1;
        currentClashId = newClashId;
        
        // Set this as the active clash for this size and house
        currentActiveClashByHouse[clashSize][preferredHouse] = newClashId;
        
        CritterClashStorage.Clash storage newClash = clashes[newClashId];
        newClash.id = uint128(newClashId);
        newClash.clashSize = clashSize;
        newClash.state = CritterClashStorage.ClashState.ACCEPTING_PLAYERS;
        newClash.playerCount = 0;
        newClash.startTime = 0;
        newClash.isProcessed = false;
        newClash.house = preferredHouse;
        
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
    
    function handlePaymentAndBoosts(
        CritterClashStorage.ClashSize clashSize,
        uint256 boostCount,
        bool useInventory,
        uint8 houseType
    ) internal returns (uint256) {
        uint256 entryFee = clashTypes[clashSize].entryFees[houseType];
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

        fundAccounting.prizePool += entryFee;
        if (boostFee > 0) {
            fundAccounting.boostFees += boostFee;
        }

        return totalFee;
    }

    function purchaseBoosts(uint256 amount) external payable whenNotPaused nonReentrant {
        require(amount > 0, "Must purchase at least 1 boost");
        require(amount <= 10, "Cannot purchase more than 10 boosts at once");

        uint256 entryFee = clashTypes[ClashSize.Two].entryFee;
        uint256 pricePerBoost = (entryFee * powerUpFeePercent) / 100;
        uint256 totalCost = pricePerBoost * amount;

        require(msg.value >= totalCost, "Insufficient payment");

        playerBoosts[msg.sender] += amount;
        fundAccounting.boostFees += totalCost;

        emit BoostsPurchased(msg.sender, amount, totalCost, NATIVE_TOKEN);
    }

    // Add missing functions
    function setClashDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 30 && newDuration <= 3600, "Duration must be between 30s and 1h");
        clashDuration = newDuration;
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

    // Update completeClash to use Entropy module's functions
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
        
        // Check if we're still waiting for entropy using Entropy module
        if (isWaitingForEntropy(clashId)) {
            // If we've waited too long for entropy (over clash duration), use fallback
            if (block.timestamp >= clash.startTime + clashDuration) {
                _calculateFallbackScores(clash, clashId);
                clearEntropyRequest(clashId);
            } else {
                revert("Still waiting for entropy");
            }
        }
        
        // Mark as processed first to prevent reentrancy
        clash.isProcessed = true;
        
        // Use Revenue module to handle prize distribution
        CritterClashRevenue.distributePrizes(
            clashId,
            clash.clashSize,
            clash.playerCount,
            clash.sortedPlayers,
            clash.sortedCritterIds,
            clash.sortedScores,
            clashTypes[clash.clashSize].numWinners,
            clashTypes[clash.clashSize].rewardPercentages
        );
        
        // Update clash state
        clash.state = CritterClashStorage.ClashState.COMPLETED_WITH_RESULTS;
        
        // Reset current active clash for this size since this one is complete
        currentActiveClashByHouse[clash.clashSize][clash.house] = 0;
        
        // Emit completion events
        emit ClashCompleted(
            clashId,
            clash.sortedPlayers,
            clash.sortedScores,
            clash.sortedCritterIds,
            clash.boostCount
        );
    }
    
    // Update _calculateFallbackScores to use ScoreCalculator
    function _calculateFallbackScores(CritterClashStorage.Clash storage clash, uint256 clashId) internal {
        uint8 playerCount = uint8(clash.playerCount);
        bool isMixedClash = clash.house == 255;
        
        // Create temporary arrays for ScoreCalculator
        uint256[] memory tempCritterIds = new uint256[](playerCount);
        address[] memory tempPlayers = new address[](playerCount);
        
        // Copy data to temporary arrays
        for (uint8 i = 0; i < playerCount; i++) {
            tempCritterIds[i] = clash.critterIds[i];
            tempPlayers[i] = clash.players[i];
        }
        
        // Use ScoreCalculator to calculate final scores with fallback entropy
        bytes32 fallbackEntropy = keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            clashId
        ));
        
        // Calculate final scores using ScoreCalculator
        ScoreCalculator.ScoreResult memory result = scoreCalculator.calculateFinalScores(
            tempCritterIds,
            tempPlayers,
            clash.boostCount,
            isMixedClash,
            fallbackEntropy
        );
        
        // Store results back in clash
        for (uint8 i = 0; i < playerCount; i++) {
            clash.sortedScores[i] = result.scores[i];
            clash.sortedPlayers[i] = result.sortedPlayers[i];
            clash.sortedCritterIds[i] = result.sortedCritterIds[i];
        }
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
    function getUserClashIds(address user) external view returns (uint256[] memory) {
        uint256 count = userClashCount[user];
        uint256[] memory ids = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            ids[i] = userClashIdsMap[user][i];
        }
        
        return ids;
    }

    // Update onEntropyReceived to handle the only scoring event
    function onEntropyReceived(uint256 clashId, bytes32 entropy) external override {
        require(msg.sender == address(scoreCalculator), "Only score calculator");
        
        CritterClashStorage.Clash storage clash = clashes[clashId];
        require(clash.state == CritterClashStorage.ClashState.CLASHING, "Invalid clash state");
        
        // Calculate final scores and get sorted arrays in one step
        ScoreCalculator.ScoreResult memory result = scoreCalculator.calculateFinalScores(
            clash.critterIds,
            clash.players,
            clash.boostCount,
            clash.house == 255,
            entropy
        );

        // Store final sorted arrays
        clash.scores = result.scores;
        clash.players = result.sortedPlayers;
        clash.critterIds = result.sortedCritterIds;
        
        // Update state
        clash.state = CritterClashStorage.ClashState.COMPLETE;

        emit ClashCompleted(
            clashId,
            clash.sortedPlayers,
            clash.sortedScores,
            clash.sortedCritterIds,
            clash.boostCount
        );
    }

    // Update _transitionToClashing to use ScoreCalculator's sorting
    function _transitionToClashing(uint256 clashId) internal {
        Clash storage clash = clashes[clashId];
        require(clash.state == ClashState.FILLING, "Invalid clash state");
        require(clash.playerCount > 1, "Not enough players");

        // Update state
        clash.state = ClashState.CLASHING;
        
        // Request entropy without calculating initial scores
        scoreCalculator.requestEntropyForClash(
            clash.critterIds,
            clash.players,
            clash.boostCount,
            clash.house == 255,
            clashId
        );

        emit ClashStarted(clashId);
    }

    /**
     * @dev Get entry fee for a specific clash size and house type
     */
    function getEntryFee(CritterClashStorage.ClashSize clashSize, uint8 houseType) public view returns (uint256) {
        require(houseType == HOUSE_COMMON || 
                houseType == HOUSE_UNCOMMON || 
                houseType == HOUSE_RARE || 
                houseType == HOUSE_LEGENDARY || 
                houseType == HOUSE_MIXED, "Invalid house type");
        
        return clashTypes[clashSize].entryFees[houseType];
    }

    /**
     * @dev Admin function to set entry fee for a specific clash size and house type
     */
    function setEntryFee(CritterClashStorage.ClashSize clashSize, uint8 houseType, uint256 newFee) external onlyOwner {
        require(clashSize != CritterClashStorage.ClashSize.None, "Invalid clash size");
        require(houseType == HOUSE_COMMON || 
                houseType == HOUSE_UNCOMMON || 
                houseType == HOUSE_RARE || 
                houseType == HOUSE_LEGENDARY || 
                houseType == HOUSE_MIXED, "Invalid house type");
        
        uint256 oldFee = clashTypes[clashSize].entryFees[houseType];
        clashTypes[clashSize].entryFees[houseType] = uint96(newFee);
        emit EntryFeeUpdated(clashSize, oldFee, newFee);
    }
}