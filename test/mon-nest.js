const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('MON-Nest protocol', function () {
  async function fixture() {
    const [admin, owner, renter, juror1, juror2, juror3, otherRenter] = await ethers.getSigners();
    const registry = await ethers.deployContract('PropertyRegistry', [admin.address]);
    const reputation = await ethers.deployContract('Reputation', [admin.address]);
    const escrow = await ethers.deployContract('RentalEscrow', [admin.address, await registry.getAddress()]);
    const court = await ethers.deployContract('DisputeCourt', [admin.address, await escrow.getAddress()]);
    await escrow.grantRole(await escrow.COURT_ROLE(), await court.getAddress());
    await reputation.grantRole(await reputation.UPDATER_ROLE(), await court.getAddress());
    await court.setReputation(await reputation.getAddress());
    return { admin, owner, renter, juror1, juror2, juror3, otherRenter, registry, reputation, escrow, court };
  }

  async function fundedAgreement(ctx, renter = ctx.renter, months = 3) {
    const { owner, registry, escrow } = ctx;
    if ((await registry.nextPropertyId()) === 1n) {
      await registry.connect(owner).register(ethers.id('metadata'), ethers.id('proof'));
      await registry.verify(1);
    }
    const now = await time.latest();
    await escrow.connect(renter).createAgreement(1, owner.address, ethers.parseEther('1'), ethers.parseEther('1'), now, now + months * 30 * 86400, ethers.id('terms'));
    const id = (await escrow.nextAgreementId()) - 1n;
    await escrow.connect(renter).fund(id, { value: ethers.parseEther('2') });
    return id;
  }

  async function vote(court, juror, caseId, ownerWins) {
    const salt = ethers.id(`salt-${juror.address}`);
    const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address', 'bool', 'bytes32'], [caseId, juror.address, ownerWins, salt]));
    await court.connect(juror).commitVote(caseId, commitment);
    return () => court.connect(juror).revealVote(caseId, ownerWins, salt);
  }

  it('registers and verifies a property', async function () {
    const { owner, registry } = await fixture();
    await registry.connect(owner).register(ethers.id('metadata'), ethers.id('ownership-proof'));
    expect((await registry.properties(1)).verified).to.equal(false);
    await registry.verify(1);
    expect(await registry.isVerifiedOwner(1, owner.address)).to.equal(true);
  });

  it('registers and verifies a batch of properties for the caller', async function () {
    const { owner, registry, renter } = await fixture();
    const hashes = [1, 2, 3].map(i => ethers.id(`home-${i}`));
    await registry.connect(owner).registerMany(hashes, hashes.map(hash => ethers.id(`proof-${hash}`)));
    await expect(registry.connect(renter).verifyMany([1, 2, 3])).to.be.reverted;
    await registry.verifyMany([1, 2, 3]);
    for (const id of [1, 2, 3]) expect(await registry.isVerifiedOwner(id, owner.address)).to.equal(true);
    await expect(registry.connect(owner).registerMany(hashes, [])).to.be.revertedWith('Invalid batch');
  });

  it('funds an agreement and releases rent through pull payments', async function () {
    const { owner, renter, registry, escrow } = await fixture();
    await registry.connect(owner).register(ethers.id('metadata'), ethers.id('proof'));
    await registry.verify(1);
    const now = await time.latest();
    await escrow.connect(renter).createAgreement(1, owner.address, ethers.parseEther('1'), ethers.parseEther('1'), now, now + 30 * 86400, ethers.id('terms'));
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

  it('never releases more rent than the agreement funded', async function () {
    const ctx = await fixture();
    const id = await fundedAgreement(ctx);
    await fundedAgreement(ctx, ctx.otherRenter);
    await ctx.escrow.releaseRent(id);
    await time.increase(30 * 86400);
    await expect(ctx.escrow.releaseRent(id)).to.be.revertedWith('Rent already released');
    await ctx.escrow.connect(ctx.renter).payRent(id, { value: ethers.parseEther('1') });
    await ctx.escrow.releaseRent(id);
    expect(await ctx.escrow.claimable(ctx.owner.address)).to.equal(ethers.parseEther('2'));
  });

  it('takes the platform fee from released rent', async function () {
    const ctx = await fixture();
    await ctx.escrow.setPlatformFee(200, ctx.admin.address);
    const id = await fundedAgreement(ctx);
    await ctx.escrow.releaseRent(id);
    expect(await ctx.escrow.claimable(ctx.owner.address)).to.equal(ethers.parseEther('0.98'));
    expect(await ctx.escrow.claimable(ctx.admin.address)).to.equal(ethers.parseEther('0.02'));
  });

  it('returns the deposit to the renter when the lease completes', async function () {
    const ctx = await fixture();
    const id = await fundedAgreement(ctx, ctx.renter, 1);
    await expect(ctx.escrow.connect(ctx.renter).complete(id)).to.be.revertedWith('Cannot complete');
    await ctx.escrow.releaseRent(id);
    await time.increase(31 * 86400);
    await ctx.escrow.connect(ctx.renter).complete(id);
    expect(await ctx.escrow.claimable(ctx.renter.address)).to.equal(ethers.parseEther('1'));
    expect(await ctx.escrow.remainingEscrow(id)).to.equal(0n);
    await expect(ctx.escrow.connect(ctx.renter).withdraw()).to.changeEtherBalance(ctx.renter, ethers.parseEther('1'));
  });

  it('refunds the renter when cancelled before the lease starts', async function () {
    const { owner, renter, registry, escrow } = await fixture();
    await registry.connect(owner).register(ethers.id('metadata'), ethers.id('proof'));
    await registry.verify(1);
    const start = (await time.latest()) + 7 * 86400;
    await escrow.connect(renter).createAgreement(1, owner.address, 100n, 50n, start, start + 30 * 86400, ethers.id('terms'));
    await escrow.connect(renter).fund(1, { value: 150n });
    await escrow.connect(owner).cancel(1);
    expect(await escrow.claimable(renter.address)).to.equal(150n);
  });

  it('requires an odd, sufficiently-staked jury for a disputed agreement', async function () {
    const ctx = await fixture();
    const { admin, juror1, juror2, juror3, court, escrow, renter } = ctx;
    for (const juror of [juror1, juror2, juror3]) await court.connect(juror).depositStake({ value: ethers.parseEther('1') });
    const id = await fundedAgreement(ctx);
    await expect(court.connect(admin).createCase(id, [juror1.address, juror2.address, juror3.address])).to.be.revertedWith('Agreement not disputed');
    await escrow.connect(renter).openDispute(id, ethers.id('evidence'));
    await expect(court.connect(admin).createCase(id, [juror1.address, juror2.address])).to.be.revertedWith('Odd jury required');
    await expect(court.connect(admin).createCase(id, [juror1.address, juror2.address, juror3.address])).to.emit(court, 'CaseCreated');
    await expect(court.connect(admin).createCase(id, [juror1.address, juror2.address, juror3.address])).to.be.revertedWith('Case exists');
  });

  it('settles a dispute from only that agreement and slashes jurors who never reveal', async function () {
    const ctx = await fixture();
    const { admin, owner, renter, juror1, juror2, juror3, court, escrow, reputation } = ctx;
    await court.setWindows(60, 60);
    for (const juror of [juror1, juror2, juror3]) await court.connect(juror).depositStake({ value: ethers.parseEther('1') });
    const id = await fundedAgreement(ctx);
    const otherId = await fundedAgreement(ctx, ctx.otherRenter);
    await escrow.connect(owner).openDispute(id, ethers.id('damage-photos'));
    await court.connect(admin).createCase(id, [juror1.address, juror2.address, juror3.address]);

    const reveal1 = await vote(court, juror1, 1, false);
    const reveal2 = await vote(court, juror2, 1, false);
    await vote(court, juror3, 1, true);
    await time.increase(61);
    await reveal1();
    await reveal2();
    await time.increase(61);
    await court.finalize(1);

    expect(await escrow.claimable(renter.address)).to.equal(ethers.parseEther('2'));
    expect(await escrow.claimable(owner.address)).to.equal(0n);
    expect(await escrow.remainingEscrow(otherId)).to.equal(ethers.parseEther('2'));
    expect(await court.stake(juror3.address)).to.equal(0n);
    expect(await court.stake(juror1.address)).to.equal(ethers.parseEther('1.5'));
    expect(await reputation.percentage(renter.address, 0)).to.equal(100n);
    expect((await reputation.scores(juror3.address, 2)).negative).to.equal(1n);
  });
});
