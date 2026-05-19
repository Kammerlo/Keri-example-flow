import { cn } from "../../lib/cn";
export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "px-4 py-2 text-sm",
            value === it.value
              ? "border-b-2 border-slate-900 font-semibold"
              : "text-slate-500"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
