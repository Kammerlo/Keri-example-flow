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
