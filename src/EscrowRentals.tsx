'use client';

import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { homes } from './data';
import { type Agreement, escrowAddress, escrowProperties, readAccountAgreements } from './escrow';

/** Escrow agreements where this wallet is the renter or the owner, with a shortcut to manage each home. */
export default function EscrowRentals({ address, onOpenHome }: { address: string; onOpenHome: (homeId: number) => void }) {
  const [rows, setRows] = useState<Agreement[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    readAccountAgreements(address).then(result => { if (active) setRows(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [address]);
  if (!escrowAddress) return null;
  const homeFor = (propertyId: number) => homes.find(home => escrowProperties[String(home.id)] === propertyId);
  const mon = (value: bigint) => `${Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 6 })} MON`;
  return <section className="profile-saved escrow-rentals">
    <div className="section-head"><div><span className="kicker">TESTNET ESCROW</span><h2>Your escrow rentals</h2></div></div>
    {failed ? <div className="panel"><p>Escrow records are temporarily unavailable.</p></div>
      : rows === null ? <div className="panel"><p>Loading escrow agreements…</p></div>
      : !rows.length ? <div className="panel"><h3>No escrow agreements yet</h3><p>Rent a paid home to lock its first month and deposit in escrow. Agreements where you are the owner appear here too.</p></div>
      : <div className="escrow-rental-list">{rows.map(agreement => {
        const home = homeFor(agreement.propertyId);
        const asOwner = agreement.owner.toLowerCase() === address.toLowerCase();
        return <article className="panel escrow-rental" key={agreement.id}>
          <div>
            <span className={`rental-pill ${agreement.state === 'Funded' || agreement.state === 'Active' ? 'active' : ''}`}>{agreement.state}</span>
            <h3>{home?.title ?? `Property #${agreement.propertyId}`}</h3>
            <p>Agreement #{agreement.id} · you are the {asOwner ? 'owner' : 'renter'} · rent held {mon(agreement.rentHeld)} · deposit {mon(agreement.deposit)}</p>
          </div>
          {home && <button className="quiet-button" onClick={() => onOpenHome(home.id)}>Manage</button>}
        </article>;
      })}</div>}
  </section>;
}
