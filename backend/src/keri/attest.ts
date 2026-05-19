import { randomBytes } from "node:crypto";
import { type SignifyClient } from "signify-ts";
import type { AttestPayload, VerificationCheck } from "@keri-demo/shared";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import { saidify } from "./saidify";
import { waitForNotification, markAndDelete } from "./notifications";
import { checkAnchorInKel } from "./verifyKel";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createAttestationRequest(
  holderAid: string,
  rec: StepRecorder
): AttestPayload {
  // `i` first, `d` second: the holder/Veridian recompute the SAID and the key
  // order must match (see reference remotesign.ts ordering).
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

/**
 * Veridian attestation, adopted precisely from KeriService.requestAttestation:
 * the backend sends a /remotesign/ixn/req exchange to the wallet AID, the phone
 * signs + anchors an ixn, the backend waits for /remotesign/ixn/ref then reads
 * the wallet's new key-state sequence. Returns the anchored SAID + sequence so
 * verifyAttestation can confirm the seal in the KEL.
 */
export async function remoteSignAttestation(
  verifier: IssuerState,
  issuerName: string,
  holderAid: string,
  rec: StepRecorder
): Promise<{ said: string; seq: string }> {
  const client = verifier.client;

  // CRITICAL (per KeriService comment): signify's createExchangeMessage does
  // attrs.put("i", recipient) then putAll(payload). The payload's first key
  // MUST be `i` and second `d` so the SAID we compute matches the one Veridian
  // recomputes — otherwise the wallet drops the request without any UI.
  const payload: Record<string, unknown> = {
    i: holderAid,
    d: "",
    purpose: "demo-attestation",
    nonce: randomBytes(16).toString("hex"),
    dt: nowKeriTimestamp(),
  };
  const { sad, said } = await saidify(payload);

  rec.add({
    title: "Verifier sends a remote-sign request to the wallet",
    call: 'client.exchanges().send(name, "remotesign", hab, "/remotesign/ixn/req", ...)',
    keriMessage: "/remotesign/ixn/req",
    explanation:
      "The backend asks the Veridian wallet to anchor this payload's SAID in its " +
      "own KEL. Approve the signing request on your phone.",
    response: sad,
  });
  const hab = await client.identifiers().get(issuerName);
  await client
    .exchanges()
    .send(
      issuerName,
      "remotesign",
      hab,
      "/remotesign/ixn/req",
      sad as Record<string, unknown>,
      {},
      [holderAid]
    );

  const ref = await waitForNotification(
    client,
    ["/remotesign/ixn/ref", "/exn/remotesign/ixn/ref"],
    180_000
  );
  await markAndDelete(client, ref);

  // Let KERIA settle the new ixn, then read the wallet's latest key state.
  await sleep(2000);
  let seq = "unknown";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const q = await client
        .keyStates()
        .query(holderAid, undefined, undefined);
      await client.operations().wait(q, waitOpts());
      const states = (await client.keyStates().get(holderAid)) as Array<{
        s: string;
      }>;
      if (states.length && states[0].s) {
        seq = states[0].s;
        break;
      }
    } catch {
      /* retry */
    }
    if (attempt < 5) await sleep(3000);
  }
  rec.add({
    title: "Wallet anchored the attestation",
    explanation: `The Veridian wallet signed and anchored the SAID at KEL sequence ${seq}.`,
    response: { said, seq },
  });
  return { said, seq };
}
