import { indexer } from 'envio';

const key = (chain: number, contract: string, id: bigint | string) => `${chain}:${contract.toLowerCase()}:${id}`;

indexer.onEvent({ contract: 'Bookings', event: 'ListingConfigured' }, async ({ event, context }) => {
  context.Listing.set({ id: key(event.chainId, event.srcAddress, event.params.listingId), ...event.params });
});
indexer.onEvent({ contract: 'Bookings', event: 'HomeBooked' }, async ({ event, context }) => {
  const id = `${event.chainId}:${event.transaction.hash}:${event.logIndex}`;
  context.Booking.set({ id, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), listingId: event.params.listingId, renter: event.params.renter.toLowerCase(), broker: event.params.broker.toLowerCase(), paidWei: event.params.paidWei, bookedAt: Number(event.params.bookedAt), expiresAt: Number(event.params.expiresAt), txHash: event.transaction.hash, blockNumber: event.block.number, logIndex: event.logIndex });
  context.Activity.set({ id, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Home booked', subjectId: String(event.params.listingId), account: event.params.renter.toLowerCase(), amountWei: event.params.paidWei, detail: `Reserved until ${event.params.expiresAt}`, txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'PropertyRegistry', event: 'PropertyRegistered' }, async ({ event, context }) => {
  context.Property.set({ id: key(event.chainId, event.srcAddress, event.params.propertyId), propertyId: event.params.propertyId, owner: event.params.owner.toLowerCase(), metadataHash: event.params.metadataHash, verified: false, active: true });
});
indexer.onEvent({ contract: 'PropertyRegistry', event: 'PropertyVerified' }, async ({ event, context }) => {
  const id = key(event.chainId, event.srcAddress, event.params.propertyId);
  const property = await context.Property.get(id); if (property) context.Property.set({ ...property, verified: true });
});
indexer.onEvent({ contract: 'PropertyRegistry', event: 'PropertyStatusChanged' }, async ({ event, context }) => {
  const property = await context.Property.get(key(event.chainId, event.srcAddress, event.params.propertyId));
  if (property) context.Property.set({ ...property, active: event.params.active });
});
indexer.onEvent({ contract: 'RentalEscrow', event: 'AgreementCreated' }, async ({ event, context }) => {
  context.Agreement.set({ id: key(event.chainId, event.srcAddress, event.params.agreementId), chainId: event.chainId, contract: event.srcAddress.toLowerCase(), agreementId: event.params.agreementId, propertyId: event.params.propertyId, renter: event.params.renter.toLowerCase(), owner: event.params.owner.toLowerCase(), state: 'Created', fundedWei: 0n, releasedWei: 0n, evidenceRoot: '', ownerAwardWei: 0n, renterAwardWei: 0n });
});
indexer.onEvent({ contract: 'RentalEscrow', event: 'AgreementFunded' }, async ({ event, context }) => {
  const row = await context.Agreement.get(key(event.chainId, event.srcAddress, event.params.agreementId));
  if (row) context.Agreement.set({ ...row, state: 'Funded', fundedWei: event.params.amount });
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Escrow funded', subjectId: String(event.params.agreementId), account: row?.renter || '', amountWei: event.params.amount, detail: 'Rent and deposit funded', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'RentalEscrow', event: 'RentReleased' }, async ({ event, context }) => {
  const row = await context.Agreement.get(key(event.chainId, event.srcAddress, event.params.agreementId));
  if (row) context.Agreement.set({ ...row, state: 'Active', releasedWei: row.releasedWei + event.params.amount });
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Rent released', subjectId: String(event.params.agreementId), account: row?.owner || '', amountWei: event.params.amount, detail: 'Rent credited to owner', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'RentalEscrow', event: 'DisputeOpened' }, async ({ event, context }) => {
  const row = await context.Agreement.get(key(event.chainId, event.srcAddress, event.params.agreementId));
  if (row) context.Agreement.set({ ...row, state: 'Disputed', evidenceRoot: event.params.evidenceRoot });
  for (const account of new Set(row ? [row.renter, row.owner] : [])) context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}:${account}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Dispute opened', subjectId: String(event.params.agreementId), account, amountWei: 0n, detail: `Evidence hash ${event.params.evidenceRoot}`, txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'RentalEscrow', event: 'AgreementResolved' }, async ({ event, context }) => {
  const row = await context.Agreement.get(key(event.chainId, event.srcAddress, event.params.agreementId));
  if (row) context.Agreement.set({ ...row, state: 'Completed', ownerAwardWei: event.params.ownerAmount, renterAwardWei: event.params.renterAmount });
  for (const account of new Set(row ? [row.renter, row.owner] : [])) context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}:${account}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Dispute resolved', subjectId: String(event.params.agreementId), account, amountWei: account === row?.owner ? event.params.ownerAmount : event.params.renterAmount, detail: 'Award credited to withdrawable balance', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'DisputeCourt', event: 'CaseCreated' }, async ({ event, context }) => {
  context.CourtCase.set({ id: key(event.chainId, event.srcAddress, event.params.caseId), caseId: event.params.caseId, agreementId: event.params.agreementId, jurors: event.params.jurors.map(value => value.toLowerCase()), ownerVotes: 0, renterVotes: 0, finalized: false, ownerWins: false });
});
indexer.onEvent({ contract: 'DisputeCourt', event: 'VoteCommitted' }, async ({ event, context }) => {
  context.Vote.set({ id: key(event.chainId, event.srcAddress, `${event.params.caseId}:${event.params.juror.toLowerCase()}`), caseId: event.params.caseId, juror: event.params.juror.toLowerCase(), committed: true, revealed: false, ownerWins: false });
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Vote committed', subjectId: String(event.params.caseId), account: event.params.juror.toLowerCase(), amountWei: 0n, detail: 'Sealed jury vote recorded', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'DisputeCourt', event: 'VoteRevealed' }, async ({ event, context }) => {
  const id = key(event.chainId, event.srcAddress, `${event.params.caseId}:${event.params.juror.toLowerCase()}`);
  const vote = await context.Vote.get(id);
  if (vote) context.Vote.set({ ...vote, revealed: true, ownerWins: event.params.ownerWins });
  const row = await context.CourtCase.get(key(event.chainId, event.srcAddress, event.params.caseId));
  if (row) context.CourtCase.set({ ...row, ownerVotes: row.ownerVotes + Number(event.params.ownerWins), renterVotes: row.renterVotes + Number(!event.params.ownerWins) });
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Vote revealed', subjectId: String(event.params.caseId), account: event.params.juror.toLowerCase(), amountWei: 0n, detail: event.params.ownerWins ? 'Voted for owner' : 'Voted for renter', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'DisputeCourt', event: 'CaseFinalized' }, async ({ event, context }) => {
  const row = await context.CourtCase.get(key(event.chainId, event.srcAddress, event.params.caseId));
  if (row) context.CourtCase.set({ ...row, finalized: true, ownerWins: event.params.ownerWins });
});
indexer.onEvent({ contract: 'Reputation', event: 'ReputationUpdated' }, async ({ event, context }) => {
  const id = key(event.chainId, event.srcAddress, `${event.params.account.toLowerCase()}:${event.params.role}`);
  const row = await context.ReputationScore.get(id);
  context.ReputationScore.set({ id, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), account: event.params.account.toLowerCase(), role: Number(event.params.role), positive: (row?.positive || 0) + Number(event.params.positive), negative: (row?.negative || 0) + Number(!event.params.positive), updatedAt: event.block.timestamp });
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Reputation updated', subjectId: String(event.params.role), account: event.params.account.toLowerCase(), amountWei: 0n, detail: event.params.positive ? 'Positive reputation event' : 'Negative reputation event', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});

// An append-only timeline preserves all milestones, even when the current state changes.
indexer.onEvent({ contract: 'RentalEscrow', event: 'Withdrawal' }, async ({ event, context }) => {
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Withdrawal', subjectId: '', account: event.params.account.toLowerCase(), amountWei: event.params.amount, detail: 'Escrow balance withdrawn', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
indexer.onEvent({ contract: 'DisputeCourt', event: 'JurorStaked' }, async ({ event, context }) => {
  context.Activity.set({ id: `${event.chainId}:${event.transaction.hash}:${event.logIndex}`, chainId: event.chainId, contract: event.srcAddress.toLowerCase(), kind: 'Juror stake', subjectId: '', account: event.params.juror.toLowerCase(), amountWei: event.params.amount, detail: 'Juror stake deposited', txHash: event.transaction.hash, blockNumber: event.block.number, timestamp: event.block.timestamp });
});
