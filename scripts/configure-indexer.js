const fs = require('node:fs');
const path = require('node:path');
const { isAddress, ZeroAddress, Interface } = require('ethers');
require('dotenv').config({ path: '.env.local', quiet: true });
const names = {
  Bookings: ['MonNestBookings', 'NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS'],
  PropertyRegistry: ['PropertyRegistry', 'NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS'],
  RentalEscrow: ['RentalEscrow', 'NEXT_PUBLIC_RENTAL_ESCROW_ADDRESS'],
  DisputeCourt: ['DisputeCourt', 'NEXT_PUBLIC_DISPUTE_COURT_ADDRESS'],
  Reputation: ['Reputation', 'NEXT_PUBLIC_REPUTATION_ADDRESS'],
};
const start = process.env.INDEXER_START_BLOCK || process.env.NEXT_PUBLIC_MON_NEST_BOOKINGS_DEPLOY_BLOCK;
if (!start || !/^\d+$/.test(start) || !Number.isSafeInteger(Number(start))) throw new Error('Set INDEXER_START_BLOCK to the earliest protocol deployment block.');
const contracts = [], addresses = [];
for (const [name, [artifactName, variable]] of Object.entries(names)) {
  const address = process.env[variable];
  if (!address) throw new Error(`Set ${variable} to a verified deployment before indexing the rental protocol.`);
  if (address && (!isAddress(address) || address === ZeroAddress)) throw new Error(`Invalid ${variable}`);
  const artifact = JSON.parse(fs.readFileSync(path.join('artifacts/contracts', `${artifactName}.sol`, `${artifactName}.json`), 'utf8'));
  contracts.push({ name, events: new Interface(artifact.abi).fragments.filter(item => item.type === 'event' && !['RoleAdminChanged', 'RoleGranted', 'RoleRevoked', 'OwnershipTransferred', 'Paused', 'Unpaused', 'BrokerChanged'].includes(item.name)).map(item => ({ event: item.format('full').replace(/^event /, '') })) });
  addresses.push({ name, address: address ? [address] : [] });
}
if (!addresses.find(item => item.name === 'Bookings').address.length) throw new Error('Deploy and configure MonNestBookings first.');
// JSON is valid YAML. RPC secrets stay in service environment variables.
const rpc = process.env.ENVIO_HYPERRPC_TOKEN ? [{ url: 'https://10143.rpc.hypersync.xyz', for: 'fallback', headers: { Authorization: 'Bearer ${ENVIO_HYPERRPC_TOKEN}' } }] : 'https://testnet-rpc.monad.xyz';
fs.writeFileSync('indexer/config.yaml', JSON.stringify({ name: 'mon-nest', field_selection: { transaction_fields: ['hash'] }, contracts, chains: [{ id: 10143, start_block: Number(start), hypersync_config: { url: 'https://10143.hypersync.xyz' }, rpc, contracts: addresses }] }, null, 2) + '\n');
console.log(`Configured Monad Testnet contract addresses from block ${start}.`);
