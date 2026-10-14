'use client';

import AboutBento from '@/components/ui/about-bento';
import Image from 'next/image';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPublicClient, formatEther, http, type Address, type Hash } from 'viem';
import { monadTestnet } from 'viem/chains';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BedDouble, Bell, Building2, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, FileCheck2, Gavel, Heart, Home as HomeIcon, KeyRound, LayoutDashboard, LogOut, MapPin, Menu, MessageCircle, ReceiptText, Search, ShieldCheck, Sparkles, UserRound, Wallet, X } from 'lucide-react';
import { homes, type Home, shorten } from './data';
import TestPayment from './TestPayment';
import EscrowBooking from './EscrowBooking';
import AccountSwitcher from './AccountSwitcher';
import EscrowRentals from './EscrowRentals';
import { escrowProperties, explorer, registryAddress } from './escrow';
import { useWallet } from './wallet/WalletProvider';
import IndexedAccount from './IndexedAccount';
import SponsorIntegrations from './SponsorIntegrations';
import { bookingsAbi, bookingsAddress, bookingsClient, bookingsDeployBlock, expectedBrokerAddress, readAccountBookingHistory, readAllBookings, readBookingHistory, type BookingHistoryEvent, type BookingSnapshot } from './bookings';


const navigationItems = [
  { id: 'homes', label: 'Find a home' }, { id: 'how', label: 'How it works' },
  { id: 'trust', label: 'Trust layer' }, { id: 'jury', label: 'Roadmap' },
  { id: 'architecture', label: 'Architecture' },
];

function Logo({ onHome }: { onHome?: () => void }) {
  return <a className="logo" href="#top" aria-label="MON-Nest home" onClick={onHome ? event => { event.preventDefault(); onHome(); } : undefined}><Image className="brand-logo" src="/brand/mon-nest-logo.png" alt="" width={56} height={56} sizes="56px" loading="eager"/><span className="brand-wordmark">MON<span className="brand-wordmark-separator">—</span><span className="brand-wordmark-name">Nest</span></span></a>;
}

function Profile({ address, saved, bookings, bookingHistory, accountHistory, accountHistoryStatus, availability, onHome, onOpenHome, onDisconnect }: { address: string; saved: number[]; bookings: Record<number, BookingSnapshot>; bookingHistory: Record<number, BookingHistoryEvent[]>; accountHistory: BookingHistoryEvent[]; accountHistoryStatus: 'idle' | 'loading' | 'ready' | 'error'; availability: 'loading' | 'ready' | 'error' | 'unconfigured'; onHome: () => void; onOpenHome: (homeId: number) => void; onDisconnect: () => void }) {
  const { kind } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setBalance(null);
    const loadBalance = () => bookingsClient.getBalance({ address: address as Address })
      .then(value => { if (active) setBalance(Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 6 })); })
      .catch(() => { if (active) setBalance('Unavailable'); });
    void loadBalance();
    const timer = window.setInterval(loadBalance, 20_000);
    window.addEventListener('focus', loadBalance);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', loadBalance); };
  }, [address]);
  const [copied, setCopied] = useState(false);
  const userRentals = homes.filter(home => home.complimentary).flatMap<{ home: Home; bookedAt: number; expiresAt: number; txHash: Hash | null; active: boolean }>(home => {
    const current = bookings[home.id];
    const events = [...new Map([...(bookingHistory[home.id] || []), ...accountHistory.filter(event => event.listingId === home.id)].map(event => [`${event.txHash}:${event.logIndex}`, event])).values()];
    if (events.length) return events.filter(event => event.renter.toLowerCase() === address.toLowerCase()).map(event => ({
      home, bookedAt: event.bookedAt, expiresAt: event.expiresAt, txHash: event.txHash,
      active: Boolean(current?.rented && current.renter.toLowerCase() === address.toLowerCase() && current.bookedAt === event.bookedAt),
    }));
    return current?.bookedAt && current.renter.toLowerCase() === address.toLowerCase() ? [{ home, bookedAt: current.bookedAt, expiresAt: current.expiresAt, txHash: null, active: current.rented }] : [];
  }).sort((a, b) => b.bookedAt - a.bookedAt);
  const loadingPastBookings = accountHistoryStatus === 'loading';
  return <div>
    <header className="nav-wrap"><nav className="nav container"><Logo onHome={onHome}/><button className="wallet-btn" onClick={onHome}>Explore homes <ArrowRight size={16}/></button></nav></header>
    <main className="profile-page container">
      <div className="dash-welcome"><div><span className="kicker">YOUR ACCOUNT</span><h1>Profile</h1><p>Your wallet, testnet bookings, and saved homes in one place.</p></div><div className="account-avatar"><Wallet size={20}/></div></div>
      <section className="panel profile-wallet">
        <h2>{kind === 'mera' ? 'Your passkey account' : 'Your wallet'}</h2>
        <p className="wallet-address">{address}</p>
        <AccountSwitcher/>
        <div className="profile-wallet-actions">
          <button className="quiet-button" onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy address'}</button>
          <a className="quiet-button" target="_blank" rel="noreferrer" href={`https://testnet.monadvision.com/address/${address}`}>View on explorer <ArrowUpRight size={15}/></a>
          <a className="quiet-button" target="_blank" rel="noreferrer" href="https://faucet.monad.xyz">Get testnet gas <ArrowUpRight size={15}/></a>
        </div>
        <dl className="profile-facts"><div><dt>Network balance</dt><dd>{balance === null ? 'Loading…' : balance === 'Unavailable' ? balance : `${balance} MON`}</dd></div><div><dt>Network</dt><dd>Monad Testnet</dd></div></dl>
        <button className="quiet-button" onClick={onDisconnect}><LogOut size={16}/>Disconnect account</button>
      </section>
      <EscrowRentals address={address} onOpenHome={onOpenHome}/>
      <section className="profile-saved"><div className="section-head"><div><span className="kicker">ON MONAD TESTNET</span><h2>Your bookings</h2></div></div>{userRentals.length ? <div className="profile-bookings">{userRentals.map(rental => <article className="profile-booking panel" key={`${rental.home.id}:${rental.bookedAt}`}><img src={rental.home.image} alt={rental.home.title}/><div><span className={`rental-pill ${rental.active ? 'active' : ''}`}>{rental.active ? 'Rented' : 'Ended'}</span><h3>{rental.home.title}</h3><p>{rental.home.area}, {rental.home.city}</p><small>Booked {new Date(rental.bookedAt * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })} · Until {new Date(rental.expiresAt * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })}</small></div><a href={`https://testnet.monadvision.com/${rental.txHash ? `tx/${rental.txHash}` : `address/${bookingsAddress}`}`} target="_blank" rel="noreferrer">View receipt ↗</a></article>)}</div> : <div className="panel"><h3>{availability === 'loading' || loadingPastBookings ? 'Checking bookings…' : availability === 'error' ? 'Booking records are temporarily unavailable' : 'No bookings for this wallet yet'}</h3><p>{availability === 'unconfigured' ? 'Onchain bookings will appear here when the booking contract is live.' : 'Book one of the 0 MON testnet homes to see its record here.'}</p><button className="primary-btn" onClick={onHome}>Explore homes <ArrowRight size={16}/></button></div>}</section>
      <section className="profile-saved"><div className="section-head"><div><span className="kicker">YOUR SHORTLIST</span><h2>Saved homes</h2></div></div>{saved.length ? <div className="home-grid">{homes.filter(home => saved.includes(home.id)).map(home => <article className="home-card" key={home.id}><div className="home-image"><img loading="lazy" src={home.image} alt={home.title}/></div><div className="home-content"><div className="home-location">{home.area}, {home.city}</div><h3>{home.title}</h3><div className="home-bottom"><strong>{home.rent} MON / month</strong><button onClick={onHome}>Explore <ArrowRight size={15}/></button></div></div></article>)}</div> : <div className="panel"><h3>No saved homes yet</h3><p>Tap the heart on a home to add it to your shortlist.</p><button className="primary-btn" onClick={onHome}>Explore homes <ArrowRight size={16}/></button></div>}</section>
      <IndexedAccount address={address}/>
    </main>
  </div>;
}

function App({ alchemyConfigured = false }: { alchemyConfigured?: boolean }) {
  const wallet = useWallet();
  const walletAccount = wallet.address || '';
  const connected = Boolean(wallet.address);
  const connecting = wallet.connecting;
  const [showProfile, setShowProfile] = useState(false);
  const [bookings, setBookings] = useState<Record<number, BookingSnapshot>>({});
  const [bookingHistory, setBookingHistory] = useState<Record<number, BookingHistoryEvent[]>>({});
  const [historyStatus, setHistoryStatus] = useState<Record<number, 'loading' | 'ready' | 'error'>>({});
  const [accountHistory, setAccountHistory] = useState<BookingHistoryEvent[]>([]);
  const [accountHistoryStatus, setAccountHistoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const refreshHistory = useCallback(async (listingId: number) => {
    if (!bookingsAddress || bookingsDeployBlock === null) return;
    setHistoryStatus(current => ({ ...current, [listingId]: 'loading' }));
    try {
      const events = await readBookingHistory(listingId);
      setBookingHistory(current => ({ ...current, [listingId]: events }));
      setHistoryStatus(current => ({ ...current, [listingId]: 'ready' }));
    } catch { setHistoryStatus(current => ({ ...current, [listingId]: 'error' })); }
  }, []);
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'error' | 'unconfigured'>(bookingsAddress && expectedBrokerAddress ? 'loading' : 'unconfigured');
  const refreshBookings = useCallback(async () => {
    if (!bookingsAddress || !expectedBrokerAddress) { setAvailability('unconfigured'); return; }
    try {
      const [onchainBroker, snapshots] = await Promise.all([
        bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'broker' }),
        readAllBookings(homes.filter(home => home.complimentary).map(home => home.id)),
      ]);
      if (onchainBroker.toLowerCase() !== expectedBrokerAddress.toLowerCase()) throw new Error('Broker address does not match');
      setBookings(snapshots);
      setAvailability('ready');
    } catch {
      setAvailability('error');
    }
  }, []);
  useEffect(() => {
    void refreshBookings();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshBookings(); }, 15_000);
    const onFocus = () => { void refreshBookings(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [refreshBookings]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSelected(null); setMenu(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  const [menu, setMenu] = useState(false);
  const [activeSection, setActiveSection] = useState('homes');
  useEffect(() => {
    const update = () => {
      let current = 'homes';
      for (const item of navigationItems) {
        const section = document.getElementById(item.id);
        if (section && section.getBoundingClientRect().top <= 180) current = item.id;
      }
      setActiveSection(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const [saved, setSaved] = useState<number[]>([]);
  useEffect(() => {
    if (!walletAccount) { setSaved([]); return; }
    try { setSaved(JSON.parse(localStorage.getItem(`mon-nest-saved:${walletAccount.toLowerCase()}`) || '[]')); } catch { setSaved([]); }
  }, [walletAccount]);
  const [selected, setSelected] = useState<Home | null>(null);
  useEffect(() => {
    if (selected?.complimentary) void refreshHistory(selected.id);
  }, [selected?.id, refreshHistory]);
  useEffect(() => {
    if (!showProfile || !walletAccount || !bookingsAddress || bookingsDeployBlock === null) return;
    let active = true;
    setAccountHistory([]);
    setAccountHistoryStatus('loading');
    void readAccountBookingHistory(walletAccount as Address)
      .then(events => { if (active) { setAccountHistory(events); setAccountHistoryStatus('ready'); } })
      .catch(() => { if (active) setAccountHistoryStatus('error'); });
    return () => { active = false; };
  }, [showProfile, walletAccount]);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalCloseRef.current?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (document.querySelector('.account-dialog')) return;
      if (event.key !== 'Tab') return;
      const dialog = modalCloseRef.current?.closest('[role="dialog"]');
      const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea') || []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keepFocusInside); previousFocus?.focus(); };
  }, [selected]);
  const [city, setCity] = useState('All cities');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [city, search]);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 5_000); return () => window.clearTimeout(timer); }, [notice]);
  type HomeHistoryEntry = { homeId: number; action: string; at: string };
  const historyStorageKey = walletAccount ? `mon-nest-home-history:${walletAccount.toLowerCase()}` : 'mon-nest-home-history';
  const [storedHomeHistory, setStoredHomeHistory] = useState<{ key: string; events: HomeHistoryEntry[] }>({ key: '', events: [] });
  const homeHistory = storedHomeHistory.key === historyStorageKey ? storedHomeHistory.events : [];
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || '[]');
      setStoredHomeHistory({ key: historyStorageKey, events: Array.isArray(parsed) ? parsed : [] });
    } catch { setStoredHomeHistory({ key: historyStorageKey, events: [] }); }
  }, [historyStorageKey]);
  const recordHomeHistory = (homeId: number, action: string) => {
    let previous: HomeHistoryEntry[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || '[]');
      if (Array.isArray(parsed)) previous = parsed;
    } catch { /* Ignore invalid browser-only history. */ }
    const next = [{ homeId, action, at: new Date().toISOString() }, ...previous].slice(0, 200);
    localStorage.setItem(historyStorageKey, JSON.stringify(next));
    setStoredHomeHistory({ key: historyStorageKey, events: next });
  };

  const openListing = (home: Home) => {
    recordHomeHistory(home.id, 'Viewed listing');
    setSelected(home);
  };

  const visibleHomes = useMemo(() => homes.filter(home =>
    (city === 'All cities' || home.city === city) &&
    `${home.title} ${home.area} ${home.city}`.toLowerCase().includes(search.toLowerCase())
  ), [city, search]);

  const connect = async () => {
    await wallet.connect();
  };

  const toggleSaved = (id: number) => {
    if (!walletAccount) { setNotice('Connect your wallet to keep a personal shortlist.'); connect(); return; }
    recordHomeHistory(id, saved.includes(id) ? 'Removed from saved homes' : 'Saved home');
    setSaved(current => {
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      if (walletAccount) localStorage.setItem(`mon-nest-saved:${walletAccount.toLowerCase()}`, JSON.stringify(next));
      return next;
    });
  };

  if (connected && walletAccount && showProfile) return <Profile key={walletAccount} onOpenHome={homeId => { setShowProfile(false); setSelected(homes.find(home => home.id === homeId) ?? null); }} address={walletAccount} saved={saved} bookings={bookings} bookingHistory={bookingHistory} accountHistory={accountHistory} accountHistoryStatus={accountHistoryStatus} availability={availability} onHome={() => { setShowProfile(false); window.setTimeout(() => document.getElementById('homes')?.scrollIntoView({ behavior: 'smooth' }), 0); }} onDisconnect={() => { wallet.disconnect(); setShowProfile(false); }} />;

  return <div id="top">
    <header className="nav-wrap">
      <nav className="nav container" aria-label="Main navigation">
        <Logo />
        <div id="main-navigation" className={`nav-links ${menu ? 'open' : ''}`}>
          {navigationItems.map(item => <a key={item.id} href={`#${item.id}`} className={activeSection === item.id ? 'active' : undefined} aria-current={activeSection === item.id ? 'location' : undefined} onClick={() => { setActiveSection(item.id); setMenu(false); }}>{item.label}</a>)}
        </div>
        <button className="wallet-btn" disabled={connecting} aria-busy={connecting} aria-label={connected ? 'Open account profile' : 'Connect account'} onClick={connected ? () => setShowProfile(true) : connect}><Wallet size={17} /><span className="wallet-label">{connected ? `Profile · ${shorten(walletAccount)}` : connecting ? 'Connecting…' : 'Connect account'}</span></button>
        <button className="menu-btn" onClick={() => setMenu(!menu)} aria-label="Toggle menu" aria-expanded={menu} aria-controls="main-navigation">{menu ? <X /> : <Menu />}</button>
      </nav>
    </header>

    {notice && <div className="toast"><Check size={16} />{notice}</div>}

    <main>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" />Mera-Powered UX on Monad</div>
          <h1>Rent without<br/><span className="hero-title-line">the <em>trust gap.</em></span></h1>
          <p className="hero-sub">Discover a home, connect your wallet, and make a verifiable 0 MON testnet booking with shared availability.</p>
          <div className="hero-actions"><a className="primary-btn" href="#homes">Explore homes <ArrowRight size={18}/></a><a className="text-link" href="#how">See how it works <span>↘</span></a></div>
          <div className="proof-row"><div><strong>68 homes</strong><span>testnet booking catalog</span></div><div><strong>0 MON</strong><span>rent and deposit</span></div><div><strong>30 days</strong><span>shared booking period</span></div></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo" role="img" aria-label="Bright, modern rental home interior" />
          <div className="floating-card escrow-card"><div className="mini-icon"><Wallet size={20}/></div><div><span>Testnet booking</span><strong>0 MON + network gas</strong></div><BadgeCheck size={21}/></div>
          <div className="floating-card verified-card"><BadgeCheck size={18}/><span>Shared status<br/><strong>Readable onchain</strong></span></div>
          <div className="mon-orbit" aria-hidden="true"><Image src="/brand/mon-nest-logo.png" alt="" width={112} height={112} sizes="(max-width: 620px) 88px, 112px"/></div>
        </div>
      </section>

      <section className="ticker" aria-label="MON-Nest features"><div className="ticker-track">
        {Array.from({ length: 8 }, (_, copy) => <div className="ticker-group" key={copy} aria-hidden={copy > 0}>
          {['0 MON BOOKINGS', 'SHARED AVAILABILITY', 'WALLET RECORDS', 'MONAD TESTNET', 'ILLUSTRATIVE HOMES'].map(label => <span className="ticker-item" key={label}>{label}<span className="ticker-separator" aria-hidden="true">|</span></span>)}
        </div>)}
      </div></section>

      <section className="homes-section container" id="homes">
        <div className="section-head"><div><span className="kicker">EXPLORE THE COLLECTION</span><h2>A better place to land.</h2></div><p>Explore 68 illustrative homes across eight cities. Every home supports a 0 MON testnet booking through the shared booking ledger.</p></div>
        <div className="filters">
          <div className="search-box"><MapPin size={18}/><input aria-label="Search homes by area or name" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by area or home" /></div>
          <label className="select-wrap"><select aria-label="Filter by city" value={city} onChange={e => setCity(e.target.value)}><option>All cities</option>{[...new Set(homes.map(home => home.city))].sort().map(name => <option key={name}>{name}</option>)}</select><ChevronDown size={16}/></label>
          <span className="result-count">{visibleHomes.length} homes</span>
        </div>
        <div className="home-grid">
          {visibleHomes.slice((page - 1) * 12, page * 12).map(home => <article className="home-card" key={home.id}>
            <div className="home-image"><button className="home-image-trigger" aria-label={`View details for ${home.title}`} aria-haspopup="dialog" onClick={() => openListing(home)}><img loading="lazy" src={home.image} alt={`${home.title} illustrative interior`} /></button><span className={`trust-badge ${home.complimentary && availability === 'ready' && bookings[home.id]?.rented ? 'rented' : ''}`}>{!home.complimentary ? 'Preview home' : availability !== 'ready' ? availability === 'loading' ? 'Checking availability' : 'Booking unavailable' : bookings[home.id]?.rented ? 'Rented' : bookings[home.id]?.active && bookings[home.id]?.priceWei === BigInt(0) ? '0 MON · Available' : 'Unavailable'}</span><button className={`heart ${saved.includes(home.id) ? 'active' : ''}`} onClick={() => toggleSaved(home.id)} aria-label={`Save ${home.title}`}><Heart size={19} fill={saved.includes(home.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="home-content"><div className="home-location"><MapPin size={14}/>{home.area}, {home.city}</div><h3>{home.title}</h3><div className="home-meta"><span><BedDouble size={16}/>{home.beds} bed</span><span>{home.baths} bath</span><span>{home.size} ft²</span></div><div className="tags">{home.tags.map(t => <span key={t}>{t}</span>)}</div><div className="home-bottom"><div><strong>{home.rent} MON</strong><span>/ month</span></div><button onClick={() => openListing(home)}>{home.complimentary && availability === 'ready' && bookings[home.id]?.rented ? 'View rental' : home.complimentary && availability === 'ready' && bookings[home.id]?.active && bookings[home.id]?.priceWei === BigInt(0) ? 'View & book' : 'View details'} <ArrowRight size={16}/></button></div></div>
          </article>)}
        </div>
        {visibleHomes.length === 0 && <div className="panel placeholder-panel"><h3>No homes match your search</h3><p>Try a different neighborhood or choose all cities.</p><button className="primary-btn" onClick={() => { setSearch(''); setCity('All cities'); }}>Clear filters</button></div>}
        {visibleHomes.length > 12 && <nav className="catalog-pagination" aria-label="Home listing pages"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(visibleHomes.length / 12)}</span><button disabled={page === Math.ceil(visibleHomes.length / 12)} onClick={() => setPage(page + 1)}>Next <ArrowRight size={15}/></button></nav>}
      </section>

      <AboutBento catalogCount={homes.length} cityCount={new Set(homes.map(home => home.city)).size} onConnect={connect} connected={connected} connecting={connecting} availability={availability}/>

      <section className="trust container" id="trust">
        <div className="trust-panel"><div className="trust-copy"><span className="kicker">THE BOOKING RECORD</span><h2>One home. One shared answer.</h2><p>MON-Nest reads availability from a Monad Testnet contract. A successful booking records the renter and end date; the same rented status appears for every visitor.</p><ul><li><FileCheck2/>A receipt for the booking transaction</li><li><ShieldCheck/>The contract rejects duplicate active bookings</li><li><Sparkles/>The broker destination is visible before payment</li></ul><a href={bookingsAddress ? `https://testnet.monadvision.com/address/${bookingsAddress}` : 'https://testnet.monadvision.com'} target="_blank" rel="noreferrer" className="outline-btn">Open Monad explorer <ArrowRight size={17}/></a></div><div className="ledger-card"><div className="ledger-head"><span>MON-NEST BOOKINGS</span><span className="live-pill">TESTNET</span></div><div className="ledger-amount"><span>Booking amount</span><strong>0 MON</strong><small>Network gas paid separately</small></div><div className="timeline"><div className="done"><i>1</i><span><strong>Availability checked</strong><small>Read from the booking contract</small></span></div><div className="done"><i>2</i><span><strong>Wallet approval</strong><small>Renter reviews the transaction</small></span></div><div className="current"><i>3</i><span><strong>Booking recorded</strong><small>Renter and end date stored onchain</small></span></div><div><i>4</i><span><strong>Rented status displayed</strong><small>Shared across visitors and wallets</small></span></div></div></div></div>
      </section>

      <section className="jury" id="jury"><div className="container jury-grid"><div><span className="kicker">FUTURE RENTAL PROTOCOL</span><h2>More than a booking record.</h2><p>Verified ownership, escrow, evidence, and community dispute resolution are the next milestones. The contracts are locally tested; these services are not active in the current booking flow.</p><a className="primary-btn dark" href="https://github.com/Madxfury/MON-Nest#implementation-checklist" target="_blank" rel="noreferrer">Read the roadmap <ArrowRight size={18}/></a></div><div className="case-card"><div className="case-top"><span>PROTOCOL CONCEPT</span><span>NOT LIVE</span></div><h3>Fair resolution for future rentals</h3><div className="evidence"><span>Evidence, jury selection, and outcome records need live infrastructure.</span><div className="evidence-bars"><i/><i/><i/><i/></div></div><small>Concept illustration · no active cases or juror enrollment</small></div></div></section>

      <section className="build-section container" id="architecture">
        <div className="section-head"><div><span className="kicker">UNDER THE HOOD</span><h2>Built for trust.<br/>Designed for everyday renting.</h2></div><p>Consumer Products & Payments is our primary track. Here’s where Monad is used today and where sponsor services fit into the rental journey.</p></div>
        <div className="architecture-flow">
          <article><span>01 · EXPERIENCE</span><h3>Find & connect</h3><p>Next.js serves the catalog and account profile. Mera derives a signing account from a passkey; existing wallets can also connect. No server stores your signing key.</p><small>Mera SDK integrated</small></article>
          <article><span>02 · TRANSACTIONS</span><h3>Book & verify</h3><p>All 68 homes use a booking contract that prevents duplicate active reservations and exposes shared status. The app waits for a receipt before confirming.</p><small>{bookingsAddress ? 'Contract configured' : 'Contract deployment pending'}</small></article>
          <article><span>03 · RENTAL PROTOCOL</span><h3>Protect & resolve</h3><p>Separate Solidity contracts cover property verification, native MON escrow, staked jury voting, and reputation. These are locally tested and not connected to live rentals.</p><small>Written & locally tested</small></article>
          <article><span>04 · ACCOUNT RECORDS</span><h3>Read & verify</h3><p>Envio handlers turn booking, escrow, dispute, vote, and reputation events into account records. Booking history also reads chain logs when indexing is unavailable.</p><small>Indexer implemented · hosting pending</small></article>
        </div>
        <SponsorIntegrations alchemyConfigured={alchemyConfigured}/>
      </section>

      <section className="cta container"><div><span className="kicker">TRY THE BOOKING FLOW</span><h2>Explore a home.<br/>See its status.</h2></div><div><p>Choose any of the 68 free testnet homes and review every detail before connecting a wallet.</p><a href="#homes" className="primary-btn">Find your nest <ArrowRight size={18}/></a></div></section>
    </main>

    <footer><div className="container footer-grid"><div><Logo/><p>Explore homes and verify testnet booking status.</p></div><div><strong>Explore</strong><a href="#homes">Homes</a><a href="#how">How it works</a><a href="#jury">Roadmap</a></div><div><strong>Build</strong><a href="https://docs.monad.xyz" target="_blank" rel="noreferrer">Monad docs</a><a href="https://github.com/Madxfury/MON-Nest" target="_blank" rel="noreferrer">GitHub</a><a href="https://hackathon.monad.xyz/tracks" target="_blank" rel="noreferrer">Metropolis</a></div><div className="footer-note"><span>Built for Metropolis 2026</span><small>Consumer Products & Payments · Monad</small></div></div><div className="container foot-bottom"><span>© 2026 MON-Nest</span><span>Prototype · Illustrative homes · Testnet only</span></div></footer>

    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="listing-title" onMouseDown={event => event.stopPropagation()}>
        <button ref={modalCloseRef} className="modal-close" aria-label="Close listing details" onClick={() => setSelected(null)}><X/></button>
        <img src={selected.image} alt={`${selected.title} illustrative interior`}/>
        <div className="modal-body">
          <span className="kicker">{selected.complimentary ? '0 MON TESTNET HOME' : 'TESTNET ESCROW RENTAL'}</span>
          <h2 id="listing-title">{selected.title}</h2>
          <p><MapPin size={16}/>{selected.area}, {selected.city}</p>
          <div className="price-box"><div><span>{selected.complimentary ? '30-day booking' : 'Illustrative monthly rent'}</span><strong>{selected.rent} MON</strong></div><div><span>Deposit</span><strong>{selected.deposit} MON</strong></div><div><span>Platform fee</span><strong>{(selected.rent * .02).toFixed(2)} MON</strong></div></div>
          {selected.complimentary ? <TestPayment key={selected.id} home={selected} booking={bookings[selected.id] || null} availability={availability} walletAccount={walletAccount} onConnect={connect} onRefresh={refreshBookings} onBooked={async (homeId: number, _hash: Hash) => { recordHomeHistory(homeId, 'Booked on Monad Testnet'); await Promise.all([refreshBookings(), refreshHistory(homeId)]); }}/> : <EscrowBooking key={selected.id} home={selected} walletAccount={walletAccount} onConnect={connect}/>}
          <section className="property-history" aria-label="Property history">
            <h3>Home history</h3>
            {!selected.complimentary ? (escrowProperties[String(selected.id)] && registryAddress ? <p>Ownership is verified in the Monad Testnet property registry as record #{escrowProperties[String(selected.id)]}. <a href={`${explorer}/address/${registryAddress}`} target="_blank" rel="noreferrer">View registry ↗</a></p> : <p>This home's verified property record appears once the testnet contracts are deployed.</p>) : !bookingsAddress ? <p>Booking history will be available after the testnet contract is deployed.</p> : historyStatus[selected.id] === 'loading' ? <p>Loading onchain booking history…</p> : historyStatus[selected.id] === 'error' ? <p>Full history is unavailable. Current availability is shown above; the indexer may need to catch up.</p> : bookingHistory[selected.id]?.length ? <ol>{[...bookingHistory[selected.id]].reverse().map(event => <li key={event.txHash + event.logIndex}><div><strong>Booked by {shorten(event.renter)}</strong><time dateTime={new Date(event.bookedAt * 1000).toISOString()}>{new Date(event.bookedAt * 1000).toLocaleDateString()} · Until {new Date(event.expiresAt * 1000).toLocaleDateString()}</time></div><a href={`https://testnet.monadvision.com/tx/${event.txHash}`} target="_blank" rel="noreferrer">Receipt ↗</a></li>)}</ol> : availability === 'ready' && bookings[selected.id]?.bookedAt ? <p>Latest testnet booking: {new Date(bookings[selected.id].bookedAt * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' })} by {shorten(bookings[selected.id].renter)}. {bookings[selected.id].rented ? 'Currently rented.' : 'Booking ended.'}</p> : historyStatus[selected.id] === 'ready' ? <p>No onchain bookings are recorded for this home yet.</p> : <p>Onchain history has not been verified yet.</p>}
            <h4>{walletAccount ? 'Your recent activity' : 'Browser activity'}</h4><small>Saved in this browser; contract bookings are shared publicly.</small><ol>{homeHistory.filter(event => event.homeId === selected.id).slice(0, 8).map((event, index) => <li key={event.at + index}><strong>{event.action}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ol>
          </section>
        </div>
      </div>
    </div>}
  </div>;
}

export default App;
