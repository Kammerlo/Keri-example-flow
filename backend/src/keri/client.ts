// ─── KERI layer: KERIA client ────────────────────────────────────────────────
// signify-ts is the edge signer; KERIA is the cloud agent that holds encrypted
// key material and talks to witnesses on the controller's behalf. A client is
// created from a 21-char `bran` (salt): `boot()` provisions the agent once,
// `connect()` authenticates every subsequent (signed) request. All key events
// and IPEX exchanges flow through this client.
import { SignifyClient, ready, Tier, randomPasscode } from "signify-ts";
import { withTimeout } from "./timeout";

// One KERIA agent processes operations sequentially; concurrent ops on the same
// client interleave and corrupt the agent's state. Every KERI call on the
// shared issuer client is funnelled through this single-flight queue.
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
  await ready(); // load the libsodium wasm before any crypto
  const client = new SignifyClient(keriaUrl, salt, Tier.low, keriaBootUrl);
  // boot() = one-time agent provisioning for this salt. On a re-run the agent
  // already exists and KERIA replies 400 — that is expected, not an error.
  try {
    await withTimeout(client.boot(), "client.boot()");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    if (!msg.match(/already exists|400/i)) throw e;
  }
  // connect() establishes the authenticated session (signed-request headers).
  await withTimeout(client.connect(), "client.connect()");
  return client;
}
