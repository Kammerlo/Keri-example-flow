import { useState } from "react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { admitGrantOnWallet } from "../keri/admit";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { StepLog } from "../components/StepLog";

export default function Issue() {
  const s = useSession();
  const [name, setName] = useState("Ada Lovelace");
  const [email, setEmail] = useState("ada@example.org");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function issue() {
    if (!s.config || !s.holderAid) return;
    setBusy(true);
    setErr("");
    setDone(false);
    s.clearSteps();
    try {
      // Demo: start the admit listener BEFORE the backend submits the grant.
      // Veridian: the phone admits; the backend blocks on /exn/ipex/admit.
      const admitP =
        s.mode === "demo" && s.client
          ? admitGrantOnWallet(s.client, s.walletName, s.config.issuerAid)
          : Promise.resolve("");
      s.recordClient({
        flow: "issue",
        title: s.mode === "demo" ? "Holder waits for the grant" : "Approve on phone",
        explanation:
          s.mode === "demo"
            ? "The browser holder is now polling KERIA for an `/exn/ipex/grant` " +
              "notification and will admit it automatically."
            : "Approve the incoming credential in your Veridian wallet.",
      });
      const resp = await api.issue({
        holderAid: s.holderAid,
        holderOobi: s.holderOobi,
        name,
        email,
        role,
      });
      s.addSteps(resp.steps);
      await admitP;
      s.recordClient({
        flow: "issue",
        title: "Credential admitted & stored",
        explanation:
          "The holder admitted the grant. The ACDC is now in the holder's wallet " +
          "and can be presented later.",
      });
      setDone(true);
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
        <h2 className="text-lg font-semibold">Issue a KeriDemoCredential</h2>
        <div className="mt-3 space-y-2">
          {[
            ["Name", name, setName],
            ["Email", email, setEmail],
            ["Role", role, setRole],
          ].map(([label, val, set]) => (
            <label key={label as string} className="block text-sm">
              {label as string}
              <input
                className="mt-1 w-full rounded border p-2"
                value={val as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
              />
            </label>
          ))}
          <Button disabled={busy} onClick={issue}>
            {busy ? "Issuing…" : "Issue credential"}
          </Button>
          {err && <Alert tone="error">{err}</Alert>}
          {done && <Alert tone="success">Credential issued & admitted.</Alert>}
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">What happened</h2>
        <StepLog steps={s.steps} />
      </Card>
    </div>
  );
}
