import { useState } from "react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { demoAnchor, veridianAnchor } from "../keri/attest";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { StepLog } from "../components/StepLog";
import type { VerificationCheck } from "@keri-demo/shared";

export default function Attest() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checks, setChecks] = useState<VerificationCheck[] | null>(null);

  async function run() {
    if (!s.client || !s.config) return;
    setBusy(true);
    setErr("");
    setChecks(null);
    s.clearSteps();
    try {
      const reqResp = await api.attestRequest({
        holderAid: s.holderAid,
        holderOobi: s.holderOobi,
      });
      s.addSteps(reqResp.steps);
      const payload = reqResp.payload as unknown as Record<string, unknown>;

      s.recordClient({
        flow: "attest",
        title:
          s.mode === "demo"
            ? "Holder anchors the SAID (ixn)"
            : "Approve signing on phone",
        explanation:
          s.mode === "demo"
            ? "The holder SAIDifies the payload and writes an interaction (ixn) " +
              "event with the SAID as a seal — committing its key to this data."
            : "The companion forwards the payload to Veridian for remote signing.",
      });

      const { said, seq } =
        s.mode === "demo"
          ? await demoAnchor(s.client, s.walletName, s.holderAid, payload)
          : await veridianAnchor(
              s.client,
              s.walletName,
              s.veridianAid,
              payload
            );
      s.recordClient({
        flow: "attest",
        title: "Anchored",
        explanation: `SAID committed at KEL sequence ${seq}.`,
        response: { said, seq },
      });

      const vr = await api.attestVerify({
        holderAid: s.mode === "demo" ? s.holderAid : s.veridianAid,
        said,
        seq,
      });
      s.addSteps(vr.steps);
      setChecks(vr.verification);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!s.holderAid)
    return <Alert tone="info">Connect an identity first (Connect tab).</Alert>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Request an attestation</h2>
        <p className="mt-1 text-sm text-slate-600">
          The backend supplies a nonce'd payload; the holder anchors its SAID in
          its KEL; the backend verifies the seal against the KEL.
        </p>
        <Button className="mt-3" disabled={busy} onClick={run}>
          {busy ? "Running…" : "Request attestation"}
        </Button>
        {err && (
          <div className="mt-3">
            <Alert tone="error">{err}</Alert>
          </div>
        )}
        {checks &&
          checks.map((c) => (
            <div className="mt-2" key={c.label}>
              <Alert tone={c.passed ? "success" : "error"}>
                <strong>
                  {c.passed ? "✓" : "✗"} {c.label}
                </strong>
                <div className="text-xs">{c.detail}</div>
              </Alert>
            </div>
          ))}
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">What happened</h2>
        <StepLog steps={s.steps} />
      </Card>
    </div>
  );
}
