// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../CritterClashStorage.sol";
import "../CritterClashStats.sol";

/**
 * @title CritterClashAdmin
 * @dev Handles all administrative functions
 */
contract CritterClashAdmin is ReentrancyGuard, Pausable, CritterClashStorage {
    // Add clashDuration state variable
    uint256 public clashDuration;
    
    // Admin events
    event EntryFeeUpdated(ClashSize indexed clashSize, uint256 newFee);
    event ClashTypeUpdated(ClashSize indexed clashSize, bool isActive);
    event ClashDurationUpdated(uint256 newDuration);
    event StatsContractSet(address statsContract);
    event EmergencyFundWithdrawn(uint256 amount);

    constructor() {
        // Set default clash duration to 5 minutes
        clashDuration = 300;
    }

    function setEntryFee(ClashSize clashSize, uint256 entryFeeInEth) external onlyOwner {
        require(clashSize != ClashSize.None, "Invalid clash size");
        clashTypes[clashSize].entryFee = uint96(entryFeeInEth);
        emit EntryFeeUpdated(clashSize, clashTypes[clashSize].entryFee);
    }

    function setClashTypeActive(ClashSize clashSize, bool isActive) external onlyOwner {
        require(clashSize != ClashSize.None, "Invalid clash size");
        clashTypes[clashSize].isActive = isActive;
        emit ClashTypeUpdated(clashSize, isActive);
    }

    function setClashType(
        ClashSize clashSize,
        uint256 maxPlayers,
        uint256 numWinners,
        uint256 entryFeeInEth,
        uint256[] calldata rewardPercentages
    ) external onlyOwner {
        require(maxPlayers > 1 && maxPlayers <= 10, "Invalid max players (2-10)");
        require(numWinners > 0 && numWinners <= maxPlayers, "Invalid number of winners");
        require(rewardPercentages.length == numWinners, "Invalid reward percentages length");
        
        uint256 totalPercentage;
        for (uint256 i = 0; i < rewardPercentages.length; i++) {
            totalPercentage += rewardPercentages[i];
        }
        require(totalPercentage == 100, "Reward percentages must sum to 100");

        clashTypes[clashSize] = ClashType({
            maxPlayers: uint96(maxPlayers),
            numWinners: uint96(numWinners),
            entryFee: uint96(entryFeeInEth * 1 ether),
            isActive: false,
            rewardPercentages: rewardPercentages
        });

        emit ClashTypeUpdated(clashSize, false);
        emit EntryFeeUpdated(clashSize, entryFeeInEth * 1 ether);
    }

    function setClashDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 30 && newDuration <= 3600, "Duration must be between 30s and 1h");
        clashDuration = newDuration;
        emit ClashDurationUpdated(newDuration);
    }

    function setStatsContract(address _stats) external onlyOwner {
        require(address(statsContract) == address(0), "Stats already set");
        require(_stats != address(0), "Invalid stats address");
        statsContract = CritterClashStats(_stats);
        emit StatsContractSet(_stats);
    }

    function withdrawEmergencyFund() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        uint256 reservedFunds = fundAccounting.prizePool + entropyStorage.entropyFeeBalance;
        require(balance > reservedFunds, "No excess funds available");
        
        uint256 emergencyFunds = balance - reservedFunds;
        (bool success, ) = msg.sender.call{value: emergencyFunds}("");
        require(success, "Emergency fund withdrawal failed");
        emit EmergencyFundWithdrawn(emergencyFunds);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    function initializeDefaultClashTypes() external onlyOwner {
        // Two player clash - Winner takes all
        uint256[] memory twoPlayerRewards = new uint256[](1);
        twoPlayerRewards[0] = 100;
        clashTypes[ClashSize.Two] = ClashType({
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
        clashTypes[ClashSize.Four] = ClashType({
            maxPlayers: 4,
            numWinners: 2,
            entryFee: 0.1 ether,
            rewardPercentages: fourPlayerRewards,
            isActive: true
        });

        emit ClashTypeUpdated(ClashSize.Two, true);
        emit ClashTypeUpdated(ClashSize.Four, true);
    }
}