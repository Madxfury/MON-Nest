const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

describe('MON-Nest public bookings', function () {
  async function fixture() {
    const [admin, broker, renter, nextRenter, outsider] = await ethers.getSigners();
    const bookings = await ethers.deployContract('MonNestBookings', [admin.address, broker.address]);
    return { admin, broker, renter, nextRenter, outsider, bookings };
  }

  it('configures all 58 complimentary homes during deployment and returns a batched snapshot', async function () {
    const { bookings } = await fixture();
    for (let id = 1; id <= 58; id++) {
      const listing = await bookings.listings(id);
      expect(listing.priceWei).to.equal(0);
      expect(listing.durationSeconds).to.equal(30 * 86400);
      expect(listing.active).to.equal(true);
    }
    const ids = Array.from({ length: 58 }, (_, index) => index + 1);
    const [configured, current, rented] = await bookings.getBookingSnapshots(ids);
    expect(configured.length).to.equal(58);
    expect(configured.every(listing => listing.active && listing.priceWei === 0n)).to.equal(true);
    expect(current.every(booking => booking.renter === ethers.ZeroAddress)).to.equal(true);
    expect(rented.every(value => !value)).to.equal(true);
    await expect(bookings.getBookingSnapshots(Array.from({ length: 59 }, (_, index) => index + 1))).to.be.revertedWith('Too many listings');
  });

  it('records a zero-MON booking and makes the home unavailable to every wallet', async function () {
    const { broker, renter, nextRenter, bookings } = await fixture();
    const brokerBalance = await ethers.provider.getBalance(broker.address);

    await expect(bookings.connect(renter).book(4, broker.address, { value: 0 }))
      .to.emit(bookings, 'HomeBooked')
      .withArgs(4, renter.address, broker.address, 0, anyValue, anyValue);

    expect(await bookings.isRented(4)).to.equal(true);
    expect((await bookings.bookings(4)).renter).to.equal(renter.address);
    expect(await ethers.provider.getBalance(broker.address)).to.equal(brokerBalance);
    await expect(bookings.connect(nextRenter).book(4, broker.address)).to.be.revertedWith('Already rented');
  });

  it('becomes bookable again when the rental period ends', async function () {
    const { broker, renter, nextRenter, bookings } = await fixture();
    await bookings.connect(renter).book(4, broker.address);
    await time.increase(30 * 86400);
    expect(await bookings.isRented(4)).to.equal(false);
    await bookings.connect(nextRenter).book(4, broker.address);
    expect((await bookings.bookings(4)).renter).to.equal(nextRenter.address);
  });

  it('forwards any listed nonzero price to the configured broker', async function () {
    const { broker, renter, bookings } = await fixture();
    const price = ethers.parseEther('1');
    await bookings.setListing(8, price, 30 * 86400, true);
    const brokerBalance = await ethers.provider.getBalance(broker.address);

    await expect(bookings.connect(renter).book(8, broker.address, { value: 0 })).to.be.revertedWith('Wrong payment');
    await bookings.connect(renter).book(8, broker.address, { value: price });
    expect(await ethers.provider.getBalance(broker.address)).to.equal(brokerBalance + price);
    expect((await bookings.bookings(8)).paidWei).to.equal(price);
  });

  it('restricts listing and broker configuration to the admin', async function () {
    const { broker, outsider, bookings } = await fixture();
    await expect(bookings.connect(outsider).setListing(9, 0, 30 * 86400, true))
      .to.be.revertedWithCustomError(bookings, 'OwnableUnauthorizedAccount');
    await expect(bookings.connect(outsider).setBroker(outsider.address))
      .to.be.revertedWithCustomError(bookings, 'OwnableUnauthorizedAccount');
    await expect(bookings.setBroker(ethers.ZeroAddress)).to.be.revertedWith('Broker required');
    await bookings.setBroker(outsider.address);
    expect(await bookings.broker()).to.equal(outsider.address);
    expect(await bookings.broker()).to.not.equal(broker.address);
  });

  it('reverts the entire booking if the broker changes after the renter reviewed it', async function () {
    const { broker, renter, outsider, bookings } = await fixture();
    await bookings.setBroker(outsider.address);
    await expect(bookings.connect(renter).book(4, broker.address))
      .to.be.revertedWith('Broker changed');
    expect(await bookings.isRented(4)).to.equal(false);
    expect((await bookings.bookings(4)).renter).to.equal(ethers.ZeroAddress);
    await bookings.connect(renter).book(4, outsider.address);
    expect((await bookings.bookings(4)).renter).to.equal(renter.address);
  });

  it('rejects unknown homes, self-booking by the broker, and invalid duration', async function () {
    const { broker, renter, bookings } = await fixture();
    await expect(bookings.connect(renter).book(999, broker.address)).to.be.revertedWith('Listing unavailable');
    await expect(bookings.connect(broker).book(4, broker.address)).to.be.revertedWith('Broker cannot rent');
    await expect(bookings.setListing(5, 0, 0, true)).to.be.revertedWith('Invalid duration');
  });
});
