# Sponsor integration evidence

This is a Monad **Testnet** build (chain 10143). The final account provider is **Mera**, selected by the owner. Dynamic and Privy are alternatives, not active integrations or bounty claims.

## Mera — integrated, device verification pending

`src/wallet/WalletProvider.tsx` uses the actual `@category-labs/mera` SDK, not a simulated passkey:

1. WebAuthn creates or retrieves a credential with a PRF output.
2. BIP32 derives the EVM account at `m/44'/60'/0'/0/0` from that output. This v1 derivation must never change for existing accounts.
3. A Mera secp256k1 signing session becomes a viem account. The transaction review precedes signed broadcast through `/api/rpc`.
4. PRF output and temporary derivation keys are wiped. Only public address, credential ID, RP domain, and derivation version are persisted. Signing sessions end on disconnect/unmount.
5. Refresh restores public identity, not a signing secret. The next transaction requests passkey recovery when needed. A restored public identity is not server-side authentication.

Run `npm run wallet:test` for synthetic deterministic recovery, signature recovery, and session teardown. This does not prove browser WebAuthn compatibility. Verify create → refresh → recover → fund testnet gas → book → disconnect in a PRF-compatible browser on **mon-nest.vercel.app**. Localhost and the production domain have separate passkeys. Do not delete a funded passkey; there is no custody backend or seed export.

Official reference: [Mera](https://github.com/category-labs/mera). The SDK is preview software; this application is not audited for real-money custody.

## Envio — generated, typechecked, receipt mapping tested; hosting pending

The supplied HyperSync and HyperRPC credentials are stored in ignored root `.env.local` as `ENVIO_API_TOKEN` and `ENVIO_HYPERRPC_TOKEN`. On 2026-10-14, an authenticated HyperSync query and HyperRPC chain-ID request both succeeded for Monad Testnet (10143). Run `npm run envio:check` to repeat these read-only checks without printing credentials. `indexer/run-envio.mjs` loads the ignored root credentials for codegen/dev, and generated configuration references the HyperRPC token through an environment placeholder, never a literal secret. HyperSync is the primary indexer source; HyperRPC is a fallback. The current HyperRPC free package is limited to five requests/minute, so it is not the visitor-facing primary RPC.

`indexer/config.yaml`, `schema.graphql`, and `src/handlers/rentals.ts` implement booking/listing, registry, escrow funding/release, disputes, court commitments/reveals/results, and reputation entities. Histories retain every event, rather than overwriting previous bookings. IDs include chain and contract, and the app queries only configured deployments.

`test/indexer-handlers.js` replays actual local Hardhat receipts into an in-memory entity store. It verifies mapping logic and all major milestones, **not** the hosted ingestion/Hasura path. Envio codegen and its separate TypeScript check also pass.

After deploying contracts and setting addresses in `.env.local`:

```bash
npm run contracts:compile
npm run indexer:configure
cd indexer
npm ci
npm run codegen
npm run check
npm run dev
```

Use Linux/macOS or WSL2 (Envio does not run natively on Windows), Node 24, and Docker for local database services. `INDEXER_START_BLOCK` must be at or before the earliest indexed contract deployment. The checked-in empty-address config is only for code generation; `npm run dev` fails closed until all five real deployment addresses have been generated. Publish the configured directory with Envio's hosted service, then set server-only `ENVIO_GRAPHQL_URL` and, if required, `ENVIO_GRAPHQL_SECRET` in local/Vercel environments. Prefer a read-only GraphQL role for production; keep admin secrets server-only.

`/api/history` serves bounded fixed queries. Property details and the profile consume the result. Unconfigured account indexing is hidden; booking event history falls back to RPC. Hosting, synchronization, and a live GraphQL query remain unchecked.

Official reference: [Envio HyperIndex guide](https://docs.envio.dev/blog/index-arc-usdc-transfers).

## Alchemy — Monad Testnet RPC configured and verified

On 2026-10-14, Monad Testnet was enabled for the supplied Alchemy app with user approval. Monad Mainnet remains disabled. The authenticated endpoint returned chain ID 10143 after activation propagated. Its server-only URL is stored in ignored `.env.local` and the Vercel production environment. This verifies service access/reads, not a booking transaction or awarded bounty. The website displays configuration status dynamically and the RPC response includes a non-secret provider header.

Set **server-only** `ALCHEMY_MONAD_TESTNET_RPC_URL`. `/api/rpc` forwards an allowlisted set of JSON-RPC operations with request-size, batch-size and timeout limits. Balance, contract reads, gas estimation, preflight simulation, receipts, logs, and Mera signed broadcasts use it. Without this setting the app uses the public Monad Testnet RPC and does **not** claim Alchemy is active. No Alchemy webhooks are claimed or required for the present polling flow. Production needs durable rate limiting/service quotas.

## Chainlink CRE — workflow and receiver locally verified; simulation pending

`integrations/cre/main.ts` uses the real CRE SDK and a Cron trigger. It reads finalized agreement state and creates signed EVM reports for due rent release or an evidence-deadline signal. `RentalAutomation.sol` authenticates the trusted forwarder and workflow ID, binds chain and receiver, rejects stale/replayed reports, and cannot select dispute awards.

See `integrations/cre/README.md`. SDK typechecking and receiver tests pass; this is **not** evidence of a CRE simulation or live DON execution. No workflow/forwarder is deployed yet.

## Aurora Intents — incompatible network, not a completed integration

`npm run aurora:check` performs a read-only call to the actual advertised token service. On 2026-10-14 it advertised Monad destinations with chain **143**, not **10143**. Mainnet tokens must not be deposited to testnet contracts. The installed SDK's default client points to a Stoplight mock, so it is deliberately not used to manufacture a successful integration.

`RentalEscrow.fundFor` is implemented and tested: an intermediary can fund an existing agreement while refunds and ownership remain with its original parties. That is only the destination prerequisite. Cross-chain quotes, EIP-191 intent signing, source deposit, execution tracking, and final escrow receipt still require a sponsor-confirmed testnet route and end-to-end validation. Bridging is disabled, and AUSD/ERC-20 support is not implemented.

## Release gate

- [x] Mera SDK account and signing implementation; synthetic signing/recovery test.
- [x] Envio codegen/typecheck and local receipt-to-entity mapping test.
- [x] RPC adapter, simulation, gas review, receipt confirmation and history UI.
- [x] CRE SDK typecheck and authenticated receiver security tests.
- [x] Aurora network capability check; fail closed on missing testnet support.
- [x] Authenticate supplied Envio HyperSync/HyperRPC tokens against Monad Testnet without logging secrets.
- [x] Enable only Monad Testnet for the Alchemy app and verify chain-ID access.
- [ ] User-approved Monad Testnet contract deployment; record address/block/receipt.
- [ ] Real Mera WebAuthn ceremony and funded booking on production domain.
- [ ] Hosted Envio caught up; production history/profile query verified.
- [ ] Alchemy URL configured and chain 10143 reads/simulation/broadcast verified.
- [ ] CRE simulation, trusted receiver deployment, workflow activation and receipt.
- [ ] Aurora testnet support, full funding flow and destination receipt.
- [ ] Independent security review before real funds or legal tenancies.
