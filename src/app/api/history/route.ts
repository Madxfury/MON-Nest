import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const listing = url.searchParams.get('listing');
  const account = url.searchParams.get('account');
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  if (!endpoint) return NextResponse.json({ source: 'unconfigured', error: 'Envio endpoint not configured' }, { status: 503 });
  if (listing && (!/^\d{1,20}$/.test(listing) || Number(listing) < 1) || account && !isAddress(account) || !listing && !account || listing && account) return NextResponse.json({ error: 'Invalid history filter' }, { status: 400 });
  const address = process.env.NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS?.toLowerCase();
  if (!address) return NextResponse.json({ error: 'Booking deployment not configured' }, { status: 503 });
  const escrow = process.env.NEXT_PUBLIC_RENTAL_ESCROW_ADDRESS?.toLowerCase() || '';
  const reputation = process.env.NEXT_PUBLIC_REPUTATION_ADDRESS?.toLowerCase() || '';
  const contracts = [address, escrow, reputation, process.env.NEXT_PUBLIC_DISPUTE_COURT_ADDRESS?.toLowerCase(), process.env.NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS?.toLowerCase()].filter(Boolean);
  const query = listing ? `query History($where: Booking_bool_exp!) { Booking(where: $where, order_by: [{blockNumber: asc}, {logIndex: asc}], limit: 1000) { listingId renter broker paidWei bookedAt expiresAt txHash blockNumber logIndex } }` : `query Account($account: String!, $contracts: [String!]!, $escrow: String!, $reputation: String!) { Activity(where: {account: {_eq: $account}, contract: {_in: $contracts}, chainId: {_eq: 10143}}, order_by: {blockNumber: desc}, limit: 50) { id kind subjectId amountWei detail txHash blockNumber timestamp } Agreement(where: {chainId: {_eq: 10143}, contract: {_eq: $escrow}, _or: [{renter: {_eq: $account}}, {owner: {_eq: $account}}]}, limit: 50) { agreementId propertyId state fundedWei releasedWei ownerAwardWei renterAwardWei } ReputationScore(where: {chainId: {_eq: 10143}, contract: {_eq: $reputation}, account: {_eq: $account}}, limit: 3) { role positive negative updatedAt } }`;
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.ENVIO_GRAPHQL_SECRET ? { 'x-hasura-admin-secret': process.env.ENVIO_GRAPHQL_SECRET } : {}) }, body: JSON.stringify({ query, variables: listing ? { where: { listingId: { _eq: listing }, contract: { _eq: address }, chainId: { _eq: 10143 } } } : { account: account!.toLowerCase(), escrow, reputation, contracts } }), signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || result.errors || !result.data) throw new Error('Indexer query failed');
    return NextResponse.json({ source: 'envio', data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ source: 'envio', error: 'Indexed history is temporarily unavailable' }, { status: 502 }); }
}
