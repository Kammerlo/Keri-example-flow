import { useState } from "react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { offerOnApply } from "../keri/offer";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { StepLog } from "../components/StepLog";
import type { VerificationCheck } from "@keri-demo/shared";

export default function Present() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checks, setChecks] = useState<VerificationCheck[] | null>(null);

  async function run() {
    if (!s.config || !s.holderAid) return;
    setBusy(true);
    setErr("");
    setChecks(null);
    s.clearSteps();
    try {
      // Demo holder: arm the offer listener before asking the verifier to apply.
      // Veridian: the phone responds to the apply notification itself.
      const offerP =
        s.mode === "demo" && s.client
          ? offerOnApply(s.client, s.walletName, s.config.schemaSaid)
          : Promise.resolve();
      s.recordClient({
        flow: "present",
        title:
          s.mode === "demo" ? "Holder waits for an apply" : "Respond on phone",
        explanation:
          s.mode === "demo"
            ? "The browser holder will offer its matching credential when the " +
              "verifier's apply arrives, then grant it after agree."
            : "Approve the presentation request in your Veridian wallet.",
      });
      const start = await api.presentStart({
        holderAid: s.holderAid,
        holderOobi: s.holderOobi,
      });
      s.addSteps(start.steps);
      await offerP;
      // Poll the job.
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await api.presentStatus(start.jobId);
        s.clearSteps();
        s.addSteps(st.steps);
        if (st.status === "done") {
          setChecks(st.verification ?? []);
          break;
        }
        if (st.status === "error") {
          setErr(st.error ?? "presentation failed");
          break;
        }
      }
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
        <h2 className="text-lg font-semibold">Request a presentation</h2>
        <p className="mt-1 text-sm text-slate-600">
          The backend acts as a verifier and runs the IPEX
          apply→offer→agree→grant→admit cycle, then verifies the credential.
        </p>
        <Button className="mt-3" disabled={busy} onClick={run}>
          {busy ? "Running…" : "Request credential presentation"}
        </Button>
        {err && (
          <div className="mt-3">
            <Alert tone="error">{err}</Alert>
          </div>
        )}
        {checks && (
          <div className="mt-3 space-y-2">
            {checks.map((c) => (
              <Alert key={c.label} tone={c.passed ? "success" : "error"}>
                <strong>{c.passed ? "✓" : "✗"} {c.label}</strong>
                <div className="text-xs">{c.detail}</div>
              </Alert>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">What happened</h2>
        <StepLog steps={s.steps} />
      </Card>
    </div>
  );
}
