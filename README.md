# MON-Nest

> A Monad Testnet rental marketplace prototype with public, onchain booking availability.

MON-Nest explores how a rental marketplace could combine clear home discovery with verifiable reservations, programmable rent escrow, and dispute resolution. The current web catalog is illustrative. The only homes intended for live booking are five complimentary testnet listings; other rental prices and terms are examples, not offers to rent real property.

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
| High | Best Use of Dynamic | Embedded wallet onboarding and transaction signing. Use one account provider in the final build. |
| Medium | Privy! | Alternative to Dynamic; beyond-login use would cover embedded wallets, funding, and policy-based signing. |
| Medium | Best Projects using Alchemy | Monad RPC, contract reads, simulation, and webhooks where supported. |
| Stretch | Best workflow with CRE | Coordinate evidence deadlines, rent releases, and dispute escalation. |
| Stretch | Bring Any-Chain Liquidity to Monad | Fund a MON/AUSD escrow from another chain through Aurora Intents. |

Cross-border AUSD and trading bounties are not targeted: forcing them into a rental escrow would dilute the core consumer story.

## How the testnet booking works

`MonNestBookings.sol` is a public availability ledger. The owner account configures each listing's price and duration, and the broker recipient is set at deployment. On `book(listingId)`, the contract checks that the home is active and not already rented, records the renter and expiry, and emits `HomeBooked`. The website reads that shared onchain state so every visitor sees the same availability. After the configured period ends, the listing becomes available to book again.

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

- [ ] Mera or Dynamic embedded/passkey wallet onboarding and transaction signing.
- [ ] Envio indexing of booking, escrow, court, and reputation events.
- [ ] Alchemy RPC or other sponsor-specific infrastructure integration, tested end to end.
- [ ] Chainlink CRE workflow for deadlines and dispute escalation.
- [ ] Aurora Intents cross-chain funding and execution.
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
- Planned: Mera or Dynamic, Envio, evidence storage, and sponsor workflows

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To use the shared booking ledger, set `NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS` to a deployed `MonNestBookings` contract on Monad Testnet and `NEXT_PUBLIC_BROKER_ADDRESS` to the expected broker recipient in `.env.local`. The app pauses bookings if the deployed contract reports a different broker. Without valid addresses, the catalog remains browsable but live bookings are unavailable.

Production verification:

```bash
npm run build
npm start
```

## Deploy and connect the booking contract

The booking deployer needs a Monad Testnet wallet with enough MON for gas, plus a **separate broker wallet**. Verify that you control the intended broker address before deploying. The broker is recorded onchain and can later be changed only by the contract owner. Do not put a private key in Git, a `NEXT_PUBLIC_*` variable, or the Vercel project. Hardhat loads deployment variables from the ignored `.env.local` file; shell environment variables also work.

Set `DEPLOYER_PRIVATE_KEY` and `BROKER_ADDRESS` in `.env.local` on your computer, then run:

```powershell
npm install
npm run contracts:compile
npm run contracts:test
npm run contracts:deploy:bookings:testnet
```

The script prints the `MonNestBookings` address, broker, and the five configured listing IDs. Check the address and transactions in the Monad Testnet explorer. Then set `NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS` and `NEXT_PUBLIC_BROKER_ADDRESS` in `.env.local` for local development and as **Production** environment variables in Vercel. Set `NEXT_PUBLIC_MONAD_RPC_URL` if using a different Monad Testnet RPC. Rebuild locally and redeploy Vercel because `NEXT_PUBLIC_*` values are embedded in the browser build. The application reads the onchain broker and checks it against the configured expected recipient before enabling bookings.

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

MON-Nest is a hackathon prototype. A local contract source file or a wallet transaction does not prove that a property was verified or leased. Until the booking contract is deployed and the public site is configured with its address, there is no shared onchain reservation state. The web app does not currently verify home ownership, hold rental deposits, create legal tenancy agreements, or adjudicate real disputes. Sponsor integrations are planned and remain unchecked until connected and exercised end to end.
