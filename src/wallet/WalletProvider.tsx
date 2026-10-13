'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, http, type Address, type Hash, type Hex } from 'viem';
import { monadTestnet } from 'viem/chains';
import { HDKey } from '@scure/bip32';
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, type Secp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { ensureMonadTestnet } from '../escrow';
import { chooseAccount, permittedAccounts, rememberTabAccount, signerFor, tabAccountFrom } from '../walletSession';

type Transaction = { to: Address; data?: Hex; value?: bigint };
type WalletState = {
  address: Address | null; kind: 'mera' | 'injected' | null; connecting: boolean;
  connect: () => Promise<void>; disconnect: () => void;
  /** Browser-wallet accounts this site may use; each tab picks its own. */
  accounts: string[]; switchAccount: (account: string) => void;
  send: (tx: Transaction) => Promise<Hash>;
};
const Context = createContext<WalletState | null>(null);
const MERA_RECORD = 'mon-nest-mera-v1';
const LAST_WALLET = 'mon-nest-wallet-kind';
// Immutable account derivation v1: BIP32 seed = WebAuthn PRF output, EVM path 0.
const ACCOUNT_PATH = "m/44'/60'/0'/0/0";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [kind, setKind] = useState<WalletState['kind']>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<Secp256k1SigningSession | null>(null);
  const resolver = useRef<(() => void) | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const rpId = () => window.location.hostname;

  const closeChooser = useCallback(() => {
    setChooser(false); resolver.current?.(); resolver.current = null;
  }, []);
  useEffect(() => {
    if (!chooser) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); if (!connecting) closeChooser(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || []);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', key, true); previousFocus?.focus(); };
  }, [chooser, connecting, closeChooser]);

  const disconnect = useCallback(() => {
    session.current?.end(); session.current = null;
    // A browser wallet signs out only this tab; other tabs keep their own accounts.
    rememberTabAccount('');
    if (kind === 'mera') { localStorage.setItem('mon-nest-wallet-disconnected', 'true'); localStorage.removeItem(LAST_WALLET); }
    setAddress(null); setKind(null);
  }, [kind]);

  const switchAccount = useCallback((account: string) => {
    rememberTabAccount(account);
    setAddress(getAddress(account)); setKind('injected');
  }, []);

  useEffect(() => {
    const provider = window.ethereum;
    let active = true;
    const restore = async () => {
      if (localStorage.getItem('mon-nest-wallet-disconnected') === 'true') return;
      if (localStorage.getItem(LAST_WALLET) === 'mera') {
        try {
          const record = JSON.parse(localStorage.getItem(MERA_RECORD) || 'null');
          // Restore public identity only. Signing requires a fresh passkey gesture.
          if (active && record?.address && record.rpId === rpId() && record.derivation === 'bip32-prf-v1') { setAddress(getAddress(record.address)); setKind('mera'); }
        } catch { /* Ignore invalid public metadata. */ }
      } else if (provider) {
        // Each tab restores only the browser-wallet account it signed in with; a new tab starts signed out.
        const permitted = await provider.request({ method: 'eth_accounts' }) as string[];
        const account = tabAccountFrom(permitted);
        if (active) setAccounts(permitted);
        if (active && account) { setAddress(getAddress(account)); setKind('injected'); }
      }
    };
    void restore().catch(() => {});
    const changed = (...args: unknown[]) => {
      if (localStorage.getItem(LAST_WALLET) === 'mera' || localStorage.getItem('mon-nest-wallet-disconnected') === 'true') return;
      // Keep this tab's account while the wallet still permits it, whichever account is selected there.
      const permitted = args[0] as string[];
      const account = tabAccountFrom(permitted);
      setAccounts(permitted);
      setAddress(account ? getAddress(account) : null); setKind(account ? 'injected' : null);
    };
    provider?.on?.('accountsChanged', changed);
    return () => { active = false; provider?.removeListener?.('accountsChanged', changed); session.current?.end(); };
  }, []);

  async function mera(create: boolean) {
    setConnecting(true); setError('');
    let output: Uint8Array | undefined;
    let root: HDKey | undefined;
    let child: HDKey | undefined;
    try {
      if (!window.isSecureContext || !navigator.credentials) throw new Error('Passkeys need HTTPS or localhost in a supported browser.');
      const result = create ? await createPasskeyWithPrfOutput({ rp: { id: rpId(), name: 'MON-Nest' }, user: { name: 'MON-Nest account', displayName: 'MON-Nest account' } }) : await getPasskeyPrfOutput({ rpId: rpId() });
      output = result.prfOutput;
      root = HDKey.fromMasterSeed(output);
      child = root.derive(ACCOUNT_PATH);
      if (!child.privateKey) throw new Error('Could not derive the passkey account.');
      session.current?.end();
      session.current = createSecp256k1SigningSession({ privateKey: child.privateKey });
      const account = toViemAccount(session.current);
      localStorage.setItem(MERA_RECORD, JSON.stringify({ address: account.address, credentialId: result.credentialId, rpId: rpId(), derivation: 'bip32-prf-v1' }));
      localStorage.setItem(LAST_WALLET, 'mera'); localStorage.removeItem('mon-nest-wallet-disconnected');
      setAddress(account.address); setKind('mera'); setChooser(false); resolver.current?.(); resolver.current = null;
      return account;
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      setError(code === 'PRF_UNAVAILABLE' ? 'This passkey provider does not support PRF. Try a compatible synced passkey or connect your existing wallet.' : (cause as Error).message || 'Passkey operation cancelled.');
      throw cause;
    } finally { output?.fill(0); root?.wipePrivateData(); child?.wipePrivateData(); setConnecting(false); }
  }

  async function injected() {
    setConnecting(true); setError('');
    try {
      if (!window.ethereum) throw new Error('Open this page in your wallet browser or install an Ethereum wallet.');
      // Always open the wallet's account chooser so each tab can sign in with a different account.
      const account = await chooseAccount();
      if (!account) throw new Error('No wallet account selected.');
      rememberTabAccount(account);
      setAccounts(await permittedAccounts());
      session.current?.end(); session.current = null;
      setAddress(getAddress(account)); setKind('injected');
      localStorage.setItem(LAST_WALLET, 'injected'); localStorage.removeItem('mon-nest-wallet-disconnected');
      setChooser(false); resolver.current?.(); resolver.current = null;
    } catch (cause) { setError((cause as Error).message || 'Wallet connection cancelled.'); }
    finally { setConnecting(false); }
  }

  const connect = () => new Promise<void>(resolve => { resolver.current?.(); setChooser(true); setError(''); resolver.current = resolve; });
  async function send(tx: Transaction): Promise<Hash> {
    if (!address) throw new Error('Connect your account first.');
    if (kind === 'mera') {
      let account;
      if (session.current) account = toViemAccount(session.current);
      else account = await mera(false);
      if (account.address.toLowerCase() !== address.toLowerCase()) throw new Error('A different passkey was selected. Review your account and try again.');
      return createWalletClient({ account, chain: monadTestnet, transport: http('/api/rpc') }).sendTransaction(tx);
    }
    const provider = window.ethereum;
    if (!provider) throw new Error('Wallet is unavailable.');
    // Sign from this tab's account, which need not be the wallet's currently selected one.
    const from = getAddress(await signerFor(address));
    await ensureMonadTestnet();
    return createWalletClient({ account: from, chain: monadTestnet, transport: custom(provider) }).sendTransaction(tx);
  }

  return <Context.Provider value={{ address, kind, connecting, connect, disconnect, send, accounts, switchAccount }}>
    {children}
    {chooser && <div className="modal-backdrop" onClick={() => { if (!connecting) closeChooser(); }}>
      <section ref={dialog} className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-heading" onClick={event => event.stopPropagation()}>
        <button className="quiet-button" aria-label="Close account dialog" disabled={connecting} onClick={closeChooser}>Close</button>
        <span className="kicker">YOUR MON-NEST ACCOUNT</span><h2 id="account-heading">A place to call yours.</h2>
        <p>Use a passkey to create or recover your account. Your device handles the signing.</p>
        <button className="primary-btn full" disabled={connecting} onClick={() => { void mera(false).catch(() => {}); }}>Continue with a passkey</button>
        <button className="outline-btn full" disabled={connecting} onClick={() => { void mera(true).catch(() => {}); }}>Create a new passkey account</button>
        <button className="quiet-button full" disabled={connecting} onClick={injected}>Connect an existing wallet</button>
        <small>Passkeys belong to this domain. Creating a new passkey creates a different address; recover with your original passkey to keep your account. Fund the account with testnet MON for gas.</small>
        <p role="status">{connecting ? 'Waiting for your device…' : error}</p>
      </section>
    </div>}
  </Context.Provider>;
}

export function useWallet() { const context = useContext(Context); if (!context) throw new Error('WalletProvider is missing.'); return context; }
