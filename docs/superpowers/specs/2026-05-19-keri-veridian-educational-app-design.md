# KERI + Veridian Educational App — Design Spec

**Date:** 2026-05-19
**Status:** Approved (pending written-spec review)

## 1. Purpose

An educational TypeScript application that teaches how to use **KERI** (Key Event
Receipt Infrastructure) and **ACDC** credentials, both **with a real Veridian
wallet** and **without one** (a browser-held "demo" identity). It demonstrates
the three core credential operations end to end and narrates every step:

1. **Issue** an ACDC credential from a backend issuer service.
2. **Request a credential presentation** from the holder (verifier-driven IPEX).
3. **Request an attestation** — the holder anchors a data SAID into its own KEL.

Every flow renders an **annotated step log**: each `signify-ts` call, the KERI
message exchanged, the raw JSON return, and a plain-language explanation of what
just happened and what to notice. The teaching goal is that a reader understands
*why* each step exists, not just that it works.

The reference implementation `/Users/thkammer/Documents/dev/cardano/typescript/cf-reeve-document-demo`
is used only for its KERI patterns (signify-ts usage, IPEX assembly, the
Demo/Veridian identity split, attestation anchoring). Its Cardano, IPFS, PDF, and
encryption layers are explicitly out of scope.

## 2. Goals & non-goals

**Goals**

- Self-contained `docker compose up` brings up all infrastructure plus the app.
- Clean, easy-to-read TypeScript with small, single-purpose modules.
- Backend holds the issuer identity (fixes the reference's main production gap of
  bundling the issuer salt in the frontend).
- Real witnesses (`toad > 0`), self-hosted ACDC schema.
- Maximal compatibility with a real Veridian mobile wallet via OOBI/QR pairing.

**Non-goals (YAGNI)**

- No Cardano, IPFS, PDF, or document-encryption features.
- No `polaris-web` / browser-extension Veridian connector (OOBI/QR companion only).
- No multi-tenant accounts, persistence of user history, or auth system.
- No production hardening beyond documenting known gaps. This is a teaching tool.
- No use of Veridian's `cred-issuance` server as a black box (we teach the
  backend-issuer ourselves).

## 3. Architecture (Approach A)

A three-agent model on one local KERIA:

- **Issuer/verifier agent** — runs in the **backend** (Express + signify-ts).
  Holds the issuer salt server-side. Issues credentials, runs verifier-side IPEX
  for presentation, and verifies attestations against the holder's key state.
- **Holder agent (demo mode)** — runs in the **browser** (signify-ts). A fresh
  salted agent created on the local KERIA. This is the "demo KERI login": the
  client holds its own keys, which is the central KERI lesson.
- **Companion agent (Veridian mode)** — runs in the **browser**. Pairs with a
  real Veridian mobile wallet via OOBI/QR. The actual holder keys live on the
  phone; the companion relays IPEX and remote-signing exchanges.

```
Browser (React + Vite + signify-ts)         Backend (Express + signify-ts)
  ├── Demo: holder agent  ───────┐            ├── Issuer agent (salt server-side)
  └── Veridian: companion agent ─┤            └── Verifier (same agent)
                                 │                     │
                                 ▼                     ▼
                         ┌──────────── KERIA (cf-idw-keria) ───────────┐
                         │  REMOTE_SIGNING, ALLOW_INTRODUCTIONS, CORS   │
                         └───────────────┬─────────────────────────────┘
                                         ▼
                              Witnesses (weboftrust/keri, kli witness demo)

Real Veridian wallet (mobile, external) ──OOBI/QR──> companion agent
```

## 4. Docker-compose topology

Three services on one Docker network. Infra is adopted from the official
`cardano-foundation/veridian-wallet` compose for maximum real-wallet
compatibility; the app layer is ours.

### 4.1 `keria`

- Image: CF-customized `ghcr.io/cardano-foundation/cf-identity-wallet/cf-idw-keria`,
  **pinned to one exact tag** recorded in `docker-compose.yaml` with a comment
  explaining it is an upstream dev tag and how to bump it (check the upstream
  compose `main` branch). The tag pinned at authoring time (from upstream
  `docker-compose.yaml`) is:
  `1.2.0-fix-VT20-2191-Un-ordered-exchange-queries-pagination-is-not-reliable-re-orders-a-a1cbe1f`.
  If that tag is ever unavailable from the registry, the README's "bump KERIA
  image" note explains pulling a current tag from upstream.
- Env: `KERI_AGENT_CORS=true`, `ALLOW_INTRODUCTIONS=true`, `REMOTE_SIGNING=true`.
  `REMOTE_SIGNING` is required for the Veridian attestation (`/remotesign`) flow;
  `ALLOW_INTRODUCTIONS` is required for OOBI pairing; `CORS` for browser agents.
- Mounts `./infra/keria-config/config.json` → `/keria/scripts/keri/cf/backer-oobis.json`.
- Entrypoint: `keria start --config-file backer-oobis --config-dir ./scripts --loglevel INFO`.
- Ports: `3901` (agent), `3902` (admin), `3903` (boot).
- Volume: `keria-data:/usr/local/var/keri`.

### 4.2 `witnesses`

- Image: `weboftrust/keri:1.1.26`.
- Entrypoint `kli`, command `witness demo` (the standard demo witness network;
  deterministic demo AIDs; insecure-by-design, called out as a teaching note).
- Mounts `./infra/keria-config/witnesses` → `/keripy/scripts/keri/cf/main`.
- Ports: `5642`–`5647`.

### 4.3 `app`

- Single image built from this repo. Runs the Express server which:
  - serves the REST API (`/api/...`),
  - serves the SAIDified ACDC schema at `GET /oobi/:said` (the standalone
    schema-server folds into the backend — "an OOBI is just an HTTP route" is a
    lesson),
  - serves the built React/Vite static bundle for everything else.
- Replaces upstream `cred-issuance` + `cred-issuance-ui`.
- Env (see §10): KERIA URLs (internal docker hostnames), issuer salt, issuer/
  registry names, `PUBLIC_HOST`, `PORT`.
- Port: `3001` (configurable).
- Volume: `app-data:/app/data` (issuer salt persistence if generated at runtime;
  see §10).

### 4.4 Startup ordering

`app.depends_on: [keria]`, `keria.depends_on: [witnesses]`, each with a
healthcheck. The backend additionally retries issuer bootstrap with backoff
until KERIA's boot endpoint answers, so a slow KERIA start does not crash the app.

### 4.5 Vendored upstream config

`/infra/keria-config/config.json` and `/infra/keria-config/witnesses/*` are
copied verbatim from `cardano-foundation/veridian-wallet` (Apache-2.0), with a
`NOTICE` file recording the source commit and license. A short script
(`infra/update-keria-config.sh`) documents how to re-pull them.

## 5. Custom ACDC schema

One simple, self-hosted schema, `KeriDemoCredential`:

```jsonc
{
  "$id": "<computed SAID>",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "KeriDemoCredential",
  "description": "Educational demo credential",
  "type": "object",
  "credentialType": "KeriDemoCredential",
  "properties": {
    "v": { "type": "string" },
    "d": { "type": "string" },
    "i": { "type": "string" },
    "ri": { "type": "string" },
    "s": { "type": "string" },
    "a": {
      "type": "object",
      "properties": {
        "i":     { "type": "string" },          // holder AID
        "dt":    { "type": "string" },          // issuance datetime
        "name":  { "type": "string" },
        "email": { "type": "string" },
        "role":  { "type": "string" }
      },
      "required": ["i", "dt", "name", "email", "role"],
      "additionalProperties": false
    }
  },
  "required": ["v", "d", "i", "ri", "s", "a"],
  "additionalProperties": false
}
```

- A build step (`infra/schema/saidify-schema.ts`, run at image build and
  available as an npm script) computes the schema SAID with signify-ts `Saider`,
  writes it into `$id`, and emits the final
  `infra/schema/keri-demo-credential.schema.json`.
- The backend loads this file, derives `SCHEMA_SAID`, and serves it at
  `GET /oobi/:said` (returns the schema JSON with
  `Content-Type: application/schema+json`).
- The schema SAID and OOBI URL are embedded in the IPEX grant `data` payload so
  the holder/Veridian can resolve and validate the schema before admitting
  (same technique as the reference's `buildGrantExchange`).

## 6. Backend (Express + signify-ts)

Small, single-purpose modules under `/backend/src`:

- `keria/client.ts` — `bootIssuerClient()`: `await ready()`, construct
  `SignifyClient(KERIA_URL, ISSUER_SALT, Tier.low, KERIA_BOOT_URL)`, then
  `boot()` + `connect()` wrapped in `withTimeout`. Idempotent (reconnect if
  already booted).
- `keria/issuer.ts` —
  - `ensureIssuer()`: list identifiers; if `ISSUER_NAME` missing, create it
    **with witnesses** (`wits: [...witnessAids]`, `toad`), wait the op, add the
    `agent` end role; return `{ aid, oobi }` (oobi from
    `client.oobis().get(ISSUER_NAME, "agent")`). The witness AIDs and `toad`
    come from `keri/witnesses.ts`, a small module holding the demo witness
    network's well-known AIDs (the `kli witness demo` set used by the vendored
    `keria-config`), and are surfaced via `/api/config` for the frontend.
  - `ensureRegistry()`: list registries; create if missing
    (`registries().create({ name, registryName, noBackers: true })`), wait op;
    return `registrySaid`. `noBackers: true` is used for simplicity and is
    flagged as a documented teaching gap.
- `keri/schema.ts` — load schema JSON, expose `SCHEMA_SAID` / `SCHEMA_OOBI`
  (built from `PUBLIC_HOST`), and `resolveSchema(client)` which calls
  `client.oobis().resolve(SCHEMA_OOBI, "schema-"+SCHEMA_SAID)` on startup.
- `keri/ipexGrant.ts` — `issueAndGrant(holderAid, attrs)`:
  `client.credentials().issue(ISSUER_NAME, { i, ri, s, a })`, wait op; build the
  IPEX grant embedding `acdc`/`iss`/`anc` + schema SAID/OOBI in `data` (port the
  reference's `buildGrantExchange` + anchor-attachment extraction);
  `client.ipex().submitGrant(...)` to `[holderAid]`, wait op; return
  `{ credentialSaid, grantExn }`.
- `keri/present.ts` — `requestPresentation(holderAid, schemaSaid)`:
  `ipex().apply` → `submitApply` → wait `/exn/ipex/offer` notification →
  `ipex().agree` → `submitAgree` → wait `/exn/ipex/grant` → extract
  `exn.e.acdc.d` → `ipex().admit` → `submitAdmit`; then **verify**: schema SAID
  matches, issuer AID matches the configured issuer, issuance/registry present,
  holder key state resolves. Returns the received ACDC + a structured
  verification breakdown. Runs as a polled job (see §8). To avoid a race, the
  frontend starts its `/exn/ipex/apply` listener (`keri/offer.ts`) **before**
  calling `present/start`; the polled job tolerates the holder's offer arriving
  at any point within the timeout window.
- `keri/attest.ts` —
  - `createAttestationRequest(holderAid)`: returns a payload to attest
    (`{ i: holderAid, d: "", purpose, nonce, dt }`; `i` then `d` ordered first,
    per the reference's SAID-stability requirement).
  - `verifyAttestation(holderAid, said, seq)`: `client.keyStates().query` +
    `keyStates().get(holderAid)`; confirm the KEL advanced and the anchored seal
    at `seq` has `d == said`; return a structured breakdown.
- `keri/saidify.ts` — thin wrapper over signify-ts `Saider.saidify` (ported).
- `keri/cesr.ts` + `keri/ipexAttachments.ts` — anchor-attachment extraction and
  CESR helpers needed by the grant builder (ported, trimmed to what issuance
  needs).
- `http/routes.ts` — Express routes (§7). Each handler builds a `StepLog[]`
  (§8) and returns it alongside results.
- `http/jobs.ts` — in-memory job registry for the polled presentation flow
  (`Map<jobId, { status, steps, result, error }>`); jobs expire after a TTL.
- `app.ts` / `server.ts` — wiring, schema OOBI route, static frontend serving,
  startup bootstrap (`ensureIssuer` → `ensureRegistry` → `resolveSchema`) with
  retry/backoff, healthcheck route `GET /healthz`.

Concurrency note: signify-ts clients are not safe for unbounded parallel
operations. Issuer/verifier KERI calls are serialized through a single async
queue in `keria/client.ts`; the spec calls this out so the implementation does
not interleave operations on the shared issuer client.

## 7. REST API

All KERI-touching responses include `steps: StepLog[]`.

- `GET  /api/config` → `{ keriaUrl, keriaBootUrl, schemaSaid, schemaOobi,
  issuerAid, issuerOobi, witnessAids, toad }` — everything the browser needs to
  boot its agent and resolve OOBIs.
- `GET  /api/issuer/info` → `{ issuerAid, issuerOobi, registrySaid }`.
- `POST /api/issuer/issue` `{ holderAid, name, email, role }` →
  `{ credentialSaid, grantExn, steps }`.
- `POST /api/verifier/present/start` `{ holderAid }` → `{ jobId, steps }`.
- `GET  /api/verifier/present/:jobId` →
  `{ status: "pending"|"done"|"error", credential?, verification?, error?, steps }`.
- `POST /api/verifier/attest/request` `{ holderAid }` →
  `{ payload, steps }` (payload to be anchored by the holder).
- `POST /api/verifier/attest/verify` `{ holderAid, said, seq }` →
  `{ verification, steps }`.
- `GET  /oobi/:said` → schema JSON (the self-hosted schema OOBI).
- `GET  /healthz` → `200` when issuer bootstrap completed.

## 8. Educational step log

The single most important teaching mechanism.

```ts
interface StepLog {
  ts: number;                 // ordering across backend + client
  source: "backend" | "client";
  flow: "connect" | "issue" | "present" | "attest";
  title: string;              // e.g. "Issuer issues ACDC"
  call?: string;              // e.g. "client.credentials().issue(...)"
  keriMessage?: string;       // e.g. "/ipex/grant", "ixn", "qry"
  explanation: string;        // plain-language: what happened + what to notice
  request?: unknown;          // serialisable args (secrets redacted)
  response?: unknown;         // raw JSON return (the thing learners inspect)
}
```

- Backend handlers append steps as they run and return them in the response;
  the polled presentation job accumulates steps across the apply→admit cycle.
- The frontend records its own `client` steps for browser-side signify calls.
- `components/StepLog.tsx` merges both by `ts`, renders an ordered list with
  the title, the `call`, a badge for `keriMessage`, the `explanation`, and a
  collapsible pretty-printed `request`/`response`.
- Explanations are authored content (not generated), curated to teach KERI
  concepts (AIDs, OOBIs, KELs, registries, IPEX grant/admit/apply/offer/agree,
  SAIDs, witnesses, `toad`).

## 9. Frontend (React + Vite + signify-ts)

Under `/frontend/src`:

- `keri/holderClient.ts` (demo) — boot a fresh browser-salted agent on KERIA;
  create the holder AID **with witnesses** (`wits`, `toad` from `/api/config`);
  add agent end role; resolve issuer OOBI + schema OOBI; return `{ client, aid }`.
- `keri/companion.ts` (Veridian) — boot the companion agent; `getCompanionOobi()`
  (rendered as a QR via `qrcode.react`); `resolveVeridianOobi(oobi)` to pair
  with the real Veridian wallet (ported pairing logic).
- `keri/ipexAdmit.ts` — demo holder: wait `/exn/ipex/grant`, `ipex().admit`,
  `submitAdmit`, mark/delete the notification (ported). Veridian: admit happens
  on the phone; the companion observes/relays.
- `keri/offer.ts` — demo holder responds to the verifier's `apply`: wait
  `/exn/ipex/apply`, find the matching credential, `ipex().offer` →
  `submitOffer`, wait `agree`, `ipex().grant` → `submitGrant`. Veridian: on phone.
- `keri/attest.ts` — demo: `saidify(payload)` then
  `identifiers().interact(name, { d: said })`, wait op, read key-state `s`.
  Veridian: `remotesignAnchor(...)` — send `/remotesign/ixn/req` exn, wait
  `/remotesign/ixn/ref`, query Veridian key state for `s` (ported). Returns
  `{ said, seq }`.
- `keri/notifications.ts` — `waitForNotification(routes, timeoutMs)` polling
  helper (ported).
- `state/session.ts` — zustand store: `mode`, `client`, `aid`, connection
  status, `steps[]`.
- `lib/api.ts` — typed fetch wrapper for the REST API; merges returned
  `steps[]` into the store.
- `components/StepLog.tsx`, plus reused shadcn-style primitives (card, button,
  badge, alert, tabs, dialog) and Tailwind, ported/trimmed from the reference.
- Pages (`react-router-dom`):
  - **Connect** — Demo (one click → boot holder, show AID) or Veridian (show
    companion OOBI QR; input to paste the Veridian OOBI; pair). Explains AIDs/
    OOBIs.
  - **Issue** — form (name/email/role) → `POST /api/issuer/issue` → show grant
    exn → demo auto-admits (Veridian: prompt to admit on phone) → show the held
    ACDC, annotated.
  - **Present** — `present/start` then poll `present/:jobId`; holder offers
    (demo in-browser; Veridian on phone); render the apply→offer→agree→admit
    round-trip and the verification breakdown, each check explained.
  - **Attest** — `attest/request` → holder anchors SAID (demo in-browser;
    Veridian on phone) → `attest/verify` → render SAID, KEL sequence, and the
    verification breakdown, explained.

## 10. Configuration

`.env.example` (committed) documents every variable:

| Var | Used by | Meaning |
|---|---|---|
| `KERIA_URL` | backend | `http://keria:3901` (in-docker) |
| `KERIA_BOOT_URL` | backend | `http://keria:3903` |
| `ISSUER_SALT` | backend | 21-char salt; if unset, generated once and persisted to `/app/data/issuer.salt` |
| `ISSUER_NAME` | backend | stable issuer identifier name |
| `ISSUER_REGISTRY` | backend | stable registry name |
| `PUBLIC_HOST` | backend | host:port reachable by browser **and**, for real-Veridian pairing, by the phone on the LAN (e.g. `http://192.168.x.y:3001`); used to build the schema/issuer OOBI URLs |
| `PORT` | backend | default `3001` |
| `VITE_KERIA_URL` | frontend | **dev fallback only** — browser-reachable KERIA agent URL (`http://localhost:3901`); at runtime the frontend prefers `/api/config` |
| `VITE_KERIA_BOOT_URL` | frontend | dev fallback only (`http://localhost:3903`) |
| `VITE_API_BASE` | frontend | default same-origin |

The browser reaches KERIA on `localhost:3901/3903` (host-published ports); the
backend reaches it on the docker network (`keria:3901/3903`). `/api/config`
returns the browser-facing URLs so the frontend never hardcodes them.

## 11. Error handling

- Every `operations().wait` and notification poll is wrapped with a timeout
  (ported `withTimeout`); on timeout the step log shows a readable error plus a
  likely-cause hint (e.g. "holder has not admitted the grant yet — is the demo
  holder connected / has the Veridian user approved on their phone?").
- The polled presentation job records partial steps so a timeout still shows how
  far the IPEX cycle progressed.
- Compose healthchecks + backend bootstrap retry/backoff prevent crash-on-start
  when KERIA is slow.
- Frontend surfaces API and signify errors inline in the relevant page and the
  step log, never as silent failures.

## 12. Testing

- **TDD for pure logic** (Vitest): schema SAID computation, `saidify` wrapper,
  IPEX grant/embeds assembly, anchor-attachment extraction, attestation
  verification (seal `d == said` at `seq`), step-log merge/order. These are
  written test-first.
- **Contract tests**: Express routes with the signify layer mocked, asserting
  response shapes and that `steps[]` is populated.
- **One integration smoke** (documented, scripted): `docker compose up` →
  bootstrap → issue → present → attest in **demo mode** (no phone needed),
  asserting a credential is held and the attestation verifies. Veridian-mode
  manual test steps are documented in the README (requires a phone + Veridian
  app).

## 13. Repo layout

```
/
  docker-compose.yml
  .env.example
  README.md
  NOTICE                        # attribution for vendored keria-config
  /infra
    /keria-config               # vendored from veridian-wallet (Apache-2.0)
      config.json
      /witnesses/...
    /schema
      keri-demo-credential.schema.json
      saidify-schema.ts
    update-keria-config.sh
  /shared                       # TS types shared by backend + frontend
    src/types.ts                # StepLog, API DTOs, config DTO
  /backend
    Dockerfile
    src/{app.ts,server.ts}
    src/keria/{client.ts,issuer.ts}
    src/keri/{schema.ts,ipexGrant.ts,present.ts,attest.ts,saidify.ts,cesr.ts,ipexAttachments.ts,notifications.ts}
    src/http/{routes.ts,jobs.ts}
    test/...
  /frontend
    src/keri/{holderClient.ts,companion.ts,ipexAdmit.ts,offer.ts,attest.ts,notifications.ts}
    src/state/session.ts
    src/lib/api.ts
    src/components/{StepLog.tsx,ui/...}
    src/routes/{Connect.tsx,Issue.tsx,Present.tsx,Attest.tsx}
    src/main.tsx
    test/...
  /docs/superpowers/specs/2026-05-19-keri-veridian-educational-app-design.md
```

The `app` Dockerfile is multi-stage: build `shared` → build `frontend` (Vite)
→ build `backend` (tsc) → runtime image that runs the backend serving the
frontend `dist`.

## 14. Known constraints & documented teaching gaps

- Upstream `cf-idw-keria` image tag is a long dev tag and drifts; we pin one and
  document bumping it. If the pinned tag becomes unavailable, the README points
  to the upstream compose for a current tag.
- Witness demo network is insecure by design (deterministic keys) — stated in UI
  and README as a non-production teaching note.
- `noBackers: true` registry and salt-on-disk are documented gaps with the
  production-correct alternative noted.
- Real-Veridian attestation depends on the wallet honoring the `/remotesign`
  exchange route and on `REMOTE_SIGNING=true` KERIA (same dependency the
  reference relies on). If a Veridian build does not support it, demo mode still
  fully demonstrates attestation.
- A real Veridian phone must reach `PUBLIC_HOST` on the LAN to resolve the
  schema/issuer OOBIs; documented in the README with the `PUBLIC_HOST` setting.

## 15. Out of scope

Cardano anchoring, IPFS, PDF handling, document encryption, address book,
counter-signing, vLEI verification, `polaris-web`/extension connector,
persistence of user sessions/history, authn/z, and any production hardening
beyond documenting the gaps above.
