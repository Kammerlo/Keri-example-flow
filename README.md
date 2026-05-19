# KERI + Veridian — Educational Demo

An educational TypeScript app that teaches **KERI** and **ACDC** credentials —
**with** a real Veridian wallet and **without** (a browser demo identity). It
issues a credential from a backend issuer, requests a presentation, and requests
an attestation, narrating every signify-ts call in an annotated step log.

## What it teaches

| Flow | KERI concepts |
|---|---|
| Connect | AIDs, OOBIs, witnesses, `toad`, client-side key custody |
| Issue | registries, ACDC, IPEX grant/admit, schema SAID + OOBI |
| Present | verifier-driven IPEX apply/offer/agree/grant/admit, verification |
| Attest | SAID anchoring via `ixn`, KEL seals, key-state verification |

## Run

```bash
cp .env.example .env        # defaults work for local demo mode
docker compose up -d --build
# wait until ready:
until curl -sf http://localhost:3001/readyz; do sleep 3; done
open http://localhost:3001
```

Then follow the tabs: **Connect → Issue → Present → Attest**.
Demo mode needs no phone. See `scripts/smoke.md`.

## Verify it works (demo mode, no phone)

With the stack up:

```bash
npm run test:e2e
```

This drives the full demo-wallet flow headlessly through signify-ts +
the backend API (connect → issue → present → attest) and asserts the
credential is admitted, the presentation verifies, and the attestation
is anchored and verified against the holder's KEL.

## Veridian (real wallet) mode

This follows the canonical `cip113` `KeriService.java` model: there is **no
browser companion** — the backend resolves the wallet's OOBI and talks directly
to the wallet AID, so issuance/presentation/attestation prompts appear **on the
phone**.

1. Set `PUBLIC_HOST` in `.env` to a URL the phone can reach on the LAN, e.g.
   `http://192.168.1.50:3001`, and point the Veridian app's KERIA **connection
   URL** at `…:3901` and **boot URL** at `…:3903` (LAN IP, not localhost).
   Re-run `docker compose up -d`.
2. **Connect** tab → Veridian card: add a connection in the Veridian app using
   the displayed **issuer OOBI** (scan the QR or use Copy), then paste **your
   Veridian identifier's OOBI** back into the field and press *Connect Veridian
   & continue* (it forwards you to Issue).
3. Issue / Present / Attest then prompt for approval inside the Veridian app.

KERI communication (grant via `createExchangeMessage` with the schema OOBI in
`exn.a`, `/ipex/apply` built the same way so the wallet doesn't drop it, and
`/remotesign/ixn/req` for attestation) is adopted from `KeriService.java`.
Attestation requires the `cf-idw-keria` image with `REMOTE_SIGNING=true`
(already set in compose). Demo mode fully demonstrates every flow without a
phone.

## Architecture

- **app** (this repo): Express backend holds the issuer/verifier signify-ts
  agent (issuer salt server-side) and serves the React/Vite UI and the schema
  OOBI at `/oobi/:said`.
- **keria**: CF `cf-idw-keria` (multi-tenant; hosts issuer + browser agents).
- **witnesses**: keripy `kli witness demo` (insecure demo network — teaching
  only, deterministic keys).

## Infrastructure attribution

`infra/keria-config/*` is vendored from
[cardano-foundation/veridian-wallet](https://github.com/cardano-foundation/veridian-wallet)
(Apache-2.0) — see `NOTICE`. Re-pull with `infra/update-keria-config.sh`.

## Bump the KERIA image

The pinned `cf-idw-keria` tag is an upstream dev tag and may drift. To update,
copy the `keria` image tag from the upstream
[`docker-compose.yaml`](https://github.com/cardano-foundation/veridian-wallet/blob/main/docker-compose.yaml)
into `docker-compose.yml` and re-run `infra/update-keria-config.sh`.

## Known teaching gaps (intentional)

- Demo witnesses are insecure (deterministic keys); `noBackers: true` registry;
  issuer salt persisted to disk. Production-correct alternatives are noted in
  the design spec (`docs/superpowers/specs/`).
- Not Cardano/IPFS/PDF — those are out of scope by design.

## Develop without Docker

```bash
npm install
npm run schema:saidify
# point KERIA_URL/KERIA_BOOT_URL at a running KERIA, then:
npm run dev:backend     # :3001
npm run dev:frontend    # :5173 (proxies /api and /oobi to :3001)
```

## Tests

```bash
npm test          # unit/contract (no infra needed)
npm run test:e2e  # full demo flow (requires `docker compose up`)
```
