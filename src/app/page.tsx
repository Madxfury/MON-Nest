import App from '../App';
import { WalletProvider } from '../wallet/WalletProvider';

export default function Home() {
  return <WalletProvider><App /></WalletProvider>;
}
