import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { connectDemoHolder } from "../keri/holder";
import { connectCompanion, pairVeridian } from "../keri/companion";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";

export default function Connect() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [companionOobi, setCompanionOobi] = useState("");
  const [veridianOobi, setVeridianOobi] = useState("");

  useEffect(() => {
    if (!s.config) api.config().then((c) => s.set({ config: c })).catch(() => {});
  }, [s]);

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
      });
      s.recordClient({
        flow: "connect",
        title: "Holder AID created",
        explanation:
          "A witnessed AID was created (toad>0). Witnesses co-sign key events so " +
          "the identifier's history is tamper-evident.",
        response: { aid: h.aid },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startVeridian() {
    if (!s.config) return;
    setBusy(true);
    setErr("");
    try {
      const c = await connectCompanion(s.config);
      s.set({
        mode: "veridian",
        client: c.client,
        walletName: c.walletName,
        holderAid: c.companionAid,
        holderOobi: c.companionOobi,
        veridianAid: c.veridianAid,
      });
      setCompanionOobi(c.companionOobi);
      s.recordClient({
        flow: "connect",
        title: "Companion agent ready",
        explanation:
          "In Veridian mode the browser runs a companion agent. Scan its OOBI " +
          "with the Veridian app, then paste the wallet's OOBI back to pair both " +
          "agents' contact lists.",
        response: { companionOobi: c.companionOobi },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    if (!s.client) return;
    setBusy(true);
    setErr("");
    try {
      const aid = await pairVeridian(s.client, veridianOobi.trim());
      s.set({ veridianAid: aid });
      s.recordClient({
        flow: "connect",
        title: "Paired with Veridian wallet",
        explanation:
          "The companion resolved the wallet's OOBI. Both agents can now exchange " +
          "IPEX and remote-signing messages.",
        response: { veridianAid: aid },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && <Alert tone="error">{err}</Alert>}
      {s.holderAid && (
        <Alert tone="success">
          Connected ({s.mode}) — AID <Badge>{s.holderAid}</Badge>
          {s.mode === "veridian" && s.veridianAid && (
            <>
              {" "}
              · Veridian <Badge>{s.veridianAid}</Badge>
            </>
          )}
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Demo KERI login</h2>
          <p className="mt-1 text-sm text-slate-600">
            A browser-held identity. No phone needed. Teaches client-side key
            custody.
          </p>
          <Button className="mt-3" disabled={busy || !s.config} onClick={demo}>
            Create demo identity
          </Button>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Connect Veridian wallet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pair a real Veridian mobile wallet via OOBI/QR.
          </p>
          <Button
            className="mt-3"
            disabled={busy || !s.config}
            onClick={startVeridian}
          >
            Start companion
          </Button>
          {companionOobi && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">
                Scan this with the Veridian app:
              </p>
              <QRCodeSVG value={companionOobi} size={160} />
              <textarea
                className="w-full rounded border p-2 text-xs"
                placeholder="Paste the Veridian wallet OOBI here"
                value={veridianOobi}
                onChange={(e) => setVeridianOobi(e.target.value)}
              />
              <Button disabled={busy || !veridianOobi} onClick={pair}>
                Pair wallet
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
