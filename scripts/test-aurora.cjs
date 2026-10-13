const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
const { inspectAuroraCapabilities, fetchAuroraAvailability, AURORA_CAPABILITIES_URL } = require('../src/lib/aurora.ts');
const asset = (id, blockchain, symbol, contractAddress = '') => ({ assetId: `nep245:v2_1.omni.hot.tg:${id}_11111111111111111111`, blockchain, symbol, contractAddress });
const mainnet = { result: { in: [asset(143, 'monad', 'MON')], out: [asset(143, 'monad', 'MON')] } };
const both = { result: { in: [asset(1313161555, 'aurora', 'ETH')], out: [asset(10143, 'monad', 'MON')] } };
const check = data => inspectAuroraCapabilities(data, '2026-10-14T00:00:00.000Z');
assert.equal(check(mainnet).status, 'missing-route');
assert.equal(check(mainnet).destinationAdvertised, false);
assert.deepEqual(check(mainnet).advertisedMonadChainIds, [143]);
assert.equal(check(both).status, 'verification-required');
assert.equal(check(both).fundingEnabled, false, 'Advertising tokens must never enable deposits');
assert.equal(check({ result: { in: [], out: both.result.out } }).status, 'missing-route', 'Source route is also required');
assert.equal(check({ result: { in: both.result.in, out: [asset(10143, 'monad', 'USDC', '0x123')] } }).destinationAdvertised, false, 'Escrow only accepts native MON');
assert.equal(check({ result: { in: both.result.in, out: [asset(143, 'monad-testnet', 'MON')] } }).destinationAdvertised, false, 'Display names cannot override chain IDs');
assert.equal(check({ result: { in: both.result.in, out: [{ ...asset(10143, 'monad', 'MON'), assetId: 'unknown:10143:MON' }] } }).destinationAdvertised, false, 'Unknown asset formats fail closed');
for (const data of [null, {}, { result: {} }, { result: { in: [], out: [{}] } }, { result: { in: [], out: null } }]) assert.throws(() => check(data));

(async () => {
  let requestCount = 0;
  const fakeFetch = async (url, options) => {
    requestCount++;
    assert.equal(url, AURORA_CAPABILITIES_URL);
    assert.equal(options.method, undefined, 'Only a read-only GET is allowed');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(mainnet));
  };
  assert.equal((await fetchAuroraAvailability(fakeFetch)).fundingEnabled, false);
  await assert.rejects(fetchAuroraAvailability(async () => new Response('', { status: 500 })));
  await assert.rejects(fetchAuroraAvailability(async () => new Response('{}')));
  await assert.rejects(fetchAuroraAvailability(async () => new Response('not json')));
  const oldFetch = global.fetch;
  try {
    global.fetch = async () => { throw new Error('provider offline'); };
    const { GET } = require('../src/app/api/aurora/availability/route.ts');
    const offline = await GET();
    assert.equal(offline.status, 503);
    assert.equal((await offline.json()).fundingEnabled, false);
    global.fetch = fakeFetch;
    requestCount = 0;
    const results = await Promise.all(Array.from({ length: 10 }, () => GET()));
    assert.equal(requestCount, 1, 'Concurrent capability calls must be coalesced');
    for (const response of results) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal((await response.json()).fundingEnabled, false);
    }
    await GET();
    assert.equal(requestCount, 1, 'Successful capability discovery is cached for one minute');
  } finally { global.fetch = oldFetch; }
  console.log('Aurora: chain isolation, malformed/offline responses, native asset gating, read-only transport, API failure, cache and concurrent requests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
