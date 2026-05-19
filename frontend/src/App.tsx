import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Connect from "./routes/Connect";
import Issue from "./routes/Issue";
import Present from "./routes/Present";
import Attest from "./routes/Attest";
import { useSession } from "./state/session";
import { cn } from "./lib/cn";

const tabs = [
  ["/connect", "1 · Connect"],
  ["/issue", "2 · Issue"],
  ["/present", "3 · Present"],
  ["/attest", "4 · Attest"],
] as const;

export default function App() {
  const mode = useSession((s) => s.mode);
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            KERI + Veridian — Educational Demo
          </h1>
          <p className="text-sm text-slate-600">
            Issue, present, and attest ACDC credentials. Every step is
            explained.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Mode
          </div>
          <div
            className={cn(
              "mt-1 rounded-lg px-4 py-2 text-base font-bold",
              mode === "demo" && "bg-emerald-100 text-emerald-800",
              mode === "veridian" && "bg-indigo-100 text-indigo-800",
              mode === "none" && "bg-slate-100 text-slate-500"
            )}
          >
            {mode === "none"
              ? "Not connected"
              : mode === "demo"
                ? "Demo wallet"
                : "Veridian wallet"}
          </div>
        </div>
      </header>
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "px-4 py-2 text-sm",
                isActive
                  ? "border-b-2 border-slate-900 font-semibold"
                  : "text-slate-500"
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/connect" replace />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/issue" element={<Issue />} />
        <Route path="/present" element={<Present />} />
        <Route path="/attest" element={<Attest />} />
      </Routes>
    </div>
  );
}
