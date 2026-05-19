# Onboarding & Start Guide

This is an educational app for learning **KERI** + **ACDC** credentials. You can
run it two ways:

- **Demo mode** — a browser-held KERI identity, no phone/wallet needed. Fully
  works out of the box and is covered by the automated e2e test.
- **Veridian mode** — a real Veridian wallet drives issuance / presentation /
  attestation. Needs the Veridian wallet running (see below).

---

## 1. Start this app

```bash
git checkout main
docker compose up -d --build
# wait until the issuer is ready:
until curl -sf http://localhost:3001/readyz; do sleep 3; done
open http://localhost:3001
```

Then use the tabs in order: **Connect → Issue → Present → Attest**. Every step
is explained inline in the step log.

### Demo mode (no wallet)

On **Connect**, click **Create demo identity**. You're taken to **Issue**.
Run Issue → Present → Attest. Done — nothing else to set up.

To verify the whole flow headlessly:

```bash
npm install
npm run test:e2e   # requires the stack from step 1 to be up
```

---

## 2. Start the Veridian wallet (for Veridian mode)

The Veridian mode talks to a **real Veridian wallet**. Start it from the
[cardano-foundation/veridian-wallet](https://github.com/cardano-foundation/veridian-wallet)
repo:

```bash
git checkout main      # in the veridian-wallet repo
npm install
npm run dev
```

Then, in the browser that opens:

1. Open **developer tools** and switch to **mobile view** (device toolbar /
   responsive mode). The Veridian wallet only renders correctly in the mobile
   viewport.
2. **Refresh the page once** after the mobile view is active — the app must
   re-bootstrap in the mobile layout or the wallet UI won't initialise
   correctly.
3. Onboard a wallet identifier when prompted.

> The Veridian app connects to **this stack's KERIA** — it just needs the
> connection/boot URLs shown on the **Connect** page (defaults
> `http://localhost:3901` / `http://localhost:3903`). Everything else
> (schema/issuer OOBIs) is resolved by KERIA itself inside docker, so no other
> URLs need changing.

### Connect Veridian to this app

On this app's **Connect** tab, Veridian card:

1. In the Veridian wallet, set the **Connection URL** and **Boot URL** to the
   values shown on the Connect card.
2. Add a connection in Veridian using the **Issuer OOBI** shown (scan the QR or
   Copy it).
3. In Veridian, share your identifier's OOBI and paste it into the field, then
   **Connect Veridian & continue** — you're taken to **Issue**.
4. Issue / Present / Attest now prompt for approval **on the wallet**.

---

## 3. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/readyz` not ready for a while | KERIA is still booting; the backend retries issuer bootstrap automatically. Wait. |
| Veridian: "Failed to resolve OOBI, operation not completing" | The wallet's KERIA can't reach the schema host. The default assumes the wallet uses *this* stack's KERIA (`SCHEMA_OOBI_HOST=http://app:3001`). If your wallet uses a different KERIA, set `SCHEMA_OOBI_HOST` to a host that KERIA can reach and `docker compose down -v && up`. |
| Veridian wallet UI looks broken | You're not in mobile view, or you didn't refresh after enabling it (see step 2). |
| Demo works, Veridian doesn't | Confirm the Veridian app's Connection/Boot URLs match the Connect card and the wallet onboarded against this KERIA. |

For the deeper networking model and KERI design notes see `README.md` and
`docs/superpowers/specs/`.
