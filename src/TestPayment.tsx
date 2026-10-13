'use client';

import { useState } from 'react';
import { createPublicClient, http, type Hash } from 'viem';
import { monadTestnet } from 'viem/chains';

export default function TestPayment() {
  const [status, setStatus] = useState('');
  const [hash, setHash] = useState<Hash>();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!window.ethereum) { setStatus('Open this page in a browser with an Ethereum-compatible wallet installed.'); return; }
    setBusy(true); setHash(undefined);
    try {
      const provider = window.ethereum;
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts[0]) throw new Error('No wallet account selected.');
      setStatus('Switch to Monad Testnet in your wallet.');
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x279f', chainName: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: ['https://testnet-rpc.monad.xyz'], blockExplorerUrls: ['https://testnet.monadvision.com'] }] });
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      }
      const chain = await provider.request({ method: 'eth_chainId' });
      if (chain !== '0x279f') throw new Error('Please select Monad Testnet.');
      setStatus('Approve the 0 MON transaction. Your wallet will show the gas fee.');
      // A zero-value self-transfer tests wallet signing and settlement without a recipient fee.
      const tx = await provider.request({ method: 'eth_sendTransaction', params: [{ from: accounts[0], to: accounts[0], value: '0x0' }] }) as Hash;
      setHash(tx); setStatus('Transaction submitted. Waiting for confirmation…');
      const client = createPublicClient({ chain: monadTestnet, transport: http('https://testnet-rpc.monad.xyz') });
      const receipt = await client.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      setStatus(receipt.status === 'success' ? 'Confirmed — 0 MON transferred. Only network gas was charged.' : 'Transaction reverted. Check the explorer for details.');
    } catch (error) {
      setStatus((error as { code?: number }).code === 4001 ? 'Transaction cancelled in your wallet.' : error instanceof Error ? error.message : 'Payment could not be completed.');
    } finally { setBusy(false); }
  }

  return <article className="panel test-payment"><div><span className="panel-kicker">TEST PRODUCT · MONAD TESTNET</span><h2>MON-Nest payment test</h2><p>0 MON price · 0 MON deposit · 0 MON platform fee</p><small>Send 0 MON to your own wallet. This tests a real transaction; it does not book a rental. You need a little testnet MON for gas.</small></div><button className="primary-btn" disabled={busy} onClick={pay}>{busy ? 'Processing…' : 'Pay 0 MON + gas'}</button><div role="status" aria-live="polite">{status}</div>{hash && <a href={`https://testnet.monadvision.com/tx/${hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>}</article>;
}
