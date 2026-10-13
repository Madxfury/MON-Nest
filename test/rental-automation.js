const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Escrow isolation and CRE receiver', function () {
  async function fixture() {
    const [admin, owner, renter, funder, forwarder] = await ethers.getSigners();
    const registry = await ethers.deployContract('PropertyRegistry', [admin.address]);
    await registry.connect(owner).register(ethers.id('home'), ethers.id('proof')); await registry.verify(1);
    const escrow = await ethers.deployContract('RentalEscrow', [admin.address, await registry.getAddress()]);
    const now = await time.latest();
    for (let i = 0; i < 2; i++) await escrow.connect(renter).createAgreement(1, owner.address, 100, 100, now, now + 30 * 86400, ethers.id('terms'));
    await escrow.connect(renter).fund(1, { value: 200 }); await escrow.connect(renter).fund(2, { value: 200 });
    const workflow = ethers.id('mon-nest-cre');
    const automation = await ethers.deployContract('RentalAutomation', [admin.address, forwarder.address, workflow, await escrow.getAddress()]);
    const metadata = ethers.solidityPacked(['bytes32','bytes10','address','bytes2'], [workflow,'0x00000000000000000000',admin.address,'0x0000']);
    const report = async (action, id = 1, chain = 31337, scheduled = null) => ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address','uint64','uint8','uint256'],[chain,await automation.getAddress(),scheduled ?? await time.latest(),action,id]);
    return { admin, owner, renter, funder, forwarder, escrow, automation, metadata, report };
  }
  it('prevents a second rent release consuming deposits or another agreement', async () => {
    const { escrow } = await fixture(); await escrow.releaseRent(1); await time.increase(31 * 86400);
    await expect(escrow.releaseRent(1)).to.be.revertedWith('Rent already released');
    expect(await escrow.remainingEscrow(1)).to.equal(100); expect(await escrow.remainingEscrow(2)).to.equal(200);
  });
  it('restricts dispute awards to that agreement balance', async () => {
    const { admin, renter, escrow } = await fixture(); await escrow.grantRole(await escrow.COURT_ROLE(), admin.address);
    await escrow.connect(renter).openDispute(1, ethers.id('evidence'));
    await expect(escrow.resolve(1, 400, 0)).to.be.revertedWith('Wrong escrow allocation');
    await escrow.resolve(1, 0, 200); expect(await escrow.remainingEscrow(2)).to.equal(200);
  });
  it('accepts a CRE release and rejects forged destinations and replay', async () => {
    const { funder, forwarder, automation, metadata, report, escrow } = await fixture(); const payload = await report(0);
    await expect(automation.connect(funder).onReport(metadata,payload)).to.be.revertedWith('Untrusted forwarder');
    await expect(automation.connect(forwarder).onReport(metadata,await report(0,1,10143))).to.be.revertedWith('Wrong report destination');
    await automation.connect(forwarder).onReport(metadata,payload); expect(await escrow.rentReleased(1)).to.equal(true);
    await expect(automation.connect(forwarder).onReport(metadata,payload)).to.be.revertedWith('Report replay');
  });
  it('rejects stale reports and signals an evidence deadline only once', async () => {
    const { forwarder, automation, metadata, report } = await fixture();
    await expect(automation.connect(forwarder).onReport(metadata,await report(0,1,31337,(await time.latest())-601))).to.be.revertedWith('Stale report');
    const deadline=(await time.latest())+100; await automation.setEvidenceDeadline(1,deadline); await time.increaseTo(deadline);
    await expect(automation.connect(forwarder).onReport(metadata,await report(1))).to.emit(automation,'DeadlineReached');
    await expect(automation.connect(forwarder).onReport(metadata,await report(1))).to.be.revertedWith('Deadline not reached');
  });
});
