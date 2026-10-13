// Read-only capability check. Never produces a deposit address or submits funds.
const endpoint = 'https://intents-connect-alpha-api.aurora.dev';
const response = await fetch(`${endpoint}/api/v1/supported_tokens`, { signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error(`Aurora capabilities unavailable (${response.status})`);
const data = await response.json();
const tokens = (data.result?.out || []).filter(token => token.blockchain?.toLowerCase().includes('monad'));
console.log('Aurora advertised Monad destination assets:', tokens.map(({ assetId, blockchain, symbol }) => ({ assetId, blockchain, symbol })));
const testnet = tokens.filter(token => /(^|\D)10143(\D|$)|monad[-_ ]testnet/i.test(`${token.assetId} ${token.blockchain}`));
if (!testnet.length) { console.error('BLOCKED: no advertised Monad Testnet (10143) route. MON-Nest cross-chain funding remains disabled. Do not deposit mainnet assets into a testnet escrow.'); process.exitCode = 2; }
else console.log('Candidate testnet routes found. Confirm execution support with Aurora before enabling deposits.');
