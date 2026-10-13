import '@nomicfoundation/hardhat-toolbox';
import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz',
      chainId: Number(process.env.MONAD_TESTNET_CHAIN_ID || 10143),
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;
