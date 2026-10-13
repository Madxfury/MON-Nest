import { createPublicClient, getAddress, http, isAddress, parseAbi, type Address, type Hash } from 'viem';
import { monadTestnet } from 'viem/chains';

const configuredAddress = process.env.NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS;
const configuredBroker = process.env.NEXT_PUBLIC_BROKER_ADDRESS;
const configuredDeployBlock = process.env.NEXT_PUBLIC_MON_NEST_BOOKINGS_DEPLOY_BLOCK?.trim();

export const bookingsAddress: Address | null = configuredAddress && isAddress(configuredAddress)
  ? getAddress(configuredAddress)
  : null;
export const expectedBrokerAddress: Address | null = configuredBroker && isAddress(configuredBroker)
  ? getAddress(configuredBroker)
  : null;
export const bookingsDeployBlock: bigint | null = configuredDeployBlock && /^(0|[1-9]\d*)$/.test(configuredDeployBlock)
  ? BigInt(configuredDeployBlock)
  : null;

export const bookingsAbi = parseAbi([
  'function broker() view returns (address)',
  'function listings(uint256 listingId) view returns (uint128 priceWei, uint64 durationSeconds, bool active)',
  'function bookings(uint256 listingId) view returns (address renter, uint64 bookedAt, uint64 expiresAt, uint256 paidWei)',
  'function isRented(uint256 listingId) view returns (bool)',
  'function getBookingSnapshots(uint256[] listingIds) view returns ((uint128 priceWei, uint64 durationSeconds, bool active)[] configured, (address renter, uint64 bookedAt, uint64 expiresAt, uint256 paidWei)[] current, bool[] rented)',
  'function book(uint256 listingId, address expectedBroker) payable',
  'event HomeBooked(uint256 indexed listingId, address indexed renter, address indexed broker, uint256 paidWei, uint64 bookedAt, uint64 expiresAt)',
]);

export const bookingsClient = createPublicClient({
  chain: monadTestnet,
  transport: http(typeof window === 'undefined' ? process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz' : '/api/rpc'),
});

export type BookingSnapshot = {
  renter: Address;
  bookedAt: number;
  expiresAt: number;
  paidWei: bigint;
  priceWei: bigint;
  active: boolean;
  rented: boolean;
};

export type BookingHistoryEvent = {
  listingId: number;
  renter: Address;
  broker: Address;
  bookedAt: number;
  expiresAt: number;
  paidWei: bigint;
  txHash: Hash;
  blockNumber: bigint;
  transactionIndex: number;
  logIndex: number;
};

export async function readAllBookings(listingIds: number[]): Promise<Record<number, BookingSnapshot>> {
  if (!bookingsAddress) throw new Error('Booking contract is not configured.');
  if (listingIds.length > 48 || listingIds.some(id => !Number.isSafeInteger(id) || id < 1 || id > 48) || new Set(listingIds).size !== listingIds.length) throw new Error('Invalid catalog listing IDs.');
  const [listings, current, rented] = await bookingsClient.readContract({
    address: bookingsAddress, abi: bookingsAbi, functionName: 'getBookingSnapshots', args: [listingIds.map(BigInt)],
  });
  if (listings.length !== listingIds.length || current.length !== listingIds.length || rented.length !== listingIds.length) throw new Error('Unexpected catalog response.');
  return Object.fromEntries(listingIds.map((id, index) => [id, {
    renter: current[index].renter, bookedAt: Number(current[index].bookedAt), expiresAt: Number(current[index].expiresAt),
    paidWei: current[index].paidWei, priceWei: listings[index].priceWei, active: listings[index].active, rented: rented[index],
  }]));
}

// Small eth_getLogs windows keep the unindexed payload and RPC response bounded.
const HISTORY_BLOCK_WINDOW = BigInt(1_000);
const HISTORY_BATCH_SIZE = 4;

/** Reads confirmed booking events in chain order. An unset deployment block never triggers a genesis scan. */
export async function readBookingHistory(listingId: number): Promise<BookingHistoryEvent[]> {
  if (!bookingsAddress || bookingsDeployBlock === null) return [];
  if (!Number.isSafeInteger(listingId) || listingId < 1) throw new Error('Invalid listing ID.');
  let indexed: BookingHistoryEvent[] = [];
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`/api/history?listing=${listingId}`);
      if (response.ok) {
        const result = await response.json();
        // Empty indexer results may mean it is still catching up. Read the chain as fallback.
        if (result.data.Booking.length) indexed = result.data.Booking.map((row: { renter: Address; broker: Address; bookedAt: number; expiresAt: number; paidWei: string; txHash: Hash; blockNumber: number; logIndex: number }) => ({ listingId, ...row, paidWei: BigInt(row.paidWei), blockNumber: BigInt(row.blockNumber), transactionIndex: 0 }));
      }
    } catch { /* Current availability and RPC history remain usable during indexer outages. */ }
  }

  const latestBlock = await bookingsClient.getBlockNumber();
  if (bookingsDeployBlock > latestBlock) return [];
  const historyStart = indexed.length ? indexed[indexed.length - 1].blockNumber : bookingsDeployBlock;
  // A full unindexed chain scan must not freeze a browser for minutes or exhaust RPC quotas.
  if (latestBlock - historyStart > BigInt(200_000)) throw new Error('Full booking history requires the configured indexer to catch up.');

  const events: BookingHistoryEvent[] = [...indexed];
  let nextBlock = historyStart;
  while (nextBlock <= latestBlock) {
    const requests = [];
    for (let i = 0; i < HISTORY_BATCH_SIZE && nextBlock <= latestBlock; i++) {
      const fromBlock = nextBlock;
      const endBlock = fromBlock + HISTORY_BLOCK_WINDOW - BigInt(1);
      const toBlock = endBlock < latestBlock ? endBlock : latestBlock;
      requests.push(bookingsClient.getContractEvents({
        address: bookingsAddress,
        abi: bookingsAbi,
        eventName: 'HomeBooked',
        args: { listingId: BigInt(listingId) },
        fromBlock,
        toBlock,
        strict: true,
      }));
      nextBlock = toBlock + BigInt(1);
    }

    const pages = await Promise.all(requests);
    for (const page of pages) {
      for (const log of page) {
        events.push({
          listingId,
          renter: log.args.renter,
          broker: log.args.broker,
          bookedAt: Number(log.args.bookedAt),
          expiresAt: Number(log.args.expiresAt),
          paidWei: log.args.paidWei,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          transactionIndex: log.transactionIndex,
          logIndex: log.logIndex,
        });
      }
    }
  }

  return [...new Map(events.map(event => [`${event.txHash}:${event.logIndex}`, event])).values()].sort((a, b) => a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex);
}

/** Read one wallet's booking events once for the profile, rather than scanning every listing. */
export async function readAccountBookingHistory(renter: Address): Promise<BookingHistoryEvent[]> {
  if (!bookingsAddress || bookingsDeployBlock === null) return [];
  if (!isAddress(renter)) throw new Error('Invalid renter address.');
  const latestBlock = await bookingsClient.getBlockNumber();
  if (bookingsDeployBlock > latestBlock) return [];
  if (latestBlock - bookingsDeployBlock > BigInt(200_000)) throw new Error('Account booking history requires a caught-up indexer.');
  const events: BookingHistoryEvent[] = [];
  let nextBlock = bookingsDeployBlock;
  while (nextBlock <= latestBlock) {
    const requests = [];
    for (let i = 0; i < HISTORY_BATCH_SIZE && nextBlock <= latestBlock; i++) {
      const fromBlock = nextBlock;
      const endBlock = fromBlock + HISTORY_BLOCK_WINDOW - BigInt(1);
      const toBlock = endBlock < latestBlock ? endBlock : latestBlock;
      requests.push(bookingsClient.getContractEvents({ address: bookingsAddress, abi: bookingsAbi, eventName: 'HomeBooked', args: { renter }, fromBlock, toBlock, strict: true }));
      nextBlock = toBlock + BigInt(1);
    }
    for (const page of await Promise.all(requests)) for (const log of page) {
      events.push({ listingId: Number(log.args.listingId), renter: log.args.renter, broker: log.args.broker,
        paidWei: log.args.paidWei, bookedAt: Number(log.args.bookedAt), expiresAt: Number(log.args.expiresAt),
        txHash: log.transactionHash, blockNumber: log.blockNumber, transactionIndex: log.transactionIndex, logIndex: log.logIndex });
    }
  }
  return events.sort((a, b) => a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex);
}

export async function readBooking(listingId: number): Promise<BookingSnapshot> {
  if (!bookingsAddress) throw new Error('Booking contract is not configured.');
  const [listing, booking, rented] = await Promise.all([
    bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'listings', args: [BigInt(listingId)] }),
    bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'bookings', args: [BigInt(listingId)] }),
    bookingsClient.readContract({ address: bookingsAddress, abi: bookingsAbi, functionName: 'isRented', args: [BigInt(listingId)] }),
  ]);
  return {
    renter: booking[0],
    bookedAt: Number(booking[1]),
    expiresAt: Number(booking[2]),
    paidWei: booking[3],
    priceWei: listing[0],
    active: listing[2],
    rented,
  };
}
