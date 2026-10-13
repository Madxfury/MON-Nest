# MON-Nest rental deadline workflow

Real `@chainlink/cre-sdk` Cron → finalized EVM reads → signed report → `RentalAutomation.onReport` pipeline. It releases a single funded month's rent when due and emits an evidence-deadline signal. It does not decide a dispute or move deposits to arbitrary recipients.

Local source verification:

```bash
npm ci
npm run check
```

Receiver tests run from the repository root with `npm run contracts:test`. These are local tests, not a hosted CRE simulation.

To run a real simulation:

1. Install/authenticate the official [CRE CLI](https://docs.chain.link/cre/getting-started/overview) and its TypeScript/Bun prerequisites. Use `cre init` to create the project configuration for your account and supported Monad Testnet RPC capability. Keep keys/credentials outside Git.
2. Deploy `RentalEscrow` and `RentalAutomation`. The receiver constructor requires your actual trusted CRE forwarder and workflow ID. Do not substitute a random address or deployer EOA for the production forwarder.
3. Copy `config.staging.example.json` to ignored `config.staging.json`; replace escrow and receiver addresses and add real funded agreement IDs (at most 10 per execution). Confirm chain ID 10143 and the supported network selector with your CRE capability configuration.
4. Put the workflow in the generated project and use `workflow.yaml` for its staging target. Run `cre workflow simulate` using the generated project's CLI instructions, initially without broadcasting. Review the report; then run an authorized broadcast test.
5. Record the simulation output, trusted workflow ID, receiver address and transaction receipt. Only then request/activate a hosted deployment with your CRE account.

The workflow needs actual deployed contracts, account access and a supported write capability; none is silently provisioned by `npm install`. Automation does not bypass an escrow dispute or its accounting guards. An evidence deadline emits an auditable signal; evidence storage, notification delivery and automatic court enrollment remain separate product work.
