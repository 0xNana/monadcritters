// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "../CritterClashStorage.sol";
import "./CritterClashEntropy.sol";
import "./CritterClashRevenue.sol";

/**
 * @title CritterClashExternal
 * @dev Handles all external contract integrations and their revenue
 */
contract CritterClashExternal is ReentrancyGuard, Pausable, CritterClashStorage {
    // External contract events
    event ExternalContractFeesWithdrawn(address indexed contractAddress, uint256 daoFees, uint256 boostFees);
    event ExternalContractEntropyDeposited(address indexed contractAddress, uint256 amount);
    event ExternalContractEntropyWithdrawn(address indexed contractAddress, uint256 amount);
    event ExternalContractEntropyUsed(address indexed contractAddress, uint256 amount);
    event ExternalContractClashJoined(address indexed contractAddress, uint256 indexed clashId, uint256 critterId, uint256 boostCount);
    event ExternalContractClashCreated(address indexed contractAddress, uint256 indexed clashId, ClashSize clashSize);

    struct ExternalContractRevenue {
        uint256 daoFees;        // Platform fees collected
        uint256 boostFees;      // Boost fees collected
        uint256 entropyBalance; // Balance for entropy requests
        uint256 totalRevenue;   // Total revenue generated
        uint256 lastWithdraw;   // Timestamp of last withdrawal
        uint256 activeClashId;  // Currently active clash for this contract
    }

    mapping(address => ExternalContractRevenue) public contractRevenue;
    mapping(uint256 => address) public clashToContract; // Maps clash IDs to their creating contract

    modifier onlyRegisteredContract() {
        require(contractRevenue[msg.sender].lastWithdraw > 0 || msg.value > 0, "Contract not registered");
        _;
    }

    function depositExternalContractEntropyFee() external payable {
        require(msg.value > 0, "Must deposit some ETH");
        ExternalContractRevenue storage revenue = contractRevenue[msg.sender];
        revenue.entropyBalance += msg.value;
        emit ExternalContractEntropyDeposited(msg.sender, msg.value);
    }

    function withdrawExternalContractEntropyFee() external nonReentrant onlyRegisteredContract {
        ExternalContractRevenue storage revenue = contractRevenue[msg.sender];
        uint256 amount = revenue.entropyBalance;
        require(amount > 0, "No entropy fees to withdraw");
        
        revenue.entropyBalance = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Entropy fee withdrawal failed");
        emit ExternalContractEntropyWithdrawn(msg.sender, amount);
    }

    function withdrawExternalContractFees() external nonReentrant onlyRegisteredContract {
        ExternalContractRevenue storage revenue = contractRevenue[msg.sender];
        uint256 daoAmount = revenue.daoFees;
        uint256 boostAmount = revenue.boostFees;
        require(daoAmount > 0 || boostAmount > 0, "No fees to withdraw");
        
        revenue.daoFees = 0;
        revenue.boostFees = 0;
        revenue.lastWithdraw = block.timestamp;
        
        if (daoAmount > 0) {
            (bool success, ) = msg.sender.call{value: daoAmount}("");
            require(success, "DAO fee withdrawal failed");
        }
        if (boostAmount > 0) {
            (bool success, ) = msg.sender.call{value: boostAmount}("");
            require(success, "Boost fee withdrawal failed");
        }
        
        emit ExternalContractFeesWithdrawn(msg.sender, daoAmount, boostAmount);
    }

    function requestExternalContractEntropy(uint256 playerCount) external onlyRegisteredContract returns (uint64) {
        ExternalContractRevenue storage revenue = contractRevenue[msg.sender];
        uint256 entropyFee = CritterClashEntropy(address(this)).getRequiredEntropyFee(playerCount);
        require(revenue.entropyBalance >= entropyFee, "Insufficient entropy balance");
        
        revenue.entropyBalance -= entropyFee;
        
        bytes32 userRandomNumber = keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            playerCount
        ));
        
        try CritterClashEntropy(address(this)).requestEntropyForClash(playerCount, userRandomNumber) returns (uint64 requestId) {
            emit ExternalContractEntropyUsed(msg.sender, entropyFee);
            return requestId;
        } catch {
            revenue.entropyBalance += entropyFee;
            revert("Entropy request failed");
        }
    }

    function createExternalClash(
        ClashSize clashSize,
        uint8 preferredHouse
    ) external onlyRegisteredContract returns (uint256) {
        require(clashTypes[clashSize].isActive, "Clash type not active");
        require(preferredHouse <= 255, "Invalid house preference");
        require(preferredHouse == 255 || preferredHouse <= 3, "Invalid house value");

        ExternalContractRevenue storage revenue = contractRevenue[msg.sender];
        require(revenue.activeClashId == 0, "Contract already has active clash");

        uint256 newClashId = currentClashId + 1;
        currentClashId = newClashId;
        
        Clash storage newClash = clashes[newClashId];
        newClash.id = uint128(newClashId);
        newClash.clashSize = clashSize;
        newClash.state = ClashState.ACCEPTING_PLAYERS;
        newClash.playerCount = 0;
        newClash.startTime = 0;
        newClash.isProcessed = false;
        newClash.house = preferredHouse;

        revenue.activeClashId = newClashId;
        clashToContract[newClashId] = msg.sender;

        emit ExternalContractClashCreated(msg.sender, newClashId, clashSize);
        return newClashId;
    }

    function joinExternalClash(
        uint256 clashId,
        uint256 critterId,
        uint256 boostCount
    ) external payable whenNotPaused onlyRegisteredContract {
        require(clashToContract[clashId] == msg.sender, "Not your clash");
        
        Clash storage clash = clashes[clashId];
        require(clash.state == ClashState.ACCEPTING_PLAYERS, "Clash not accepting players");
        require(clash.playerCount < clashTypes[clash.clashSize].maxPlayers, "Clash is full");
        
        // Handle fees
        handleExternalContractFees(msg.sender, msg.value, boostCount);
        
        // Add player to clash
        uint8 playerPosition = clash.playerCount;
        clash.players[playerPosition] = msg.sender;
        clash.critterIds[playerPosition] = critterId;
        clash.boostCount[msg.sender] = boostCount;
        clash.playerCount++;
        
        // Initialize scores
        clash.sortedPlayers[playerPosition] = msg.sender;
        clash.sortedCritterIds[playerPosition] = critterId;
        clash.sortedScores[playerPosition] = 0;
        
        emit ExternalContractClashJoined(msg.sender, clashId, critterId, boostCount);
    }

    function handleExternalContractFees(
        address contractAddress,
        uint256 entryFee,
        uint256 boostCount
    ) internal {
        ExternalContractRevenue storage revenue = contractRevenue[contractAddress];
        
        uint256 daoFeeAmount = (entryFee * daoFeePercent) / 100;
        uint256 boostFeeAmount = boostCount > 0 ? (entryFee * powerUpFeePercent * boostCount) / 100 : 0;
        
        revenue.daoFees += daoFeeAmount;
        revenue.boostFees += boostFeeAmount;
        revenue.totalRevenue += daoFeeAmount + boostFeeAmount;
    }

    function getExternalContractRevenue(address contractAddress) external view returns (
        uint256 daoFees,
        uint256 boostFees,
        uint256 entropyBalance,
        uint256 totalRevenue,
        uint256 lastWithdraw,
        uint256 activeClashId
    ) {
        ExternalContractRevenue storage revenue = contractRevenue[contractAddress];
        return (
            revenue.daoFees,
            revenue.boostFees,
            revenue.entropyBalance,
            revenue.totalRevenue,
            revenue.lastWithdraw,
            revenue.activeClashId
        );
    }

    function getExternalContractClash(uint256 clashId) external view returns (
        address contractAddress,
        ClashSize clashSize,
        ClashState state,
        uint8 playerCount,
        uint8 house,
        uint256[] memory critterIds,
        uint256[] memory scores
    ) {
        require(clashToContract[clashId] != address(0), "Not an external clash");
        Clash storage clash = clashes[clashId];
        
        uint256[] memory _critterIds = new uint256[](clash.playerCount);
        uint256[] memory _scores = new uint256[](clash.playerCount);
        
        for (uint8 i = 0; i < clash.playerCount; i++) {
            _critterIds[i] = clash.critterIds[i];
            _scores[i] = clash.sortedScores[i];
        }
        
        return (
            clashToContract[clashId],
            clash.clashSize,
            clash.state,
            clash.playerCount,
            clash.house,
            _critterIds,
            _scores
        );
    }
    
    /**
     * @dev Pauses all contract functionality using the Pausable pattern
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses contract functionality
     */
    function unpause() external onlyOwner {
        _unpause();
    }
} 