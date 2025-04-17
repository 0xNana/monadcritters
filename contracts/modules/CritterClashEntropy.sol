// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "../CritterClashStorage.sol";
import "../ScoreCalculator.sol";

// Interface for stats contract
interface ICritterClashStats {
    function recordEntropyUsage(uint256 count, uint256 fee) external;
}

/**
 * @title CritterClashEntropy
 * @dev Handles all entropy (randomness) related functionality
 */
contract CritterClashEntropy is ReentrancyGuard, IEntropyConsumer, CritterClashStorage {
    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    
    // Add missing contract references
    IScoreReceiver public scoreCalculator;
    
    // Add state variable for tracking entropy requests
    mapping(uint256 => uint256) public clashPendingRandomness;

    // Events
    event EntropyFeeDeposited(uint256 amount);
    event EntropyFeeWithdrawn(uint256 amount);
    event EntropyRequested(uint256 indexed clashId, uint256 requestId, uint256 fee);
    event EntropyRequestFailed(uint256 indexed clashId, uint256 fee);
    event EntropyTimeout(uint256 indexed clashId);
    event StatsContractSet(address indexed statsContract);
    event ScoreCalculatorSet(address indexed scoreCalculator);

    constructor(address _entropyProvider, address _entropy) {
        require(_entropyProvider != address(0), "Invalid entropy provider");
        require(_entropy != address(0), "Invalid entropy contract");
        entropyProvider = _entropyProvider;
        entropy = IEntropy(_entropy);
        
        // Initialize entropy storage
        entropyStorage.nextSequenceNumber = 0;
        entropyStorage.entropyFeeBalance = 0;
    }

    // Function to set the stats contract
    function setStatsContract(address _statsContract) external onlyOwner {
        require(_statsContract != address(0), "Invalid stats contract");
        statsContract = ICritterClashStats(_statsContract);  // Fix this line
        emit StatsContractSet(_statsContract);
    }

    // Function to set the score calculator
    function setScoreCalculator(address _scoreCalculator) external onlyOwner {
        require(_scoreCalculator != address(0), "Invalid score calculator");
        scoreCalculator = IScoreReceiver(_scoreCalculator);
        emit ScoreCalculatorSet(_scoreCalculator);
    }

    // Add helper functions for entropy state management
    function isWaitingForEntropy(uint256 clashId) public view returns (bool) {
        return clashPendingRandomness[clashId] != 0;
    }

    function clearEntropyRequest(uint256 clashId) internal {
        delete clashPendingRandomness[clashId];
        emit EntropyTimeout(clashId);
    }

    function depositEntropyFee() external payable onlyOwner {
        require(msg.value > 0, "Must deposit some ETH");
        entropyStorage.entropyFeeBalance = uint192(uint256(entropyStorage.entropyFeeBalance) + msg.value);
        emit EntropyFeeDeposited(msg.value);
    }

    function withdrawEntropyFee() external onlyOwner nonReentrant {
        uint256 amount = entropyStorage.entropyFeeBalance;
        if (amount == 0) return;
        entropyStorage.entropyFeeBalance = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Entropy fee withdrawal failed");
        emit EntropyFeeWithdrawn(amount);
    }

    function getRequiredEntropyFee(uint256 playerCount) public view returns (uint256) {
        return entropy.getFee(entropyProvider) * playerCount;
    }

    function _requestSingleEntropyForClash(uint256 clashId, uint8 playerCount) internal {
        Clash storage clash = clashes[clashId];
        require(clash.state == ClashState.CLASHING, "Clash not in clashing state");
        
        uint256 entropyFee = entropy.getFee(entropyProvider);
        require(entropyStorage.entropyFeeBalance >= entropyFee, "Insufficient entropy fee balance");
        
        entropyStorage.entropyFeeBalance = uint192(uint256(entropyStorage.entropyFeeBalance) - entropyFee);
        
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
            entropyStorage.randomRequests[requestId] = userRandomNumber;
            entropyStorage.requestToClash[requestId] = clashId;
            entropyStorage.clashSequenceNumber[clashId] = requestId;
            clashPendingRandomness[clashId] = playerCount;
            
            if (address(statsContract) != address(0)) {
                statsContract.recordEntropyUsage(1, entropyFee);
            }
            
            emit EntropyRequested(clashId, requestId, entropyFee);
        } catch {
            entropyStorage.entropyFeeBalance = uint192(uint256(entropyStorage.entropyFeeBalance) + entropyFee);
            emit EntropyRequestFailed(clashId, entropyFee);
            revert("Entropy request failed");
        }
    }

    function handleEntropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external {
        require(msg.sender == address(entropy), "Only entropy contract can call");
        require(provider == entropyProvider, "Invalid provider");
        
        // Process entropy directly
        require(provider == entropyProvider, "Invalid entropy provider");
        require(entropyStorage.randomRequests[sequenceNumber] != bytes32(0), "Invalid sequence number");
        
        uint256 clashId = entropyStorage.requestToClash[sequenceNumber];
        require(clashId > 0, "Clash not found");
        
        Clash storage clash = clashes[clashId];
        require(clash.state == ClashState.CLASHING, "Clash not in progress");

        // Process entropy and update scores through ScoreCalculator
        scoreCalculator.onEntropyReceived(clashId, randomNumber);
        
        // Clean up entropy storage
        delete entropyStorage.randomRequests[sequenceNumber];
        delete entropyStorage.requestToClash[sequenceNumber];
        delete entropyStorage.clashSequenceNumber[clashId];
        delete clashPendingRandomness[clashId];
    }

    /**
     * @dev Implementation of IEntropyConsumer.getEntropy
     */
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @dev Implementation of IEntropyConsumer.entropyCallback
     */
    function entropyCallback(
        uint64 sequenceNumber,
        bytes32 randomness,
        uint256, // blockNumber
        bytes32, // blockHash
        uint32 // blockTimestamp
    ) external {
        handleEntropyCallback(sequenceNumber, entropyProvider, randomness);
    }
}