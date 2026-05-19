import type { SignifyClient } from "signify-ts";
import { saidify } from "./saidify";
import { waitOpts } from "./timeout";

export interface AttestResult {
  said: string;
  seq: string;
}

/**
 * Demo holder: anchor the payload's SAID locally via an interaction (ixn)
 * event. (Veridian attestation is driven by the backend's /remotesign flow —
 * see backend keri/attest.ts remoteSignAttestation.)
 */
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
