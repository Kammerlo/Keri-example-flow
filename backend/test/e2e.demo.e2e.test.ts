/**
 * End-to-end demo-wallet flow against the live docker stack.
 *
 * Requires: `docker compose up -d --build` and the app reporting /readyz.
 * This drives the SAME logic the browser demo holder uses (signify-ts), but
 * headlessly, so the full connect → issue → present → attest path is verified
 * without a browser or a phone. Run: `npm run test:e2e`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  SignifyClient,
  ready,
  Tier,
  Serder,
  randomPasscode,
} from "signify-ts";
import type { ConfigDTO } from "@keri-demo/shared";
import { waitForNotification, markAndDelete } from "../src/keri/notifications";
import { saidify } from "../src/keri/saidify";
import { nowKeriTimestamp, waitOpts } from "../src/keri/timeout";

const BASE = process.env.E2E_BASE || "http://localhost:3001";
const HOLDER_NAME = "e2e-holder";

let cfg: ConfigDTO;
let client: SignifyClient;
let holderAid: string;
let holderOobi: string;

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return (await r.json()) as T;
}
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok && r.status >= 500) throw new Error(j.error || `POST ${path} ${r.status}`);
  return j;
}

describe("demo-wallet end-to-end", () => {
  beforeAll(async () => {
    // Wait for the backend issuer to be ready.
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(BASE + "/readyz");
        if (r.ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
    cfg = await getJson<ConfigDTO>("/api/config");
    expect(cfg.issuerAid).toMatch(/^E/);

    await ready();
    const salt = randomPasscode();
    client = new SignifyClient(cfg.keriaUrl, salt, Tier.low, cfg.keriaBootUrl);
    try {
      await client.boot();
    } catch (e) {
      const m = e instanceof Error ? e.message : JSON.stringify(e);
      if (!m.match(/already exists|400/i)) throw e;
    }
    await client.connect();

    const create = await client.identifiers().create(HOLDER_NAME, {
      transferable: true,
      toad: cfg.toad,
      wits: cfg.witnesses.map((w) => w.aid),
    });
    await client.operations().wait(await create.op(), waitOpts(120_000));
    holderAid = (await client.identifiers().get(HOLDER_NAME)).prefix;
    const role = await client
      .identifiers()
      .addEndRole(HOLDER_NAME, "agent", client.agent!.pre);
    await client.operations().wait(await role.op(), waitOpts());

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
    const oobiRes = await client.oobis().get(HOLDER_NAME, "agent");
    holderOobi = (oobiRes as { oobis?: string[] }).oobis?.[0] ?? "";
    expect(holderOobi).toMatch(/\/oobi\//);
  });

  it("issues a credential and the holder admits it", async () => {
    const admitP = (async () => {
      const note = await waitForNotification(
        client,
        ["/exn/ipex/grant", "/ipex/grant"],
        120_000
      );
      const [exn, sigs, atc] = await client.ipex().admit({
        senderName: HOLDER_NAME,
        recipient: cfg.issuerAid,
        datetime: nowKeriTimestamp(),
        grantSaid: note.a.d,
        message: "",
      });
      const op = await client
        .ipex()
        .submitAdmit(HOLDER_NAME, exn, sigs, atc, [cfg.issuerAid]);
      await client.operations().wait(op, waitOpts());
      await markAndDelete(client, note);
    })();

    const resp = await postJson<{ credentialSaid: string; error?: string }>(
      "/api/issuer/issue",
      {
        holderAid,
        holderOobi,
        name: "Ada Lovelace",
        email: "ada@example.org",
        role: "student",
      }
    );
    expect(resp.error).toBeUndefined();
    expect(resp.credentialSaid).toMatch(/^E/);
    await admitP;

    const creds = (await client.credentials().list()) as Array<{
      sad: { d: string; s: string };
    }>;
    expect(creds.some((c) => c.sad.s === cfg.schemaSaid)).toBe(true);
  });

  it("presents the credential and the verifier validates it", async () => {
    const offerP = (async () => {
      const applyNote = await waitForNotification(
        client,
        ["/exn/ipex/apply", "/ipex/apply"],
        180_000
      );
      const applySaid = applyNote.a.d;
      const applyExchange = await client.exchanges().get(applySaid);
      const verifierAid = (applyExchange.exn as { i: string }).i;
      await markAndDelete(client, applyNote);

      const list = (await client.credentials().list()) as Array<{
        sad: { d: string; s: string };
      }>;
      const match = list.find((c) => c.sad.s === cfg.schemaSaid)!;
      const cred = (await client.credentials().get(match.sad.d)) as unknown as {
        sad: Record<string, unknown>;
        atc: string;
        iss: Record<string, unknown>;
        issatc: string;
        anc: Record<string, unknown>;
        ancatc: string;
      };
      const acdc = new Serder(cred.sad);

      const [oExn, oSigs, oEnd] = await client.ipex().offer({
        senderName: HOLDER_NAME,
        recipient: verifierAid,
        acdc,
        applySaid,
        datetime: nowKeriTimestamp(),
      });
      const oOp = await client
        .ipex()
        .submitOffer(HOLDER_NAME, oExn, oSigs, oEnd, [verifierAid]);
      await client.operations().wait(oOp, waitOpts());

      const agreeNote = await waitForNotification(
        client,
        ["/exn/ipex/agree", "/ipex/agree"],
        180_000
      );
      const agreeSaid = agreeNote.a.d;
      await markAndDelete(client, agreeNote);

      const [gExn, gSigs, gEnd] = await client.ipex().grant({
        senderName: HOLDER_NAME,
        recipient: verifierAid,
        acdc,
        acdcAttachment: cred.atc,
        iss: new Serder(cred.iss),
        issAttachment: cred.issatc,
        anc: new Serder(cred.anc),
        ancAttachment: cred.ancatc,
        agreeSaid,
        datetime: nowKeriTimestamp(),
      });
      const gOp = await client
        .ipex()
        .submitGrant(HOLDER_NAME, gExn, gSigs, gEnd, [verifierAid]);
      await client.operations().wait(gOp, waitOpts());
    })();

    const start = await postJson<{ jobId: string }>(
      "/api/verifier/present/start",
      { holderAid, holderOobi }
    );
    await offerP;

    let verification: Array<{ passed: boolean; label: string }> | undefined;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await getJson<{
        status: string;
        verification?: Array<{ passed: boolean; label: string }>;
        error?: string;
      }>(`/api/verifier/present/${start.jobId}`);
      if (st.status === "done") {
        verification = st.verification;
        break;
      }
      if (st.status === "error") throw new Error(st.error);
    }
    expect(verification, "presentation did not complete").toBeTruthy();
    expect(verification!.length).toBeGreaterThanOrEqual(3);
    for (const c of verification!) expect(c.passed, c.label).toBe(true);
  });

  it("anchors an attestation and the verifier confirms it in the KEL", async () => {
    const req = await postJson<{
      payload: Record<string, unknown>;
    }>("/api/verifier/attest/request", { holderAid, holderOobi });
    const payload = req.payload;

    const { said } = await saidify(payload);
    const res = await client.identifiers().interact(HOLDER_NAME, { d: said });
    await client.operations().wait(await res.op(), waitOpts());
    const states = (await client.keyStates().get(holderAid)) as Array<{
      s: string;
    }>;
    const seq = states[0].s;

    const vr = await postJson<{
      verification: Array<{ passed: boolean; label: string }>;
    }>("/api/verifier/attest/verify", { holderAid, said, seq });
    expect(vr.verification.length).toBeGreaterThanOrEqual(1);
    for (const c of vr.verification) expect(c.passed, c.label).toBe(true);
  });
});
