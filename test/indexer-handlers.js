const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Replay actual Hardhat receipt logs into the handlers with an in-memory entity
// store. This verifies mapping logic, not hosted Envio ingestion or GraphQL.
describe('Envio receipt-to-entity integration', function () {
  it('preserves booking history, escrow milestones, jury votes and reputation', async () => {
    const callbacks = new Map(), stores = {};
    const context = new Proxy({}, { get: (_, name) => stores[name] ||= { rows: new Map(), set(row) { this.rows.set(row.id, row); }, async get(id) { return this.rows.get(id); } } });
    const source = fs.readFileSync('indexer/src/handlers/rentals.ts', 'utf8').replace("import { indexer } from 'envio';", '');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { indexer: { onEvent({ contract, event }, callback) { const key = `${contract}:${event}`; if (callbacks.has(key)) throw Error(`Duplicate handler ${key}`); callbacks.set(key, callback); } } });
    const [admin, owner, renter, broker, ...jurors] = await ethers.getSigners();
    const registry = await ethers.deployContract('PropertyRegistry', [admin.address]);
    const escrow = await ethers.deployContract('RentalEscrow', [admin.address, await registry.getAddress()]);
    const court = await ethers.deployContract('DisputeCourt', [admin.address, await escrow.getAddress()]);
    const reputation = await ethers.deployContract('Reputation', [admin.address]);
    const bookings = await ethers.deployContract('MonNestBookings', [admin.address, broker.address]);
    const contracts = { PropertyRegistry: registry, RentalEscrow: escrow, DisputeCourt: court, Reputation: reputation, Bookings: bookings };
    async function replay(tx) {
      const receipt = await (await tx).wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      for (const log of receipt.logs) {
        const entry = Object.entries(contracts).find(([, contract]) => contract.target.toLowerCase() === log.address.toLowerCase());
        if (!entry) continue;
        const [name, contract] = entry;
        const parsed = contract.interface.parseLog(log);
        const handler = callbacks.get(`${name}:${parsed.name}`);
        if (handler) await handler({ context, event: { chainId: 10143, srcAddress: log.address, params: parsed.args.toObject(), transaction: { hash: receipt.hash }, block: { number: receipt.blockNumber, timestamp: block.timestamp }, logIndex: log.index } });
      }
    }
    await replay(bookings.deploymentTransaction());
    await replay(bookings.connect(renter).book(4, broker.address));
    await time.increase(31 * 86400);
    await replay(bookings.connect(owner).book(4, broker.address));
    expect(stores.Booking.rows.size).to.equal(2);
    expect(stores.Listing.rows.size).to.equal(68);
    await replay(registry.connect(owner).register(ethers.id('listing'), ethers.id('ownership')));
    await replay(registry.verify(1));
    expect([...stores.Property.rows.values()][0].verified).to.equal(true);
    const now = await time.latest();
    await replay(escrow.connect(renter).createAgreement(1, owner.address, 100, 100, now, now + 30 * 86400, ethers.id('terms')));
    await replay(escrow.connect(broker).fundFor(1, { value: 200 }));
    expect((await escrow.agreements(1)).renter).to.equal(renter.address);
    await replay(escrow.releaseRent(1));
    await replay(escrow.connect(renter).openDispute(1, ethers.id('evidence')));
    await escrow.grantRole(await escrow.COURT_ROLE(), await court.getAddress());
    for (const juror of jurors.slice(0,3)) await replay(court.connect(juror).depositStake({ value: ethers.parseEther('1') }));
    await replay(court.createCase(1, jurors.slice(0,3).map(item => item.address)));
    const salt = ethers.id('test-only-vote-salt');
    for (const juror of jurors.slice(0,3)) await replay(court.connect(juror).commitVote(1, ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address','bool','bytes32'], [1,juror.address,false,salt]))));
    await time.increase(2 * 86400);
    for (const juror of jurors.slice(0,3)) await replay(court.connect(juror).revealVote(1, false, salt));
    await time.increase(86400);
    await replay(court.finalize(1));
    await replay(escrow.connect(renter).withdraw());
    await replay(reputation.record(renter.address, 0, true, ethers.id('completed-rental')));
    const agreement = [...stores.Agreement.rows.values()][0];
    expect(agreement.state).to.equal('Completed');
    expect(agreement.fundedWei).to.equal(200n);
    expect(agreement.releasedWei).to.equal(100n);
    expect(agreement.renterAwardWei).to.equal(100n);
    expect(stores.Vote.rows.size).to.equal(3);
    expect([...stores.CourtCase.rows.values()][0].finalized).to.equal(true);
    expect([...stores.ReputationScore.rows.values()][0].positive).to.equal(1);
    const activity = [...stores.Activity.rows.values()];
    for (const kind of ['Home booked','Escrow funded','Rent released','Dispute opened','Dispute resolved','Vote committed','Vote revealed','Withdrawal','Reputation updated']) expect(activity.some(row => row.kind === kind), kind).to.equal(true);
  });
});
