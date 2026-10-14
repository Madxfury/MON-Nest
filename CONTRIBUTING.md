# Contributing to MON-Nest

Use Node.js 24 and `npm ci` to install the locked dependencies. Copy `.env.example` to `.env.local` for optional service configuration; credentials and signing keys must stay outside Git.

## Before opening a pull request

```bash
npm run build -- --webpack
npm run wallet:test
npm run aurora:test
```

For Solidity or protocol changes, also run `npm run contracts:test`. Hardhat downloads the configured Solidity compiler on the first run. Indexer changes should pass the validation steps in [the integration guide](docs/SPONSOR_INTEGRATIONS.md).

Keep changes focused. Describe the user-visible result and include the commands you ran. For interface changes, attach desktop and mobile screenshots and check keyboard navigation, empty states, and reduced-motion behavior. Do not label an integration live without a verified deployment and an end-to-end receipt.

## Project conventions

- TypeScript and React components use explicit props and accessible controls.
- Reusable UI primitives live in `components/ui`; application flows live in `src`.
- `src/app/site.css` owns the brand theme; `bento.css` scopes Tailwind's component styles.
- Preserve the existing passkey derivation path and account isolation behavior.
- Use neutral wallet greetings; personal names appear only when entered by the account owner.
- Keep documentation, deployment manifests, and environment examples aligned with the code.
- Retain font licenses and image credits when changing visual assets.

## Reporting security issues

Follow the repository's [threat model](docs/THREAT_MODEL.md). Avoid putting credentials, private keys, or sensitive account data in public issues. Use GitHub's private vulnerability reporting if the repository has it enabled; otherwise contact the maintainer before sharing sensitive reproduction details.
