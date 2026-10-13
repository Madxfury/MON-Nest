'use client';
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';

type Data = {
  Activity: { id: string; kind: string; subjectId: string; amountWei: string; detail: string; txHash: string; timestamp: number }[];
  Agreement: { agreementId: string; state: string; fundedWei: string; releasedWei: string; ownerAwardWei: string; renterAwardWei: string }[];
  ReputationScore: { role: number; positive: number; negative: number }[];
};
export default function IndexedAccount({ address }: { address: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    setData(null); setState('loading');
    const load = async () => {
      try {
        const response = await fetch(`/api/history?account=${address}`);
        if (response.status === 503) { if (active) setState('unconfigured'); return; }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (active) { setData(result.data); setState('ready'); }
      } catch { if (active) setState('error'); }
    };
    void load(); const timer = window.setInterval(load, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [address]);
  if (state === 'unconfigured') return null;
  return <section className="profile-saved"><div className="section-head"><div><span className="kicker">YOUR ONCHAIN ACTIVITY</span><h2>Payments & records</h2></div><small>Indexed by Envio</small></div><div className="panel">{state === 'loading' ? <p>Loading your records…</p> : state === 'error' ? <p>Indexed records are temporarily unavailable.</p> : <>{data?.Agreement.map(item => <article className="indexed-row" key={item.agreementId}><strong>Agreement #{item.agreementId}</strong><span>{item.state}</span><small>{formatEther(BigInt(item.fundedWei))} MON funded · {formatEther(BigInt(item.releasedWei))} MON released</small></article>)}{data?.Activity.length ? data.Activity.map(item => <article className="indexed-row" key={item.id}><div><strong>{item.kind}</strong><small>{item.detail} · {new Date(item.timestamp * 1000).toLocaleDateString()}</small></div><span>{formatEther(BigInt(item.amountWei))} MON</span><a href={`https://testnet.monadvision.com/tx/${item.txHash}`} target="_blank" rel="noreferrer">Receipt ↗</a></article>) : <p>No indexed activity for this account yet.</p>}{Boolean(data?.ReputationScore.length) && <div className="reputation-row">{data!.ReputationScore.map(score => <span key={score.role}>{['Renter', 'Owner', 'Juror'][score.role]} reputation: {score.positive} positive · {score.negative} negative</span>)}</div>}</>}</div></section>;
}
