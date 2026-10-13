'use client';

import { useEffect, useState } from 'react';
import { encodeFunctionData, formatEther, type Address, type Hash } from 'viem';
import { type Home, shorten } from './data';
import { bookingsAbi, bookingsAddress, bookingsClient, expectedBrokerAddress, readBooking, type BookingSnapshot } from './bookings';
import { useWallet } from './wallet/WalletProvider';

type Props = {
  home: Home;
  booking: BookingSnapshot | null;
  availability: 'loading' | 'ready' | 'error' | 'unconfigured';
  walletAccount: string;
  onConnect: () => Promise<void>;
  onBooked: (homeId: number, hash: Hash) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
};

function messageFor(error: unknown) {
  const typed = error as { code?: number; message?: string };
  if (typed.code === 4001) return 'You cancelled the transaction in your wallet.';
  const message = typed.message || '';
  if (/Already rented|Listing unavailable/i.test(message)) return 'This home was booked by someone else. Availability has been refreshed.';
  if (/insufficient funds/i.test(message)) return 'Your wallet needs a small amount of testnet MON for network gas.';
  if (/Broker cannot rent/i.test(message)) return 'The broker wallet cannot book its own listing. Please use a renter wallet.';
  if (/Broker changed/i.test(message)) return 'The broker destination changed before confirmation. No booking was made; refresh the page to review it again.';
  if (/broker address does not match/i.test(message)) return 'Booking is paused because the onchain broker does not match the configured payment destination.';
  if (/Wrong payment/i.test(message)) return 'The onchain price changed. Please refresh before booking.';
  if (/user rejected|denied/i.test(message)) return 'You cancelled the transaction in your wallet.';
  return message && message.length < 180 ? message : 'Booking could not be confirmed. Check your wallet and try again.';
}

export default function TestPayment({ home, booking, availability, walletAccount, onConnect, onBooked, onRefresh }: Props) {
  const wallet = useWallet();
  const [status, setStatus] = useState('');
  const [hash, setHash] = useState<Hash>();
  const [busy, setBusy] = useState(false);
  const [broker, setBroker] = useState<Address>();
  const [review, setReview] = useState<{ account: string; gas: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (bookingsAddress) {
      bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'broker' })
        .then(value => { if (active) setBroker(value); })
        .catch(() => { if (active) setBroker(undefined); });
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setStatus('');
    setReview(null);
    setHash(undefined);
    if (!walletAccount) return;
    const saved = localStorage.getItem(`mon-nest-booking-tx:${home.id}:${walletAccount.toLowerCase()}`);
    if (saved?.startsWith('0x')) setHash(saved as Hash);
  }, [home.id, walletAccount]);

  async function book(approved = false) {
    if (!walletAccount) { await onConnect(); return; }
    if (!bookingsAddress || !expectedBrokerAddress) { setStatus('Booking is not available right now.'); return; }
    setBusy(true);
    setStatus('Checking live availability…');
    let submitted: Hash | undefined;
    let receiptConfirmed = false;
    let receiptFailed = false;
    try {
      const fresh = await readBooking(home.id);
      if (!fresh.active || fresh.rented) throw new Error('Already rented');
      if (fresh.priceWei !== BigInt(0)) throw new Error('Wrong payment');
      const accounts = [walletAccount];
      const recipient = await bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'broker' });
      if (recipient.toLowerCase() !== expectedBrokerAddress.toLowerCase()) throw new Error('Broker address does not match');
      if (recipient.toLowerCase() === accounts[0].toLowerCase()) throw new Error('Broker cannot rent');

      await bookingsClient.simulateContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'book', args: [BigInt(home.id), expectedBrokerAddress], account: walletAccount as Address, value: BigInt(0) });
      if (!approved || review?.account !== walletAccount) {
        const data = encodeFunctionData({ abi: bookingsAbi, functionName: 'book', args: [BigInt(home.id), expectedBrokerAddress] });
        const [gas, fees] = await Promise.all([
          bookingsClient.estimateGas({ account: walletAccount as Address, to: bookingsAddress, data, value: BigInt(0) }),
          bookingsClient.estimateFeesPerGas(),
        ]);
        setReview({ account: walletAccount, gas: formatEther(gas * fees.maxFeePerGas) });
        setStatus('Review this booking before signing. Gas estimates can change.');
        return;
      }
      setReview(null);
      setStatus('Approve your 0 MON booking in the wallet. Only network gas will be charged.');
      submitted = await wallet.send({
        to: bookingsAddress,
        value: BigInt(0),
        data: encodeFunctionData({ abi: bookingsAbi, functionName: 'book', args: [BigInt(home.id), expectedBrokerAddress] }),
      });
      setHash(submitted);
      setStatus('Transaction submitted. Waiting for confirmation…');
      const receipt = await bookingsClient.waitForTransactionReceipt({ hash: submitted, timeout: 120_000 });
      if (receipt.status !== 'success') { receiptFailed = true; throw new Error('The booking transaction reverted.'); }
      receiptConfirmed = true;
      localStorage.setItem(`mon-nest-booking-tx:${home.id}:${accounts[0].toLowerCase()}`, submitted);
      let verified = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const confirmed = await readBooking(home.id);
          verified = confirmed.rented && confirmed.renter.toLowerCase() === accounts[0].toLowerCase();
          if (verified) break;
        } catch { /* A confirmed transaction can precede RPC read propagation. */ }
        await new Promise(resolve => setTimeout(resolve, 750));
      }
      try { await onBooked(home.id, submitted); } catch { /* The receipt remains confirmed if refreshing availability fails. */ }
      setStatus(verified ? 'Booking confirmed on Monad Testnet. This home now appears as rented to everyone.' : 'Transaction confirmed. The shared status is still syncing; check the explorer and refresh shortly.');
    } catch (error) {
      setStatus(receiptConfirmed ? 'Transaction confirmed. Shared availability could not refresh yet; check the explorer and refresh shortly.' : receiptFailed ? 'Transaction failed; no booking was made. Check the explorer for details.' : submitted ? 'Transaction submitted, but confirmation is taking longer than expected. Check the explorer before trying again.' : messageFor(error));
      if (/Already rented|Listing unavailable/i.test((error as Error).message || '')) await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const bookedByYou = Boolean(booking?.rented && walletAccount && booking.renter.toLowerCase() === walletAccount.toLowerCase());
  // `ready` is set only after the parent verifies this configured address against the contract.
  // Keep the destination visible even if this component's separate RPC read is slow.
  const visibleBroker = broker || (availability === 'ready' ? expectedBrokerAddress : null);
  return <div className="booking-payment">
    {availability === 'unconfigured' ? <div className="booking-state">Online booking is being configured for Monad Testnet.</div> :
      availability === 'error' ? <div className="booking-state">Live availability is temporarily unavailable. Please try again later.</div> :
      availability === 'loading' ? <div className="booking-state">Checking live availability…</div> :
      booking?.rented ? <div className="booking-state"><strong>{bookedByYou ? 'You rented this home' : 'Rented'}</strong><span>Unavailable until {new Date(booking.expiresAt * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })}.</span></div> :
      <button className="primary-btn full" disabled={busy || !booking?.active || booking.priceWei !== BigInt(0)} onClick={() => void book()}>{busy ? 'Checking booking…' : !booking?.active || booking.priceWei !== BigInt(0) ? 'Not available for 0 MON booking' : walletAccount ? 'Review 0 MON booking' : 'Connect account to book'}</button>}
    {review && !booking?.rented && <section className="transaction-review" aria-label="Review booking"><strong>Confirm your 30-day booking</strong><dl><div><dt>Network</dt><dd>Monad Testnet</dd></div><div><dt>Rent + deposit</dt><dd>0 MON</dd></div><div><dt>Estimated maximum gas fee</dt><dd>{review.gas} MON</dd></div><div><dt>Signing account</dt><dd>{shorten(review.account)}</dd></div><div><dt>Contract</dt><dd>{shorten(bookingsAddress || '')}</dd></div></dl><p>This records a testnet reservation only, not a real tenancy.</p><button className="primary-btn full" disabled={busy} onClick={() => void book(true)}>{busy ? 'Waiting for confirmation…' : 'Confirm & sign booking'}</button><button className="quiet-button full" disabled={busy} onClick={() => { setReview(null); setStatus(''); }}>Cancel</button></section>}
    <small>This is a 30-day testnet booking of an illustrative home, not a lease or guaranteed stay. The onchain record sets shared availability. Rent and deposit: 0 MON; wallet gas still applies.</small>
    {visibleBroker && <div className="booking-recipient"><span>Broker payment destination</span><a href={`https://testnet.monadvision.com/address/${visibleBroker}`} target="_blank" rel="noreferrer">{shorten(visibleBroker)} ↗</a><span>Amount sent: 0 MON</span></div>}
    <p role="status" aria-live="polite">{status}</p>
    {hash && <a href={`https://testnet.monadvision.com/tx/${hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>}
  </div>;
}
