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
