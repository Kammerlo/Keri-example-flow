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
