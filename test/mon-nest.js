const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('MON-Nest protocol', function () {
  async function fixture() {
    const [admin, owner, renter, juror1, juror2, juror3] = await ethers.getSigners();
    const registry = await ethers.deployContract('PropertyRegistry', [admin.address]);
    const reputation = await ethers.deployContract('Reputation', [admin.address]);
    const escrow = await ethers.deployContract('RentalEscrow', [admin.address, await registry.getAddress()]);
    const court = await ethers.deployContract('DisputeCourt', [admin.address, await escrow.getAddress()]);
    await escrow.grantRole(await escrow.COURT_ROLE(), await court.getAddress());
    return { admin, owner, renter, juror1, juror2, juror3, registry, reputation, escrow, court };
  }

  it('registers and verifies a property', async function () {
    const { owner, registry } = await fixture();
    await registry.connect(owner).register(ethers.id('metadata'), ethers.id('ownership-proof'));
    expect((await registry.properties(1)).verified).to.equal(false);
    await registry.verify(1);
    expect(await registry.isVerifiedOwner(1, owner.address)).to.equal(true);
  });

  it('funds an agreement and releases rent through pull payments', async function () {
    const { owner, renter, registry, escrow } = await fixture();
    await registry.connect(owner).register(ethers.id('metadata'), ethers.id('proof'));
    await registry.verify(1);
    const now = await time.latest();
    await escrow.connect(renter).createAgreement(1, owner.address, ethers.parseEther('1'), ethers.parseEther('1'), now, now + 31 * 86400, ethers.id('terms'));
    await escrow.connect(renter).fund(1, { value: ethers.parseEther('2') });
    await escrow.releaseRent(1);
    expect(await escrow.claimable(owner.address)).to.equal(ethers.parseEther('1'));
  });

  it('rejects incorrect escrow funding', async function () {
    const { owner, renter, registry, escrow } = await fixture();
    await registry.connect(owner).register(ethers.id('metadata'), ethers.id('proof'));
    await registry.verify(1);
    const now = await time.latest();
    await escrow.connect(renter).createAgreement(1, owner.address, 100n, 100n, now, now + 86400, ethers.id('terms'));
    await expect(escrow.connect(renter).fund(1, { value: 199n })).to.be.revertedWith('Wrong value');
  });

  it('requires an odd, sufficiently-staked jury', async function () {
    const { admin, juror1, juror2, juror3, court } = await fixture();
    for (const juror of [juror1, juror2, juror3]) await court.connect(juror).depositStake({ value: ethers.parseEther('1') });
    await expect(court.connect(admin).createCase(1, 100n, [juror1.address, juror2.address])).to.be.revertedWith('Odd jury required');
    await expect(court.connect(admin).createCase(1, 100n, [juror1.address, juror2.address, juror3.address])).to.emit(court, 'CaseCreated');
  });
});
