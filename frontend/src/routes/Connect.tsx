import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { connectDemoHolder } from "../keri/holder";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";

export default function Connect() {
  const s = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [veridianOobi, setVeridianOobi] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!s.config) api.config().then((c) => s.set({ config: c })).catch(() => {});
  }, [s]);

  async function copyIssuerOobi() {
    const text = s.config?.issuerOobi ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function demo() {
    if (!s.config) return;
    setBusy(true);
    setErr("");
    try {
      s.recordClient({
        flow: "connect",
        title: "Boot a browser-held KERI agent",
        explanation:
          "Demo mode generates a salt in your browser and boots a signify-ts " +
          "agent on the local KERIA. The keys never leave the client — this is " +
          "the core KERI idea: you control your identifier.",
      });
      const h = await connectDemoHolder(s.config);
      s.set({
        mode: "demo",
        client: h.client,
        walletName: h.walletName,
        holderAid: h.aid,
        holderOobi: h.oobi,
        veridianAid: "",
      });
      s.recordClient({
        flow: "connect",
        title: "Holder AID created",
        explanation:
          "A witnessed AID was created (toad>0). Witnesses co-sign key events so " +
          "the identifier's history is tamper-evident.",
        response: { aid: h.aid },
      });
      navigate("/issue");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connectVeridian() {
    if (!veridianOobi.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const resp = await api.veridianConnect(veridianOobi.trim());
      s.addSteps(resp.steps);
      s.set({
        mode: "veridian",
        client: null,
        walletName: "",
        holderAid: resp.aid,
        holderOobi: veridianOobi.trim(),
        veridianAid: resp.aid,
      });
      navigate("/issue");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cfg = s.config;

  return (
    <div className="space-y-4">
      {err && <Alert tone="error">{err}</Alert>}
      {s.holderAid && (
        <Alert tone="success">
          Connected ({s.mode}) — AID <Badge>{s.holderAid}</Badge>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Demo KERI login</h2>
          <p className="mt-1 text-sm text-slate-600">
            A browser-held identity. No phone needed. Teaches client-side key
            custody. You'll be taken to the Issue step.
          </p>
          <Button className="mt-3" disabled={busy || !cfg} onClick={demo}>
            Create demo identity
          </Button>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Connect Veridian wallet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pair a real Veridian mobile wallet. The backend talks directly to
            your wallet, so issuance/presentation/attestation prompts appear on
            the phone.
          </p>

          <div className="mt-3 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold">Set up the Veridian app first:</p>
            <p>
              1. In Veridian → <em>Settings → Connection</em>, set the{" "}
              <strong>KERIA connection URL</strong> to{" "}
              <code className="rounded bg-white px-1">
                {cfg?.keriaUrl ?? "http://localhost:3901"}
              </code>{" "}
              and the <strong>boot URL</strong> to{" "}
              <code className="rounded bg-white px-1">
                {cfg?.keriaBootUrl ?? "http://localhost:3903"}
              </code>
              . On a phone, replace <code>localhost</code> with this machine's
              LAN IP (and set <code>PUBLIC_HOST</code> accordingly).
            </p>
            <p>
              2. Add a connection in Veridian using this issuer's OOBI (scan or
              copy):
            </p>
            {cfg?.issuerOobi ? (
              <div className="mt-2 space-y-2">
                <div className="bg-white p-2 inline-block rounded">
                  <QRCodeSVG value={cfg.issuerOobi} size={140} />
                </div>
                <div className="flex items-start gap-2">
                  <code className="block flex-1 break-all rounded bg-white p-2 font-mono text-[11px] text-slate-700">
                    {cfg.issuerOobi}
                  </code>
                  <Button
                    className="shrink-0"
                    type="button"
                    onClick={copyIssuerOobi}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-amber-700">Issuer OOBI not available yet.</p>
            )}
            <p>
              3. In Veridian, share <em>your</em> identifier's OOBI and paste it
              below.
            </p>
          </div>

          <textarea
            className="mt-3 w-full rounded border p-2 text-xs"
            rows={3}
            placeholder="Paste your Veridian wallet OOBI here"
            value={veridianOobi}
            onChange={(e) => setVeridianOobi(e.target.value)}
          />
          <Button
            className="mt-2"
            disabled={busy || !cfg || !veridianOobi.trim()}
            onClick={connectVeridian}
          >
            {busy ? "Connecting…" : "Connect Veridian & continue"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
