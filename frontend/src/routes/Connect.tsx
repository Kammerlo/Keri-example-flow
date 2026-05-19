import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "../state/session";
import { api } from "../lib/api";
import { connectDemoHolder } from "../keri/holder";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
  );
}

function ConfigRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink/45">
        {label}
      </span>
      <code className="keri flex-1">{value}</code>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md border border-[var(--line)] bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink/60 transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? "copied" : "copy"}
        </button>
      )}
    </div>
  );
}

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

  const connected = Boolean(s.holderAid);

  return (
    <div className="space-y-5">
      {/* ── intro ─────────────────────────────────────────────── */}
      <section className="reveal" style={{ animationDelay: "40ms" }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
          step 01 — establish an identifier
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-tight">
          Pick how you hold your keys.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
          KERI identifiers are <em>self-certifying</em> — control lives with the
          key holder, not a registry. Try it with browser-held keys, or drive it
          from a real Veridian wallet.
        </p>
      </section>

      {err && (
        <div className="reveal">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
      {connected && (
        <div className="reveal">
          <Alert tone="success">
            Connected via <strong>{s.mode}</strong> — AID{" "}
            <Badge>{s.holderAid}</Badge>
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Demo card ───────────────────────────────────────── */}
        <button
          onClick={demo}
          disabled={busy || !cfg}
          className="reveal panel group relative flex flex-col items-start p-6 text-left transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex w-full items-start justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-ink text-paper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/35">
              no phone
            </span>
          </div>
          <h3 className="mt-5 text-xl font-bold">Demo KERI login</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            Boots a signify-ts agent in your browser and creates a witnessed
            AID. Keys never leave the client — the essence of self-sovereign
            identity.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 font-display text-sm font-semibold text-accent">
            {busy ? <Spinner /> : null}
            {busy ? "creating…" : "Create demo identity"}
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </button>

        {/* ── Veridian card ───────────────────────────────────── */}
        <div
          className="reveal panel flex flex-col p-6"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex w-full items-start justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-lg border-2 border-ink text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect
                  x="6"
                  y="2.5"
                  width="12"
                  height="19"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M10.5 18.5h3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="chip border-accent/40 bg-accent-soft text-accent">
              real wallet
            </span>
          </div>
          <h3 className="mt-5 text-xl font-bold">Connect Veridian wallet</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            The backend talks straight to your wallet AID — issue / present /
            attest prompts pop on the phone. Point Veridian at:
          </p>

          <div className="mt-4 space-y-2 rounded-lg border border-[var(--line)] bg-paper/60 p-3">
            <ConfigRow
              label="conn url"
              value={cfg?.keriaUrl ?? "http://localhost:3901"}
            />
            <ConfigRow
              label="boot url"
              value={cfg?.keriaBootUrl ?? "http://localhost:3903"}
            />
            {cfg?.issuerOobi && (
              <ConfigRow
                label="issuer oobi"
                value={cfg.issuerOobi}
                onCopy={copyIssuerOobi}
                copied={copied}
              />
            )}
          </div>

          {cfg?.issuerOobi && (
            <div className="mt-4 flex items-center gap-4">
              <div className="rounded-lg border border-[var(--line)] bg-white p-2">
                <QRCodeSVG
                  value={cfg.issuerOobi}
                  size={92}
                  fgColor="#0b0e14"
                  bgColor="transparent"
                />
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-ink/45">
                add this issuer OOBI as a
                <br />
                connection in Veridian, then
                <br />
                paste your wallet OOBI ↓
              </p>
            </div>
          )}

          <textarea
            className="mt-4 w-full rounded-lg border border-[var(--line)] p-2.5 font-mono text-[12px] outline-none transition-colors focus:border-accent"
            rows={3}
            placeholder="paste your Veridian wallet OOBI…"
            value={veridianOobi}
            onChange={(e) => setVeridianOobi(e.target.value)}
          />
          <Button
            className="mt-3 w-full"
            disabled={busy || !cfg || !veridianOobi.trim()}
            onClick={connectVeridian}
          >
            {busy ? (
              <>
                <Spinner /> connecting…
              </>
            ) : (
              "Connect Veridian & continue →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
