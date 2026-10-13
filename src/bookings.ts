import { createPublicClient, getAddress, http, isAddress, parseAbi, type Address } from 'viem';
import { monadTestnet } from 'viem/chains';

const configuredAddress = process.env.NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS;
const configuredBroker = process.env.NEXT_PUBLIC_BROKER_ADDRESS;

export const bookingsAddress: Address | null = configuredAddress && isAddress(configuredAddress)
  ? getAddress(configuredAddress)
  : null;
export const expectedBrokerAddress: Address | null = configuredBroker && isAddress(configuredBroker)
  ? getAddress(configuredBroker)
  : null;

export const bookingsAbi = parseAbi([
  'function broker() view returns (address)',
  'function listings(uint256 listingId) view returns (uint128 priceWei, uint64 durationSeconds, bool active)',
  'function bookings(uint256 listingId) view returns (address renter, uint64 bookedAt, uint64 expiresAt, uint256 paidWei)',
  'function isRented(uint256 listingId) view returns (bool)',
  'function book(uint256 listingId) payable',
  'event HomeBooked(uint256 indexed listingId, address indexed renter, address indexed broker, uint256 paidWei, uint64 expiresAt)',
]);

export const bookingsClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'),
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
