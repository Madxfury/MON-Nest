'use client';

import { useCallback, useEffect, useState } from 'react';
import { encodeFunctionData, formatEther, keccak256, parseEventLogs, toHex, type Address, type Hash, type Hex } from 'viem';
import { type Home, shorten } from './data';
import { useWallet } from './wallet/WalletProvider';
import { type Agreement, escrowAbi, escrowAddress, escrowClient, escrowProperties, explorer, readAgreements, registryAbi, registryAddress, testnetAmount, TESTNET_SCALE } from './escrow';

type Props = { home: Home; walletAccount: string; onConnect: () => Promise<void> };

const mon = (value: bigint) => `${Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 6 })} MON`;
const day = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' });

function messageFor(error: unknown) {
  const typed = error as { code?: number; shortMessage?: string; message?: string };
  if (typed.code === 4001 || /user rejected|denied/i.test(typed.message || '')) return 'You cancelled the transaction in your wallet.';
  if (/insufficient funds/i.test(typed.message || '')) return 'Your wallet needs more testnet MON. Get some from faucet.monad.xyz.';
  const known = (typed.message || '').match(/Owner cannot rent|Owner not verified|Too early|Rent not funded|Lease ended|Cannot complete|Cannot cancel|Nothing to withdraw/);
  if (known) return `The contract rejected this: ${known[0]}.`;
  const message = typed.shortMessage || typed.message || '';
  return message && message.length < 180 ? message : 'The transaction could not be completed. Check your wallet and try again.';
}

export default function EscrowBooking({ home, walletAccount, onConnect }: Props) {
  const wallet = useWallet();
  const propertyId = escrowProperties[String(home.id)];
  const [owner, setOwner] = useState<Address>();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [claimable, setClaimable] = useState(BigInt(0));
  const [status, setStatus] = useState('');
  const [hash, setHash] = useState<Hash>();
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState('');
  const rent = testnetAmount(home.rent);
  const deposit = testnetAmount(home.deposit);

  const refresh = useCallback(async () => {
    if (!escrowAddress || !propertyId) return;
    if (registryAddress) {
      const property = await escrowClient.readContract({ address: registryAddress, abi: registryAbi, functionName: 'properties', args: [BigInt(propertyId)] });
      setOwner(property[0]);
    }
    if (!walletAccount) { setAgreements([]); setClaimable(BigInt(0)); return; }
    const [rows, owed] = await Promise.all([
      readAgreements(propertyId, walletAccount),
      escrowClient.readContract({ address: escrowAddress, abi: escrowAbi, functionName: 'claimable', args: [walletAccount as Address] }),
    ]);
    setAgreements(rows);
    setClaimable(owed);
  }, [propertyId, walletAccount]);

  useEffect(() => { refresh().catch(() => setStatus('Escrow records are temporarily unavailable.')); }, [refresh]);

  async function run(label: string, data: Hex, value = BigInt(0)) {
    if (!walletAccount) { await onConnect(); return null; }
    setBusy(true);
    try {
      setStatus(`${label}: approve in your wallet…`);
      const submitted = await wallet.send({ to: escrowAddress!, data, value });
      setHash(submitted);
      setStatus(`${label}: waiting for confirmation…`);
      const receipt = await escrowClient.waitForTransactionReceipt({ hash: submitted, timeout: 120_000 });
      if (receipt.status !== 'success') throw new Error('The transaction reverted.');
      setStatus(`${label}: confirmed on Monad Testnet.`);
      await refresh();
      return receipt;
    } catch (error) {
      setStatus(messageFor(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function lockInEscrow() {
    if (!owner) return;
    const start = Math.floor(Date.now() / 1000);
    const end = start + 30 * 24 * 60 * 60;
    const terms = keccak256(toHex(JSON.stringify({ home: home.id, title: home.title, rent: rent.toString(), deposit: deposit.toString(), start, end })));
    const receipt = await run('Step 1 of 2 · Create agreement', encodeFunctionData({ abi: escrowAbi, functionName: 'createAgreement', args: [BigInt(propertyId), owner, rent, deposit, BigInt(start), BigInt(end), terms] }));
    if (!receipt) return;
    const [created] = parseEventLogs({ abi: escrowAbi, eventName: 'AgreementCreated', logs: receipt.logs });
    if (!created) { setStatus('Agreement created. Fund it from the list below.'); return; }
    await fund(created.args.agreementId);
  }

  const fund = (id: bigint) => run('Step 2 of 2 · Fund escrow', encodeFunctionData({ abi: escrowAbi, functionName: 'fund', args: [id] }), rent + deposit);

  if (!escrowAddress || !propertyId) return <p className="booking-state">Escrow rental for this home opens once the testnet contracts are deployed.</p>;

  const now = Date.now() / 1000;
  const me = walletAccount.toLowerCase();
  const isOwner = Boolean(owner && owner.toLowerCase() === me);
  return <div className="booking-payment escrow-booking">
    <h3>Rent with escrow protection</h3>
    <p className="escrow-intro">Lock the first month's rent and a refundable deposit in escrow. Testnet amounts are 1/{TESTNET_SCALE} of the listed price.</p>
    <div className="price-box">
      <div><span>Testnet monthly rent</span><strong>{mon(rent)}</strong></div>
      <div><span>Refundable deposit</span><strong>{mon(deposit)}</strong></div>
      <div><span>Locked in escrow today</span><strong>{mon(rent + deposit)}</strong></div>
    </div>
    {isOwner ? <div className="booking-state">You are the verified owner of this home. Agreements renters open with you appear below.</div>
      : <button className="primary-btn full" disabled={busy || !owner} onClick={lockInEscrow}>{busy ? 'Waiting for wallet…' : walletAccount ? 'Lock rent + deposit in escrow' : 'Connect account to rent'}</button>}
    <small>Money goes to the MON-Nest escrow contract, not the owner. Rent is released monthly (2% platform fee); your deposit comes back when the lease closes, or a staked jury decides if there is a dispute. Testnet only, not a legal lease.</small>
    <p role="status" aria-live="polite">{status}</p>
    {hash && <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>}

    {agreements.map(a => {
      const live = a.state === 'Funded' || a.state === 'Active';
      const mine = a.renter.toLowerCase() === me;
      const canRelease = live && now >= a.nextReleaseAt && a.nextReleaseAt < a.endAt && a.rentHeld >= a.monthlyRent;
      return <article className="escrow-agreement" key={a.id}>
        <header><strong>Agreement #{a.id}</strong><span className={`rental-pill ${live ? 'active' : ''}`}>{a.state}</span></header>
        <dl>
          <div><dt>{mine ? 'Owner' : 'Renter'}</dt><dd>{shorten(mine ? a.owner : a.renter)}</dd></div>
          <div><dt>Rent held</dt><dd>{mon(a.rentHeld)}</dd></div>
          <div><dt>{a.state === 'Completed' || a.state === 'Cancelled' ? 'Deposit (settled)' : 'Deposit'}</dt><dd>{mon(a.deposit)}</dd></div>
          <div><dt>Lease</dt><dd>{day(a.startAt)} – {day(a.endAt)}</dd></div>
        </dl>
        <div className="escrow-actions">
          {a.state === 'Created' && mine && <button className="quiet-button" disabled={busy} onClick={() => fund(BigInt(a.id))}>Fund escrow</button>}
          {a.state === 'Created' && <button className="quiet-button" disabled={busy} onClick={() => run('Cancel agreement', encodeFunctionData({ abi: escrowAbi, functionName: 'cancel', args: [BigInt(a.id)] }))}>Cancel</button>}
          {canRelease && <button className="quiet-button" disabled={busy} onClick={() => run('Release rent', encodeFunctionData({ abi: escrowAbi, functionName: 'releaseRent', args: [BigInt(a.id)] }))}>Release this month's rent</button>}
          {live && (!mine || now >= a.endAt) && <button className="quiet-button" disabled={busy} onClick={() => run('Close lease', encodeFunctionData({ abi: escrowAbi, functionName: 'complete', args: [BigInt(a.id)] }))}>{mine ? 'Close lease & get deposit back' : 'Close lease & return deposit'}</button>}
        </div>
        {live && <div className="escrow-dispute">
          <input value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="Describe the issue (hashed onchain as evidence)" aria-label="Dispute evidence"/>
          <button className="quiet-button" disabled={busy || !evidence.trim()} onClick={() => run('Open dispute', encodeFunctionData({ abi: escrowAbi, functionName: 'openDispute', args: [BigInt(a.id), keccak256(toHex(`${a.id}:${evidence.trim()}`))] }))}>Open dispute</button>
        </div>}
        {a.state === 'Disputed' && <small>Funds are frozen. A staked, odd-numbered jury votes in secret (commit–reveal); the majority ruling pays out from this agreement only.</small>}
      </article>;
    })}
    {claimable > BigInt(0) && <button className="primary-btn full" disabled={busy} onClick={() => run('Withdraw', encodeFunctionData({ abi: escrowAbi, functionName: 'withdraw' }))}>Withdraw {mon(claimable)}</button>}
  </div>;
}
