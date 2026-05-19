// ─── KERI layer (browser): KERIA client ──────────────────────────────────────
// The demo holder runs signify-ts *in the browser* and keeps its own salt in
// localStorage — the keys never touch our backend. This is the core KERI
// lesson: the holder, not the issuer, controls the identifier. boot() = one-
// time agent provisioning; connect() = authenticated session.
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
