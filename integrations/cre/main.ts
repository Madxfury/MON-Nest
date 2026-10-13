import { CronCapability, EVMClient, Runner, handler, getNetwork, encodeCallMsg, bytesToHex, hexToBase64, LAST_FINALIZED_BLOCK_NUMBER, type Runtime } from '@chainlink/cre-sdk';
import { decodeFunctionResult, encodeFunctionData, encodeAbiParameters, parseAbi, parseAbiParameters, zeroAddress, type Address } from 'viem';

type Config = { schedule: string; chainName: string; chainId: number; escrow: Address; receiver: Address; gasLimit: string; agreementIds: string[] };
const abi = parseAbi([
  'function agreements(uint256) view returns (uint256 propertyId,address owner,address renter,uint128 monthlyRent,uint128 deposit,uint64 startAt,uint64 endAt,uint64 nextReleaseAt,uint8 state,bytes32 termsHash)',
  'function rentReleased(uint256) view returns (bool)',
  'function evidenceDeadlines(uint256) view returns (uint64)',
]);
const run = (runtime: Runtime<Config>) => {
  const config = runtime.config;
  const network = getNetwork({ chainFamily: 'evm', chainSelectorName: config.chainName });
  if (!network) throw new Error('Configured chain is unavailable in this CRE SDK. Request supported Monad capability configuration.');
  const evm = new EVMClient(network.chainSelector.selector);
  const now = BigInt(Math.floor(runtime.now().getTime() / 1000));
  const outputs: string[] = [];
  for (const id of config.agreementIds.slice(0, 10)) {
    const agreementId = BigInt(id);
    const read = (target: Address, functionName: 'agreements' | 'rentReleased' | 'evidenceDeadlines') => {
      const response = evm.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: target, data: encodeFunctionData({ abi, functionName, args: [agreementId] }) }), blockNumber: LAST_FINALIZED_BLOCK_NUMBER }).result();
      return decodeFunctionResult({ abi, functionName, data: bytesToHex(response.data) });
    };
    const agreement = read(config.escrow, 'agreements') as readonly [bigint, Address, Address, bigint, bigint, bigint, bigint, bigint, number, `0x${string}`];
    const released = read(config.escrow, 'rentReleased') as boolean;
    const deadline = read(config.receiver, 'evidenceDeadlines') as bigint;
    const actions: number[] = [];
    if ((agreement[8] === 1 || agreement[8] === 2) && agreement[7] <= now && !released) actions.push(0);
    if (deadline > 0n && deadline <= now) actions.push(1);
    for (const action of actions) {
      const data = encodeAbiParameters(parseAbiParameters('uint256,address,uint64,uint8,uint256'), [BigInt(config.chainId), config.receiver, now, action, agreementId]);
      const report = runtime.report({ encodedPayload: hexToBase64(data), encoderName: 'evm', signingAlgo: 'ecdsa', hashingAlgo: 'keccak256' }).result();
      const result = evm.writeReport(runtime, { receiver: config.receiver, report, gasConfig: { gasLimit: config.gasLimit } }).result();
      if (result.errorMessage) throw new Error(result.errorMessage);
      const hash = bytesToHex(result.txHash || new Uint8Array());
      runtime.log(`Agreement ${id}, action ${action}: ${hash}`); outputs.push(hash);
    }
  }
  return outputs;
};
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(config => [handler(new CronCapability().trigger({ schedule: config.schedule }), run)]);
}
void main();
