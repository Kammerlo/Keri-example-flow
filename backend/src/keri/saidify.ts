// ─── KERI layer: SAID ────────────────────────────────────────────────────────
// A SAID (Self-Addressing IDentifier) is a Blake3 digest of a payload embedded
// back into that payload's `d` field, so the content is its own tamper-evident
// id. Attestation anchors a SAID into the holder's KEL; change one byte and the
// SAID — and every downstream check — no longer matches.
import { Saider } from "signify-ts";

export async function saidify(
  payload: Record<string, unknown>
): Promise<{ sad: Record<string, unknown>; said: string }> {
  const result = (Saider as unknown as {
    saidify: (p: Record<string, unknown>) => [unknown, Record<string, unknown>];
  }).saidify(payload);
  if (Array.isArray(result)) {
    const [saider, sad] = result as [Record<string, unknown>, Record<string, unknown>];
    const said =
      typeof saider === "string"
        ? saider
        : ((saider.qb64 ?? saider.said) as string);
    return { sad, said };
  }
  const r = result as { sad: Record<string, unknown>; said: string };
  return { sad: r.sad, said: r.said };
}
