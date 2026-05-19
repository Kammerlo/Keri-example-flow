# KERI + Veridian Educational App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, educational TypeScript app that teaches KERI/ACDC credential issuance, presentation, and attestation — with a real Veridian wallet (OOBI/QR) and without (browser demo identity) — narrating every signify-ts call in an annotated step log, runnable via `docker compose up`.

**Architecture:** Three-agent model. A backend Express service holds the issuer/verifier signify-ts agent (issuer salt server-side). The browser runs the holder agent (demo mode) or a companion agent paired to a real Veridian wallet (Veridian mode). Infra (KERIA + demo witnesses) is adopted from the `cardano-foundation/veridian-wallet` docker-compose for real-wallet compatibility; the schema OOBI is self-hosted by the backend.

**Tech Stack:** TypeScript, signify-ts, Express, React + Vite, Tailwind, zustand, Vitest, Docker Compose, KERIA (`cf-idw-keria`), keripy demo witnesses.

**Reference (read-only, same machine):** `/Users/thkammer/Documents/dev/cardano/typescript/cf-reeve-document-demo` — KERI patterns are ported from here. Referred to below as `$REF`.

**Spec:** `docs/superpowers/specs/2026-05-19-keri-veridian-educational-app-design.md`.

---

## File Structure

```
/
  package.json                      # npm workspaces root
  tsconfig.base.json
  docker-compose.yml
  .env.example
  .gitignore
  README.md
  NOTICE                            # attribution for vendored keria-config
  infra/
    keria-config/config.json        # vendored from veridian-wallet (Apache-2.0)
    keria-config/witnesses/...       # vendored
    update-keria-config.sh
    schema/keri-demo-credential.schema.json   # generated (committed)
    schema/saidify-schema.ts                   # computes the schema SAID
  shared/
    package.json
    tsconfig.json
    src/types.ts                    # StepLog, API DTOs, ConfigDTO, witness constants
  backend/
    package.json
    tsconfig.json
    Dockerfile
    src/env.ts                      # env loading + validation
    src/keri/timeout.ts             # withTimeout (ported)
    src/keri/saidify.ts             # Saider wrapper (ported)
    src/keri/cesr.ts                # CESR parse/reduce (ported, pure)
    src/keri/notifications.ts       # waitForNotification/markAndDelete (ported)
    src/keri/witnesses.ts           # demo witness AIDs + toad
    src/keri/client.ts              # bootIssuerClient + serialized op queue
    src/keri/issuer.ts              # ensureIssuer / ensureRegistry / resolveSchema
    src/keri/grant.ts               # buildGrantExchange + issueAndGrant (ported)
    src/keri/present.ts             # verifier IPEX apply→admit + verify
    src/keri/attest.ts              # attestation request + KEL verify
    src/keri/oobi.ts                # resolveOobiOnClient (ported)
    src/step.ts                     # StepRecorder
    src/jobs.ts                     # in-memory job registry (presentation)
    src/routes.ts                   # Express routes
    src/server.ts                   # wiring + bootstrap + static serving
    test/...                        # Vitest specs
  frontend/
    package.json
    tsconfig.json
    index.html
    vite.config.ts
    tailwind.config.js
    postcss.config.js
    src/main.tsx
    src/index.css
    src/lib/cn.ts
    src/lib/api.ts
    src/keri/timeout.ts             # ported
    src/keri/saidify.ts             # ported
    src/keri/notifications.ts       # ported
    src/keri/client.ts              # bootClient (browser)
    src/keri/holder.ts              # demo holder bootstrap/connect
    src/keri/companion.ts           # Veridian companion + OOBI pairing
    src/keri/admit.ts               # admitGrantOnWallet (ported)
    src/keri/offer.ts               # respond to verifier apply (ported pattern)
    src/keri/attest.ts              # demo interact / veridian remotesign (ported)
    src/state/session.ts            # zustand store + step buffer
    src/components/StepLog.tsx
    src/components/ui/{button,card,badge,alert,tabs}.tsx
    src/routes/{Connect,Issue,Present,Attest}.tsx
    src/App.tsx
    test/...
```

---

## Conventions for this plan

- `$REF` = `/Users/thkammer/Documents/dev/cardano/typescript/cf-reeve-document-demo`.
- "Copy verbatim then edit" tasks: the exact source is small and given in full in the step (no need to open `$REF`); edits are explicit line changes.
- Commit after every task with the message shown.
- Node 20+. Run all npm commands from repo root unless stated.
- Backend swaps the reference's `import.meta.env.VITE_X` for `process.env.X`; frontend keeps `import.meta.env.VITE_X`.

---

## Phase 0 — Monorepo scaffold

### Task 0.1: Root workspace + tooling

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
*.log
.env
backend/data/
.DS_Store
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "keri-example-flow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": ["shared", "backend", "frontend"],
  "scripts": {
    "build:shared": "npm run build -w shared",
    "build:frontend": "npm run build -w frontend",
    "build:backend": "npm run build -w backend",
    "build": "npm run build:shared && npm run build:frontend && npm run build:backend",
    "schema:saidify": "tsx infra/schema/saidify-schema.ts",
    "test": "npm run build:shared && npm run test -w shared && npm run test -w backend && npm run test -w frontend",
    "dev:backend": "npm run build:shared && npm run dev -w backend",
    "dev:frontend": "npm run build:shared && npm run dev -w frontend"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "~5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Create `.env.example`**

```
# Backend (in-docker hostnames)
KERIA_URL=http://keria:3901
KERIA_BOOT_URL=http://keria:3903
ISSUER_NAME=keri-demo-issuer
ISSUER_REGISTRY=keri-demo-registry
# 21-char salt; leave blank to auto-generate & persist to backend/data/issuer.salt
ISSUER_SALT=
# Host:port reachable by the browser AND (for real Veridian) the phone on the LAN
PUBLIC_HOST=http://localhost:3001
PORT=3001

# Frontend dev fallbacks (runtime values come from /api/config)
VITE_KERIA_URL=http://localhost:3901
VITE_KERIA_BOOT_URL=http://localhost:3903
VITE_API_BASE=
```

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .env.example
git commit -m "chore: monorepo scaffold (workspaces, tsconfig, env example)"
```

---

## Phase 1 — Shared types

### Task 1.1: Shared package

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/types.ts`
- Test: `shared/test/types.test.ts`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "@keri-demo/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/types.js",
  "types": "dist/types.d.ts",
  "exports": {
    ".": { "types": "./dist/types.d.ts", "import": "./dist/types.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

> **Why dist (not `src/types.ts`):** the backend runs compiled JS (`node dist/server.js`); Node resolves `@keri-demo/shared` via `exports`, so it must point at built JS, not a `.ts` source. Every consumer therefore requires `build:shared` to have run first — the root `build`/`test`/`dev:*` scripts (Task 0.1) enforce that ordering.

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing test `shared/test/types.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { WITNESSES, TOAD, witnessAids } from "../src/types";

describe("witness constants", () => {
  it("exposes the three keripy demo witnesses with CESR AIDs", () => {
    expect(WITNESSES).toHaveLength(3);
    for (const w of WITNESSES) {
      expect(w.aid).toMatch(/^B[A-Za-z0-9_-]{43}$/);
      expect(w.url).toMatch(/^http:\/\/witnesses:564[2-4]$/);
    }
  });
  it("toad is a 2-of-3 threshold", () => {
    expect(TOAD).toBe(2);
  });
  it("witnessAids() returns just the AID strings", () => {
    expect(witnessAids()).toEqual(WITNESSES.map((w) => w.aid));
  });
});
```

- [ ] **Step 4: Run test, verify it fails**

Run: `npm run test -w shared`
Expected: FAIL — `Cannot find module '../src/types'`.

- [ ] **Step 5: Create `shared/src/types.ts`**

```ts
// ─── Witness network (keripy `kli witness demo`, well-known deterministic AIDs) ───
export interface WitnessInfo {
  name: string;
  aid: string;
  url: string;
}

export const WITNESSES: WitnessInfo[] = [
  { name: "wan", aid: "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha", url: "http://witnesses:5642" },
  { name: "wil", aid: "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM", url: "http://witnesses:5643" },
  { name: "wes", aid: "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX", url: "http://witnesses:5644" },
];

export const TOAD = 2;

export function witnessAids(): string[] {
  return WITNESSES.map((w) => w.aid);
}

// ─── Annotated step log (core teaching mechanism) ───
export type FlowName = "connect" | "issue" | "present" | "attest";

export interface StepLog {
  ts: number;
  source: "backend" | "client";
  flow: FlowName;
  title: string;
  call?: string;
  keriMessage?: string;
  explanation: string;
  request?: unknown;
  response?: unknown;
  error?: string;
}

// ─── API DTOs ───
export interface ConfigDTO {
  keriaUrl: string;
  keriaBootUrl: string;
  schemaSaid: string;
  schemaOobi: string;
  issuerAid: string;
  issuerOobi: string;
  registrySaid: string;
  witnesses: WitnessInfo[];
  toad: number;
}

export interface IssueRequest {
  holderAid: string;
  holderOobi: string;
  name: string;
  email: string;
  role: string;
}
export interface IssueResponse {
  credentialSaid: string;
  grantExn: unknown;
  steps: StepLog[];
}

export interface PresentStartRequest {
  holderAid: string;
  holderOobi: string;
}
export interface PresentStartResponse {
  jobId: string;
  steps: StepLog[];
}
export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail: string;
}
export interface PresentStatusResponse {
  status: "pending" | "done" | "error";
  credential?: Record<string, unknown>;
  verification?: VerificationCheck[];
  error?: string;
  steps: StepLog[];
}

export interface AttestRequestBody {
  holderAid: string;
  holderOobi: string;
}
export interface AttestPayload {
  i: string;
  d: string;
  purpose: string;
  nonce: string;
  dt: string;
}
export interface AttestRequestResponse {
  payload: AttestPayload;
  steps: StepLog[];
}
export interface AttestVerifyRequest {
  holderAid: string;
  said: string;
  seq: string;
}
export interface AttestVerifyResponse {
  verification: VerificationCheck[];
  steps: StepLog[];
}
```

- [ ] **Step 6: Run test, verify it passes**

Run: `npm run test -w shared`
Expected: PASS (3 tests).

- [ ] **Step 7: Build shared to `dist` (all later backend/frontend tasks resolve `@keri-demo/shared` from built JS/d.ts)**

Run: `npm install && npm run build:shared`
Expected: `shared/dist/types.js` and `shared/dist/types.d.ts` exist.

- [ ] **Step 8: Commit**

```bash
git add shared package-lock.json
git commit -m "feat(shared): step-log, API DTOs, demo witness constants"
```

---

## Phase 2 — Infra: schema, vendored config, compose skeleton

### Task 2.1: ACDC schema + SAIDification (TDD)

**Files:**
- Create: `infra/schema/saidify-schema.ts`, `infra/schema/keri-demo-credential.schema.json` (generated, then committed)
- Test: `backend/test/schema.test.ts` (created later in Phase 3 once backend deps exist) — for now test the script output here.
- Test: `shared/test/schema.test.ts`

- [ ] **Step 1: Add signify-ts to root devDependencies for the saidify script**

Edit `package.json` → add to `devDependencies`: `"signify-ts": "^0.3.0"`. Then:

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Write the failing test `shared/test/schema.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(
  new URL("../../infra/schema/keri-demo-credential.schema.json", import.meta.url)
);

describe("KeriDemoCredential schema", () => {
  it("is generated and self-addressing", () => {
    expect(existsSync(schemaPath)).toBe(true);
    const s = JSON.parse(readFileSync(schemaPath, "utf8"));
    expect(s.$id).toMatch(/^E[A-Za-z0-9_-]{43}$/);
    expect(s.title).toBe("KeriDemoCredential");
    expect(s.properties.a.properties).toHaveProperty("name");
    expect(s.properties.a.properties).toHaveProperty("email");
    expect(s.properties.a.properties).toHaveProperty("role");
    expect(s.properties.a.required).toEqual(["i", "dt", "name", "email", "role"]);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npm run test -w shared`
Expected: FAIL — schema file does not exist.

- [ ] **Step 4: Create `infra/schema/saidify-schema.ts`**

```ts
// Computes the ACDC schema SAID (BLAKE3, label "$id") and writes the
// final self-addressing schema JSON. Run: `npm run schema:saidify`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Saider, ready } from "signify-ts";

const OUT = fileURLToPath(
  new URL("./keri-demo-credential.schema.json", import.meta.url)
);

const schema: Record<string, unknown> = {
  $id: "",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "KeriDemoCredential",
  description: "Educational demo credential issued over IPEX",
  type: "object",
  credentialType: "KeriDemoCredential",
  properties: {
    v: { type: "string" },
    d: { type: "string" },
    i: { type: "string" },
    ri: { type: "string" },
    s: { type: "string" },
    a: {
      type: "object",
      properties: {
        i: { type: "string" },
        dt: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string" },
      },
      required: ["i", "dt", "name", "email", "role"],
      additionalProperties: false,
    },
  },
  required: ["v", "d", "i", "ri", "s", "a"],
  additionalProperties: false,
};

async function main(): Promise<void> {
  await ready();
  // label "$id": ACDC/JSON-Schema SAIDs live in the `$id` field.
  const [, sad] = (Saider as unknown as {
    saidify: (
      sad: Record<string, unknown>,
      code?: string,
      kind?: string,
      label?: string
    ) => [unknown, Record<string, unknown>];
  }).saidify(schema, undefined, undefined, "$id");

  writeFileSync(OUT, JSON.stringify(sad, null, 2) + "\n");
  console.log(`schema SAID: ${sad.$id as string}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Generate the schema**

Run: `npm run schema:saidify`
Expected: prints `schema SAID: E...` and writes `infra/schema/keri-demo-credential.schema.json`.

- [ ] **Step 6: Run test, verify it passes**

Run: `npm run test -w shared`
Expected: PASS.

- [ ] **Step 7: Commit (schema JSON is committed so the OOBI is stable)**

```bash
git add infra/schema package.json package-lock.json shared/test/schema.test.ts
git commit -m "feat(infra): SAIDified KeriDemoCredential ACDC schema + generator"
```

### Task 2.2: Vendor KERIA/witness config from veridian-wallet

**Files:**
- Create: `infra/keria-config/config.json`, `infra/keria-config/witnesses/` (vendored), `infra/update-keria-config.sh`, `NOTICE`

- [ ] **Step 1: Create `infra/update-keria-config.sh`**

```bash
#!/usr/bin/env bash
# Re-pulls KERIA + witness config from cardano-foundation/veridian-wallet.
# These files configure the demo witness network and KERIA backer OOBIs.
set -euo pipefail
REF="https://raw.githubusercontent.com/cardano-foundation/veridian-wallet/main"
DEST="$(cd "$(dirname "$0")" && pwd)/keria-config"
mkdir -p "$DEST/witnesses"
curl -fsSL "$REF/keria-config/config.json" -o "$DEST/config.json"
echo "Pulled keria-config/config.json"
echo "NOTE: also copy keria-config/witnesses/* from the upstream repo tree."
echo "Upstream: https://github.com/cardano-foundation/veridian-wallet/tree/main/keria-config"
```

- [ ] **Step 2: Fetch the upstream config**

Run:
```bash
chmod +x infra/update-keria-config.sh && ./infra/update-keria-config.sh
```
Expected: writes `infra/keria-config/config.json`. If the upstream path 404s, fetch the current path from the upstream `docker-compose.yaml` volume mapping (`./keria-config/...`) and adjust the script URL accordingly, then re-run.

- [ ] **Step 3: Mirror the witnesses dir**

Run:
```bash
git clone --depth 1 https://github.com/cardano-foundation/veridian-wallet /tmp/vw \
 && cp -R /tmp/vw/keria-config/witnesses infra/keria-config/ \
 && rm -rf /tmp/vw
```
Expected: `infra/keria-config/witnesses/` populated. (If the upstream layout differs, copy whatever `keria-config/` subtree the upstream `docker-compose.yaml` mounts into `keria` and `witnesses`.)

- [ ] **Step 4: Create `NOTICE`**

```
This project vendors configuration from cardano-foundation/veridian-wallet
(https://github.com/cardano-foundation/veridian-wallet), licensed Apache-2.0.

Vendored paths:
  infra/keria-config/config.json
  infra/keria-config/witnesses/*

These are the KERIA backer-OOBI config and the keripy demo witness
configuration, used unmodified for local-development infrastructure only.
Re-pull with infra/update-keria-config.sh.
```

- [ ] **Step 5: Commit**

```bash
git add infra/keria-config infra/update-keria-config.sh NOTICE
git commit -m "chore(infra): vendor keria-config + witnesses from veridian-wallet (Apache-2.0)"
```

---

## Phase 3 — Backend KERI primitives

### Task 3.1: Backend package + env

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/src/env.ts`
- Test: `backend/test/env.test.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "@keri-demo/backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@keri-demo/shared": "*",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "signify-ts": "^0.3.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "~5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install**

Run: `npm install`
Expected: workspace deps resolve.

- [ ] **Step 4: Write failing test `backend/test/env.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env";

describe("loadEnv", () => {
  it("returns defaults and the configured port", () => {
    const env = loadEnv({
      KERIA_URL: "http://keria:3901",
      KERIA_BOOT_URL: "http://keria:3903",
      PUBLIC_HOST: "http://localhost:3001",
      PORT: "3001",
    });
    expect(env.keriaUrl).toBe("http://keria:3901");
    expect(env.issuerName).toBe("keri-demo-issuer");
    expect(env.port).toBe(3001);
  });
  it("throws when KERIA_URL is missing", () => {
    expect(() => loadEnv({})).toThrow(/KERIA_URL/);
  });
});
```

- [ ] **Step 5: Run test, verify it fails**

Run: `npm run test -w backend`
Expected: FAIL — `Cannot find module '../src/env'`.

- [ ] **Step 6: Create `backend/src/env.ts`**

```ts
export interface Env {
  keriaUrl: string;
  keriaBootUrl: string;
  issuerName: string;
  issuerRegistry: string;
  issuerSalt: string | null;
  publicHost: string;
  port: number;
}

export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const req = (k: string): string => {
    const v = src[k];
    if (!v) throw new Error(`Missing required env var: ${k}`);
    return v;
  };
  return {
    keriaUrl: req("KERIA_URL"),
    keriaBootUrl: req("KERIA_BOOT_URL"),
    issuerName: src.ISSUER_NAME || "keri-demo-issuer",
    issuerRegistry: src.ISSUER_REGISTRY || "keri-demo-registry",
    issuerSalt: src.ISSUER_SALT && src.ISSUER_SALT.length > 0 ? src.ISSUER_SALT : null,
    publicHost: src.PUBLIC_HOST || "http://localhost:3001",
    port: Number(src.PORT || "3001"),
  };
}
```

- [ ] **Step 7: Run test, verify it passes**

Run: `npm run test -w backend`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/test/env.test.ts backend/src/env.ts package-lock.json
git commit -m "feat(backend): package scaffold + env loader (TDD)"
```

### Task 3.2: Port pure CESR helpers (TDD)

**Files:**
- Create: `backend/src/keri/cesr.ts`
- Test: `backend/test/cesr.test.ts`

- [ ] **Step 1: Write failing test `backend/test/cesr.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseCesrData, makeCesrStream, reduceCesrChain } from "../src/keri/cesr";

const vcp = { v: "ACDC", t: "vcp", i: "Ereg" };
const iss = { v: "ACDC", t: "iss", i: "Ecred" };
const acdc = { v: "ACDC", d: "Ecred", i: "Eiss", s: "Eschema", a: { x: 1 } };
const ixn = { v: "KERI", t: "ixn", i: "Eaid" };

const stream =
  JSON.stringify(vcp) + "-ATC1" +
  JSON.stringify(iss) + "-ATC2" +
  JSON.stringify(ixn) + "-ATC3" +
  JSON.stringify(acdc);

describe("cesr", () => {
  it("parseCesrData splits events and trailing attachments", () => {
    const parsed = parseCesrData(stream);
    expect(parsed).toHaveLength(4);
    expect(parsed[0].event.t).toBe("vcp");
    expect(parsed[0].atc).toBe("-ATC1");
    expect(parsed[3].event.d).toBe("Ecred");
    expect(parsed[3].atc).toBe("");
  });
  it("makeCesrStream round-trips events+atc", () => {
    expect(makeCesrStream([vcp], ["-ATC1"])).toBe(JSON.stringify(vcp) + "-ATC1");
  });
  it("reduceCesrChain keeps only vcp, iss, acdc and drops ixn", () => {
    const reduced = parseCesrData(reduceCesrChain(stream));
    expect(reduced.map((e) => e.event.t ?? "acdc")).toEqual(["vcp", "iss", "acdc"]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/keri/cesr.ts` (verbatim port of `$REF/src/lib/keri/cesr.ts`)**

```ts
export interface CesrEntry {
  event: Record<string, unknown>;
  atc: string;
}

export function parseCesrData(cesrData: string): CesrEntry[] {
  const result: CesrEntry[] = [];
  let index = 0;
  while (index < cesrData.length) {
    if (cesrData[index] !== "{") {
      index++;
      continue;
    }
    let braceCount = 0;
    let jsonEnd = index;
    for (let i = index; i < cesrData.length; i++) {
      const ch = cesrData[i];
      if (ch === "{") braceCount++;
      else if (ch === "}") {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    const jsonEvent = cesrData.slice(index, jsonEnd);
    let attachmentEnd = cesrData.length;
    for (let i = jsonEnd; i < cesrData.length; i++) {
      if (cesrData[i] === "{") {
        attachmentEnd = i;
        break;
      }
    }
    const attachment = cesrData.slice(jsonEnd, attachmentEnd);
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(jsonEvent) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to parse CESR event: ${jsonEvent.slice(0, 80)}`);
    }
    result.push({ event, atc: attachment });
    index = attachmentEnd;
  }
  return result;
}

export function makeCesrStream(
  events: Record<string, unknown>[],
  attachments: string[]
): string {
  if (events.length !== attachments.length) {
    throw new Error(
      `Events and attachments lists must have the same size. Events: ${events.length}, Attachments: ${attachments.length}`
    );
  }
  let stream = "";
  for (let i = 0; i < events.length; i++) {
    stream += JSON.stringify(events[i]);
    if (attachments[i]) stream += attachments[i];
  }
  return stream;
}

export function reduceCesrChain(cesrData: string): string {
  const parsed = parseCesrData(cesrData);
  const vcpEvents: Record<string, unknown>[] = [];
  const vcpAtcs: string[] = [];
  const issEvents: Record<string, unknown>[] = [];
  const issAtcs: string[] = [];
  const acdcEvents: Record<string, unknown>[] = [];
  const acdcAtcs: string[] = [];
  for (const entry of parsed) {
    const { event, atc } = entry;
    const eventType = event["t"];
    if (eventType != null) {
      if (eventType === "vcp") {
        vcpEvents.push(event);
        vcpAtcs.push(atc);
      } else if (eventType === "iss") {
        issEvents.push(event);
        issAtcs.push(atc);
      }
    } else if (event["s"] != null && event["a"] != null && event["i"] != null) {
      acdcEvents.push(event);
      acdcAtcs.push("");
    }
  }
  return makeCesrStream(
    [...vcpEvents, ...issEvents, ...acdcEvents],
    [...vcpAtcs, ...issAtcs, ...acdcAtcs]
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w backend`
Expected: PASS (3 cesr tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/keri/cesr.ts backend/test/cesr.test.ts
git commit -m "feat(backend): port pure CESR parse/reduce helpers (TDD)"
```

### Task 3.3: Port timeout, saidify, notifications, oobi (no logic change)

**Files:**
- Create: `backend/src/keri/timeout.ts`, `backend/src/keri/saidify.ts`, `backend/src/keri/notifications.ts`, `backend/src/keri/oobi.ts`
- Test: `backend/test/saidify.test.ts`

- [ ] **Step 1: Create `backend/src/keri/timeout.ts`**

```ts
const DEFAULT_TIMEOUT_MS = 60_000;

export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`[keri] timeout (${ms}ms): ${label}`)),
        ms
      )
    ),
  ]);
}

export function waitOpts(ms = DEFAULT_TIMEOUT_MS): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(ms) };
}

export function nowKeriTimestamp(): string {
  return new Date().toISOString().replace("Z", "000+00:00");
}
```

- [ ] **Step 2: Create `backend/src/keri/saidify.ts` (port of `$REF/src/lib/keri/saidify.ts`)**

```ts
import { Saider } from "signify-ts";

export async function saidify(
  payload: Record<string, unknown>
): Promise<{ sad: Record<string, unknown>; said: string }> {
  const result = (Saider as unknown as {
    saidify: (p: Record<string, unknown>) => [unknown, Record<string, unknown>];
  }).saidify(payload);
  if (Array.isArray(result)) {
    const [saider, sad] = result as [Record<string, unknown>, Record<string, unknown>];
    const said =
      typeof saider === "string"
        ? saider
        : ((saider.qb64 ?? saider.said) as string);
    return { sad, said };
  }
  const r = result as { sad: Record<string, unknown>; said: string };
  return { sad: r.sad, said: r.said };
}
```

- [ ] **Step 3: Create `backend/src/keri/notifications.ts` (verbatim port of `$REF/src/lib/keri/notifications.ts`)**

```ts
import { type SignifyClient } from "signify-ts";

export interface Notification {
  i: string;
  dt: string;
  r: boolean;
  a: { r: string; d: string };
}

const POLL_INTERVAL_MS = 1_500;

export async function waitForNotification(
  client: SignifyClient,
  routes: string | string[],
  timeoutMs = 60_000
): Promise<Notification> {
  const routeList = Array.isArray(routes) ? routes : [routes];
  const normalised = routeList.flatMap((r) => {
    const withPrefix = r.startsWith("/exn/") ? r : `/exn${r}`;
    const withoutPrefix = r.startsWith("/exn/") ? r.slice(4) : r;
    return [r, withPrefix, withoutPrefix];
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { notes } = await client.notifications().list(0, 24);
    for (const note of notes as Notification[]) {
      if (!note.r && normalised.includes(note.a.r)) return note;
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  throw new Error(
    `[notifications] timeout waiting for routes: ${routeList.join(", ")}`
  );
}

export async function markAndDelete(
  client: SignifyClient,
  note: Notification
): Promise<void> {
  await client.notifications().mark(note.i);
  await client.notifications().delete(note.i);
}
```

- [ ] **Step 4: Create `backend/src/keri/oobi.ts` (port of `resolveOobiOnClient` from `$REF/src/lib/keri/ipex.ts:272-279`)**

```ts
import { type SignifyClient } from "signify-ts";
import { waitOpts } from "./timeout";

export async function resolveOobiOnClient(
  client: SignifyClient,
  oobi: string,
  alias = `peer-${Date.now()}`
): Promise<void> {
  const op = await client.oobis().resolve(oobi, alias);
  await client.operations().wait(op, waitOpts());
}
```

- [ ] **Step 5: Write failing test `backend/test/saidify.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { ready } from "signify-ts";
import { saidify } from "../src/keri/saidify";

describe("saidify", () => {
  beforeAll(async () => {
    await ready();
  });
  it("computes a deterministic Blake3 SAID and embeds it in d", async () => {
    const a = await saidify({ i: "Eaid", d: "", purpose: "demo", nonce: "abc" });
    const b = await saidify({ i: "Eaid", d: "", purpose: "demo", nonce: "abc" });
    expect(a.said).toMatch(/^E[A-Za-z0-9_-]{43}$/);
    expect(a.said).toBe(b.said);
    expect(a.sad.d).toBe(a.said);
  });
});
```

- [ ] **Step 6: Run test, verify it fails then passes**

Run: `npm run test -w backend`
Expected: FAIL first (module missing) — but module now exists, so it should PASS. If `ready()` is slow, allow up to 30s; Vitest default is fine. Expected final: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/keri/timeout.ts backend/src/keri/saidify.ts backend/src/keri/notifications.ts backend/src/keri/oobi.ts backend/test/saidify.test.ts
git commit -m "feat(backend): port timeout/saidify/notifications/oobi helpers"
```

### Task 3.4: Step recorder (TDD)

**Files:**
- Create: `backend/src/step.ts`
- Test: `backend/test/step.test.ts`

- [ ] **Step 1: Write failing test `backend/test/step.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { StepRecorder } from "../src/step";

describe("StepRecorder", () => {
  it("records ordered backend steps with explanation and raw response", () => {
    const rec = new StepRecorder("issue");
    rec.add({
      title: "Issue ACDC",
      call: "client.credentials().issue(...)",
      keriMessage: "iss",
      explanation: "The issuer creates the credential in its registry.",
      response: { d: "Ecred" },
    });
    const steps = rec.steps();
    expect(steps).toHaveLength(1);
    expect(steps[0].source).toBe("backend");
    expect(steps[0].flow).toBe("issue");
    expect(steps[0].ts).toBeTypeOf("number");
    expect(steps[0].response).toEqual({ d: "Ecred" });
  });
  it("captures errors via fail()", () => {
    const rec = new StepRecorder("present");
    rec.fail("Apply timed out", "Holder never offered — is the wallet connected?");
    expect(rec.steps()[0].error).toBe("Apply timed out");
    expect(rec.steps()[0].explanation).toMatch(/wallet connected/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/step.ts`**

```ts
import type { FlowName, StepLog } from "@keri-demo/shared";

export class StepRecorder {
  private _steps: StepLog[] = [];
  constructor(private readonly flow: FlowName) {}

  add(s: {
    title: string;
    call?: string;
    keriMessage?: string;
    explanation: string;
    request?: unknown;
    response?: unknown;
  }): void {
    this._steps.push({
      ts: Date.now(),
      source: "backend",
      flow: this.flow,
      ...s,
    });
  }

  fail(error: string, explanation: string): void {
    this._steps.push({
      ts: Date.now(),
      source: "backend",
      flow: this.flow,
      title: "Error",
      explanation,
      error,
    });
  }

  steps(): StepLog[] {
    return this._steps;
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w backend`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/step.ts backend/test/step.test.ts
git commit -m "feat(backend): StepRecorder for annotated step log (TDD)"
```

### Task 3.5: Attestation KEL verification (TDD — pure logic)

**Files:**
- Create: `backend/src/keri/verifyKel.ts`
- Test: `backend/test/verifyKel.test.ts`

- [ ] **Step 1: Write failing test `backend/test/verifyKel.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { checkAnchorInKel } from "../src/keri/verifyKel";

const kel = [
  { t: "icp", s: "0", a: [] },
  { t: "ixn", s: "1", a: [{ d: "Esaid-1" }] },
  { t: "ixn", s: "2", a: [{ d: "Esaid-2" }] },
];

describe("checkAnchorInKel", () => {
  it("passes when the seal d==said exists at the given seq", () => {
    const checks = checkAnchorInKel(kel, "Esaid-2", "2");
    expect(checks.every((c) => c.passed)).toBe(true);
  });
  it("fails when said is not anchored at that seq", () => {
    const checks = checkAnchorInKel(kel, "Esaid-2", "1");
    expect(checks.some((c) => !c.passed)).toBe(true);
  });
  it("fails when seq is missing from the KEL", () => {
    const checks = checkAnchorInKel(kel, "Esaid-2", "9");
    expect(checks.find((c) => c.label.includes("sequence"))!.passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/keri/verifyKel.ts`**

```ts
import type { VerificationCheck } from "@keri-demo/shared";

type KelEvent = { t?: string; s?: string; a?: Array<Record<string, unknown>> };

export function checkAnchorInKel(
  kel: KelEvent[],
  said: string,
  seq: string
): VerificationCheck[] {
  const event = kel.find((e) => String(e.s) === String(seq));
  const seqCheck: VerificationCheck = {
    label: `KEL has an event at sequence ${seq}`,
    passed: Boolean(event),
    detail: event
      ? `Found a '${event.t}' event at s=${seq}.`
      : `No event at s=${seq}; the holder's KEL did not advance as claimed.`,
  };
  if (!event) return [seqCheck];

  const seals = Array.isArray(event.a) ? event.a : [];
  const anchored = seals.some((s) => s && s.d === said);
  return [
    seqCheck,
    {
      label: "Attestation SAID is anchored as a seal",
      passed: anchored,
      detail: anchored
        ? `Event s=${seq} contains a seal with d=${said}; the holder's key committed to exactly this payload.`
        : `Event s=${seq} does not anchor ${said}; the payload was not the one signed.`,
    },
  ];
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w backend`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/keri/verifyKel.ts backend/test/verifyKel.test.ts
git commit -m "feat(backend): KEL anchor verification logic (TDD)"
```

---

## Phase 4 — Backend issuer/verifier service

### Task 4.1: Serialized KERIA client

**Files:**
- Create: `backend/src/keri/client.ts`

- [ ] **Step 1: Create `backend/src/keri/client.ts`**

(Ported from `$REF/src/lib/keri/keriaClient.ts`, adapted to `process.env`, plus a single-flight async queue because the issuer client must not run KERI ops in parallel.)

```ts
import { SignifyClient, ready, Tier, randomPasscode } from "signify-ts";
import { withTimeout } from "./timeout";

let queue: Promise<unknown> = Promise.resolve();

/** Serialize all KERI operations on the shared issuer client. */
export function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run as Promise<T>;
}

export async function generateSalt(): Promise<string> {
  await ready();
  return randomPasscode();
}

export async function bootClient(
  keriaUrl: string,
  keriaBootUrl: string,
  salt: string
): Promise<SignifyClient> {
  await ready();
  const client = new SignifyClient(keriaUrl, salt, Tier.low, keriaBootUrl);
  try {
    await withTimeout(client.boot(), "client.boot()");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    if (!msg.match(/already exists|400/i)) throw e;
  }
  await withTimeout(client.connect(), "client.connect()");
  return client;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build -w shared && npm run -w backend exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/keri/client.ts
git commit -m "feat(backend): KERIA client boot + single-flight op queue"
```

### Task 4.2: Issuer bootstrap (witnessed AID, registry, schema OOBI)

**Files:**
- Create: `backend/src/keri/issuer.ts`

- [ ] **Step 1: Create `backend/src/keri/issuer.ts`**

(Ported/adapted from `$REF/src/lib/keri/issuerClient.ts`: env via `process.env`, **witnesses added** (`wits`+`toad`), schema OOBI is our self-hosted URL, salt may be generated.)

```ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type SignifyClient } from "signify-ts";
import { witnessAids, TOAD } from "@keri-demo/shared";
import type { Env } from "../env";
import { bootClient, generateSalt } from "./client";
import { withTimeout, waitOpts } from "./timeout";

export interface IssuerState {
  client: SignifyClient;
  aid: string;
  oobi: string;
  registrySaid: string;
}

const SALT_FILE = "data/issuer.salt";

function resolveSalt(env: Env): string {
  if (env.issuerSalt) return env.issuerSalt;
  if (existsSync(SALT_FILE)) return readFileSync(SALT_FILE, "utf8").trim();
  return "";
}

export async function bootstrapIssuer(
  env: Env,
  schemaSaid: string,
  schemaOobi: string
): Promise<IssuerState> {
  let salt = resolveSalt(env);
  if (!salt) {
    salt = await generateSalt();
    mkdirSync(dirname(SALT_FILE), { recursive: true });
    writeFileSync(SALT_FILE, salt);
  }

  const client = await bootClient(env.keriaUrl, env.keriaBootUrl, salt);

  // Identifier (witnessed).
  let aid: string;
  const idPage = await withTimeout(client.identifiers().list(), "identifiers list");
  const idList =
    (idPage as { aids: Array<{ name: string; prefix: string }> }).aids ?? [];
  const existing = idList.find((id) => id.name === env.issuerName);
  if (existing) {
    aid = existing.prefix;
  } else {
    const result = await withTimeout(
      client.identifiers().create(env.issuerName, {
        transferable: true,
        toad: TOAD,
        wits: witnessAids(),
      }),
      "identifier create"
    );
    await client.operations().wait(await result.op(), waitOpts());
    const hab = await withTimeout(
      client.identifiers().get(env.issuerName),
      "identifier get"
    );
    aid = hab.prefix;
    const roleResult = await withTimeout(
      client.identifiers().addEndRole(env.issuerName, "agent", client.agent!.pre),
      "addEndRole"
    );
    await client.operations().wait(await roleResult.op(), waitOpts());
  }

  // Registry.
  let registrySaid: string;
  const registries = await withTimeout(
    client.registries().list(env.issuerName),
    "registries list"
  );
  if (registries && (registries as unknown[]).length > 0) {
    registrySaid = (registries as Array<{ regk: string }>)[0].regk;
  } else {
    const regResult = await withTimeout(
      client.registries().create({
        name: env.issuerName,
        registryName: env.issuerRegistry,
        noBackers: true,
      }),
      "registry create"
    );
    await client.operations().wait(await regResult.op(), waitOpts());
    registrySaid = regResult.regser.pre;
  }

  // Schema OOBI (self-hosted) — must resolve before issuance.
  const schemaOp = await withTimeout(
    client.oobis().resolve(schemaOobi, `schema-${schemaSaid}`),
    "schema OOBI resolve"
  );
  await client.operations().wait(schemaOp, waitOpts());

  // Own OOBI (so holders can verify the grant signature).
  let oobi = "";
  try {
    const r = await withTimeout(
      client.oobis().get(env.issuerName, "agent"),
      "own OOBI"
    );
    oobi = (r as { oobis?: string[] }).oobis?.[0] ?? "";
  } catch (e) {
    console.error("[issuer] own OOBI fetch failed (non-fatal):", e);
  }

  return { client, aid, oobi, registrySaid };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run -w backend exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/keri/issuer.ts
git commit -m "feat(backend): witnessed issuer bootstrap (AID + registry + schema OOBI)"
```

### Task 4.3: Issue + IPEX grant

**Files:**
- Create: `backend/src/keri/grant.ts`

- [ ] **Step 1: Create `backend/src/keri/grant.ts`**

(Ported from `$REF/src/lib/keri/ipex.ts:33-225`: `nowKeriTimestamp`, `parseCesrEvents`, `getAncAttachment`, `buildGrantExchange`, and an `issueAndGrant` that takes a `StepRecorder`. Env via params.)

```ts
import {
  type SignifyClient,
  type Serder,
  Siger,
  b,
  d,
  messagize,
  serializeACDCAttachment,
  serializeIssExnAttachment,
} from "signify-ts";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

function parseCesrEvents(
  cesr: string
): Array<{ event: Record<string, unknown>; atc: string }> {
  const result: Array<{ event: Record<string, unknown>; atc: string }> = [];
  let i = 0;
  while (i < cesr.length) {
    if (cesr[i] !== "{") {
      i++;
      continue;
    }
    let depth = 0;
    let jsonEnd = i;
    for (let j = i; j < cesr.length; j++) {
      if (cesr[j] === "{") depth++;
      else if (cesr[j] === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = j + 1;
          break;
        }
      }
    }
    const jsonStr = cesr.slice(i, jsonEnd);
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      i = jsonEnd;
      continue;
    }
    let atcEnd = cesr.length;
    for (let j = jsonEnd; j < cesr.length; j++) {
      if (cesr[j] === "{") {
        atcEnd = j;
        break;
      }
    }
    result.push({ event, atc: cesr.slice(jsonEnd, atcEnd) });
    i = atcEnd;
  }
  return result;
}

async function getAncAttachment(
  client: SignifyClient,
  credentialSaid: string
): Promise<string | undefined> {
  const cesrText = (await client.credentials().get(credentialSaid, true)) as string;
  const events = parseCesrEvents(cesrText);
  return events.find((e) => e.event.t === "ixn")?.atc;
}

async function buildGrantExchange(
  client: SignifyClient,
  args: {
    senderName: string;
    recipient: string;
    datetime: string;
    acdc: Serder;
    iss: Serder;
    anc: Serder;
    ancAttachment: string | undefined;
    schemaSaid: string;
    schemaOobi: string;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<[any, string[], string]> {
  const hab = await client.identifiers().get(args.senderName);
  let ancAtc = args.ancAttachment;
  if (ancAtc === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keeper = (client as any).manager.get(hab);
    const sigs: string[] = await keeper.sign(b(args.anc.raw as unknown as string));
    const sigers = sigs.map((sig: string) => new Siger({ qb64: sig }));
    const ims = d(messagize(args.anc, sigers));
    ancAtc = ims.substring(args.anc.size);
  }
  const acdcAtc = d(serializeACDCAttachment(args.iss));
  const issAtc = d(serializeIssExnAttachment(args.anc));
  const embeds = {
    acdc: [args.acdc, acdcAtc],
    iss: [args.iss, issAtc],
    anc: [args.anc, ancAtc],
  };
  const data = { m: "", s: args.schemaSaid, oobiUrl: args.schemaOobi };
  return client
    .exchanges()
    .createExchangeMessage(
      hab,
      "/ipex/grant",
      data,
      embeds as never,
      args.recipient,
      args.datetime
    );
}

export async function issueAndGrant(
  issuer: IssuerState,
  issuerName: string,
  holderAid: string,
  schemaSaid: string,
  schemaOobi: string,
  attrs: { name: string; email: string; role: string },
  rec: StepRecorder
): Promise<{ credentialSaid: string; grantExn: unknown }> {
  const { client, aid: issuerAid, registrySaid } = issuer;
  const dt = nowKeriTimestamp();

  rec.add({
    title: "Issuer creates the ACDC",
    call: "client.credentials().issue(name, { i, ri, s, a })",
    keriMessage: "iss",
    explanation:
      "The issuer mints a credential into its registry. `i` is the issuer AID, " +
      "`ri` the registry, `s` the schema SAID, `a` the subject attributes (the " +
      "holder AID is `a.i`). KERIA writes an issuance (iss) event to the TEL.",
    request: { i: issuerAid, ri: registrySaid, s: schemaSaid, a: { i: holderAid, ...attrs } },
  });
  const issueResult = await client.credentials().issue(issuerName, {
    i: issuerAid,
    ri: registrySaid,
    s: schemaSaid,
    a: { i: holderAid, dt, name: attrs.name, email: attrs.email, role: attrs.role },
  });
  await client.operations().wait(issueResult.op, waitOpts());
  const credentialSaid = issueResult.acdc.sad.d as string;
  rec.add({
    title: "Credential minted",
    explanation:
      "The credential now exists with a SAID (self-addressing id). It is not yet " +
      "delivered — the holder must receive and admit it over IPEX.",
    response: issueResult.acdc.sad,
  });

  const ancAttachment = await getAncAttachment(client, credentialSaid);

  rec.add({
    title: "Issuer sends IPEX grant",
    call: "client.ipex().submitGrant(...)",
    keriMessage: "/ipex/grant",
    explanation:
      "IPEX (Issuance & Presentation EXchange) is the consent protocol. The grant " +
      "bundles the ACDC + issuance + anchor events, and embeds the schema SAID and " +
      "OOBI so the holder can fetch and validate the schema before accepting.",
  });
  const [grantExn, grantSigs, grantAtc] = await buildGrantExchange(client, {
    senderName: issuerName,
    recipient: holderAid,
    datetime: nowKeriTimestamp(),
    acdc: issueResult.acdc,
    iss: issueResult.iss,
    anc: issueResult.anc,
    ancAttachment,
    schemaSaid,
    schemaOobi,
  });
  const grantOp = await client
    .ipex()
    .submitGrant(issuerName, grantExn, grantSigs, grantAtc, [holderAid]);
  await client.operations().wait(grantOp, waitOpts());
  rec.add({
    title: "Grant delivered to holder's KERIA mailbox",
    explanation:
      "The holder will see an `/exn/ipex/grant` notification and must `admit` it " +
      "to store the credential. Until then the holder does not have the credential.",
    response: grantExn,
  });

  return { credentialSaid, grantExn };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run -w backend exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/keri/grant.ts
git commit -m "feat(backend): issue ACDC + IPEX grant with schema embed (ported)"
```

### Task 4.4: Verifier presentation + verification

**Files:**
- Create: `backend/src/keri/present.ts`

- [ ] **Step 1: Create `backend/src/keri/present.ts`**

(Ported from `$REF/src/lib/keri/ipex.ts:290-366` `presentCredentialOnCompanion`, here the **backend is the verifier**; adds a `StepRecorder` and a verification breakdown.)

```ts
import { type SignifyClient } from "signify-ts";
import type { VerificationCheck } from "@keri-demo/shared";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import { waitForNotification, markAndDelete } from "./notifications";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

export async function requestPresentation(
  verifier: IssuerState,
  verifierName: string,
  holderAid: string,
  schemaSaid: string,
  rec: StepRecorder,
  timeoutMs = 180_000
): Promise<{ credential: Record<string, unknown>; verification: VerificationCheck[] }> {
  const client = verifier.client;

  rec.add({
    title: "Verifier sends IPEX apply",
    call: "client.ipex().apply({ schemaSaid })",
    keriMessage: "/ipex/apply",
    explanation:
      "Presentation is verifier-driven. `apply` asks the holder: “present a " +
      "credential of this schema.” The holder decides whether to disclose.",
  });
  const [applyExn, applySigs] = await client.ipex().apply({
    senderName: verifierName,
    recipient: holderAid,
    schemaSaid,
    datetime: nowKeriTimestamp(),
  });
  const applyOp = await client
    .ipex()
    .submitApply(verifierName, applyExn, applySigs, [holderAid]);
  await client.operations().wait(applyOp, waitOpts());

  rec.add({
    title: "Waiting for holder's offer",
    keriMessage: "/ipex/offer",
    explanation:
      "The holder (browser demo agent, or the Veridian phone) responds with an " +
      "`offer` containing the credential it is willing to present.",
  });
  const offerNote = await waitForNotification(
    client,
    ["/exn/ipex/offer", "/ipex/offer"],
    timeoutMs
  );
  const offerSaid = offerNote.a.d;
  await markAndDelete(client, offerNote);

  rec.add({
    title: "Verifier agrees to the offer",
    call: "client.ipex().agree({ offerSaid })",
    keriMessage: "/ipex/agree",
    explanation: "`agree` confirms the verifier wants the offered credential.",
  });
  const [agreeExn, agreeSigs] = await client.ipex().agree({
    senderName: verifierName,
    recipient: holderAid,
    offerSaid,
    datetime: nowKeriTimestamp(),
  });
  const agreeOp = await client
    .ipex()
    .submitAgree(verifierName, agreeExn, agreeSigs, [holderAid]);
  await client.operations().wait(agreeOp, waitOpts());

  const grantNote = await waitForNotification(
    client,
    ["/exn/ipex/grant", "/ipex/grant"],
    timeoutMs
  );
  const grantSaid = grantNote.a.d;
  const grantExchange = await client.exchanges().get(grantSaid);
  const exn = grantExchange.exn as {
    e?: { acdc?: Record<string, unknown> & { d?: string } };
  };
  const acdc = exn.e?.acdc;
  if (!acdc?.d) throw new Error("[present] grant exchange has no acdc.d");

  rec.add({
    title: "Holder grants the credential",
    keriMessage: "/ipex/grant",
    explanation:
      "The holder discloses the credential. The verifier now validates it before " +
      "admitting.",
    response: acdc,
  });

  const [admitExn, admitSigs, admitAtc] = await client.ipex().admit({
    senderName: verifierName,
    recipient: holderAid,
    grantSaid,
    datetime: nowKeriTimestamp(),
  });
  const admitOp = await client
    .ipex()
    .submitAdmit(verifierName, admitExn, admitSigs, admitAtc, [holderAid]);
  await client.operations().wait(admitOp, waitOpts());
  await markAndDelete(client, grantNote);

  const verification: VerificationCheck[] = [
    {
      label: "Schema SAID matches the requested schema",
      passed: acdc.s === schemaSaid,
      detail: `Presented schema ${String(acdc.s)} ${
        acdc.s === schemaSaid ? "==" : "!="
      } requested ${schemaSaid}.`,
    },
    {
      label: "Issuer is the trusted demo issuer",
      passed: acdc.i === verifier.aid,
      detail: `Credential issuer ${String(acdc.i)} ${
        acdc.i === verifier.aid ? "==" : "!="
      } this issuer ${verifier.aid}.`,
    },
    {
      label: "Credential is bound to the presenting holder",
      passed:
        (acdc.a as Record<string, unknown> | undefined)?.i === holderAid,
      detail: `Subject a.i ${String(
        (acdc.a as Record<string, unknown> | undefined)?.i
      )} ${
        (acdc.a as Record<string, unknown> | undefined)?.i === holderAid
          ? "=="
          : "!="
      } presenter ${holderAid}.`,
    },
  ];
  rec.add({
    title: "Verification complete",
    explanation:
      "Each check is a distinct trust question: right schema? trusted issuer? " +
      "bound to the party that presented it? All must pass to trust the claim.",
    response: verification,
  });

  return { credential: acdc, verification };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run -w backend exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/keri/present.ts
git commit -m "feat(backend): verifier IPEX presentation + verification breakdown"
```

### Task 4.5: Attestation request + verify

**Files:**
- Create: `backend/src/keri/attest.ts`

- [ ] **Step 1: Create `backend/src/keri/attest.ts`**

```ts
import { randomBytes } from "node:crypto";
import { type SignifyClient } from "signify-ts";
import type { AttestPayload, VerificationCheck } from "@keri-demo/shared";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import { checkAnchorInKel } from "./verifyKel";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

export function createAttestationRequest(
  holderAid: string,
  rec: StepRecorder
): AttestPayload {
  // `i` first, `d` second: the holder/Veridian recompute the SAID and the key
  // order must match (see $REF/src/lib/keri/remotesign.ts:38-46).
  const payload: AttestPayload = {
    i: holderAid,
    d: "",
    purpose: "demo-attestation",
    nonce: randomBytes(16).toString("hex"),
    dt: nowKeriTimestamp(),
  };
  rec.add({
    title: "Verifier asks for an attestation",
    explanation:
      "Attestation = the holder anchors a SAID of this exact payload into its own " +
      "KEL via an interaction (ixn) event. That proves the holder's key committed " +
      "to this data at a specific point in its key history. The verifier supplies " +
      "a nonce so the attestation can't be a replay.",
    response: payload,
  });
  return payload;
}

export async function verifyAttestation(
  verifier: IssuerState,
  holderAid: string,
  said: string,
  seq: string,
  rec: StepRecorder
): Promise<VerificationCheck[]> {
  const client: SignifyClient = verifier.client;

  rec.add({
    title: "Verifier queries the holder's key state",
    call: "client.keyStates().query(holderAid)",
    keriMessage: "qry",
    explanation:
      "The verifier independently pulls the holder's KEL from KERIA/witnesses — it " +
      "does not trust the holder's word. Witnesses are why this is tamper-evident.",
  });
  const queryOp = await client.keyStates().query(holderAid, undefined, undefined);
  await client.operations().wait(queryOp, waitOpts());

  const events = (await client
    .keyEvents()
    .get(holderAid)) as Array<Record<string, unknown>>;
  const kel = events.map((e) => {
    const ked = (e.ked ?? e) as { t?: string; s?: string; a?: unknown };
    return {
      t: ked.t as string | undefined,
      s: ked.s as string | undefined,
      a: Array.isArray(ked.a)
        ? (ked.a as Array<Record<string, unknown>>)
        : [],
    };
  });

  const checks = checkAnchorInKel(kel, said, seq);
  rec.add({
    title: "Attestation verified against the KEL",
    explanation:
      "If the seal d==said exists at the claimed sequence, the holder's signing " +
      "key irrevocably committed to this payload. Change one byte and the SAID — " +
      "and this check — fails.",
    response: checks,
  });
  return checks;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run -w backend exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/keri/attest.ts
git commit -m "feat(backend): attestation request + KEL verification"
```

### Task 4.6: Job registry (TDD)

**Files:**
- Create: `backend/src/jobs.ts`
- Test: `backend/test/jobs.test.ts`

- [ ] **Step 1: Write failing test `backend/test/jobs.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { JobRegistry } from "../src/jobs";

describe("JobRegistry", () => {
  it("creates pending jobs and resolves them", () => {
    const reg = new JobRegistry();
    const id = reg.create("present");
    expect(reg.get(id)!.status).toBe("pending");
    reg.resolve(id, { credential: { d: "X" }, verification: [] });
    expect(reg.get(id)!.status).toBe("done");
    expect(reg.get(id)!.result).toEqual({ credential: { d: "X" }, verification: [] });
  });
  it("records errors", () => {
    const reg = new JobRegistry();
    const id = reg.create("present");
    reg.error(id, "boom");
    expect(reg.get(id)!.status).toBe("error");
    expect(reg.get(id)!.error).toBe("boom");
  });
  it("appends steps", () => {
    const reg = new JobRegistry();
    const id = reg.create("present");
    reg.appendSteps(id, [
      { ts: 1, source: "backend", flow: "present", title: "x", explanation: "y" },
    ]);
    expect(reg.get(id)!.steps).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w backend`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/jobs.ts`**

```ts
import { randomUUID } from "node:crypto";
import type { FlowName, StepLog } from "@keri-demo/shared";

interface Job {
  status: "pending" | "done" | "error";
  flow: FlowName;
  steps: StepLog[];
  result?: unknown;
  error?: string;
  createdAt: number;
}

const TTL_MS = 30 * 60_000;

export class JobRegistry {
  private jobs = new Map<string, Job>();

  create(flow: FlowName): string {
    this.gc();
    const id = randomUUID();
    this.jobs.set(id, { status: "pending", flow, steps: [], createdAt: Date.now() });
    return id;
  }
  appendSteps(id: string, steps: StepLog[]): void {
    const j = this.jobs.get(id);
    if (j) j.steps.push(...steps);
  }
  resolve(id: string, result: unknown): void {
    const j = this.jobs.get(id);
    if (j) {
      j.status = "done";
      j.result = result;
    }
  }
  error(id: string, error: string): void {
    const j = this.jobs.get(id);
    if (j) {
      j.status = "error";
      j.error = error;
    }
  }
  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }
  private gc(): void {
    const now = Date.now();
    for (const [id, j] of this.jobs)
      if (now - j.createdAt > TTL_MS) this.jobs.delete(id);
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w backend`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/jobs.ts backend/test/jobs.test.ts
git commit -m "feat(backend): in-memory job registry for polled presentation (TDD)"
```

### Task 4.7: Routes + server wiring

**Files:**
- Create: `backend/src/routes.ts`, `backend/src/server.ts`

- [ ] **Step 1: Create `backend/src/routes.ts`**

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router, type Request, type Response } from "express";
import {
  WITNESSES,
  TOAD,
  type ConfigDTO,
  type IssueRequest,
  type PresentStartRequest,
  type AttestRequestBody,
  type AttestVerifyRequest,
} from "@keri-demo/shared";
import type { Env } from "./env";
import type { IssuerState } from "./keri/issuer";
import { serialize } from "./keri/client";
import { resolveOobiOnClient } from "./keri/oobi";
import { issueAndGrant } from "./keri/grant";
import { requestPresentation } from "./keri/present";
import { createAttestationRequest, verifyAttestation } from "./keri/attest";
import { StepRecorder } from "./step";
import { JobRegistry } from "./jobs";

const schemaPath = fileURLToPath(
  new URL("../../infra/schema/keri-demo-credential.schema.json", import.meta.url)
);
const schemaJson = JSON.parse(readFileSync(schemaPath, "utf8"));
const SCHEMA_SAID: string = schemaJson.$id;

export function makeRouter(
  env: Env,
  issuer: IssuerState,
  jobs: JobRegistry
): Router {
  const r = Router();
  const schemaOobi = `${env.publicHost}/oobi/${SCHEMA_SAID}`;

  r.get("/oobi/:said", (req: Request, res: Response) => {
    if (req.params.said !== SCHEMA_SAID) return res.status(404).end();
    res.type("application/schema+json").send(JSON.stringify(schemaJson));
  });

  r.get("/healthz", (_req, res) => res.json({ ok: true }));

  r.get("/api/config", (_req, res) => {
    const cfg: ConfigDTO = {
      keriaUrl: process.env.VITE_KERIA_URL || "http://localhost:3901",
      keriaBootUrl: process.env.VITE_KERIA_BOOT_URL || "http://localhost:3903",
      schemaSaid: SCHEMA_SAID,
      schemaOobi,
      issuerAid: issuer.aid,
      issuerOobi: issuer.oobi,
      registrySaid: issuer.registrySaid,
      witnesses: WITNESSES,
      toad: TOAD,
    };
    res.json(cfg);
  });

  r.get("/api/issuer/info", (_req, res) =>
    res.json({
      issuerAid: issuer.aid,
      issuerOobi: issuer.oobi,
      registrySaid: issuer.registrySaid,
    })
  );

  r.post("/api/issuer/issue", async (req: Request, res: Response) => {
    const body = req.body as IssueRequest;
    const rec = new StepRecorder("issue");
    try {
      const out = await serialize(async () => {
        rec.add({
          title: "Verifier resolves the holder's OOBI",
          call: "client.oobis().resolve(holderOobi)",
          keriMessage: "oobi",
          explanation:
            "Each KERIA agent keeps its own contacts. The issuer must resolve the " +
            "holder's OOBI before it can target that AID in a grant.",
        });
        await resolveOobiOnClient(issuer.client, body.holderOobi, `holder-${Date.now()}`);
        return issueAndGrant(
          issuer,
          env.issuerName,
          body.holderAid,
          SCHEMA_SAID,
          schemaOobi,
          { name: body.name, email: body.email, role: body.role },
          rec
        );
      });
      res.json({ ...out, steps: rec.steps() });
    } catch (e) {
      rec.fail(
        (e as Error).message,
        "Issuance failed. Common cause: the holder's OOBI is unreachable, or KERIA " +
          "is still starting."
      );
      res.status(500).json({ steps: rec.steps(), error: (e as Error).message });
    }
  });

  r.post("/api/verifier/present/start", (req: Request, res: Response) => {
    const body = req.body as PresentStartRequest;
    const jobId = jobs.create("present");
    const rec = new StepRecorder("present");
    res.json({ jobId, steps: rec.steps() });
    void serialize(async () => {
      try {
        await resolveOobiOnClient(issuer.client, body.holderOobi, `holder-${Date.now()}`);
        const out = await requestPresentation(
          issuer,
          env.issuerName,
          body.holderAid,
          SCHEMA_SAID,
          rec
        );
        jobs.appendSteps(jobId, rec.steps());
        jobs.resolve(jobId, out);
      } catch (e) {
        rec.fail(
          (e as Error).message,
          "Presentation did not complete. The holder may not have offered the " +
            "credential (is the demo holder connected / did the Veridian user approve?)."
        );
        jobs.appendSteps(jobId, rec.steps());
        jobs.error(jobId, (e as Error).message);
      }
    });
  });

  r.get("/api/verifier/present/:jobId", (req: Request, res: Response) => {
    const j = jobs.get(req.params.jobId);
    if (!j) return res.status(404).json({ error: "unknown job" });
    const result = j.result as
      | { credential: Record<string, unknown>; verification: unknown[] }
      | undefined;
    res.json({
      status: j.status,
      credential: result?.credential,
      verification: result?.verification,
      error: j.error,
      steps: j.steps,
    });
  });

  r.post("/api/verifier/attest/request", (req: Request, res: Response) => {
    const body = req.body as AttestRequestBody;
    const rec = new StepRecorder("attest");
    const payload = createAttestationRequest(body.holderAid, rec);
    res.json({ payload, steps: rec.steps() });
  });

  r.post("/api/verifier/attest/verify", async (req: Request, res: Response) => {
    const body = req.body as AttestVerifyRequest;
    const rec = new StepRecorder("attest");
    try {
      const verification = await serialize(() =>
        verifyAttestation(issuer, body.holderAid, body.said, body.seq, rec)
      );
      res.json({ verification, steps: rec.steps() });
    } catch (e) {
      rec.fail(
        (e as Error).message,
        "Could not verify the attestation against the holder's KEL."
      );
      res.status(500).json({ steps: rec.steps(), error: (e as Error).message });
    }
  });

  return r;
}
```

- [ ] **Step 2: Create `backend/src/server.ts`**

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { loadEnv } from "./env";
import { bootstrapIssuer } from "./keri/issuer";
import { JobRegistry } from "./jobs";
import { makeRouter } from "./routes";

dotenv.config();

const schemaPath = fileURLToPath(
  new URL("../../infra/schema/keri-demo-credential.schema.json", import.meta.url)
);
const SCHEMA_SAID: string = JSON.parse(readFileSync(schemaPath, "utf8")).$id;

async function bootstrapWithRetry(env: ReturnType<typeof loadEnv>) {
  const schemaOobi = `${env.publicHost}/oobi/${SCHEMA_SAID}`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await bootstrapIssuer(env, SCHEMA_SAID, schemaOobi);
    } catch (e) {
      const wait = Math.min(attempt * 3000, 15000);
      console.error(
        `[bootstrap] attempt ${attempt} failed (${(e as Error).message}); ` +
          `retrying in ${wait}ms (is KERIA up?)`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  let ready = false;
  app.get("/readyz", (_req, res) =>
    ready ? res.json({ ready: true }) : res.status(503).json({ ready: false })
  );

  app.listen(env.port, () =>
    console.log(`[server] listening on :${env.port}`)
  );

  const issuer = await bootstrapWithRetry(env);
  const jobs = new JobRegistry();
  app.use(makeRouter(env, issuer, jobs));

  const dist = fileURLToPath(new URL("../../frontend/dist", import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(`${dist}/index.html`));
  }
  ready = true;
  console.log(`[server] issuer ready: ${issuer.aid}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run build:shared && npm run build -w backend`
Expected: compiles to `backend/dist` with no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes.ts backend/src/server.ts
git commit -m "feat(backend): Express routes + server bootstrap with retry"
```

---

## Phase 5 — Frontend (React + Vite)

### Task 5.1: Frontend scaffold

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/postcss.config.js`, `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/cn.ts`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "@keri-demo/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.json && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@keri-demo/shared": "*",
    "clsx": "^2.1.1",
    "qrcode.react": "^4.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.1",
    "signify-ts": "^0.3.0",
    "tailwind-merge": "^2.6.0",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.6.3",
    "vite": "^6.0.5",
    "vite-plugin-node-polyfills": "^0.23.0",
    "vite-plugin-wasm": "^3.4.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [react(), wasm(), nodePolyfills()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/oobi": "http://localhost:3001",
    },
  },
  build: { target: "esnext" },
});
```

- [ ] **Step 4: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KERI + Veridian — Educational Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `frontend/postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Create `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 7: Create `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-slate-50 text-slate-900; }
```

- [ ] **Step 8: Create `frontend/src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Create `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 10: Create `frontend/src/App.tsx` (placeholder; replaced in Task 5.7)**

```tsx
export default function App() {
  return <div className="p-8">KERI demo — loading…</div>;
}
```

- [ ] **Step 11: Install + build**

Run: `npm install && npm run build -w frontend`
Expected: Vite build succeeds (placeholder app).

- [ ] **Step 12: Commit**

```bash
git add frontend package-lock.json
git commit -m "feat(frontend): Vite + React + Tailwind scaffold"
```

### Task 5.2: Port frontend KERI helpers

**Files:**
- Create: `frontend/src/keri/timeout.ts`, `frontend/src/keri/saidify.ts`, `frontend/src/keri/notifications.ts`, `frontend/src/keri/client.ts`

- [ ] **Step 1: Create `frontend/src/keri/timeout.ts`**

```ts
export function nowKeriTimestamp(): string {
  return new Date().toISOString().replace("Z", "000+00:00");
}
export function waitOpts(ms = 60_000): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(ms) };
}
```

- [ ] **Step 2: Create `frontend/src/keri/saidify.ts`**

```ts
import { Saider } from "signify-ts";

export async function saidify(
  payload: Record<string, unknown>
): Promise<{ sad: Record<string, unknown>; said: string }> {
  const result = (Saider as unknown as {
    saidify: (p: Record<string, unknown>) => [unknown, Record<string, unknown>];
  }).saidify(payload);
  if (Array.isArray(result)) {
    const [saider, sad] = result as [Record<string, unknown>, Record<string, unknown>];
    const said =
      typeof saider === "string"
        ? saider
        : ((saider.qb64 ?? saider.said) as string);
    return { sad, said };
  }
  const r = result as { sad: Record<string, unknown>; said: string };
  return { sad: r.sad, said: r.said };
}
```

- [ ] **Step 3: Create `frontend/src/keri/notifications.ts`**

```ts
import { type SignifyClient } from "signify-ts";

export interface Notification {
  i: string;
  dt: string;
  r: boolean;
  a: { r: string; d: string };
}

const POLL_INTERVAL_MS = 1_500;

export async function waitForNotification(
  client: SignifyClient,
  routes: string | string[],
  timeoutMs = 60_000
): Promise<Notification> {
  const routeList = Array.isArray(routes) ? routes : [routes];
  const normalised = routeList.flatMap((r) => {
    const withPrefix = r.startsWith("/exn/") ? r : `/exn${r}`;
    const withoutPrefix = r.startsWith("/exn/") ? r.slice(4) : r;
    return [r, withPrefix, withoutPrefix];
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { notes } = await client.notifications().list(0, 24);
    for (const note of notes as Notification[]) {
      if (!note.r && normalised.includes(note.a.r)) return note;
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  throw new Error(
    `[notifications] timeout waiting for routes: ${routeList.join(", ")}`
  );
}

export async function markAndDelete(
  client: SignifyClient,
  note: Notification
): Promise<void> {
  await client.notifications().mark(note.i);
  await client.notifications().delete(note.i);
}
```

- [ ] **Step 4: Create `frontend/src/keri/client.ts`** (browser boot, Vite env)

```ts
import { SignifyClient, ready, Tier, randomPasscode } from "signify-ts";

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`[keria] timeout: ${label}`)), 60_000)
    ),
  ]);
}

export async function generateSalt(): Promise<string> {
  await ready();
  return randomPasscode();
}

export async function bootClient(
  keriaUrl: string,
  keriaBootUrl: string,
  salt: string
): Promise<SignifyClient> {
  await ready();
  const client = new SignifyClient(keriaUrl, salt, Tier.low, keriaBootUrl);
  try {
    await withTimeout(client.boot(), "boot");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    if (!msg.match(/already exists|400/i)) throw e;
  }
  await withTimeout(client.connect(), "connect");
  return client;
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run build -w frontend`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/keri
git commit -m "feat(frontend): port KERI client/saidify/notifications helpers"
```

### Task 5.3: Session store + API client

**Files:**
- Create: `frontend/src/state/session.ts`, `frontend/src/lib/api.ts`

- [ ] **Step 1: Create `frontend/src/state/session.ts`**

```ts
import { create } from "zustand";
import type { SignifyClient } from "signify-ts";
import type { ConfigDTO, StepLog } from "@keri-demo/shared";

type Mode = "none" | "demo" | "veridian";

interface SessionState {
  mode: Mode;
  config: ConfigDTO | null;
  client: SignifyClient | null;
  walletName: string;
  holderAid: string;
  holderOobi: string;
  veridianAid: string;
  steps: StepLog[];
  set: (p: Partial<SessionState>) => void;
  addSteps: (s: StepLog[]) => void;
  recordClient: (s: Omit<StepLog, "ts" | "source">) => void;
  clearSteps: () => void;
}

export const useSession = create<SessionState>((set) => ({
  mode: "none",
  config: null,
  client: null,
  walletName: "",
  holderAid: "",
  holderOobi: "",
  veridianAid: "",
  steps: [],
  set: (p) => set(p),
  addSteps: (s) => set((st) => ({ steps: [...st.steps, ...s] })),
  recordClient: (s) =>
    set((st) => ({
      steps: [...st.steps, { ...s, ts: Date.now(), source: "client" }],
    })),
  clearSteps: () => set({ steps: [] }),
}));
```

- [ ] **Step 2: Create `frontend/src/lib/api.ts`**

```ts
import type {
  ConfigDTO,
  IssueRequest,
  IssueResponse,
  PresentStartResponse,
  PresentStatusResponse,
  AttestRequestResponse,
  AttestVerifyResponse,
} from "@keri-demo/shared";

const base = import.meta.env.VITE_API_BASE || "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok && r.status >= 500) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || "request failed");
  }
  return r.json() as Promise<T>;
}

export const api = {
  config: () => fetch(base + "/api/config").then((r) => r.json() as Promise<ConfigDTO>),
  issue: (b: IssueRequest) => post<IssueResponse>("/api/issuer/issue", b),
  presentStart: (b: { holderAid: string; holderOobi: string }) =>
    post<PresentStartResponse>("/api/verifier/present/start", b),
  presentStatus: (jobId: string) =>
    fetch(base + `/api/verifier/present/${jobId}`).then(
      (r) => r.json() as Promise<PresentStatusResponse>
    ),
  attestRequest: (b: { holderAid: string; holderOobi: string }) =>
    post<AttestRequestResponse>("/api/verifier/attest/request", b),
  attestVerify: (b: { holderAid: string; said: string; seq: string }) =>
    post<AttestVerifyResponse>("/api/verifier/attest/verify", b),
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run build -w frontend`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/state frontend/src/lib/api.ts
git commit -m "feat(frontend): zustand session store + typed API client"
```

### Task 5.4: Holder / companion / admit / offer / attest

**Files:**
- Create: `frontend/src/keri/holder.ts`, `frontend/src/keri/companion.ts`, `frontend/src/keri/admit.ts`, `frontend/src/keri/offer.ts`, `frontend/src/keri/attest.ts`

- [ ] **Step 1: Create `frontend/src/keri/holder.ts`**

```ts
import type { SignifyClient } from "signify-ts";
import type { ConfigDTO } from "@keri-demo/shared";
import { bootClient, generateSalt } from "./client";
import { waitOpts } from "./timeout";

const SALT_KEY = "keri-demo/holder-salt";
const NAME_KEY = "keri-demo/holder-name";

export interface HolderSession {
  client: SignifyClient;
  walletName: string;
  aid: string;
  oobi: string;
}

export async function connectDemoHolder(cfg: ConfigDTO): Promise<HolderSession> {
  let salt = localStorage.getItem(SALT_KEY);
  let walletName = localStorage.getItem(NAME_KEY);
  const fresh = !salt;
  if (!salt) salt = await generateSalt();
  if (!walletName) walletName = `holder-${salt.slice(0, 8)}`;

  const client = await bootClient(cfg.keriaUrl, cfg.keriaBootUrl, salt);

  let aid: string;
  const idPage = await client.identifiers().list();
  const list =
    (idPage as { aids: Array<{ name: string; prefix: string }> }).aids ?? [];
  const existing = list.find((i) => i.name === walletName);
  if (existing && !fresh) {
    aid = existing.prefix;
  } else {
    const res = await client.identifiers().create(walletName, {
      transferable: true,
      toad: cfg.toad,
      wits: cfg.witnesses.map((w) => w.aid),
    });
    await client.operations().wait(await res.op(), waitOpts());
    const hab = await client.identifiers().get(walletName);
    aid = hab.prefix;
    const roleRes = await client
      .identifiers()
      .addEndRole(walletName, "agent", client.agent!.pre);
    await client.operations().wait(await roleRes.op(), waitOpts());
  }

  // Resolve issuer + schema OOBIs so the holder can validate the grant.
  for (const [oobi, alias] of [
    [cfg.schemaOobi, `schema-${cfg.schemaSaid}`],
    [cfg.issuerOobi, "issuer"],
  ] as const) {
    if (!oobi) continue;
    try {
      const op = await client.oobis().resolve(oobi, alias);
      await client.operations().wait(op, waitOpts());
    } catch {
      /* already resolved */
    }
  }

  const oobiRes = await client.oobis().get(walletName, "agent");
  const oobi = (oobiRes as { oobis?: string[] }).oobis?.[0] ?? "";

  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(NAME_KEY, walletName);
  return { client, walletName, aid, oobi };
}
```

- [ ] **Step 2: Create `frontend/src/keri/companion.ts`**

```ts
import type { SignifyClient } from "signify-ts";
import type { ConfigDTO } from "@keri-demo/shared";
import { bootClient, generateSalt } from "./client";
import { waitOpts } from "./timeout";

const SESSION_SALT = "keri-demo/companion-salt";
const COMPANION_NAME = "veridian-companion";
const VERIDIAN_AID = "keri-demo/veridian-aid";

export interface CompanionSession {
  client: SignifyClient;
  walletName: string;
  companionAid: string;
  companionOobi: string;
  veridianAid: string;
}

export async function connectCompanion(cfg: ConfigDTO): Promise<CompanionSession> {
  let salt = sessionStorage.getItem(SESSION_SALT);
  if (!salt) {
    salt = await generateSalt();
    sessionStorage.setItem(SESSION_SALT, salt);
  }
  const client = await bootClient(cfg.keriaUrl, cfg.keriaBootUrl, salt);

  const idPage = await client.identifiers().list();
  const list =
    (idPage as { aids: Array<{ name: string; prefix: string }> }).aids ?? [];
  let companionAid: string;
  const existing = list.find((i) => i.name === COMPANION_NAME);
  if (existing) {
    companionAid = existing.prefix;
  } else {
    const res = await client.identifiers().create(COMPANION_NAME, {
      transferable: true,
      toad: cfg.toad,
      wits: cfg.witnesses.map((w) => w.aid),
    });
    await client.operations().wait(await res.op(), waitOpts());
    companionAid = (await client.identifiers().get(COMPANION_NAME)).prefix;
    const roleRes = await client
      .identifiers()
      .addEndRole(COMPANION_NAME, "agent", client.agent!.pre);
    await client.operations().wait(await roleRes.op(), waitOpts());
  }
  for (const [oobi, alias] of [
    [cfg.schemaOobi, `schema-${cfg.schemaSaid}`],
    [cfg.issuerOobi, "issuer"],
  ] as const) {
    if (!oobi) continue;
    try {
      const op = await client.oobis().resolve(oobi, alias);
      await client.operations().wait(op, waitOpts());
    } catch {
      /* already resolved */
    }
  }
  const oobiRes = await client.oobis().get(COMPANION_NAME, "agent");
  const companionOobi = (oobiRes as { oobis?: string[] }).oobis?.[0] ?? "";
  return {
    client,
    walletName: COMPANION_NAME,
    companionAid,
    companionOobi,
    veridianAid: localStorage.getItem(VERIDIAN_AID) ?? "",
  };
}

export async function pairVeridian(
  client: SignifyClient,
  veridianOobi: string
): Promise<string> {
  const alias = `veridian-${Date.now()}`;
  const op = await client.oobis().resolve(veridianOobi, alias);
  await client.operations().wait(op, waitOpts());
  const m = veridianOobi.match(/\/oobi\/([^/]+)/);
  const aid = m ? m[1] : "";
  if (!aid) throw new Error("Could not extract AID from the Veridian OOBI");
  localStorage.setItem(VERIDIAN_AID, aid);
  return aid;
}
```

- [ ] **Step 3: Create `frontend/src/keri/admit.ts`** (port of `$REF/src/lib/keri/ipex.ts:231-265 admitGrantOnWallet`)

```ts
import type { SignifyClient } from "signify-ts";
import { waitForNotification, markAndDelete } from "./notifications";
import { nowKeriTimestamp, waitOpts } from "./timeout";

export async function admitGrantOnWallet(
  client: SignifyClient,
  walletName: string,
  issuerAid: string,
  timeoutMs = 120_000
): Promise<string> {
  const grantNote = await waitForNotification(
    client,
    ["/exn/ipex/grant", "/ipex/grant"],
    timeoutMs
  );
  const grantSaid = grantNote.a.d;
  const [admitExn, admitSigs, admitAtc] = await client.ipex().admit({
    senderName: walletName,
    recipient: issuerAid,
    datetime: nowKeriTimestamp(),
    grantSaid,
    message: "",
  });
  const op = await client
    .ipex()
    .submitAdmit(walletName, admitExn, admitSigs, admitAtc, [issuerAid]);
  await client.operations().wait(op, waitOpts());
  await markAndDelete(client, grantNote);
  return grantSaid;
}
```

- [ ] **Step 4: Create `frontend/src/keri/offer.ts`** (holder responds to the verifier's apply — the mirror of `present.ts`)

```ts
import type { SignifyClient } from "signify-ts";
import { waitForNotification, markAndDelete } from "./notifications";
import { nowKeriTimestamp, waitOpts } from "./timeout";

/**
 * Wait for the verifier's IPEX apply, offer a matching credential, then grant it
 * after the verifier agrees. Mirrors the verifier loop in backend present.ts.
 */
export async function offerOnApply(
  client: SignifyClient,
  walletName: string,
  schemaSaid: string,
  timeoutMs = 180_000
): Promise<void> {
  const applyNote = await waitForNotification(
    client,
    ["/exn/ipex/apply", "/ipex/apply"],
    timeoutMs
  );
  const applyExchange = await client.exchanges().get(applyNote.a.d);
  const verifierAid = (applyExchange.exn as { i: string }).i;
  await markAndDelete(client, applyNote);

  const creds = (await client.credentials().list()) as Array<{
    sad: { d: string; s: string };
  }>;
  const match = creds.find((c) => c.sad.s === schemaSaid);
  if (!match) throw new Error("No credential matching the requested schema");

  const [offerExn, offerSigs, offerAtc] = await client.ipex().offer({
    senderName: walletName,
    recipient: verifierAid,
    acdc: match.sad as unknown as Record<string, unknown>,
    datetime: nowKeriTimestamp(),
  });
  const offerOp = await client
    .ipex()
    .submitOffer(walletName, offerExn, offerSigs, offerAtc, [verifierAid]);
  await client.operations().wait(offerOp, waitOpts());

  const agreeNote = await waitForNotification(
    client,
    ["/exn/ipex/agree", "/ipex/agree"],
    timeoutMs
  );
  await markAndDelete(client, agreeNote);

  const [grantExn, grantSigs, grantAtc] = await client.ipex().grant({
    senderName: walletName,
    recipient: verifierAid,
    acdc: match.sad as unknown as Record<string, unknown>,
    datetime: nowKeriTimestamp(),
  });
  const grantOp = await client
    .ipex()
    .submitGrant(walletName, grantExn, grantSigs, grantAtc, [verifierAid]);
  await client.operations().wait(grantOp, waitOpts());
}
```

- [ ] **Step 5: Create `frontend/src/keri/attest.ts`** (demo: `interact`; Veridian: `remotesign` — ported from `$REF/src/lib/keri/remotesign.ts`)

```ts
import type { SignifyClient } from "signify-ts";
import { saidify } from "./saidify";
import { waitForNotification, markAndDelete } from "./notifications";
import { waitOpts } from "./timeout";

export interface AttestResult {
  said: string;
  seq: string;
}

/** Demo holder: anchor the SAID locally via an interaction (ixn) event. */
export async function demoAnchor(
  client: SignifyClient,
  walletName: string,
  aid: string,
  payload: Record<string, unknown>
): Promise<AttestResult> {
  const { said } = await saidify(payload);
  const res = await client.identifiers().interact(walletName, { d: said });
  await client.operations().wait(await res.op(), waitOpts());
  const states = (await client.keyStates().get(aid)) as Array<{ s: string }>;
  return { said, seq: states[0].s };
}

/** Veridian: send the payload to the phone for remote signing + KEL anchoring. */
export async function veridianAnchor(
  client: SignifyClient,
  companionName: string,
  veridianAid: string,
  payload: Record<string, unknown>
): Promise<AttestResult> {
  const ordered: Record<string, unknown> = {};
  ordered.i = payload.i ?? veridianAid;
  ordered.d = payload.d ?? "";
  for (const [k, v] of Object.entries(payload))
    if (k !== "i" && k !== "d") ordered[k] = v;

  const { sad, said } = await saidify(ordered);
  const hab = await client.identifiers().get(companionName);
  await client
    .exchanges()
    .send(
      companionName,
      "remotesign",
      hab,
      "/remotesign/ixn/req",
      sad as Record<string, unknown>,
      {},
      [veridianAid]
    );

  const ref = await waitForNotification(
    client,
    ["/remotesign/ixn/ref", "/exn/remotesign/ixn/ref"],
    180_000
  );
  await markAndDelete(client, ref);

  await new Promise((r) => setTimeout(r, 2000));
  let seq = "unknown";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const q = await client.keyStates().query(veridianAid, undefined, undefined);
      await client.operations().wait(q, waitOpts());
      const states = (await client.keyStates().get(veridianAid)) as Array<{
        s: string;
      }>;
      if (states.length && states[0].s) {
        seq = states[0].s;
        break;
      }
    } catch {
      /* retry */
    }
    if (attempt < 5) await new Promise((r) => setTimeout(r, 3000));
  }
  return { said, seq };
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run build -w frontend`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/keri
git commit -m "feat(frontend): holder, companion pairing, admit, offer, attest"
```

### Task 5.5: UI primitives + StepLog

**Files:**
- Create: `frontend/src/components/ui/{button,card,badge,alert,tabs}.tsx`, `frontend/src/components/StepLog.tsx`

- [ ] **Step 1: Create `frontend/src/components/ui/button.tsx`**

```tsx
import { cn } from "../../lib/cn";
export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, ...rest } = props;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50",
        className
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/ui/card.tsx`**

```tsx
import { cn } from "../../lib/cn";
export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)}
      {...rest}
    />
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ui/badge.tsx`**

```tsx
import { cn } from "../../lib/cn";
export function Badge(props: React.HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props;
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700",
        className
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/ui/alert.tsx`**

```tsx
import { cn } from "../../lib/cn";
export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-green-50 text-green-800 border-green-200",
  };
  return (
    <div className={cn("rounded-md border p-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/ui/tabs.tsx`**

```tsx
import { cn } from "../../lib/cn";
export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "px-4 py-2 text-sm",
            value === it.value
              ? "border-b-2 border-slate-900 font-semibold"
              : "text-slate-500"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/components/StepLog.tsx`**

```tsx
import { useState } from "react";
import type { StepLog as Step } from "@keri-demo/shared";
import { Badge } from "./ui/badge";
import { cn } from "../lib/cn";

function Raw({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  if (data === undefined) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-slate-500 underline"
      >
        {open ? "Hide" : "Show"} {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function StepLog({ steps }: { steps: Step[] }) {
  const ordered = [...steps].sort((a, b) => a.ts - b.ts);
  if (ordered.length === 0)
    return (
      <p className="text-sm text-slate-400">
        Steps will appear here as the flow runs.
      </p>
    );
  return (
    <ol className="space-y-3">
      {ordered.map((s, i) => (
        <li
          key={i}
          className={cn(
            "rounded-md border p-3",
            s.error ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {i + 1}. {s.title}
            </span>
            <Badge>{s.source}</Badge>
            {s.keriMessage && (
              <Badge className="bg-indigo-100 text-indigo-700">
                {s.keriMessage}
              </Badge>
            )}
          </div>
          {s.call && (
            <code className="mt-1 block font-mono text-xs text-slate-500">
              {s.call}
            </code>
          )}
          <p className="mt-1 text-sm text-slate-700">{s.explanation}</p>
          {s.error && (
            <p className="mt-1 text-sm font-medium text-red-700">{s.error}</p>
          )}
          <Raw label="request" data={s.request} />
          <Raw label="response" data={s.response} />
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run build -w frontend`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components
git commit -m "feat(frontend): UI primitives + annotated StepLog component"
```

### Task 5.6: Pages — Connect, Issue, Present, Attest

**Files:**
- Create: `frontend/src/routes/Connect.tsx`, `Issue.tsx`, `Present.tsx`, `Attest.tsx`

- [ ] **Step 1: Create `frontend/src/routes/Connect.tsx`**

```tsx
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { connectDemoHolder } from "../keri/holder";
import { connectCompanion, pairVeridian } from "../keri/companion";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";

export default function Connect() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [companionOobi, setCompanionOobi] = useState("");
  const [veridianOobi, setVeridianOobi] = useState("");

  useEffect(() => {
    if (!s.config) api.config().then((c) => s.set({ config: c })).catch(() => {});
  }, [s]);

  async function demo() {
    if (!s.config) return;
    setBusy(true);
    setErr("");
    try {
      s.recordClient({
        flow: "connect",
        title: "Boot a browser-held KERI agent",
        explanation:
          "Demo mode generates a salt in your browser and boots a signify-ts " +
          "agent on the local KERIA. The keys never leave the client — this is " +
          "the core KERI idea: you control your identifier.",
      });
      const h = await connectDemoHolder(s.config);
      s.set({
        mode: "demo",
        client: h.client,
        walletName: h.walletName,
        holderAid: h.aid,
        holderOobi: h.oobi,
      });
      s.recordClient({
        flow: "connect",
        title: "Holder AID created",
        explanation:
          "A witnessed AID was created (toad>0). Witnesses co-sign key events so " +
          "the identifier's history is tamper-evident.",
        response: { aid: h.aid },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startVeridian() {
    if (!s.config) return;
    setBusy(true);
    setErr("");
    try {
      const c = await connectCompanion(s.config);
      s.set({
        mode: "veridian",
        client: c.client,
        walletName: c.walletName,
        holderAid: c.companionAid,
        holderOobi: c.companionOobi,
        veridianAid: c.veridianAid,
      });
      setCompanionOobi(c.companionOobi);
      s.recordClient({
        flow: "connect",
        title: "Companion agent ready",
        explanation:
          "In Veridian mode the browser runs a companion agent. Scan its OOBI " +
          "with the Veridian app, then paste the wallet's OOBI back to pair both " +
          "agents' contact lists.",
        response: { companionOobi: c.companionOobi },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    if (!s.client) return;
    setBusy(true);
    setErr("");
    try {
      const aid = await pairVeridian(s.client, veridianOobi.trim());
      s.set({ veridianAid: aid });
      s.recordClient({
        flow: "connect",
        title: "Paired with Veridian wallet",
        explanation:
          "The companion resolved the wallet's OOBI. Both agents can now exchange " +
          "IPEX and remote-signing messages.",
        response: { veridianAid: aid },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && <Alert tone="error">{err}</Alert>}
      {s.holderAid && (
        <Alert tone="success">
          Connected ({s.mode}) — AID <Badge>{s.holderAid}</Badge>
          {s.mode === "veridian" && s.veridianAid && (
            <>
              {" "}
              · Veridian <Badge>{s.veridianAid}</Badge>
            </>
          )}
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Demo KERI login</h2>
          <p className="mt-1 text-sm text-slate-600">
            A browser-held identity. No phone needed. Teaches client-side key
            custody.
          </p>
          <Button className="mt-3" disabled={busy || !s.config} onClick={demo}>
            Create demo identity
          </Button>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Connect Veridian wallet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pair a real Veridian mobile wallet via OOBI/QR.
          </p>
          <Button
            className="mt-3"
            disabled={busy || !s.config}
            onClick={startVeridian}
          >
            Start companion
          </Button>
          {companionOobi && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">
                Scan this with the Veridian app:
              </p>
              <QRCodeSVG value={companionOobi} size={160} />
              <textarea
                className="w-full rounded border p-2 text-xs"
                placeholder="Paste the Veridian wallet OOBI here"
                value={veridianOobi}
                onChange={(e) => setVeridianOobi(e.target.value)}
              />
              <Button disabled={busy || !veridianOobi} onClick={pair}>
                Pair wallet
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/routes/Issue.tsx`**

```tsx
import { useState } from "react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { admitGrantOnWallet } from "../keri/admit";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { StepLog } from "../components/StepLog";

export default function Issue() {
  const s = useSession();
  const [name, setName] = useState("Ada Lovelace");
  const [email, setEmail] = useState("ada@example.org");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function issue() {
    if (!s.client || !s.config) return;
    setBusy(true);
    setErr("");
    setDone(false);
    s.clearSteps();
    try {
      // Demo: start the admit listener BEFORE the backend submits the grant.
      const admitP =
        s.mode === "demo"
          ? admitGrantOnWallet(s.client, s.walletName, s.config.issuerAid)
          : Promise.resolve("");
      s.recordClient({
        flow: "issue",
        title: s.mode === "demo" ? "Holder waits for the grant" : "Approve on phone",
        explanation:
          s.mode === "demo"
            ? "The browser holder is now polling KERIA for an `/exn/ipex/grant` " +
              "notification and will admit it automatically."
            : "Approve the incoming credential in your Veridian wallet.",
      });
      const resp = await api.issue({
        holderAid: s.holderAid,
        holderOobi: s.holderOobi,
        name,
        email,
        role,
      });
      s.addSteps(resp.steps);
      await admitP;
      s.recordClient({
        flow: "issue",
        title: "Credential admitted & stored",
        explanation:
          "The holder admitted the grant. The ACDC is now in the holder's wallet " +
          "and can be presented later.",
      });
      setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!s.holderAid)
    return <Alert tone="info">Connect an identity first (Connect tab).</Alert>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Issue a KeriDemoCredential</h2>
        <div className="mt-3 space-y-2">
          {[
            ["Name", name, setName],
            ["Email", email, setEmail],
            ["Role", role, setRole],
          ].map(([label, val, set]) => (
            <label key={label as string} className="block text-sm">
              {label as string}
              <input
                className="mt-1 w-full rounded border p-2"
                value={val as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
              />
            </label>
          ))}
          <Button disabled={busy} onClick={issue}>
            {busy ? "Issuing…" : "Issue credential"}
          </Button>
          {err && <Alert tone="error">{err}</Alert>}
          {done && <Alert tone="success">Credential issued & admitted.</Alert>}
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">What happened</h2>
        <StepLog steps={s.steps} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/routes/Present.tsx`**

```tsx
import { useState } from "react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { offerOnApply } from "../keri/offer";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { StepLog } from "../components/StepLog";
import type { VerificationCheck } from "@keri-demo/shared";

export default function Present() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checks, setChecks] = useState<VerificationCheck[] | null>(null);

  async function run() {
    if (!s.client || !s.config) return;
    setBusy(true);
    setErr("");
    setChecks(null);
    s.clearSteps();
    try {
      // Demo holder: arm the offer listener before asking the verifier to apply.
      const offerP =
        s.mode === "demo"
          ? offerOnApply(s.client, s.walletName, s.config.schemaSaid)
          : Promise.resolve();
      s.recordClient({
        flow: "present",
        title:
          s.mode === "demo" ? "Holder waits for an apply" : "Respond on phone",
        explanation:
          s.mode === "demo"
            ? "The browser holder will offer its matching credential when the " +
              "verifier's apply arrives, then grant it after agree."
            : "Approve the presentation request in your Veridian wallet.",
      });
      const start = await api.presentStart({
        holderAid: s.holderAid,
        holderOobi: s.holderOobi,
      });
      s.addSteps(start.steps);
      await offerP;
      // Poll the job.
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await api.presentStatus(start.jobId);
        s.clearSteps();
        s.addSteps(st.steps);
        if (st.status === "done") {
          setChecks(st.verification ?? []);
          break;
        }
        if (st.status === "error") {
          setErr(st.error ?? "presentation failed");
          break;
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!s.holderAid)
    return <Alert tone="info">Connect an identity first (Connect tab).</Alert>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Request a presentation</h2>
        <p className="mt-1 text-sm text-slate-600">
          The backend acts as a verifier and runs the IPEX
          apply→offer→agree→grant→admit cycle, then verifies the credential.
        </p>
        <Button className="mt-3" disabled={busy} onClick={run}>
          {busy ? "Running…" : "Request credential presentation"}
        </Button>
        {err && (
          <div className="mt-3">
            <Alert tone="error">{err}</Alert>
          </div>
        )}
        {checks && (
          <div className="mt-3 space-y-2">
            {checks.map((c) => (
              <Alert key={c.label} tone={c.passed ? "success" : "error"}>
                <strong>{c.passed ? "✓" : "✗"} {c.label}</strong>
                <div className="text-xs">{c.detail}</div>
              </Alert>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">What happened</h2>
        <StepLog steps={s.steps} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/routes/Attest.tsx`**

```tsx
import { useState } from "react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { demoAnchor, veridianAnchor } from "../keri/attest";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { StepLog } from "../components/StepLog";
import type { VerificationCheck } from "@keri-demo/shared";

export default function Attest() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checks, setChecks] = useState<VerificationCheck[] | null>(null);

  async function run() {
    if (!s.client || !s.config) return;
    setBusy(true);
    setErr("");
    setChecks(null);
    s.clearSteps();
    try {
      const reqResp = await api.attestRequest({
        holderAid: s.holderAid,
        holderOobi: s.holderOobi,
      });
      s.addSteps(reqResp.steps);
      const payload = reqResp.payload as unknown as Record<string, unknown>;

      s.recordClient({
        flow: "attest",
        title:
          s.mode === "demo"
            ? "Holder anchors the SAID (ixn)"
            : "Approve signing on phone",
        explanation:
          s.mode === "demo"
            ? "The holder SAIDifies the payload and writes an interaction (ixn) " +
              "event with the SAID as a seal — committing its key to this data."
            : "The companion forwards the payload to Veridian for remote signing.",
      });

      const { said, seq } =
        s.mode === "demo"
          ? await demoAnchor(s.client, s.walletName, s.holderAid, payload)
          : await veridianAnchor(
              s.client,
              s.walletName,
              s.veridianAid,
              payload
            );
      s.recordClient({
        flow: "attest",
        title: "Anchored",
        explanation: `SAID committed at KEL sequence ${seq}.`,
        response: { said, seq },
      });

      const vr = await api.attestVerify({
        holderAid: s.mode === "demo" ? s.holderAid : s.veridianAid,
        said,
        seq,
      });
      s.addSteps(vr.steps);
      setChecks(vr.verification);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!s.holderAid)
    return <Alert tone="info">Connect an identity first (Connect tab).</Alert>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Request an attestation</h2>
        <p className="mt-1 text-sm text-slate-600">
          The backend supplies a nonce'd payload; the holder anchors its SAID in
          its KEL; the backend verifies the seal against the KEL.
        </p>
        <Button className="mt-3" disabled={busy} onClick={run}>
          {busy ? "Running…" : "Request attestation"}
        </Button>
        {err && (
          <div className="mt-3">
            <Alert tone="error">{err}</Alert>
          </div>
        )}
        {checks &&
          checks.map((c) => (
            <div className="mt-2" key={c.label}>
              <Alert tone={c.passed ? "success" : "error"}>
                <strong>
                  {c.passed ? "✓" : "✗"} {c.label}
                </strong>
                <div className="text-xs">{c.detail}</div>
              </Alert>
            </div>
          ))}
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">What happened</h2>
        <StepLog steps={s.steps} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run build -w frontend`
Expected: succeeds (pages compiled; App still placeholder).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes
git commit -m "feat(frontend): Connect/Issue/Present/Attest pages"
```

### Task 5.7: App shell + routing

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `frontend/src/App.tsx`**

```tsx
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Connect from "./routes/Connect";
import Issue from "./routes/Issue";
import Present from "./routes/Present";
import Attest from "./routes/Attest";
import { useSession } from "./state/session";
import { cn } from "./lib/cn";

const tabs = [
  ["/connect", "1 · Connect"],
  ["/issue", "2 · Issue"],
  ["/present", "3 · Present"],
  ["/attest", "4 · Attest"],
] as const;

export default function App() {
  const mode = useSession((s) => s.mode);
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">KERI + Veridian — Educational Demo</h1>
        <p className="text-sm text-slate-600">
          Issue, present, and attest ACDC credentials. Every step is explained.
          {mode !== "none" && ` · mode: ${mode}`}
        </p>
      </header>
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "px-4 py-2 text-sm",
                isActive
                  ? "border-b-2 border-slate-900 font-semibold"
                  : "text-slate-500"
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/connect" replace />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/issue" element={<Issue />} />
        <Route path="/present" element={<Present />} />
        <Route path="/attest" element={<Attest />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build -w frontend`
Expected: succeeds; `frontend/dist` produced.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): app shell with tabbed flow navigation"
```

---

## Phase 6 — Docker + compose + smoke + docs

### Task 6.1: Backend Dockerfile (multi-stage)

**Files:**
- Create: `backend/Dockerfile`, `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
**/node_modules
**/dist
.git
.env
backend/data
```

- [ ] **Step 2: Create `backend/Dockerfile`**

```dockerfile
# Multi-stage: build shared -> frontend -> backend, run backend serving dist.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY . .
RUN npm run build:shared \
 && npm run schema:saidify \
 && npm run build:frontend \
 && npm run build:backend

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/infra/schema ./infra/schema
WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile .dockerignore
git commit -m "build: multi-stage Dockerfile for the app service"
```

### Task 6.2: docker-compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

(Pinned KERIA tag from upstream `veridian-wallet` at spec time. To bump: see README.)

```yaml
services:
  witnesses:
    container_name: kdemo-witnesses
    image: weboftrust/keri:1.1.26
    environment:
      - PYTHONUNBUFFERED=1
      - PYTHONIOENCODING=UTF-8
    entrypoint: [kli]
    command: [witness, demo]
    volumes:
      - ./infra/keria-config/witnesses:/keripy/scripts/keri/cf/main
    ports:
      - "5642:5642"
      - "5643:5643"
      - "5644:5644"
      - "5645:5645"
      - "5646:5646"
      - "5647:5647"

  keria:
    container_name: kdemo-keria
    image: ghcr.io/cardano-foundation/cf-identity-wallet/cf-idw-keria:1.2.0-fix-VT20-2191-Un-ordered-exchange-queries-pagination-is-not-reliable-re-orders-a-a1cbe1f
    environment:
      - KERI_AGENT_CORS=true
      - ALLOW_INTRODUCTIONS=true
      - REMOTE_SIGNING=true
    volumes:
      - keria-data:/usr/local/var/keri
      - ./infra/keria-config/config.json:/keria/scripts/keri/cf/backer-oobis.json
    entrypoint: keria start --config-file backer-oobis --config-dir ./scripts --loglevel INFO
    depends_on: [witnesses]
    ports:
      - "3901:3901"
      - "3902:3902"
      - "3903:3903"

  app:
    container_name: kdemo-app
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      - KERIA_URL=http://keria:3901
      - KERIA_BOOT_URL=http://keria:3903
      - ISSUER_NAME=keri-demo-issuer
      - ISSUER_REGISTRY=keri-demo-registry
      - PUBLIC_HOST=${PUBLIC_HOST:-http://localhost:3001}
      - PORT=3001
      - VITE_KERIA_URL=${VITE_KERIA_URL:-http://localhost:3901}
      - VITE_KERIA_BOOT_URL=${VITE_KERIA_BOOT_URL:-http://localhost:3903}
    volumes:
      - app-data:/app/backend/data
    depends_on: [keria]
    ports:
      - "3001:3001"

volumes:
  keria-data:
  app-data:
```

- [ ] **Step 2: Validate compose syntax**

Run: `docker compose config -q`
Expected: no output (valid).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "build: docker-compose (witnesses + cf-idw-keria + app)"
```

### Task 6.3: Integration smoke (demo mode, no phone)

**Files:**
- Create: `scripts/smoke.md`

- [ ] **Step 1: Create `scripts/smoke.md`**

```markdown
# Demo-mode smoke test (no phone required)

1. `docker compose up -d --build`
2. Wait for readiness:
   `until curl -sf http://localhost:3001/readyz; do sleep 3; done`
3. Open http://localhost:3001 in a browser.
4. **Connect** tab → "Create demo identity". Expect a success banner with an AID
   and connect steps in the log.
5. **Issue** tab → keep defaults → "Issue credential". Expect:
   - backend steps: issue ACDC, send grant
   - client steps: holder waits, credential admitted
   - green "Credential issued & admitted".
6. **Present** tab → "Request credential presentation". Expect the
   apply→offer→agree→grant→admit steps and three green verification checks.
7. **Attest** tab → "Request attestation". Expect the anchor step with a SAID +
   sequence, and green KEL verification checks.

Pass criteria: steps 5–7 all reach green states with no error steps.
```

- [ ] **Step 2: Run the smoke test manually**

Run: `docker compose up -d --build` then follow `scripts/smoke.md`.
Expected: all steps reach green. If KERIA is slow on first boot, the backend
logs `[bootstrap] attempt N failed … retrying`; `/readyz` returns 200 once the
issuer is bootstrapped — this is expected, not a failure.

- [ ] **Step 3: Tear down**

Run: `docker compose down`
Expected: containers removed.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.md
git commit -m "test: documented demo-mode integration smoke"
```

### Task 6.4: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
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

## Veridian (real wallet) mode

1. Set `PUBLIC_HOST` in `.env` to a URL your phone can reach on the LAN, e.g.
   `http://192.168.1.50:3001` (the schema/issuer OOBIs must resolve from the
   phone). Re-run `docker compose up -d`.
2. **Connect** tab → "Start companion" → scan the QR with the Veridian app →
   paste the wallet's OOBI back → "Pair wallet".
3. Issue/Present/Attest then prompt for approval inside the Veridian app.

Veridian attestation uses the `/remotesign` exchange route and requires the
`cf-idw-keria` image with `REMOTE_SIGNING=true` (already set in compose). If a
Veridian build does not support it, demo mode still fully demonstrates
attestation.

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
npm test
```
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README (run, Veridian mode, attribution, teaching gaps)"
```

### Task 6.5: Final full build + test gate

- [ ] **Step 1: Clean build everything**

Run: `npm install && npm run build && npm test`
Expected: shared+frontend+backend build clean; all Vitest suites pass.

- [ ] **Step 2: Validate compose once more**

Run: `docker compose config -q`
Expected: no output.

- [ ] **Step 3: Commit any lockfile/build fixups**

```bash
git add -A
git commit -m "chore: final build + test gate green" || echo "nothing to commit"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §3 three-agent architecture | 4.1–4.5 (backend issuer/verifier), 5.4 (browser holder/companion) |
| §4.1 keria service (CF image, env, config mount, pinned tag) | 6.2 |
| §4.2 witnesses service | 6.2 |
| §4.3 app service (API + schema OOBI + static) | 4.7, 6.1, 6.2 |
| §4.4 startup ordering / bootstrap retry | 4.7 (server retry), 6.2 (depends_on) |
| §4.5 vendored keria-config + NOTICE + update script | 2.2 |
| §5 custom ACDC schema + saidify + /oobi serving | 2.1, 4.7 |
| §6 backend modules (client/issuer/grant/present/attest/jobs/routes/server) | 4.1–4.7 |
| §6 serialized op queue | 4.1 (`serialize`) |
| §7 REST API surface | 4.7 |
| §8 StepLog mechanism | 1.1 (type), 3.4 (recorder), 5.5 (component) |
| §9 frontend modules + pages | 5.2–5.7 |
| §10 configuration / env | 0.1, 3.1, 6.2 |
| §11 error handling (timeouts, readable hints, partial steps) | 3.3 timeout, 4.7 fail()+job steps |
| §12 testing (TDD pure logic, contract, smoke) | 1.1/2.1/3.2/3.4/3.5/4.6 (TDD), 6.3 (smoke) |
| §13 repo layout | matches File Structure |
| §14 known gaps documented | 6.4 README, NOTICE |

No spec requirement is left without a task.

**2. Placeholder scan**

`backend/src/App.tsx` placeholder in Task 5.1 is explicitly replaced in Task 5.7
(intentional, not a plan placeholder). `scripts/smoke.md` and Veridian steps are
manual by necessity (a mobile wallet cannot be containerized) and are concrete.
No "TBD"/"add error handling"/"similar to Task N"/uncoded steps remain.

**3. Type consistency**

`ConfigDTO`, `IssueRequest/Response`, `PresentStart*`, `PresentStatusResponse`,
`AttestPayload`, `AttestRequest*`, `AttestVerify*`, `VerificationCheck`,
`StepLog`, `WitnessInfo` are defined once in `shared/src/types.ts` (Task 1.1) and
consumed unchanged by backend (Tasks 4.x) and frontend (Tasks 5.x). `StepRecorder`
(3.4) emits `StepLog`. `JobRegistry` (4.6) stores `StepLog[]`/result consumed by
`/present/:jobId` (4.7) and `Present.tsx` (5.6). `HolderSession`/`CompanionSession`
shapes consumed by `Connect.tsx`. Names checked consistent across tasks.

---

## Execution Handoff

(See end-of-skill prompt — offer subagent-driven vs inline execution.)
