import { NextResponse } from 'next/server';

const methods = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBalance', 'eth_getCode', 'eth_call', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getTransactionCount', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getLogs', 'eth_sendRawTransaction']);
let checkedEndpoint = '', checkedAt = 0;
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Cross-origin RPC access is not allowed' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 128_000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  try {
    const text = await request.text();
    if (text.length > 128_000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const body = JSON.parse(text);
    const calls = Array.isArray(body) ? body : [body];
    if (!calls.length || calls.length > 25 || calls.some(call => !methods.has(call.method) || call.jsonrpc !== '2.0')) return NextResponse.json({ error: 'Unsupported RPC method' }, { status: 400 });
    const endpoint = process.env.ALCHEMY_MONAD_TESTNET_RPC_URL || process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
    if (checkedEndpoint !== endpoint || Date.now() - checkedAt > 60_000) {
      const chainResponse = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      const chain = await chainResponse.json();
      if (!chainResponse.ok || BigInt(chain.result || 0) !== BigInt(10143)) return NextResponse.json({ error: 'RPC must be configured for Monad Testnet (10143)' }, { status: 503 });
      checkedEndpoint = endpoint; checkedAt = Date.now();
    }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'RPC temporarily unavailable' }, { status: 502 });
    return NextResponse.json(await response.json(), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'RPC request failed' }, { status: 502 }); }
}
