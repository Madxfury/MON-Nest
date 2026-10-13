# MON-Nest

> Verified rentals. Protected payments. Fair outcomes — built on Monad.

MON-Nest is a consumer rental marketplace that replaces broker commissions and handshake trust with verified property records, programmable rent escrow, and community dispute resolution. It is designed for ordinary renters and owners: blockchain is the rail, not the product vocabulary.

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

## Product flow

1. An owner verifies identity and property control, then mints a non-transferable listing record containing a content hash of the terms and media.
2. A renter signs clear terms and funds first rent, one-month deposit, and dispute reserve into a non-custodial escrow on Monad.
3. Check-in evidence is hashed and time-stamped. Scheduled rent releases after the agreed confirmation window.
4. Either party can open a dispute and reveal evidence to a randomly assigned, staked jury.
5. The majority ruling settles escrow. Honest participation updates portable reputation and juror rewards.

The web experience currently uses an explicitly labeled demo wallet and mock listings. It never requests funds or broadcasts a transaction.

## Implementation checklist

This list is the source of truth for build status. Checkboxes should be updated in the same pull request as each implementation.

### Product and design

- [x] Name and brand the product as **MON-Nest**.
- [x] Build a responsive Next.js marketplace experience.
- [x] Add authentic residential photography stored locally for reliable rendering.
- [x] Add discovery filters, saved homes, wallet-demo state, booking preview, and responsive navigation.
- [x] Explain escrow, proof, and community resolution without requiring crypto knowledge.
- [x] Label all prototype values and simulated actions honestly.
- [ ] Add owner listing creation and renter/owner dashboards.
- [ ] Add accessible form validation, empty/error states, and a guided first-use flow.

### Monad contracts

- [ ] `PropertyRegistry.sol`: property attestation, metadata hash, status, and owner authorization.
- [ ] `RentalEscrow.sol`: agreement creation, MON/ERC-20 funding, milestone releases, cancellation, and pull payments.
- [ ] `DisputeCourt.sol`: juror staking, unbiased assignment, commit/reveal vote, ruling, slashing, and rewards.
- [ ] `Reputation.sol`: non-transferable role-specific attestations.
- [ ] Add access control, pausing, reentrancy protection, and invariant checks.
- [ ] Add unit, fuzz, and invariant tests with explicit edge cases.
- [ ] Deploy contracts to the current Monad test network and record verified addresses below.

### App integrations

- [ ] Replace the demo connector with **Mera** or **Dynamic** passkey onboarding.
- [ ] Add typed contract reads/writes and human-readable transaction review.
- [ ] Add Envio indexing and event-driven home, escrow, dispute, and reputation views.
- [ ] Store listing files and encrypted evidence offchain; put only content hashes and permissions onchain.
- [ ] Add signed media manifests with capture time, perceptual hash, and EXIF availability; never treat EXIF alone as authenticity proof.
- [ ] Add notifications for due rent, evidence windows, jury deadlines, and settlements.
- [ ] Evaluate CRE and Aurora Intents only after the core escrow is safe.

### Security, legal, and operations

- [ ] Write escrow state-machine and threat-model documents.
- [ ] Use checks-effects-interactions, pull payments, replay protection, and bounded loops.
- [ ] Add a multisig-controlled emergency pause and time-locked upgrades, or make contracts immutable.
- [ ] Complete independent smart-contract review before holding real value.
- [ ] Define evidence privacy, retention, appeals, and jurisdiction-specific rental compliance.
- [ ] Add analytics, monitoring, rate limits, abuse reporting, and incident runbooks.

### Demo and submission

- [x] Add production metadata and social preview configuration.
- [x] Make the repository directly deployable to Vercel.
- [ ] Add deployed Vercel URL.
- [ ] Add testnet contract addresses and explorer links.
- [ ] Record a 2–3 minute end-to-end demo.
- [ ] Prepare architecture diagram, pitch deck, and judge test instructions.
- [ ] Run final mobile, accessibility, performance, and broken-link audits.

## Tech stack

- Next.js App Router + React + TypeScript
- Plain CSS design system and Lucide icons
- Planned: Solidity + Foundry, viem, Mera/Dynamic, Envio, content-addressed storage
- Deployment: Vercel for the web app; Monad test network for contracts

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production verification:

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Import `Madxfury/MON-Nest` in Vercel.
2. Keep the detected framework preset as **Next.js**.
3. Use the default build command (`next build`) and output settings.
4. Add environment variables from `.env.example` when live integrations are implemented.
5. Deploy. Pull requests receive preview deployments when Vercel Git integration is enabled.

No `vercel.json` is required; Vercel's supported Next.js defaults are the safest deployment configuration.

## Contract deployments

| Network | Contract | Address |
| --- | --- | --- |
| Monad test network | PropertyRegistry | Not deployed |
| Monad test network | RentalEscrow | Not deployed |
| Monad test network | DisputeCourt | Not deployed |
| Monad test network | Reputation | Not deployed |

## Image credits

The prototype uses real residential photography from [Unsplash](https://unsplash.com) downloaded into `public/homes` so the demo does not depend on remote image hosts. Images are presentation examples, not real MON-Nest listings. Before launch, attach photographer attribution metadata and replace them with owner-authorized listing media.

## Important scope note

MON-Nest is a hackathon prototype. It does not currently hold funds, verify ownership, provide legal tenancy agreements, or adjudicate real disputes. Those claims remain unchecked until the corresponding onchain and operational systems are implemented and verified.
