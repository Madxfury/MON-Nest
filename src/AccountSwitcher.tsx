'use client';

import { shorten } from './data';
import { useWallet } from './wallet/WalletProvider';

/** Lets a browser-wallet user pick which connected account this tab uses. */
export default function AccountSwitcher() {
  const { address, kind, accounts, switchAccount, connect } = useWallet();
  if (kind !== 'injected' || !address) return null;
  return <div className="account-switcher">
    <span>Accounts connected to MON-Nest</span>
    <div>
      {accounts.map(account => account.toLowerCase() === address.toLowerCase()
        ? <strong key={account} className="account-current">{shorten(account)} · this tab</strong>
        : <button key={account} className="quiet-button" onClick={() => switchAccount(account)}>Use {shorten(account)} in this tab</button>)}
      <button className="quiet-button" onClick={() => void connect()}>+ Connect another account</button>
    </div>
    <small>Each browser tab keeps its own account, so you can be the renter in one tab and the owner in another.</small>
    {accounts[0] && accounts[0].toLowerCase() !== address.toLowerCase() && <small className="account-hint">Your wallet currently has {shorten(accounts[0])} selected. Select {shorten(address)} in your wallet before signing from this tab.</small>}
  </div>;
}
