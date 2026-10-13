import assert from 'node:assert/strict';
import { HDKey } from '@scure/bip32';
import { createSecp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { recoverMessageAddress } from 'viem';
// Synthetic fixture only; never used as a deployed wallet.
const derive = () => HDKey.fromMasterSeed(new Uint8Array(32).fill(7)).derive("m/44'/60'/0'/0/0");
const first = derive(), recovered = derive();
const session = createSecp256k1SigningSession({ privateKey: first.privateKey });
const restored = createSecp256k1SigningSession({ privateKey: recovered.privateKey });
first.wipePrivateData(); recovered.wipePrivateData();
const account = toViemAccount(session);
assert.equal(account.address, toViemAccount(restored).address);
const message = 'MON-Nest passkey signing integration';
assert.equal(await recoverMessageAddress({ message, signature: await account.signMessage({ message }) }), account.address);
session.end(); restored.end();
await assert.rejects(() => account.signMessage({ message }), error => error.code === 'SESSION_ENDED');
console.log('Mera: deterministic recovery, viem signing, and session teardown verified.');
