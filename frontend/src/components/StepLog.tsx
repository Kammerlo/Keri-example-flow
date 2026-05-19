import { useState } from "react";
import type { StepLog as Step } from "@keri-demo/shared";
import { Badge } from "./ui/badge";
import { cn } from "../lib/cn";

function Raw({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  if (data === undefined) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-slate-500 underline"
      >
        {open ? "Hide" : "Show"} {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
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
      <p className="text-sm text-slate-400">
        Steps will appear here as the flow runs.
      </p>
    );
  return (
    <ol className="space-y-3">
      {ordered.map((s, i) => (
        <li
          key={i}
          className={cn(
            "rounded-md border p-3",
            s.error ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {i + 1}. {s.title}
            </span>
            <Badge>{s.source}</Badge>
            {s.keriMessage && (
              <Badge className="bg-indigo-100 text-indigo-700">
                {s.keriMessage}
              </Badge>
            )}
          </div>
          {s.call && (
            <code className="mt-1 block font-mono text-xs text-slate-500">
              {s.call}
            </code>
          )}
          <p className="mt-1 text-sm text-slate-700">{s.explanation}</p>
          {s.error && (
            <p className="mt-1 text-sm font-medium text-red-700">{s.error}</p>
          )}
          <Raw label="request" data={s.request} />
          <Raw label="response" data={s.response} />
        </li>
      ))}
    </ol>
  );
}
