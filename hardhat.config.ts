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
            url: "https://lb.drpc.org/ogrpc?network=monad-testnet&dkey=Aqc2SxxCSUZUic_W8QUkq94l8CrHAroR8IETfhHoK236",
            accounts: process.env.MONAD_TESTNET_PRIVATE_KEY ? [process.env.MONAD_TESTNET_PRIVATE_KEY] : [],
            chainId: 10143,
            gas: 10000000,
            timeout: 600000  // 5 minutes
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
        apiKey: ""
    }
};

export default config; 