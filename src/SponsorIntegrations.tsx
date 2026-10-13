import { ArrowUpRight, Check, Clock3, KeyRound, Layers3, Radio, ShieldCheck } from 'lucide-react';
import AuroraRouteStatus from './AuroraRouteStatus';

export default function SponsorIntegrations({ alchemyConfigured }: { alchemyConfigured: boolean }) {
  const integrations = [
    {
      name: 'Mera', icon: KeyRound, status: 'SDK integrated', tone: 'integrated',
      bounty: 'Best Mera-Powered UX on Monad',
      description: 'Create and recover a passkey account, then sign transactions without a seed phrase or custody backend.',
      detail: 'Device verification and the first onchain booking are still pending.',
    },
    {
      name: 'Envio', icon: Layers3, status: 'APIs verified', tone: 'verified',
      bounty: 'Best Use of Envio',
      description: 'HyperSync and HyperRPC access is verified on Monad Testnet. Event handlers cover bookings, escrow, disputes, votes, and reputation.',
      detail: 'Live rental history awaits deployed contracts and a hosted indexer.',
    },
    {
      name: 'Alchemy', icon: Radio, status: alchemyConfigured ? 'RPC connected' : 'Not configured', tone: alchemyConfigured ? 'verified' : 'pending',
      bounty: 'Best Projects using Alchemy',
      description: alchemyConfigured
        ? 'Monad Testnet RPC powers account balances, contract reads, gas estimates, and transaction preflight checks.'
        : 'The RPC adapter is ready. Public Monad Testnet RPC is used until an Alchemy endpoint is configured.',
      detail: alchemyConfigured ? 'Chain 10143 · credentials stay server-side. Full booking verification is pending.' : 'Alchemy credentials have not been configured for this build.',
    },
  ];

  return <section className="sponsor-section" aria-labelledby="sponsors-heading">
    <div className="sponsor-heading">
      <div><span className="kicker">SPONSOR BOUNTIES</span><h3 id="sponsors-heading">What powers the experience.</h3></div>
      <p>One passkey account layer, verified testnet infrastructure, and a clear path from code to live rental records.</p>
    </div>
    <div className="sponsor-grid sponsor-core">
      {integrations.map(({ name, icon: Icon, status, tone, bounty, description, detail }) => <article className="sponsor-card" key={name}>
        <div className="sponsor-card-top"><span className="sponsor-icon" aria-hidden="true"><Icon size={21}/></span><span className={`integration-status ${tone}`}>{tone === 'pending' ? <Clock3 size={12} aria-hidden="true"/> : <Check size={12} aria-hidden="true"/>}{status}</span></div>
        <h4>{name}</h4><strong>{bounty}</strong><p>{description}</p><small>{detail}</small>
      </article>)}
    </div>
    <div className="sponsor-progress-heading"><Clock3 size={15} aria-hidden="true"/><h4>In progress</h4><span>Not active in the rental flow</span></div>
    <div className="sponsor-progress">
      <article><div><h4>Chainlink CRE</h4><span className="integration-status pending">Locally tested</span></div><strong>Best workflow with CRE</strong><p>Scheduled rent releases and evidence-deadline signals are implemented. CRE simulation, a trusted forwarder, and live deployment are still pending.</p></article>
      <AuroraRouteStatus/>
    </div>
    <div className="sponsor-footer"><ShieldCheck size={20} aria-hidden="true"/><p>Mera is the only account layer. Monad Testnet only—no real-money rentals. Statuses describe implementation, not bounty awards.</p><a href="https://github.com/Madxfury/MON-Nest/blob/main/docs/SPONSOR_INTEGRATIONS.md" target="_blank" rel="noreferrer">View integration checklist <ArrowUpRight size={15} aria-hidden="true"/></a></div>
  </section>;
}
