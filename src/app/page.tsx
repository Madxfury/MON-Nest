import App from '../App';
import { WalletProvider } from '../wallet/WalletProvider';

export default function Home() {
  return <WalletProvider><App alchemyConfigured={Boolean(process.env.ALCHEMY_MONAD_TESTNET_RPC_URL)} /></WalletProvider>;
}
