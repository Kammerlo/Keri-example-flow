// ─── KERI layer: SAID ────────────────────────────────────────────────────────
// Self-Addressing IDentifier: a Blake3 digest of the payload written back into
// its own `d` field. The holder SAIDifies the attestation payload, anchors the
// SAID in its KEL, and the backend re-derives/verifies it — content integrity
// with no shared secret.
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
