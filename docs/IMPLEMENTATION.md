# Protocol and deployment reference

MON-Nest uses a complimentary booking ledger and includes a separate escrow-based rental protocol prototype on Monad Testnet (chain ID **10143**). This document describes the source and recorded deployment configuration; it does not certify the current availability of a hosted service.

## Complimentary booking ledger

`MonNestBookings.sol` holds one active booking per listing. `book(listingId, expectedBroker)` checks the reviewed broker, active availability, and exact payment, then records the renter and expiry and emits `HomeBooked`. Expired bookings become available again; prior events remain in the account history.

The current catalog contains **58 complimentary homes, IDs 1 through 58**. The constructor and deployment scripts configure them at **0 MON for 30 days**. Network gas is paid separately. If the owner changes a listing's price, the contract requires that exact payment and forwards it to the recorded broker. The broker cannot book its own listing.

## Escrow-based rentals

The recorded deployment manifest maps 36 earlier demo properties to registry records. The current catalog uses complimentary bookings; these escrow records support the separate protocol prototype. `RentalEscrow` holds rent and deposits per agreement. The protocol includes monthly rent release, a 2% platform fee, lease closure, deposit withdrawal, and dispute routing through `DisputeCourt` with reputation records. Earlier paid-demo testnet amounts used one-thousandth of the illustrative catalog price.

The deployer owns the registered demo homes. Use a different renter wallet when testing the separate escrow protocol. These records represent illustrative properties and do not establish real property ownership or tenancy.

The manifest predates the 58-home catalog update. Check the recorded booking ledger configuration before testing the complete catalog; deploy or configure the ledger to match the current source when needed.

## Recorded contracts

The source of deployment configuration is [`src/deployments/monadTestnet.json`](../src/deployments/monadTestnet.json). It includes the broker, deployment blocks, and the catalog-to-property mapping.

| Contract | Recorded Monad Testnet address |
| :--- | :--- |
| PropertyRegistry | [0xd57ddD4691AFAa049b8deEa3398811DbaF42a54b](https://testnet.monadvision.com/address/0xd57ddD4691AFAa049b8deEa3398811DbaF42a54b) |
| RentalEscrow | [0x3CF0b81e75376dDE45E05f318ac34B51acc45a00](https://testnet.monadvision.com/address/0x3CF0b81e75376dDE45E05f318ac34B51acc45a00) |
| DisputeCourt | [0x5F3510a0978053c12eBB13d5a1D97B8B86fDE0bb](https://testnet.monadvision.com/address/0x5F3510a0978053c12eBB13d5a1D97B8B86fDE0bb) |
| Reputation | [0x2795f86e87d206dd7134458bf18fb00d4c9A0Cc7](https://testnet.monadvision.com/address/0x2795f86e87d206dd7134458bf18fb00d4c9A0Cc7) |
| MonNestBookings | [0x84811Dc78aC306f0d7D842BCE9CEEb917efB4861](https://testnet.monadvision.com/address/0x84811Dc78aC306f0d7D842BCE9CEEb917efB4861) |

`NEXT_PUBLIC_*` address variables override the manifest. Rebuild after changing them, since those values are included in the browser bundle. The app checks the onchain broker against the expected recipient before enabling complimentary bookings.

## Deploying your own testnet contracts

Use a funded Monad Testnet deployer and a separate broker wallet. Configure the ignored `.env.local` using [`.env.example`](../.env.example).

```bash
npm run contracts:compile
npm run contracts:test
npm run contracts:deploy:bookings:testnet  # Booking ledger only
npm run contracts:deploy:testnet           # All five rental contracts
```

The full deployment writes the manifest and registers demo property records in batches. Review addresses, roles, and receipts in the explorer before using them. Keep deployment private keys local; never put them in Git, public environment variables, or the web deployment.

For a browser-wallet booking deployment, run `npm run contracts:deploy:browser` and open `http://localhost:3011` in the browser containing the configured deployer. The helper requires its configured deployer and broker addresses, verifies all 58 complimentary listings, and shows the deployment receipt. Review its configuration before use. Deployment requires an explicit wallet approval.

## Indexing and hosted configuration

The app and history API read the manifest. `npm run indexer:configure` uses it to prepare the event source configuration. Preserve the earliest deployment block when indexing the full protocol. Follow [the integration guide](SPONSOR_INTEGRATIONS.md) for Envio, Alchemy, CRE, and Aurora activation.

Vercel uses the Next.js preset. Configure the same public deployment values and server-only service credentials, then verify the public origin independently. Passkeys are domain-bound, so local and hosted credentials are different accounts.

## Release verification

- Verify a public-domain Mera create → recover → sign → disconnect sequence on a supported device.
- Confirm a complimentary booking receipt and shared rented state in an independent visitor session.
- Exercise escrow creation, funding, rent release, closure, and withdrawal with renter and owner accounts.
- Check indexed account history after the hosted indexer catches up.
- Activate automation only after CRE simulation and a verified trusted receiver.
- Keep Aurora funding disabled until both the testnet route and destination escrow execution are verified.
- Independently review the protocol before considering real funds or real tenancy agreements.

Use the [technical demo walkthrough](TECHNICAL_DEMO_SCRIPT.md) for a three-minute presentation and the [threat model](THREAT_MODEL.md) for trust boundaries.
