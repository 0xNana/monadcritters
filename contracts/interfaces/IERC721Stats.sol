// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC721Stats {
    /**
     * @dev Returns the stats for a given token ID
     * @param tokenId The ID of the token to get stats for
     * @return stamina The stamina stat (0-255)
     * @return speed The speed stat (0-255)
     * @return luck The luck stat (0-255)
     * @return rarity The rarity value (determines house mapping)
     */
    function getStats(uint256 tokenId) external view returns (
        uint256 stamina,
        uint256 speed,
        uint256 luck,
        uint256 rarity
    );

    /**
     * @dev Optional: Returns if this contract supports the stats interface
     */
    function supportsStatsInterface() external view returns (bool);
} 