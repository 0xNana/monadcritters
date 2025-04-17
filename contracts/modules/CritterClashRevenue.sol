// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../CritterClashStorage.sol";

/**
 * @title CritterClashRevenue
 * @dev Handles all revenue and fee related functionality
 */
contract CritterClashRevenue is ReentrancyGuard, Pausable, CritterClashStorage {
    // Revenue events
    event DAOFeeWithdrawn(uint256 amount);
    event BoostFeesWithdrawn(uint256 amount);
    event DAOFeeUpdated(uint256 oldFee, uint256 newFee);
    event PowerUpFeeUpdated(uint256 oldFee, uint256 newFee);
    event BoostsPurchased(address indexed player, uint256 amount, uint256 cost, address tokenAddress);

    mapping(address => RevenueInfo) public revenueInfo;

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

    function handlePaymentAndBoosts(
        ClashSize clashSize,
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
} 