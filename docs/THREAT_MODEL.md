# MON-Nest threat model

## Assets and trust boundaries

- Rent and deposits held by `RentalEscrow` are the highest-value assets.
- Property documents and dispute evidence stay offchain; contracts store hashes only.
- The registry verifier, court administrator, deployment key, indexer, storage service, and web client are distinct trust boundaries.
- A frontend compromise must not be able to move escrowed value without the contract state machine allowing it.

## Primary threats and mitigations

| Threat | Current mitigation | Remaining production work |
| --- | --- | --- |
| Reentrancy during payout | Pull payments, state cleared before transfer, `ReentrancyGuard` | Independent audit and invariant tests |
| Fake property listing | Ownership-proof hash plus `VERIFIER_ROLE` | Define verifier policy and appeal path |
| Evidence tampering | Content hash committed at dispute opening | Encrypted storage, signed manifests, availability guarantees |
| Juror bribery or copied votes | Commit/reveal voting and locked stake | Unbiased onchain selection, slashing and collusion analysis |
| Duplicate jurors | Duplicate-address rejection | Sybil-resistant identity provider |
| Admin key compromise | Narrow role-based permissions | Multisig, timelock and key rotation |
| Stuck funds | Pull withdrawals and court resolution | Cancellation/expiry paths and emergency recovery design |
| Malicious frontend | Transaction destination, amount and estimated gas are reviewed before signing | Verified deployments, CSP and reproducible builds |
| Pooled escrow drain | Per-agreement remaining balance, one rent release, exact dispute allocation | Property-based and invariant testing, audit |
| Forged CRE report | Immutable forwarder/workflow, destination/chain binding, freshness and replay checks | Confirm real forwarder and DON configuration |
| Wrong-chain bridge | Aurora deposits disabled while chain 10143 is unsupported | Sponsor-confirmed testnet route and receipt verification |
| Passkey secret exposure | PRF-derived account, memory-only signing session, temporary key wipe | Client security review, passkey-loss recovery policy, CSP |
| Privacy leakage | Only hashes belong onchain | Formal evidence access and retention policy |

## Escrow state machine

```text
Created -> Funded -> Active -> Completed
                  \-> Disputed -> Completed
Created -----------------------> Cancelled (planned)
```

The renter can fund directly; an intermediary can also use `fundFor` to fund an existing agreement without changing its parties or refund recipients. The prototype accepts one funded month, tracks each agreement's balance separately, and permits one rent release. Scheduled rent becomes claimable to the owner rather than being pushed. Either party can dispute; only the authorized court can allocate exactly that agreement's remaining balance. Normal expiry/cancellation and full renter operations still need implementation before this broader protocol is launched.

## Known limitations

- Contract code is hackathon-grade and unaudited.
- Juror selection is currently supplied by an administrator; production must use verifiable unbiased randomness and identity constraints.
- The first contract version handles native MON only. ERC-20 stablecoin support must use safe transfer wrappers and explicit token allowlists.
- Cancellation, appeals, late fees, partial monthly accrual, upgrades, and emergency recovery are intentionally not claimed as complete.
