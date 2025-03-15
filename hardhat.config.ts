require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox-viem");
require("ts-node/register");
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            evmVersion: "paris",
            viaIR: true,
        },
    },
    networks: {
        monadTestnet: {
            url: "https://testnet-rpc.monad.xyz",
            accounts: process.env.MONAD_TESTNET_PRIVATE_KEY ? [process.env.MONAD_TESTNET_PRIVATE_KEY] : [],
            chainId: 10143,
            gasPrice: 1000000000000,
            gas: 10000000,
            timeout: 60000
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/H1zC39JXN7BWm5miBv-NBDwsF1INON5w",
            accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
            chainId: 11155111,
            gasPrice: "auto",
            timeout: 60000
        },
        hardhat: {
            chainId: 31337,
            mining: {
                auto: true,
                interval: 0,
                mempool: {
                    order: "fifo"
                }
            }
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    mocha: {
        require: ["ts-node/register"],
        timeout: 40000
    },
    sourcify: {
        enabled: true,
        apiUrl: "https://sourcify-api-monad.blockvision.org",
        browserUrl: "https://testnet.monadexplorer.com",
    },
    etherscan: {
        enabled: false
    }
};

export default config; 