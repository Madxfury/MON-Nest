import { shorten } from './data';

// Each browser tab keeps its own MON-Nest account, so one tab can act as the renter and
// another as the owner. The wallet still decides which accounts this site may use.
const TAB_ACCOUNT_KEY = 'mon-nest-tab-account';

export function rememberTabAccount(account: string) {
  try {
    if (account) sessionStorage.setItem(TAB_ACCOUNT_KEY, account);
    else sessionStorage.removeItem(TAB_ACCOUNT_KEY);
  } catch {}
}

/** The account this tab signed in with, if the wallet still permits it; otherwise ''. */
export function tabAccountFrom(permitted: string[]) {
  let saved = '';
  try { saved = (sessionStorage.getItem(TAB_ACCOUNT_KEY) || '').toLowerCase(); } catch {}
  return permitted.find(account => account.toLowerCase() === saved) || '';
}

export async function permittedAccounts(): Promise<string[]> {
  if (!window.ethereum) return [];
  return (await window.ethereum.request({ method: 'eth_accounts' }) as string[]) || [];
}

/** Opens the wallet's account chooser and returns the account this tab should use. */
export async function chooseAccount(): Promise<string> {
  const provider = window.ethereum;
  if (!provider) return '';
  const before = await permittedAccounts().catch(() => [] as string[]);
  try {
    await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
  } catch (error) {
    // Wallets without the permissions API fall back to a plain connection request.
    if ((error as { code?: number }).code !== -32601) throw error;
    await provider.request({ method: 'eth_requestAccounts' });
  }
  const after = await permittedAccounts();
  // Prefer the account the person just added; otherwise the wallet's currently selected one.
  return after.find(account => !before.some(old => old.toLowerCase() === account.toLowerCase())) || after[0] || '';
}

/** The wallet account to send from: the tab's account, provided the wallet permits it. */
export async function signerFor(walletAccount: string) {
  const provider = window.ethereum;
  if (!provider) throw new Error('Install an Ethereum-compatible wallet to continue.');
  let accounts = await permittedAccounts();
  if (!accounts.length) accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  const from = accounts.find(account => account.toLowerCase() === walletAccount.toLowerCase());
  if (!from) throw new Error('This account is no longer connected to MON-Nest. Reconnect it from your profile and try again.');
  // MetaMask 13.52's confirmation screen crashed in testing when asked to sign for a connected
  // account other than the one selected in the wallet, so ask for that account to be selected first.
  if (accounts[0].toLowerCase() !== from.toLowerCase()) throw new Error(`Open your wallet and select ${shorten(from)}, the account this tab uses, then try again.`);
  return from;
}
