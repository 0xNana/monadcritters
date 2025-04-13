// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "hardhat/console.sol";

interface IEntropyReceiver {
    function handleEntropyCallback(uint64 sequenceNumber, address provider, bytes32 randomNumber) external;
}

contract MockEntropy {
    uint256 public constant FEE = 0.0001 ether;
    address public provider;
    uint64 private nextSequenceNumber = 1;  // Start from 1 instead of 0
    
    // Track random numbers for each sequence number
    mapping(uint64 => bytes32) public randomNumbers;
    mapping(uint64 => address) public consumers;
    mapping(address => uint64[]) public consumerSequences;  // Track sequences per consumer
    
    constructor(address _provider) {
        provider = _provider;
    }
    
    function setProvider(address _provider) external {
        provider = _provider;
    }
    
    function getFee(address) external pure returns (uint256) {
        return FEE;
    }
    
    function requestWithCallback(
        address _provider,
        bytes32 userRandomNumber
    ) external payable returns (uint64) {
        require(msg.value >= FEE, "Insufficient fee");
        require(_provider == provider, "Invalid provider");
        
        // Store the user random number and consumer
        uint64 currentSeq = nextSequenceNumber++;  // Increment after getting current value
        randomNumbers[currentSeq] = userRandomNumber;
        consumers[currentSeq] = msg.sender;
        consumerSequences[msg.sender].push(currentSeq);
        
        // Log debug info
        console.log("Mock Request - Sequence:", currentSeq);
        console.log("Mock Request - Consumer:", msg.sender);
        console.log("Mock Request - Provider:", provider);
        
        return currentSeq;  // Return the sequence number like the real entropy contract
    }
    
    function mockCallback(
        uint64 sequenceNumber,
        bytes32 randomNumber
    ) external {
        require(randomNumbers[sequenceNumber] != bytes32(0), "Invalid sequence number");
        address consumer = consumers[sequenceNumber];
        require(consumer != address(0), "Consumer not found");
        
        // Log debug info
        console.log("Mock Callback - Sequence:", sequenceNumber);
        console.log("Mock Callback - Consumer:", consumer);
        console.log("Mock Callback - Provider:", provider);
        console.log("Mock Callback - Random Number:", uint256(randomNumber));
        
        // Call the consumer's callback function through the public interface
        IEntropyReceiver(consumer).handleEntropyCallback(
            sequenceNumber,
            provider,
            randomNumber
        );
        
        // Clear the request data after successful callback
        delete randomNumbers[sequenceNumber];
        delete consumers[sequenceNumber];
        
        // Remove sequence from consumer's array
        uint64[] storage sequences = consumerSequences[consumer];
        for (uint256 i = 0; i < sequences.length; i++) {
            if (sequences[i] == sequenceNumber) {
                sequences[i] = sequences[sequences.length - 1];
                sequences.pop();
                break;
            }
        }
    }

    // Add receive function to accept ETH
    receive() external payable {}
    
    // Helper function to get all sequence numbers for a consumer
    function getConsumerSequences(address consumer) external view returns (uint64[] memory) {
        return consumerSequences[consumer];
    }
} 