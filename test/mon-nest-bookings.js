const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

describe('MON-Nest public bookings', function () {
  async function fixture() {
    const [admin, broker, renter, nextRenter, outsider] = await ethers.getSigners();
    const bookings = await ethers.deployContract('MonNestBookings', [admin.address, broker.address]);
    await bookings.setListing(4, 0, 30 * 86400, true);
    return { admin, broker, renter, nextRenter, outsider, bookings };
  }

  it('records a zero-MON booking and makes the home unavailable to every wallet', async function () {
    const { broker, renter, nextRenter, bookings } = await fixture();
    const brokerBalance = await ethers.provider.getBalance(broker.address);

    await expect(bookings.connect(renter).book(4, { value: 0 }))
      .to.emit(bookings, 'HomeBooked')
      .withArgs(4, renter.address, broker.address, 0, anyValue);

    expect(await bookings.isRented(4)).to.equal(true);
    expect((await bookings.bookings(4)).renter).to.equal(renter.address);
    expect(await ethers.provider.getBalance(broker.address)).to.equal(brokerBalance);
    await expect(bookings.connect(nextRenter).book(4)).to.be.revertedWith('Already rented');
  });

  it('becomes bookable again when the rental period ends', async function () {
    const { renter, nextRenter, bookings } = await fixture();
    await bookings.connect(renter).book(4);
    await time.increase(30 * 86400);
    expect(await bookings.isRented(4)).to.equal(false);
    await bookings.connect(nextRenter).book(4);
    expect((await bookings.bookings(4)).renter).to.equal(nextRenter.address);
  });

  it('forwards any listed nonzero price to the configured broker', async function () {
    const { broker, renter, bookings } = await fixture();
    const price = ethers.parseEther('1');
    await bookings.setListing(8, price, 30 * 86400, true);
    const brokerBalance = await ethers.provider.getBalance(broker.address);

    await expect(bookings.connect(renter).book(8, { value: 0 })).to.be.revertedWith('Wrong payment');
    await bookings.connect(renter).book(8, { value: price });
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

  it('rejects unknown homes, self-booking by the broker, and invalid duration', async function () {
    const { broker, renter, bookings } = await fixture();
    await expect(bookings.connect(renter).book(999)).to.be.revertedWith('Listing unavailable');
    await expect(bookings.connect(broker).book(4)).to.be.revertedWith('Broker cannot rent');
    await expect(bookings.setListing(5, 0, 0, true)).to.be.revertedWith('Invalid duration');
  });
});
