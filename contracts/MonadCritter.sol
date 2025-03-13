// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract MonadCritter is ERC721, Ownable, Pausable {
    using Strings for uint256;

    // All prices are in MON (Monad's native token)
    // 1 MON = 1e18 (18 decimals)
    uint256 public mintPrice = 0.01 * 1e18; // 0.01 MON
    uint256 public totalSupply;
    
    // Maximum mints per wallet
    uint256 public constant MAX_MINTS_PER_WALLET = 4;
    
    // Track mints per wallet
    mapping(address => uint256) public mintsPerWallet;

    // Base URI for sprites
    string public baseImageURI = "https://monadcritters.example.com/assets/sprites/";
    
    // Rarity names for metadata
    string[4] private rarityNames = ["Common", "Uncommon", "Rare", "Legendary"];
    
    // Sprite sizes for different display contexts
    uint256[5] private spriteSizes = [512, 256, 128, 64, 32];

    struct Stats {
        uint8 speed;
        uint8 stamina;
        uint8 luck;
        uint8 rarity; // 0: Common, 1: Uncommon, 2: Rare, 3: Legendary
    }

    mapping(uint256 => Stats) public tokenStats;

    event CritterMinted(uint256 indexed tokenId, address indexed owner, Stats stats);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event BaseImageURIUpdated(string oldURI, string newURI);

    constructor() ERC721("MonadCritter", "MCRIT") {
        _transferOwnership(msg.sender);
    }

    function mint() external payable whenNotPaused {
        require(msg.value >= mintPrice, "Insufficient MON sent");
        require(mintsPerWallet[msg.sender] < MAX_MINTS_PER_WALLET, "Exceeded max mints per wallet");

        uint256 tokenId = totalSupply + 1;
        Stats memory stats = generateStats();
        
        _safeMint(msg.sender, tokenId);
        tokenStats[tokenId] = stats;
        totalSupply++;
        mintsPerWallet[msg.sender]++;

        // Refund excess MON if any
        uint256 excess = msg.value - mintPrice;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "MON refund failed");
        }

        emit CritterMinted(tokenId, msg.sender, stats);
    }
    
    function ownerMint(address to, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        for (uint256 i = 0; i < amount; i++) {
            uint256 tokenId = totalSupply + 1;
            Stats memory stats = generateStats();
            
            _safeMint(to, tokenId);
            tokenStats[tokenId] = stats;
            totalSupply++;
            
            emit CritterMinted(tokenId, to, stats);
        }
    }

    function generateStats() internal view returns (Stats memory) {
        // Use block data and token data for randomness
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            totalSupply
        )));

        // Determine rarity (70/20/9/1 distribution)
        uint8 rarity;
        uint256 rarityRoll = rand % 100;
        if (rarityRoll < 70) rarity = 0; // Common
        else if (rarityRoll < 90) rarity = 1; // Uncommon
        else if (rarityRoll < 99) rarity = 2; // Rare
        else rarity = 3; // Legendary

        // Generate base stats (1-100)
        uint8 speed = uint8(((rand >> 8) % 60) + 40); // 40-100
        uint8 stamina = uint8(((rand >> 16) % 60) + 40); // 40-100
        uint8 luck = uint8(((rand >> 24) % 60) + 40); // 40-100

        // Apply rarity boosts
        if (rarity == 1) { // Uncommon: +10%
            uint256 boostedSpeed = uint256(speed) * 110 / 100;
            uint256 boostedStamina = uint256(stamina) * 110 / 100;
            uint256 boostedLuck = uint256(luck) * 110 / 100;
            speed = uint8(boostedSpeed > 255 ? 255 : boostedSpeed);
            stamina = uint8(boostedStamina > 255 ? 255 : boostedStamina);
            luck = uint8(boostedLuck > 255 ? 255 : boostedLuck);
        } else if (rarity == 2) { // Rare: +25%
            uint256 boostedSpeed = uint256(speed) * 125 / 100;
            uint256 boostedStamina = uint256(stamina) * 125 / 100;
            uint256 boostedLuck = uint256(luck) * 125 / 100;
            speed = uint8(boostedSpeed > 255 ? 255 : boostedSpeed);
            stamina = uint8(boostedStamina > 255 ? 255 : boostedStamina);
            luck = uint8(boostedLuck > 255 ? 255 : boostedLuck);
        } else if (rarity == 3) { // Legendary: +50%
            uint256 boostedSpeed = uint256(speed) * 150 / 100;
            uint256 boostedStamina = uint256(stamina) * 150 / 100;
            uint256 boostedLuck = uint256(luck) * 150 / 100;
            speed = uint8(boostedSpeed > 255 ? 255 : boostedSpeed);
            stamina = uint8(boostedStamina > 255 ? 255 : boostedStamina);
            luck = uint8(boostedLuck > 255 ? 255 : boostedLuck);
        }

        return Stats(speed, stamina, luck, rarity);
    }

    function getStats(uint256 tokenId) external view returns (Stats memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenStats[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        Stats memory stats = tokenStats[tokenId];
        
        // Build the JSON metadata in parts to reduce stack depth
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(_buildTokenJSON(tokenId, stats))
            )
        );
    }
    
    function _buildTokenJSON(uint256 tokenId, Stats memory stats) internal view returns (bytes memory) {
        string memory rarityName = rarityNames[stats.rarity];
        string memory rarityLower = toLower(rarityName);
        
        // Part 1: Basic metadata
        bytes memory part1 = abi.encodePacked(
            '{"name": "MonadCritter #', tokenId.toString(), '",',
            '"description": "A ', rarityName, ' MonadCritter for racing on the Monad blockchain.",',
            '"attributes": [',
                '{"trait_type": "Rarity", "value": "', rarityName, '"},',
                '{"trait_type": "Speed", "value": ', uint256(stats.speed).toString(), '},',
                '{"trait_type": "Stamina", "value": ', uint256(stats.stamina).toString(), '},',
                '{"trait_type": "Luck", "value": ', uint256(stats.luck).toString(), '}',
            '],'
        );
        
        // Part 2: Image URLs
        bytes memory part2 = abi.encodePacked(
            '"image": "', baseImageURI, rarityLower, '-', spriteSizes[0].toString(), '.png",',
            '"image_512": "', baseImageURI, rarityLower, '-', spriteSizes[0].toString(), '.png",',
            '"image_256": "', baseImageURI, rarityLower, '-', spriteSizes[1].toString(), '.png",',
            '"image_128": "', baseImageURI, rarityLower, '-', spriteSizes[2].toString(), '.png",',
            '"image_64": "', baseImageURI, rarityLower, '-', spriteSizes[3].toString(), '.png",',
            '"image_32": "', baseImageURI, rarityLower, '-', spriteSizes[4].toString(), '.png"',
            '}'
        );
        
        return abi.encodePacked(part1, part2);
    }
    
    function toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        
        for (uint i = 0; i < bStr.length; i++) {
            // Convert uppercase to lowercase
            if (bStr[i] >= 0x41 && bStr[i] <= 0x5A) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        
        return string(bLower);
    }
    
    function setBaseImageURI(string memory _baseImageURI) external onlyOwner {
        string memory oldURI = baseImageURI;
        baseImageURI = _baseImageURI;
        emit BaseImageURIUpdated(oldURI, _baseImageURI);
    }

    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = _mintPrice;
        emit MintPriceUpdated(oldPrice, _mintPrice);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No MON balance to withdraw");
        
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "MON transfer failed");
    }
}

interface IMonadCritter {
    struct Stats {
        uint256 speed;
        uint256 stamina;
        uint256 luck;
    }

    function getStats(uint256 tokenId) external view returns (Stats memory);
}