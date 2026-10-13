'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import type { AuroraAvailability } from './lib/aurora';

export default function AuroraRouteStatus() {
  const [availability, setAvailability] = useState<AuroraAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);

  async function check() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setFailed(false); setAvailability(null);
    try {
      const response = await fetch('/api/aurora/availability', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      const result: AuroraAvailability = await response.json();
      if (!['missing-route', 'verification-required'].includes(result.status) || result.fundingEnabled !== false || result.destinationChainId !== 10143) throw new Error('Invalid route');
      setAvailability(result);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => { void check(); return () => active.current?.abort(); }, []);

  return <article className="aurora-route-card">
    <div><h4>Aurora Intents</h4><span className="integration-status pending">{loading ? 'Checking route…' : failed ? 'Check unavailable' : availability?.status === 'verification-required' ? 'Verification required' : 'Route not available'}</span></div>
    <strong>Bring Any-Chain Liquidity to Monad</strong>
    <div className="aurora-network-path" aria-label="Requested funding route">
      <span>Aurora Testnet<small>1313161555 · ETH</small></span><ArrowRight size={16} aria-hidden="true"/><span>Monad Testnet<small>10143 · MON</small></span>
    </div>
    <div className="aurora-route-result" role="status" aria-live="polite" aria-busy={loading}>
      {loading ? <p>Reading the live Intents token service. No wallet connection or signature needed.</p> : failed ? <p>We couldn’t verify route availability. Try again shortly. Funding remains disabled.</p> : availability && <>
        <p>{availability.status === 'verification-required'
          ? 'Candidate assets are advertised. Escrow execution and a destination receipt must still be verified before funding can open.'
          : 'The Intents service does not advertise this testnet route. Adding an RPC URL cannot enable a cross-chain transfer.'}</p>
        <dl><div><dt>Aurora Testnet source</dt><dd>{availability.sourceAdvertised ? 'Advertised' : 'Not advertised'}</dd></div><div><dt>Monad Testnet MON</dt><dd>{availability.destinationAdvertised ? 'Advertised' : 'Not advertised'}</dd></div></dl>
        {availability.advertisedMonadChainIds.includes(143) && <p className="aurora-route-evidence">Advertised Monad destination: mainnet 143{availability.advertisedMonadSymbols.length ? ` (${availability.advertisedMonadSymbols.join(', ')})` : ''}. Not used by MON-Nest.</p>}
        <small>Checked <time dateTime={availability.checkedAt}>{new Date(availability.checkedAt).toLocaleString()}</time></small>
      </>}
    </div>
    <div className="aurora-route-actions"><button type="button" onClick={() => void check()} disabled={loading}><RefreshCw size={13} aria-hidden="true"/>{loading ? 'Checking…' : 'Check again'}</button><a href="https://intents-connect-alpha-api.aurora.dev/api/v1/supported_tokens" target="_blank" rel="noreferrer">View provider data ↗</a></div>
    <p className="aurora-funding-note">No mainnet bridge or deposit is enabled. Direct Monad Testnet bookings do not depend on this route.</p>
  </article>;
}
