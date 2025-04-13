// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SocialPointsTracker
 * @dev Contract for tracking social engagement points without modifying the main CritterClash contract
 */
contract SocialPointsTracker is Ownable {
    using ECDSA for bytes32;
    
    // Main CritterClash contract
    address public critterClashAddress;
    
    // Admin signer for validating claims
    address public adminSigner;
    
    // Deadline for claiming points
    uint256 public claimDeadline;
    
    // Track if user has already claimed
    mapping(address => bool) public hasClaimed;
    
    // User point balances
    mapping(address => uint256) public pointBalances;
    
    // User task completion status (taskId => completion status)
    mapping(address => mapping(bytes32 => bool)) public completedTasks;
    
    // All users who have points
    address[] public pointHolders;
    mapping(address => bool) private isPointHolder;
    
    event PointsClaimed(address indexed user, uint256 points);
    event BatchPointsClaimed(uint256 userCount, uint256 totalPoints);
    event AdminSignerUpdated(address indexed newSigner);
    event ClaimDeadlineUpdated(uint256 newDeadline);
    
    constructor(address _critterClash, address _adminSigner) {
        critterClashAddress = _critterClash;
        adminSigner = _adminSigner;
        _transferOwnership(msg.sender);
    }
    
    /**
     * @dev Updates the admin signer address
     * @param _newSigner The new admin signer address
     */
    function updateAdminSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        adminSigner = _newSigner;
        emit AdminSignerUpdated(_newSigner);
    }
    
    /**
     * @dev Sets the deadline for claiming points
     * @param _deadline The timestamp after which points can't be claimed
     */
    function setClaimDeadline(uint256 _deadline) external onlyOwner {
        require(_deadline > block.timestamp, "Deadline must be in the future");
        claimDeadline = _deadline;
        emit ClaimDeadlineUpdated(_deadline);
    }
    
    /**
     * @dev Allows users to claim points with a valid signature
     * @param points The number of points to claim
     * @param signature The signature proving points are valid
     */
    function claimPoints(uint256 points, bytes calldata signature) external {
        require(block.timestamp <= claimDeadline, "Claim period ended");
        require(!hasClaimed[msg.sender], "Already claimed");
        
        // Verify signature (message contains user address and points)
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, points));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        require(ethSignedMessageHash.recover(signature) == adminSigner, "Invalid signature");
        
        // Mark as claimed and update points
        hasClaimed[msg.sender] = true;
        pointBalances[msg.sender] = points;
        
        // Add to point holders if first time
        if (!isPointHolder[msg.sender]) {
            isPointHolder[msg.sender] = true;
            pointHolders.push(msg.sender);
        }
        
        // Emit event 
        emit PointsClaimed(msg.sender, points);
    }
    
    /**
     * @dev Batch claims points for multiple users (admin only)
     * @param users Array of user addresses
     * @param points Array of point amounts
     */
    function batchClaimPoints(
        address[] calldata users,
        uint256[] calldata points
    ) external onlyOwner {
        require(users.length == points.length, "Array length mismatch");
        require(block.timestamp <= claimDeadline, "Claim period ended");
        
        uint256 totalPoints = 0;
        
        for (uint i = 0; i < users.length; i++) {
            if (!hasClaimed[users[i]]) {
                hasClaimed[users[i]] = true;
                pointBalances[users[i]] = points[i];
                totalPoints += points[i];
                
                // Add to point holders if first time
                if (!isPointHolder[users[i]]) {
                    isPointHolder[users[i]] = true;
                    pointHolders.push(users[i]);
                }
                
                emit PointsClaimed(users[i], points[i]);
            }
        }
        
        emit BatchPointsClaimed(users.length, totalPoints);
    }
    
    /**
     * @dev Gets user point balance
     * @param user The user address
     * @return The user's point balance
     */
    function getPointBalance(address user) external view returns (uint256) {
        return pointBalances[user];
    }
    
    /**
     * @dev Gets all point holders and their balances
     * @return users Array of user addresses
     * @return balances Array of point balances
     */
    function getAllPointHolders() external view returns (address[] memory users, uint256[] memory balances) {
        users = new address[](pointHolders.length);
        balances = new uint256[](pointHolders.length);
        
        for (uint i = 0; i < pointHolders.length; i++) {
            users[i] = pointHolders[i];
            balances[i] = pointBalances[pointHolders[i]];
        }
        
        return (users, balances);
    }
    
    /**
     * @dev Gets the top N point holders
     * @param count Number of top holders to return
     * @return users Array of user addresses
     * @return balances Array of point balances
     */
    function getTopPointHolders(uint256 count) external view returns (address[] memory users, uint256[] memory balances) {
        uint256 resultCount = count > pointHolders.length ? pointHolders.length : count;
        
        users = new address[](resultCount);
        balances = new uint256[](resultCount);
        
        // Create temporary array for sorting
        address[] memory tempUsers = new address[](pointHolders.length);
        uint256[] memory tempBalances = new uint256[](pointHolders.length);
        
        for (uint i = 0; i < pointHolders.length; i++) {
            tempUsers[i] = pointHolders[i];
            tempBalances[i] = pointBalances[pointHolders[i]];
        }
        
        // Simple bubble sort (inefficient but works for demonstration)
        for (uint i = 0; i < tempUsers.length; i++) {
            for (uint j = i + 1; j < tempUsers.length; j++) {
                if (tempBalances[i] < tempBalances[j]) {
                    // Swap balances
                    uint256 tempBalance = tempBalances[i];
                    tempBalances[i] = tempBalances[j];
                    tempBalances[j] = tempBalance;
                    
                    // Swap users
                    address tempUser = tempUsers[i];
                    tempUsers[i] = tempUsers[j];
                    tempUsers[j] = tempUser;
                }
            }
        }
        
        // Copy top N results
        for (uint i = 0; i < resultCount; i++) {
            users[i] = tempUsers[i];
            balances[i] = tempBalances[i];
        }
        
        return (users, balances);
    }
} 