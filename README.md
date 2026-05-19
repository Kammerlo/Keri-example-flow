# KERI · Veridian — Credential Lab

An educational TypeScript app for learning **KERI** and **ACDC** credentials. A
backend issuer issues a credential, requests a presentation, and requests an
attestation — and every signify-ts call is explained inline in a step log.

Run it two ways:

- **Demo mode** — a browser-held KERI identity. No wallet, no phone. Fully
  works out of the box and is covered by an automated end-to-end test.
- **Veridian mode** — a real Veridian wallet drives the flows.

## What it teaches

| Step | KERI concepts |
|---|---|
| Connect | AIDs, OOBIs, witnesses, client-side key custody |
| Issue | registries, ACDC, IPEX grant/admit, schema OOBI |
| Present | verifier-driven IPEX apply/offer/agree/grant/admit |
| Attest | SAID anchoring via `ixn`, KEL seals, key-state verification |

## Quick start (demo mode)

```bash
cp .env.example .env
docker compose up -d --build
until curl -sf http://localhost:3001/readyz; do sleep 3; done
open http://localhost:3001
```

Go through the tabs **Connect → Issue → Present → Attest**. On **Connect**,
click **Create demo identity** — done, no wallet needed.

Verify the whole flow headlessly:

```bash
npm install
npm run test:e2e      # requires the stack above to be running
```

## Run end-to-end with a real Veridian wallet

**1. Start this stack:**

```bash
docker compose up -d
until curl -sf http://localhost:3001/readyz; do sleep 3; done
```

**2. Start the Veridian wallet** from the
[cardano-foundation/veridian-wallet](https://github.com/cardano-foundation/veridian-wallet)
repo:

```bash
git checkout main
npm install
npm run dev
```

**3. Open the wallet** at <http://localhost:3003> in the browser, switch
DevTools to **mobile view** (device toolbar), and **refresh once** after mobile
view is active.

**4. Point the wallet at this stack's KERIA** — connection URL
`http://localhost:3901`, boot URL `http://localhost:3903` (also shown on the
**Connect** tab). Onboard a wallet identifier.

**5. Connect in this app:** on the **Connect** tab, copy the **Issuer OOBI**
and add it as a connection in Veridian; paste your wallet's OOBI back into the
field and press **Connect Veridian & continue**.

**6. Run the flows.** Issue / Present / Attest now prompt for approval inside
the Veridian wallet.

> The wallet uses *this stack's* KERIA, so all OOBIs resolve over the docker
> network with the defaults — nothing else to configure. Deeper notes and
> troubleshooting are in [`ONBOARDING.md`](ONBOARDING.md).

## Architecture

- **app** — Express backend holding the issuer/verifier signify-ts agent
  (issuer salt server-side); serves the React/Vite UI and the schema OOBI.
- **keria** — `cf-idw-keria`, multi-tenant; hosts the issuer agent and the
  browser/wallet agents.
- **witnesses** — keripy `kli witness demo` (insecure demo network — teaching
  only).

KERI/IPEX wiring follows the Veridian team's `credential-server`. Design notes
live in `docs/superpowers/specs/`.

## Tests

```bash
npm test          # unit / contract (no infra)
npm run test:e2e  # full demo flow (requires docker compose up)
```

Infra under `infra/keria-config/` is vendored from
`cardano-foundation/veridian-wallet` (Apache-2.0); see `NOTICE`.
