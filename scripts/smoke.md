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

## Automated demo e2e

`npm run test:e2e` (with the stack up) drives the same demo-mode flow
headlessly via signify-ts — no browser or phone needed. See
`backend/test/e2e.demo.test.ts`.
