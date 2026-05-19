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
      ? "Not connected"
      : mode === "demo"
        ? "Demo wallet"
        : "Veridian wallet";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          mode === "none" ? "bg-ink/25" : "bg-accent"
        )}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
        mode
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

export default function App() {
  const mode = useSession((s) => s.mode);
  const loc = useLocation();
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-7">
      <header className="reveal panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-paper">
              <span className="font-display text-base font-bold">Ki</span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">
                KERI <span className="text-ink/30">·</span> Veridian
              </h1>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
                credential lab
              </p>
            </div>
          </div>
          <ModePill mode={mode} />
        </div>
        <nav className="mt-5 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-4">
          {tabs.map(([to, label, n]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-ink text-paper"
                    : "text-ink/55 hover:bg-ink/[0.04] hover:text-ink"
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
                  <span className="font-semibold">{label}</span>
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

      <footer className="mt-10 flex items-center justify-between border-t border-[var(--line)] pt-4 font-mono text-[11px] text-ink/35">
        <span>signify-ts · KERIA · ACDC · IPEX</span>
        <span className="hidden sm:block">every step is explained</span>
      </footer>
    </div>
  );
}
