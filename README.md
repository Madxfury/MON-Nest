# MON-Nest

> A Monad Testnet rental marketplace prototype with public, onchain booking availability.

MON-Nest explores how a rental marketplace could combine clear home discovery with verifiable reservations, programmable rent escrow, and dispute resolution. The current web catalog is illustrative. The only homes intended for live booking are five complimentary testnet listings; other rental prices and terms are examples, not offers to rent real property.

**Selected account provider: Mera passkeys.** No Dynamic/Privy account layer is enabled. See [sponsor integration evidence and activation checklist](docs/SPONSOR_INTEGRATIONS.md) for implemented code, verified tests, and remaining live-service gates. A wallet-approved testnet deployment is still required; no private key needs to be shared with this application.

## Hackathon position

**Primary track: Consumer Products & Payments**

The track asks for consumer-facing financial products that use onchain rails as a design advantage for people who do not identify as crypto users. MON-Nest fits because escrow, milestone settlement, and a one-month protected deposit solve a familiar consumer problem while Monad makes frequent, low-cost rent activity practical.

**Secondary narrative: Trust, Identity & AI Infrastructure**

Property ownership attestations, evidence provenance, portable reputation, and juror history create a trust layer. These support the product, but the primary submission remains Consumer Products & Payments.

The other tracks were reviewed deliberately:

- **Onchain Finance & Trading:** not selected; MON-Nest is not a trading product or market primitive.
- **Social, Attention & Culture:** not selected; community juries use governance, but cultural participation and open social graphs are not the core product.

### Relevant sponsor bounties

| Priority | Bounty | Intended integration |
| --- | --- | --- |
| High | Best Mera-Powered UX on Monad | Passkey-first account layer with no seed phrase, extension, or custody backend. |
| High | Best Use of Envio | Index listings, escrow milestones, deposits, disputes, jury votes, and reputation into the product UI. |
| Alternative | Best Use of Dynamic | Evaluated, not integrated: Mera is the single selected account provider. |
| Alternative | Privy! | Evaluated, not integrated: do not claim this bounty in the Mera build. |
| Medium | Best Projects using Alchemy | Monad RPC, contract reads, simulation, and webhooks where supported. |
| Stretch | Best workflow with CRE | Coordinate evidence deadlines, rent releases, and dispute escalation. |
| Stretch | Bring Any-Chain Liquidity to Monad | Fund a MON/AUSD escrow from another chain through Aurora Intents. |

Cross-border AUSD and trading bounties are not targeted: forcing them into a rental escrow would dilute the core consumer story.

## How the testnet booking works

`MonNestBookings.sol` is a public availability ledger. The owner configures prices and durations; the constructor seeds five complimentary homes. On `book(listingId, expectedBroker)`, the contract verifies the reviewed broker, active availability and exact payment, records the renter and expiry, and emits `HomeBooked`. Every visitor reads the same onchain state. Expired bookings become available again, while past events remain in history.

The five complimentary catalog entries are IDs **4, 45, 46, 47, and 48**. The deployment script configures each at **0 MON for 30 days**. A successful booking has a 0 MON listing price; the wallet still pays Monad Testnet network gas. No rent is transferred to the broker for these zero-priced bookings. If an administrator later configures a positive testnet price, `book` requires the exact amount and sends it to the contract's broker address, never back to the renter. The broker wallet cannot book its own listings.

| ID | Illustrative catalog home | Testnet price |
| --- | --- | --- |
| 4 | The Nest at Bandra | 0 MON |
| 45 | Fernlight Studio | 0 MON |
| 46 | The Red Chair Loft | 0 MON |
| 47 | The Outlook Residence | 0 MON |
| 48 | Sunline House | 0 MON |

The listings and photos do **not** establish real property ownership or a legal tenancy. This booking contract does not hold a deposit or create a lease. The separate escrow, property registry, court, and reputation contracts are research prototypes that are not connected to a complete renter journey.

## Implementation checklist

Update these checkboxes only when the corresponding implementation has been verified. Source code, a deployed contract, and a working production UI are separate milestones.

### Product and design

- [x] Brand the product as MON-Nest and build a responsive Next.js catalog.
- [x] Include 48 illustrative homes with locally stored residential images, search, city filters, and pagination.
- [x] Connect an injected wallet, restore an already authorized account after refresh, and respond to account changes and explicit disconnect.
- [x] Show a wallet-specific profile and locally saved homes.
- [x] Record local browser viewing/saving history, labeled as local activity rather than verified property history.
- [x] Add five complimentary homes as normal catalog listings.
- [ ] Verify the booking UI against a deployed testnet contract: global availability, transaction pending/confirmed/failed states, explorer links, and the renter's booking in their profile.
- [ ] Add owner-authorized listings, real availability, rental terms, and an owner operations interface.
- [ ] Complete mobile and accessibility review of the booking journey.

### Monad contracts

- [x] Implement `MonNestBookings.sol` with one active booking per listing, a configured broker recipient, expiry, and events.
- [x] Add a deployment script that configures complimentary IDs 4 and 45–48.
- [x] Add unit tests for zero-price booking, shared availability, expiry, payout, and authorization.
- [x] Write `PropertyRegistry.sol`, `RentalEscrow.sol`, `DisputeCourt.sol`, and `Reputation.sol` prototypes and basic unit tests.
- [ ] Deploy `MonNestBookings` to Monad Testnet and record its verified address below.
- [ ] Connect the deployed address to local and Vercel builds, then confirm two independent wallets see the same rented state.
- [ ] Deploy and independently review the broader rental protocol before accepting rent or deposits.
- [ ] Add ERC-20 funding, cancellation, unbiased juror selection, slashing, rewards, fuzz tests, and invariants to the broader protocol.

### Sponsor bounties and services

- [x] Mera SDK passkey creation/recovery, deterministic account derivation, viem signing and session teardown.
- [x] Synthetic Mera account recovery/signature/session-end tests (`npm run wallet:test`).
- [ ] Real device passkey ceremony, refresh/recovery, gas funding and booking on the public domain.
- [x] Envio schema, all protocol event handlers, code generation and typecheck.
- [x] Replay actual local contract receipts through indexer handlers; verify history, escrow, votes and reputation.
- [x] Consume Envio through a server-only GraphQL adapter and account UI, with RPC booking history fallback.
- [ ] Host Envio, configure its endpoint, and verify live ingestion → GraphQL → production UI.
- [x] Server-only RPC adapter, contract simulation, gas estimate review and signed transaction broadcast support.
- [x] Authenticate supplied Envio HyperSync/HyperRPC tokens on chain 10143; load them privately into the indexer.
- [x] Configure a server-only Alchemy Monad Testnet URL and verify chain-ID reads (Monad Mainnet remains disabled).
- [ ] Verify Alchemy transaction simulation/broadcast end to end with the deployed booking contract.
- [x] Real Chainlink CRE SDK workflow and authenticated onchain report receiver; local type/security tests.
- [ ] Simulate, deploy and activate CRE using a trusted forwarder and account access.
- [x] Escrow intermediary `fundFor` entry point and read-only Aurora network compatibility check.
- [x] Live Aurora availability UI/API: requested network IDs, provider evidence, timestamp, retry, and offline handling; no deposit or mainnet execution.
- [ ] Aurora Intents full cross-chain funding/execution (blocked: advertised Monad routes are mainnet 143, not testnet 10143).
- [ ] AUSD/ERC-20 escrow support (native MON only today).
- [ ] Encrypted evidence storage, signed media manifests, notifications, and abuse handling.

### Security and submission

- [x] Document the proposed escrow state machine and known threats in `docs/THREAT_MODEL.md`.
- [x] Make the Next.js site deployable to Vercel and publish the existing site at https://mon-nest.vercel.app.
- [ ] Verify the newly implemented booking flow on the public deployment.
- [ ] Add contract source verification, testnet explorer links, and reproducible judge instructions.
- [ ] Complete independent contract security review, legal review, and operational monitoring before a real-money launch.
- [ ] Record an end-to-end demo and complete mobile, accessibility, performance, and broken-link audits.

## Tech stack

- Next.js App Router + React + TypeScript
- Plain CSS design system and Lucide icons
- Solidity 0.8.28, Hardhat, OpenZeppelin, and viem for contract development and testnet reads/writes
- Vercel for the web app; Monad Testnet for the booking contract when deployed
- Mera passkey accounts + viem signing; Envio HyperIndex handlers and GraphQL adapter
- Chainlink CRE SDK workflow + authenticated Solidity receiver (live deployment pending)

## Run locally

Requires Node.js 24 (Mera SDK requirement).

```bash
npm install
npm run dev -- --port 3010
```

Open `http://localhost:3010`. Copy `.env.example` to ignored `.env.local` and configure the booking address, expected broker and deployment block after deployment. Unconfigured bookings are disabled, not simulated. Mera needs no hosted project ID. Alchemy/Envio settings are server-only; see [activation instructions](docs/SPONSOR_INTEGRATIONS.md). Localhost and production passkeys are separate accounts because they belong to different domains.

Production verification:

```bash
npm run build
npm start -- --port 3010
```

## Deploy and connect the booking contract

The booking deployer needs a Monad Testnet wallet with enough MON for gas, plus a **separate broker wallet**. Verify that you control the intended broker address before deploying. The broker is recorded onchain and can later be changed only by the contract owner. Do not put a private key in Git, a `NEXT_PUBLIC_*` variable, or the Vercel project. Hardhat loads deployment variables from the ignored `.env.local` file; shell environment variables also work.

Use the browser-wallet flow below, or configure a private deployment key locally for the alternative CLI flow.

**Recommended: browser-wallet deployment without a private-key file.** Run `npm run contracts:deploy:browser`, open `http://localhost:3011` in the Chrome profile with the confirmed MetaMask deployer, and review/approve the single deployment transaction. The local helper checks the receipt, owner, broker and all five listings, then shows the contract address and deployment block. It never reads wallet secrets. Deployment gas requires your explicit wallet approval. The helper currently expects the user-confirmed deployer `0x2733Bd3F25B762Afc860a4B34aC38E5B5D932563` and separate broker `0xc0aB4B8462792E0BeCE8D5e7d6e31CF4716c08CB`.

The following alternative Hardhat flow needs a privately configured deployment key; do not paste it in chat or commit it:

```powershell
npm install
npm run contracts:compile
npm run contracts:test
npm run contracts:deploy:bookings:testnet
```

The script prints the `MonNestBookings` address, broker, and the five configured listing IDs. Check the address and transactions in the Monad Testnet explorer. Then set `NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS`, `NEXT_PUBLIC_BROKER_ADDRESS`, and `NEXT_PUBLIC_MON_NEST_BOOKINGS_DEPLOY_BLOCK` in `.env.local` for local development and as **Production** environment variables in Vercel. Use the decimal block number from the deployment receipt; a later block omits earlier bookings. Set `NEXT_PUBLIC_MONAD_RPC_URL` if using a different Monad Testnet RPC. Rebuild locally and redeploy Vercel because `NEXT_PUBLIC_*` values are embedded in the browser build. The application reads the onchain broker and checks it against the configured expected recipient before enabling bookings.

For the web app, import `Madxfury/MON-Nest` in Vercel with the Next.js preset and default build settings. The current public domain is https://mon-nest.vercel.app. A new deployment must be checked at that domain before marking the booking UI live.

## Contract deployments

| Network | Contract | Address |
| --- | --- | --- |
| Monad test network | PropertyRegistry | Not deployed |
| Monad test network | RentalEscrow | Not deployed |
| Monad test network | DisputeCourt | Not deployed |
| Monad test network | Reputation | Not deployed |
| Monad Testnet | MonNestBookings | Not deployed |

## Image credits

The prototype uses real residential photography from [Unsplash](https://unsplash.com) downloaded into `public/homes` so the demo does not depend on remote image hosts. Images are presentation examples, not real MON-Nest listings. Before launch, attach photographer attribution metadata and replace them with owner-authorized listing media.

## Important scope note

MON-Nest is a hackathon prototype, not a real-property marketplace or audited rental protocol. Until the booking contract is deployed and configured, shared reservations remain disabled. The web app does not verify actual home ownership, hold real rental deposits, create legal tenancy agreements, or adjudicate real disputes. Sponsor SDK code and local tests are distinguished from live service verification in the checklists above; incomplete live gates remain unchecked.
