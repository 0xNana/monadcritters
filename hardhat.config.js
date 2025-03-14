require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: false
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        count: 20, // Ensure we have enough accounts for testing
        accountsBalance: "10000000000000000000000" // 10000 ETH
      },
      mining: {
        auto: true,
        interval: 0
      }
    }
  },
  mocha: {
    timeout: 40000
  }
}; 