// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/// @notice A small, public availability ledger for MON-Nest's bookable homes.
/// @dev The broker receives the listed price immediately. This contract does not
/// hold a deposit or create a legal lease; paid escrow belongs in RentalEscrow.
contract MonNestBookings is Ownable, ReentrancyGuard {
    struct Listing {
        uint128 priceWei;
        uint64 durationSeconds;
        bool active;
    }

    struct Booking {
        address renter;
        uint64 bookedAt;
        uint64 expiresAt;
        uint256 paidWei;
    }

    address payable public broker;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Booking) public bookings;

    event BrokerChanged(address indexed previousBroker, address indexed newBroker);
    event ListingConfigured(uint256 indexed listingId, uint256 priceWei, uint64 durationSeconds, bool active);
    event HomeBooked(uint256 indexed listingId, address indexed renter, address indexed broker, uint256 paidWei, uint64 bookedAt, uint64 expiresAt);

    constructor(address admin, address payable initialBroker) Ownable(admin) {
        require(initialBroker != address(0), 'Broker required');
        broker = initialBroker;
        emit BrokerChanged(address(0), initialBroker);

        // Twelve catalog homes are complimentary 0 MON stays; paid homes rent through RentalEscrow.
        uint256[12] memory complimentaryListingIds = [uint256(4), 27, 29, 31, 32, 36, 38, 42, 45, 46, 47, 48];
        for (uint256 i; i < complimentaryListingIds.length; i++) {
            _setListing(complimentaryListingIds[i], 0, 30 days, true);
        }
    }

    function setBroker(address payable newBroker) external onlyOwner {
        require(newBroker != address(0), 'Broker required');
        address previousBroker = broker;
        broker = newBroker;
        emit BrokerChanged(previousBroker, newBroker);
    }

    function setListing(uint256 listingId, uint128 priceWei, uint64 durationSeconds, bool active) external onlyOwner {
        _setListing(listingId, priceWei, durationSeconds, active);
    }

    function _setListing(uint256 listingId, uint128 priceWei, uint64 durationSeconds, bool active) internal {
        require(listingId != 0, 'Listing required');
        require(durationSeconds >= 1 days && durationSeconds <= 365 days, 'Invalid duration');
        listings[listingId] = Listing(priceWei, durationSeconds, active);
        emit ListingConfigured(listingId, priceWei, durationSeconds, active);
    }

    function isRented(uint256 listingId) public view returns (bool) {
        return bookings[listingId].expiresAt > block.timestamp;
    }

    /// @notice Batch availability for the catalog, avoiding one RPC request per home.
    function getBookingSnapshots(uint256[] calldata listingIds) external view returns (Listing[] memory configured, Booking[] memory current, bool[] memory rented) {
        require(listingIds.length <= 48, 'Too many listings');
        configured = new Listing[](listingIds.length);
        current = new Booking[](listingIds.length);
        rented = new bool[](listingIds.length);
        for (uint256 i; i < listingIds.length; i++) {
            configured[i] = listings[listingIds[i]];
            current[i] = bookings[listingIds[i]];
            rented[i] = current[i].expiresAt > block.timestamp;
        }
    }

    function book(uint256 listingId, address expectedBroker) external payable nonReentrant {
        Listing memory listing = listings[listingId];
        require(listing.active, 'Listing unavailable');
        require(!isRented(listingId), 'Already rented');
        require(expectedBroker == broker, 'Broker changed');
        require(msg.sender != broker, 'Broker cannot rent');
        require(msg.value == listing.priceWei, 'Wrong payment');

        uint64 bookedAt = uint64(block.timestamp);
        uint64 expiresAt = bookedAt + listing.durationSeconds;
        bookings[listingId] = Booking(msg.sender, bookedAt, expiresAt, msg.value);

        if (msg.value != 0) {
            (bool sent,) = broker.call{value: msg.value}('');
            require(sent, 'Broker payment failed');
        }
        emit HomeBooked(listingId, msg.sender, broker, msg.value, bookedAt, expiresAt);
    }
}
