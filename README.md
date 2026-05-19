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

- issuance & presentation: `createExchangeMessage` for `/ipex/grant` and
  `/ipex/apply` with `s` + **`oobiUrl`** in `exn.a`
  ([`KeriService.java#L739`](https://github.com/cardano-foundation/cip113-programmable-tokens-platform/blob/662e4fbc76756778b5e200965fa8605da71922cc/src/programmable-tokens-offchain-java/src/main/java/org/cardanofoundation/cip113/service/KeriService.java#L739)).
  The wallet needs `oobiUrl` to resolve the ACDC schema when you **open** the
  notification — a plain `ipex().grant()` delivers the notification but the
  wallet errors on open.
- OOBI resolve: strip `?name=`, resolve, then best-effort `contacts().update`
  (a `contacts().update` failure must not abort the connection)
- attestation: `/remotesign/ixn/req` (needs `cf-idw-keria`,
  `REMOTE_SIGNING=true`, already set)

This message layer is verified by the headless **demo** e2e (issue → present →
attest, 3/3) against the same KERIA. Demo mode fully demonstrates every flow
with no phone.

### Two schema hosts (important)

Schema OOBIs are resolved server-side by a KERIA agent — and the demo holder
and a real Veridian wallet may use **different** KERIAs:

- **`SCHEMA_RESOLVE_HOST`** (default `http://app:3001`) — reachable by *this*
  stack's KERIA; used for issuer bootstrap and the demo holder
  (`/api/config`). Keep the docker service name.
- **`SCHEMA_OOBI_HOST`** (default `http://app:3001`) — embedded as
  `exn.a.oobiUrl` (base, no SAID — the wallet appends `/<schemaSaid>`) and the
  issuer loc-scheme. **This is resolved by the wallet's KERIA agent, not the
  Veridian app.** In the standard setup the Veridian app connects to *this*
  stack's KERIA (`localhost:3901`), so the resolver is the `keria` container
  itself — the URL must be the docker service name `http://app:3001`, **not**
  `localhost` (inside keria, `localhost` is keria, not the app). Only override
  if the wallet uses a *different* KERIA on another network
  (`http://host.docker.internal:3001` / `http://<LAN-IP>:3001`).

Both paths the wallet uses (inline `oobiUrl` and the indexer/loc-scheme
lookup) then resolve to `${SCHEMA_OOBI_HOST}/oobi/<schemaSaid>`, fetched by
the wallet's KERIA.

### Networking model (what must be reachable from where)

OOBIs are resolved by **KERIA agents server-side**, not by the phone. When the
Veridian app points its KERIA connection at this stack, the wallet's KERIA *is*
the `keria` container — so every OOBI (schema, issuer, wallet) must be reachable
**from the `keria` container's network**, i.e. the docker service names. These
are the defaults and must **not** be changed to a LAN IP:

- schema OOBI → `SCHEMA_OOBI_HOST=http://app:3001` (embedded as `oobiUrl` in
  grant/apply; the wallet's KERIA fetches it)
- issuer OOBI → `http://keria:3902/...` (what `oobis().get` returns; the
  wallet's KERIA resolves it)
- witnesses → `http://witnesses:564x` (vendored config; KERIA-internal)

The **only** thing that must be reachable from the phone is the KERIA
**connection URL `:3901`** and **boot URL `:3903`** the Veridian app's signify
client connects to. So, for a real phone:

1. Run the stack; ensure ports `3901`/`3903` are reachable from the phone
   (same LAN — use the host's LAN IP, or a tunnel). Leave `SCHEMA_OOBI_HOST`
   and the vendored `keria-config` at their docker-internal defaults.
2. In the Veridian app set the KERIA connection URL to `http://<LAN-IP>:3901`
   and boot URL to `http://<LAN-IP>:3903`.
3. **Connect** tab → add the issuer OOBI as a connection in Veridian → paste
   your wallet's OOBI back → *Connect Veridian & continue*; Issue / Present /
   Attest then prompt on the phone.

The KERI message layer is verified by the headless **demo** e2e (3/3) on this
same KERIA; demo mode needs no phone.

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
