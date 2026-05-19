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

## Veridian (real wallet) mode — code-correct, infra-dependent

There is **no browser companion**: the backend resolves the wallet's OOBI and
talks directly to the wallet AID, so prompts appear **on the phone**. The KERI
communication is adopted from the Veridian team's own
[`services/credential-server`](https://github.com/cardano-foundation/veridian-wallet/tree/main/services/credential-server):

- issuance: plain `client.ipex().grant({ acdc, anc, iss, ancAttachment })`
- presentation: plain `client.ipex().apply({ schemaSaid })`
- OOBI resolve: strip `?name=`, resolve, then `contacts().update(...)`
- attestation: `/remotesign/ixn/req` (needs `cf-idw-keria`,
  `REMOTE_SIGNING=true`, already set)

This message layer is verified by the headless **demo** e2e (issue → present →
attest, 3/3) against the same KERIA. Demo mode fully demonstrates every flow
with no phone.

### ⚠️ Known limitation: OOBI reachability for a real phone

A KERI agent can only deliver an exn to an AID whose endpoint its KERIA can
reach, and a wallet only accepts a grant from an issuer whose OOBI it could
resolve. **Out of the box every OOBI/URL here uses docker-internal hostnames**
(`GET /api/config` returns e.g. `issuerOobi=http://keria:3902/...`,
`schemaOobi=http://app:3001/...`, `keriaUrl=http://localhost:3901`). A phone
cannot resolve `keria`, `app`, or `localhost`, so the issuer connection never
establishes and grants are silently dropped — which is why the phone shows
nothing even though the message construction is correct.

Making a real phone work is an operator networking task, not a code change. You
must expose, at one address the phone can reach (your machine's LAN IP, or a
reverse proxy/tunnel), **all** of:

- KERIA agent `:3901` and boot `:3903` — and configure the Veridian app to use
  them;
- KERIA ext `:3902` **and override the advertised URL**: the vendored
  `infra/keria-config/config.json` hardcodes `"keria": { "curls":
  ["http://keria:3902/"] }` — change it to your reachable host so issuer OOBIs
  are resolvable;
- the demo witnesses `:5642–5647` — `infra/keria-config/config.json` `iurls`
  and `infra/keria-config/witnesses/*` hardcode `http://witnesses:564x`;
- the schema OOBI — set `PUBLIC_HOST` to the same reachable host.

Then: **Connect** tab → add the issuer OOBI as a connection in Veridian → paste
your wallet's OOBI back → *Connect Veridian & continue*; Issue/Present/Attest
prompt on the phone. Until that infra is in place, use demo mode.

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
