import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

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
            metadata: {
                bytecodeHash: "none",
                useLiteralContent: true
            }
        },
    },
    networks: {
        monad: {
            url: "https://testnet-rpc.monad.xyz/",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 10143,
            gas: 10000000,
            timeout: 160000
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
        browserUrl: "https://testnet.monadexplorer.com"
    },
    etherscan: {
        enabled: false
    }
};

export default config; 