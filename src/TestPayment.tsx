'use client';

import { useEffect, useState } from 'react';
import { encodeFunctionData, isAddress, type Address, type Hash } from 'viem';
import { type Home, shorten } from './data';
import { bookingsAbi, bookingsAddress, bookingsClient, expectedBrokerAddress, readBooking, type BookingSnapshot } from './bookings';

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
  if (/broker address does not match/i.test(message)) return 'Booking is paused because the onchain broker does not match the configured payment destination.';
  if (/Wrong payment/i.test(message)) return 'The onchain price changed. Please refresh before booking.';
  if (/user rejected|denied/i.test(message)) return 'You cancelled the transaction in your wallet.';
  return message && message.length < 180 ? message : 'Booking could not be confirmed. Check your wallet and try again.';
}

export default function TestPayment({ home, booking, availability, walletAccount, onConnect, onBooked, onRefresh }: Props) {
  const [status, setStatus] = useState('');
  const [hash, setHash] = useState<Hash>();
  const [busy, setBusy] = useState(false);
  const [broker, setBroker] = useState<Address>();

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
    setHash(undefined);
    if (!walletAccount) return;
    const saved = localStorage.getItem(`mon-nest-booking-tx:${home.id}:${walletAccount.toLowerCase()}`);
    if (saved?.startsWith('0x')) setHash(saved as Hash);
  }, [home.id, walletAccount]);

  async function book() {
    if (!walletAccount) { await onConnect(); return; }
    if (!window.ethereum || !bookingsAddress || !expectedBrokerAddress) { setStatus('Booking is not available right now.'); return; }
    setBusy(true);
    setStatus('Checking live availability…');
    try {
      const fresh = await readBooking(home.id);
      if (!fresh.active || fresh.rented) throw new Error('Already rented');
      if (fresh.priceWei !== BigInt(0)) throw new Error('Wrong payment');
      const provider = window.ethereum;
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts[0] || !isAddress(accounts[0])) throw new Error('Select a wallet account first.');
      if (accounts[0].toLowerCase() !== walletAccount.toLowerCase()) throw new Error('Your wallet account changed. Please try again.');
      const recipient = broker || await bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'broker' });
      if (recipient.toLowerCase() !== expectedBrokerAddress.toLowerCase()) throw new Error('Broker address does not match');
      if (recipient.toLowerCase() === accounts[0].toLowerCase()) throw new Error('Broker cannot rent');

      setStatus('Switch to Monad Testnet in your wallet.');
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x279f', chainName: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: ['https://testnet-rpc.monad.xyz'], blockExplorerUrls: ['https://testnet.monadvision.com'] }] });
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      }
      if (await provider.request({ method: 'eth_chainId' }) !== '0x279f') throw new Error('Please select Monad Testnet.');

      setStatus('Approve your 0 MON booking in the wallet. Only network gas will be charged.');
      const tx = await provider.request({ method: 'eth_sendTransaction', params: [{
        from: accounts[0],
        to: bookingsAddress,
        value: '0x0',
        data: encodeFunctionData({ abi: bookingsAbi, functionName: 'book', args: [BigInt(home.id)] }),
      }] }) as Hash;
      setHash(tx);
      setStatus('Transaction submitted. Waiting for confirmation…');
      const receipt = await bookingsClient.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      if (receipt.status !== 'success') throw new Error('The booking transaction reverted.');
      const confirmed = await readBooking(home.id);
      if (!confirmed.rented || confirmed.renter.toLowerCase() !== accounts[0].toLowerCase()) {
        throw new Error('The transaction confirmed, but the booking record could not be verified.');
      }
      localStorage.setItem(`mon-nest-booking-tx:${home.id}:${accounts[0].toLowerCase()}`, tx);
      setStatus('Booking confirmed on Monad Testnet. This home now appears as rented to everyone.');
      await onBooked(home.id, tx);
    } catch (error) {
      setStatus(messageFor(error));
      if (/Already rented|Listing unavailable/i.test((error as Error).message || '')) await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const bookedByYou = Boolean(booking?.rented && walletAccount && booking.renter.toLowerCase() === walletAccount.toLowerCase());
  return <div className="booking-payment">
    {availability === 'unconfigured' ? <div className="booking-state">Online booking is being configured for Monad Testnet.</div> :
      availability === 'error' ? <div className="booking-state">Live availability is temporarily unavailable. Please try again later.</div> :
      availability === 'loading' ? <div className="booking-state">Checking live availability…</div> :
      booking?.rented ? <div className="booking-state"><strong>{bookedByYou ? 'You rented this home' : 'Rented'}</strong><span>Unavailable until {new Date(booking.expiresAt * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })}.</span></div> :
      <button className="primary-btn full" disabled={busy || !booking?.active || booking.priceWei !== BigInt(0)} onClick={book}>{busy ? 'Confirming booking…' : !booking?.active || booking.priceWei !== BigInt(0) ? 'Not available for 0 MON booking' : walletAccount ? 'Book for 0 MON' : 'Connect wallet to book'}</button>}
    <small>This is a 30-day testnet booking of an illustrative home, not a lease or guaranteed stay. The onchain record sets shared availability. Rent and deposit: 0 MON; wallet gas still applies.</small>
    {broker && <div className="booking-recipient"><span>Broker payment destination</span><a href={`https://testnet.monadvision.com/address/${broker}`} target="_blank" rel="noreferrer">{shorten(broker)} ↗</a><span>Amount sent: 0 MON</span></div>}
    <p role="status" aria-live="polite">{status}</p>
    {hash && <a href={`https://testnet.monadvision.com/tx/${hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>}
  </div>;
}
