import { NavLink, Route, Routes, Navigate, useLocation } from "react-router-dom";
import Connect from "./routes/Connect";
import Issue from "./routes/Issue";
import Present from "./routes/Present";
import Attest from "./routes/Attest";
import { useSession } from "./state/session";
import { cn } from "./lib/cn";

const tabs = [
  ["/connect", "Connect", "01"],
  ["/issue", "Issue", "02"],
  ["/present", "Present", "03"],
  ["/attest", "Attest", "04"],
] as const;

function ModePill({ mode }: { mode: string }) {
  const label =
    mode === "none"
      ? "offline"
      : mode === "demo"
        ? "demo wallet"
        : "veridian wallet";
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          mode === "none"
            ? "bg-ink/25"
            : "bg-accent animate-pulse-ring"
        )}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
        mode
      </span>
      <span className="font-display text-sm font-semibold">{label}</span>
    </div>
  );
}

export default function App() {
  const mode = useSession((s) => s.mode);
  const loc = useLocation();
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-6">
      {/* ── console header ─────────────────────────────────────────── */}
      <header className="reveal panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rotate-12 bg-accent/10 blur-2xl" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-paper shadow-[3px_3px_0_0_var(--accent)]">
              <span className="font-display text-lg font-bold">Ki</span>
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">
                KERI<span className="text-accent">·</span>Veridian
              </h1>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/45">
                interactive credential lab
              </p>
            </div>
          </div>
          <ModePill mode={mode} />
        </div>
        <div className="mt-4 h-px w-full overflow-hidden bg-ink/10">
          <div className="h-px w-1/3 animate-sweep bg-accent" />
        </div>
        <nav className="mt-4 flex flex-wrap gap-2">
          {tabs.map(([to, label, n]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-2 rounded-lg border px-3.5 py-2 transition-all",
                  isActive
                    ? "border-ink bg-ink text-paper shadow-[3px_3px_0_0_var(--accent)]"
                    : "border-[var(--line)] bg-white text-ink/60 hover:-translate-y-0.5 hover:text-ink"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      isActive ? "text-accent" : "text-ink/35"
                    )}
                  >
                    {n}
                  </span>
                  <span className="font-display text-sm font-semibold">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main key={loc.pathname} className="reveal mt-6 flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/connect" replace />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/issue" element={<Issue />} />
          <Route path="/present" element={<Present />} />
          <Route path="/attest" element={<Attest />} />
        </Routes>
      </main>

      <footer className="mt-8 flex items-center justify-between border-t border-ink/10 pt-4 font-mono text-[11px] text-ink/35">
        <span>signify-ts · KERIA · ACDC · IPEX</span>
        <span className="hidden sm:block">
          every step is explained — read the log →
        </span>
      </footer>
    </div>
  );
}
