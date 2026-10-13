import { readFileSync } from 'node:fs';
// configure-indexer.js emits JSON (valid YAML). Fail closed on starter configs.
let config;
try { config = JSON.parse(readFileSync('config.yaml', 'utf8')); }
catch { throw new Error('Run npm run indexer:configure from the repo root after deploying all protocol contracts.'); }
const chain = config.chains?.[0];
if (chain?.id !== 10143 || !Number.isSafeInteger(chain.start_block) || chain.start_block < 1 || chain.contracts?.length !== 5 || chain.contracts.some(item => item.address?.length !== 1 || !/^0x[\da-f]{40}$/i.test(item.address[0]) || /^0x0{40}$/i.test(item.address[0]))) throw new Error('Indexer requires five explicit verified Monad Testnet deployments and their start block.');
