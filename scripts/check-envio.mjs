import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
// Read-only checks. Never log tokens, authenticated URLs or response errors.
async function check() {
  const sync = process.env.ENVIO_API_TOKEN, rpc = process.env.ENVIO_HYPERRPC_TOKEN;
  if (!sync || !rpc) throw new Error('Set both Envio tokens in ignored .env.local first.');
  const heightResponse = await fetch('https://10143.hypersync.xyz/height', { headers: { Authorization: `Bearer ${sync}` }, signal: AbortSignal.timeout(15_000) });
  if (!heightResponse.ok) throw new Error(`HyperSync height check returned HTTP ${heightResponse.status}.`);
  const { height } = await heightResponse.json();
  if (!Number.isSafeInteger(height) || height < 1) throw new Error('HyperSync returned an invalid height.');
  const response = await fetch('https://10143.hypersync.xyz/query', { method: 'POST', headers: { Authorization: `Bearer ${sync}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from_block: height - 1, to_block: height, include_all_blocks: true, field_selection: { block: ['number', 'hash'] } }), signal: AbortSignal.timeout(15_000) });
  const query = await response.json();
  if (!response.ok || query.error || query.next_block !== height) throw new Error(`HyperSync authenticated query failed (HTTP ${response.status}).`);
  console.log(`HyperSync: authenticated Monad Testnet query verified at block ${height}.`);
  const rpcResponse = await fetch('https://10143.rpc.hypersync.xyz', { method: 'POST', headers: { Authorization: `Bearer ${rpc}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(15_000) });
  const result = await rpcResponse.json();
  if (!rpcResponse.ok || result.error || BigInt(result.result || 0) !== 10143n) throw new Error(`HyperRPC chain check failed (HTTP ${rpcResponse.status}).`);
  console.log('HyperRPC: authenticated chain 10143 verified. Credentials not printed.');
}
check().catch(error => { console.error(error instanceof TypeError ? 'Envio connection failed; secret omitted.' : error.message); process.exitCode = 1; });
