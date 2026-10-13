'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPublicClient, formatEther, http, type Address } from 'viem';
import { monadTestnet } from 'viem/chains';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BedDouble, Bell, Building2, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, FileCheck2, Gavel, Heart, Home as HomeIcon, KeyRound, LayoutDashboard, LogOut, MapPin, Menu, MessageCircle, ReceiptText, Search, ShieldCheck, Sparkles, UserRound, Wallet, X } from 'lucide-react';
import { homes, type Home, shorten } from './data';
import TestPayment from './TestPayment';


function Logo() {
  return <a className="logo" href="#top" aria-label="MON-Nest home"><span className="logo-mark">M</span><span>MON—NEST</span></a>;
}

type DashboardTab = 'Overview' | 'My rentals' | 'Payments' | 'Disputes' | 'Profile';

function Dashboard({ address, onDisconnect }: { address: string; onDisconnect: () => void }) {
  const [tab, setTab] = useState<DashboardTab>('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  useEffect(() => {
    let active = true;
    setBalance(null); setBalanceError(false);
    const client = createPublicClient({ chain: monadTestnet, transport: http() });
    client.getBalance({ address: address as Address }).then(value => {
      if (active) setBalance(Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 6 }));
    }).catch(() => { if (active) setBalanceError(true); });
    return () => { active = false; };
  }, [address]);
  const nav = [
    { label: 'Overview' as DashboardTab, icon: LayoutDashboard },
    { label: 'My rentals' as DashboardTab, icon: HomeIcon },
    { label: 'Payments' as DashboardTab, icon: ReceiptText },
    { label: 'Disputes' as DashboardTab, icon: Gavel },
    { label: 'Profile' as DashboardTab, icon: UserRound },
  ];
  return <div className="dashboard-shell">
    <aside className={`dash-sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="dash-brand"><Logo/><button onClick={() => setMobileNav(false)} aria-label="Close dashboard menu"><X/></button></div>
      <div className="account-chip"><div className="account-avatar"><Wallet size={18}/></div><div><strong>Connected wallet</strong><span>{shorten(address)}</span></div></div>
      <nav className="dash-nav" aria-label="Dashboard">{nav.map(item => <button key={item.label} className={tab === item.label ? 'active' : ''} onClick={() => { setTab(item.label); setMobileNav(false); }}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="network-card"><span>Monad Testnet</span><strong>Your wallet account</strong><small>Rental contracts are not connected yet</small></div>
      <button className="disconnect" onClick={onDisconnect}><LogOut size={18}/>Disconnect wallet</button>
    </aside>
    <section className="dash-main">
      <header className="dash-topbar"><button className="dash-menu" aria-label="Open dashboard menu" onClick={() => setMobileNav(true)}><Menu/></button><div><span>MON-Nest /</span><strong>{tab}</strong></div><span title={address}>{shorten(address)}</span></header>
      <div className="dash-content">
        <div className="dash-welcome"><div><span className="kicker">YOUR ACCOUNT</span><h1>{tab === 'Overview' ? 'Welcome home.' : tab}</h1><p>Connected as {shorten(address)}</p></div></div>
        {tab === 'Overview' && <><div className="essential-stats"><div><span>Wallet balance · Monad Testnet</span><strong>{balanceError ? 'Unavailable' : balance === null ? 'Loading…' : `${balance} MON`}</strong><small>Read directly from the network</small></div><div><span>Rental records</span><strong>Not connected</strong><small>No rental data provider configured</small></div><div><span>Escrow records</span><strong>Not connected</strong><small>No account funds assumed</small></div></div><TestPayment key={address}/></>}
        {tab === 'Payments' && <TestPayment key={address}/>}
        <article className="panel placeholder-panel">
          {tab === 'Profile' ? <><h2>Your wallet</h2><p style={{ overflowWrap: 'anywhere' }}>{address}</p><p>Your identity comes from the wallet you connect. No personal profile has been created.</p></> : <><div className="placeholder-icon"><HomeIcon/></div><h2>{tab === 'Payments' ? 'No rental payment history available' : tab === 'Disputes' ? 'No dispute records available' : 'Your rental journey starts here'}</h2><p>Your wallet is connected. Rental agreements, escrow balances, and disputes will appear here once the deployed contracts and account data service are connected.</p><button className="primary-btn" onClick={onDisconnect}>Explore homes <ArrowRight size={16}/></button></>}
        </article>
      </div>
    </section>
  </div>;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [walletAccount, setWalletAccount] = useState('');
  useEffect(() => {
    const provider = window.ethereum;
    const changed = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setWalletAccount(accounts[0] || '');
      setConnected(Boolean(accounts[0]));
    };
    const disconnected = () => { setConnected(false); setWalletAccount(''); };
    provider?.on?.('accountsChanged', changed);
    provider?.on?.('disconnect', disconnected);
    return () => {
      provider?.removeListener?.('accountsChanged', changed);
      provider?.removeListener?.('disconnect', disconnected);
    };
  }, []);
  const [menu, setMenu] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const [selected, setSelected] = useState<Home | null>(null);
  const [city, setCity] = useState('All cities');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const visibleHomes = useMemo(() => homes.filter(home =>
    (city === 'All cities' || home.city === city) &&
    `${home.title} ${home.area} ${home.city}`.toLowerCase().includes(search.toLowerCase())
  ), [city, search]);

  const connect = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
        if (!accounts[0]) return;
        setWalletAccount(accounts[0]);
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
        } catch {
          setNotice('Wallet connected; switch to Monad Testnet to transact');
        }
      } else {
        setNotice('Install an Ethereum-compatible wallet to connect your account.');
        return;
      }
      setConnected(true);
      setNotice('Wallet connected');
      window.setTimeout(() => setNotice(''), 2600);
    } catch {
      setNotice('Wallet connection was cancelled');
      window.setTimeout(() => setNotice(''), 2600);
    }
  };

  const toggleSaved = (id: number) => setSaved(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  if (connected && walletAccount) return <Dashboard key={walletAccount} address={walletAccount} onDisconnect={() => { setConnected(false); setWalletAccount(''); }} />;

  return <div id="top">
    <header className="nav-wrap">
      <nav className="nav container">
        <Logo />
        <div className={`nav-links ${menu ? 'open' : ''}`}>
          <a href="#homes" onClick={() => setMenu(false)}>Find a home</a>
          <a href="#how" onClick={() => setMenu(false)}>How it works</a>
          <a href="#trust" onClick={() => setMenu(false)}>Trust layer</a>
          <a href="#jury" onClick={() => setMenu(false)}>Become a juror</a>
        </div>
        <button className="wallet-btn" onClick={connect}><Wallet size={17} />Connect wallet</button>
        <button className="menu-btn" onClick={() => setMenu(!menu)} aria-label="Toggle menu">{menu ? <X /> : <Menu />}</button>
      </nav>
    </header>

    {notice && <div className="toast"><Check size={16} />{notice}</div>}

    <main>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" />Live prototype · Monad Testnet</div>
          <h1>Rent without the<br/><em>trust gap.</em></h1>
          <p className="hero-sub">Verified homes, protected payments, and fair resolution—without brokers taking a month of rent.</p>
          <div className="hero-actions"><a className="primary-btn" href="#homes">Explore homes <ArrowRight size={18}/></a><a className="text-link" href="#how">See how it works <span>↘</span></a></div>
          <div className="proof-row"><div><strong>2%</strong><span>flat platform fee</span></div><div><strong>1 mo.</strong><span>deposit, protected</span></div><div><strong>~1 sec</strong><span>testnet settlement</span></div></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo" role="img" aria-label="Bright, modern rental home interior" />
          <div className="floating-card escrow-card"><div className="mini-icon"><ShieldCheck size={20}/></div><div><span>Escrow protected</span><strong>84 MON secured</strong></div><BadgeCheck size={21}/></div>
          <div className="floating-card verified-card"><BadgeCheck size={18}/><span>Owner verified<br/><strong>Onchain proof</strong></span></div>
          <div className="mon-orbit">M</div>
        </div>
      </section>

      <section className="ticker"><div>NO BROKER FEES <span>✦</span> ONCHAIN ESCROW <span>✦</span> VERIFIED LISTINGS <span>✦</span> COMMUNITY RESOLUTION <span>✦</span> BUILT ON MONAD <span>✦</span></div></section>

      <section className="homes-section container" id="homes">
        <TestPayment />
        <div className="section-head"><div><span className="kicker">CURATED & VERIFIED</span><h2>A better place to land.</h2></div><p>Every home carries an owner proof, property record, and transparent rental terms before you commit.</p></div>
        <div className="filters">
          <div className="search-box"><MapPin size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by area or home" /></div>
          <label className="select-wrap"><select value={city} onChange={e => setCity(e.target.value)}><option>All cities</option><option>Mumbai</option><option>Bengaluru</option><option>Goa</option></select><ChevronDown size={16}/></label>
          <span className="result-count">{visibleHomes.length} verified homes</span>
        </div>
        <div className="home-grid">
          {visibleHomes.map(home => <article className="home-card" key={home.id}>
            <div className="home-image"><img src={home.image} alt={`${home.title} interior`} /><span className="trust-badge"><BadgeCheck size={15}/> {home.trust}% trust</span><button className={`heart ${saved.includes(home.id) ? 'active' : ''}`} onClick={() => toggleSaved(home.id)} aria-label="Save home"><Heart size={19} fill={saved.includes(home.id) ? 'currentColor' : 'none'}/></button></div>
            <div className="home-content"><div className="home-location"><MapPin size={14}/>{home.area}, {home.city}</div><h3>{home.title}</h3><div className="home-meta"><span><BedDouble size={16}/>{home.beds} bed</span><span>{home.baths} bath</span><span>{home.size} ft²</span></div><div className="tags">{home.tags.map(t => <span key={t}>{t}</span>)}</div><div className="home-bottom"><div><strong>{home.rent} MON</strong><span>/ month</span></div><button onClick={() => setSelected(home)}>View & book <ArrowRight size={16}/></button></div></div>
          </article>)}
        </div>
      </section>

      <section className="steps" id="how"><div className="container"><div className="section-head light"><div><span className="kicker">THE NEW RENTAL RAIL</span><h2>Keys, not complications.</h2></div><p>MON-Nest turns a handshake into a transparent, programmable agreement while keeping the experience human.</p></div><div className="step-grid">
        <div className="step"><span>01</span><div className="step-icon"><Building2/></div><h3>Find a verified nest</h3><p>Browse homes with ownership attestations, image fingerprints, and clear onchain terms.</p></div>
        <div className="step"><span>02</span><div className="step-icon"><CircleDollarSign/></div><h3>Lock rent in escrow</h3><p>One month rent and deposit stay protected in a Monad smart contract—not a stranger’s account.</p></div>
        <div className="step"><span>03</span><div className="step-icon"><KeyRound/></div><h3>Move in with proof</h3><p>Sign the rental agreement, record check-in evidence, and release rent by milestone.</p></div>
        <div className="step"><span>04</span><div className="step-icon"><Gavel/></div><h3>Resolve fairly</h3><p>If something goes wrong, staked community jurors review sealed evidence and rule transparently.</p></div>
      </div></div></section>

      <section className="trust container" id="trust">
        <div className="trust-panel"><div className="trust-copy"><span className="kicker">THE TRUST LAYER</span><h2>Every promise leaves a receipt.</h2><p>Important rental events become verifiable records on Monad: the listing, signed terms, escrow deposits, evidence hashes, and final settlement.</p><ul><li><FileCheck2/>Tamper-evident property & evidence records</li><li><ShieldCheck/>Non-custodial escrow with milestone release</li><li><Sparkles/>Portable reputation for owners, renters & jurors</li></ul><a href="https://testnet.monadvision.com" target="_blank" rel="noreferrer" className="outline-btn">Open Monad explorer <ArrowRight size={17}/></a></div><div className="ledger-card"><div className="ledger-head"><span>RENTAL #MN-2048</span><span className="live-pill">● ACTIVE</span></div><div className="ledger-amount"><span>Protected balance</span><strong>84.00 MON</strong><small>Rent + one-month deposit</small></div><div className="timeline"><div className="done"><i><Check/></i><span><strong>Terms signed</strong><small>Both parties · 0x8c1…a04</small></span></div><div className="done"><i><Check/></i><span><strong>Funds secured</strong><small>Escrow · block 12,482,901</small></span></div><div className="current"><i>3</i><span><strong>Check-in window</strong><small>Evidence hash pending</small></span></div><div><i>4</i><span><strong>Monthly release</strong><small>Scheduled after confirmation</small></span></div></div></div></div>
      </section>

      <section className="jury" id="jury"><div className="container jury-grid"><div><span className="kicker">COMMUNITY COURT</span><h2>Fair outcomes need skin in the game.</h2><p>Jurors stake MON, receive cases at random, review privacy-aware evidence, and earn fees for honest participation. Majority decides; reputation remembers.</p><button className="primary-btn dark" onClick={() => { if (!connected) connect(); setNotice('Juror onboarding added to your demo journey'); }}>Join the jury pool <ArrowRight size={18}/></button></div><div className="case-card"><div className="case-top"><span>ANONYMOUS CASE</span><span>14h 22m left</span></div><h3>Security deposit · wall damage</h3><div className="evidence"><span>4 evidence items</span><div className="evidence-bars"><i/><i/><i/><i/></div></div><div className="vote-row"><button>Tenant <strong>3</strong></button><button>Owner <strong>2</strong></button></div><small>Illustrative jury flow · no live case data</small></div></div></section>

      <section className="cta container"><div><span className="kicker">A HOME SHOULD FEEL SAFE</span><h2>Your next chapter,<br/>secured on Monad.</h2></div><div><p>Skip the broker. Keep your deposit protected. Rent with proof.</p><a href="#homes" className="primary-btn">Find your nest <ArrowRight size={18}/></a></div></section>
    </main>

    <footer><div className="container footer-grid"><div><Logo/><p>Verified rentals. Protected payments.<br/>Fair outcomes.</p></div><div><strong>Explore</strong><a href="#homes">Homes</a><a href="#how">How it works</a><a href="#jury">Juror network</a></div><div><strong>Build</strong><a href="https://docs.monad.xyz" target="_blank" rel="noreferrer">Monad docs</a><a href="https://github.com/Madxfury/MON-Nest" target="_blank" rel="noreferrer">GitHub</a><a href="https://hackathon.monad.xyz/tracks" target="_blank" rel="noreferrer">Metropolis</a></div><div className="footer-note"><span>Built for Metropolis 2026</span><small>Consumer Products & Payments · Monad</small></div></div><div className="container foot-bottom"><span>© 2026 MON-Nest</span><span>Prototype · Testnet only · Not financial or legal advice</span></div></footer>

    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}><X/></button><img src={selected.image} alt={selected.title}/><div className="modal-body"><span className="kicker">VERIFIED RENTAL</span><h2>{selected.title}</h2><p><MapPin size={16}/>{selected.area}, {selected.city}</p><div className="price-box"><div><span>Monthly rent</span><strong>{selected.rent} MON</strong></div><div><span>Protected deposit</span><strong>{selected.deposit} MON</strong></div><div><span>Platform fee</span><strong>{(selected.rent * .02).toFixed(2)} MON</strong></div></div><button className="primary-btn full" onClick={() => { if (!connected) connect(); setNotice('Demo booking prepared — no transaction was sent'); setSelected(null); }}>Prepare escrow <ShieldCheck size={18}/></button><small>This prototype never requests funds or sends a transaction.</small></div></div></div>}
  </div>;
}

export default App;
