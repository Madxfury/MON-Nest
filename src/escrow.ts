import { createPublicClient, getAddress, http, isAddress, parseAbi, parseEther, type Address } from 'viem';
import { monadTestnet } from 'viem/chains';
import deployment from './deployments/monadTestnet.json';

function pick(envValue: string | undefined, fallback: string | null | undefined): Address | null {
  const value = envValue || fallback;
  return value && isAddress(value) ? getAddress(value) : null;
}

export const escrowAddress = pick(process.env.NEXT_PUBLIC_RENTAL_ESCROW_ADDRESS, deployment.RentalEscrow);
export const registryAddress = pick(process.env.NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS, deployment.PropertyRegistry);
export const courtAddress = pick(process.env.NEXT_PUBLIC_DISPUTE_COURT_ADDRESS, deployment.DisputeCourt);
/** Catalog home id -> PropertyRegistry id, written by scripts/deploy.js. */
export const escrowProperties: Record<string, number> = deployment.escrowProperties;
export const explorer = 'https://testnet.monadvision.com';

/** Catalog prices are illustrative; testnet escrow locks 1/1000th so faucet MON is enough. */
export const TESTNET_SCALE = 1000;
export const testnetAmount = (mon: number) => parseEther((mon / TESTNET_SCALE).toFixed(6));

export const STATES = ['Created', 'Funded', 'Active', 'Disputed', 'Completed', 'Cancelled'] as const;

export const escrowAbi = parseAbi([
  'function nextAgreementId() view returns (uint256)',
  'function agreements(uint256 id) view returns (uint256 propertyId, address owner, address renter, uint128 monthlyRent, uint128 deposit, uint64 startAt, uint64 endAt, uint64 nextReleaseAt, uint8 state, bytes32 termsHash)',
  'function rentHeld(uint256 id) view returns (uint256)',
  'function remainingEscrow(uint256 id) view returns (uint256)',
  'function claimable(address account) view returns (uint256)',
  'function platformFeeBps() view returns (uint16)',
  'function createAgreement(uint256 propertyId, address owner, uint128 monthlyRent, uint128 deposit, uint64 startAt, uint64 endAt, bytes32 termsHash) returns (uint256)',
  'function fund(uint256 id) payable',
  'function releaseRent(uint256 id)',
  'function complete(uint256 id)',
  'function cancel(uint256 id)',
  'function openDispute(uint256 id, bytes32 evidenceRoot)',
  'function withdraw()',
  'event AgreementCreated(uint256 indexed agreementId, uint256 indexed propertyId, address indexed renter, address owner)',
]);

export const registryAbi = parseAbi([
  'function properties(uint256 id) view returns (address owner, bytes32 metadataHash, bytes32 ownershipProofHash, uint64 createdAt, bool verified, bool active)',
]);

export const escrowClient = createPublicClient({
  chain: monadTestnet,
  // Bundles same-tick reads into one Multicall3 request; the public RPC allows ~15 requests/second.
  batch: { multicall: true },
  transport: http(typeof window === 'undefined' ? process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz' : '/api/rpc'),
});

export type Agreement = {
  id: number; propertyId: number; owner: Address; renter: Address; monthlyRent: bigint; deposit: bigint;
  rentHeld: bigint; startAt: number; endAt: number; nextReleaseAt: number; state: (typeof STATES)[number];
};

/** Scans the latest 200 agreements (newest first) and returns those matching `include`, with unreleased rent. */
async function readRecentAgreements(include: (agreement: { propertyId: number; owner: Address; renter: Address }) => boolean): Promise<Agreement[]> {
  if (!escrowAddress) return [];
  const next = Number(await escrowClient.readContract({ address: escrowAddress, abi: escrowAbi, functionName: 'nextAgreementId' }));
  const ids = Array.from({ length: Math.min(next - 1, 200) }, (_, i) => next - 1 - i);
  const rows = await Promise.all(ids.map(id => escrowClient.readContract({ address: escrowAddress!, abi: escrowAbi, functionName: 'agreements', args: [BigInt(id)] })));
  const matches = rows.flatMap((row, index) => {
    const [pid, owner, renter, monthlyRent, deposit, startAt, endAt, nextReleaseAt, state] = row;
    if (!include({ propertyId: Number(pid), owner, renter })) return [];
    return [{ id: ids[index], propertyId: Number(pid), owner, renter, monthlyRent, deposit, startAt: Number(startAt), endAt: Number(endAt), nextReleaseAt: Number(nextReleaseAt), state: STATES[state] }];
  });
  const held = await Promise.all(matches.map(agreement => escrowClient.readContract({ address: escrowAddress!, abi: escrowAbi, functionName: 'rentHeld', args: [BigInt(agreement.id)] })));
  return matches.map((agreement, index) => ({ ...agreement, rentHeld: held[index] }));
}

const involves = (wallet: string, agreement: { owner: Address; renter: Address }) =>
  agreement.owner.toLowerCase() === wallet.toLowerCase() || agreement.renter.toLowerCase() === wallet.toLowerCase();

/** Agreements for one property where the wallet is the renter or owner. */
export const readAgreements = (propertyId: number, wallet: string) => readRecentAgreements(agreement => agreement.propertyId === propertyId && involves(wallet, agreement));

/** All recent agreements where the wallet is the renter or owner. */
export const readAccountAgreements = (wallet: string) => readRecentAgreements(agreement => involves(wallet, agreement));

export async function ensureMonadTestnet() {
  const provider = window.ethereum;
  if (!provider) throw new Error('Install an Ethereum-compatible wallet to continue.');
  // Skip the switch request when already on Monad Testnet: an unneeded network-switch prompt
  // can crash MetaMask 13.52's confirmation screen (MetaMask issue #46887).
  if (await provider.request({ method: 'eth_chainId' }) === '0x279f') return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x279f', chainName: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: ['https://testnet-rpc.monad.xyz'], blockExplorerUrls: [explorer] }] });
  }
  if (await provider.request({ method: 'eth_chainId' }) !== '0x279f') throw new Error('Please select Monad Testnet.');
}
