import { useState } from "react";
import type { StepLog as Step } from "@keri-demo/shared";
import { cn } from "../lib/cn";

function Raw({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  if (data === undefined) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="font-mono text-[11px] uppercase tracking-wider text-ink/45 hover:text-accent"
      >
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-80 overflow-auto rounded-lg border border-ink/10 bg-ink p-3 text-[11px] leading-relaxed text-paper/90">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function StepLog({ steps }: { steps: Step[] }) {
  const ordered = [...steps].sort((a, b) => a.ts - b.ts);
  if (ordered.length === 0)
    return (
      <p className="font-mono text-xs text-ink/40">
        Steps will appear here as the flow runs.
      </p>
    );
  return (
    <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-ink/10">
      {ordered.map((s, i) => (
        <li
          key={i}
          className="reveal relative pl-9"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <span
            className={cn(
              "absolute left-0 top-0.5 grid h-[23px] w-[23px] place-items-center rounded-full border text-[10px] font-bold",
              s.error
                ? "border-red-400 bg-red-50 text-red-600"
                : "border-ink/15 bg-white text-ink/70"
            )}
          >
            {s.error ? "!" : i + 1}
          </span>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              s.error
                ? "border-red-300 bg-red-50"
                : "border-[var(--line)] bg-white"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold">
                {s.title}
              </span>
              <span className="chip !lowercase !tracking-normal text-ink/50">
                {s.source}
              </span>
              {s.keriMessage && (
                <span className="chip border-accent/40 bg-accent-soft text-accent">
                  {s.keriMessage}
                </span>
              )}
            </div>
            {s.call && (
              <code className="mt-1 block font-mono text-[11px] text-ink/45">
                {s.call}
              </code>
            )}
            <p className="mt-1 text-[13px] leading-relaxed text-ink/70">
              {s.explanation}
            </p>
            {s.error && (
              <p className="mt-1 font-mono text-[12px] text-red-700">
                {s.error}
              </p>
            )}
            <Raw label="request" data={s.request} />
            <Raw label="response" data={s.response} />
          </div>
        </li>
      ))}
    </ol>
  );
}
