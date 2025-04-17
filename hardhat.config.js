require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");

require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris",
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
      allowUnlimitedContractSize: true, // Add this for testing
      mining: {
        auto: true,
        interval: 0
      }
    },
    monad: {
      url: process.env.VITE_MONAD_PRIMARY_RPC || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [process.env.MONAD_TESTNET_PRIVATE_KEY].filter(Boolean)
    }
  },
  mocha: {
    timeout: 40000
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadexplorer.com"
  }
}; 