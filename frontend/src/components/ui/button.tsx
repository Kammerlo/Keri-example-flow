import { cn } from "../../lib/cn";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, children, ...rest } = props;
  return (
    <button
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden",
        "rounded-lg bg-ink px-4 py-2 font-display text-sm font-semibold tracking-wide text-paper",
        "transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0",
        "shadow-[3px_3px_0_0_rgba(255,92,40,0.9)] hover:shadow-[5px_5px_0_0_rgba(255,92,40,1)]",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        className
      )}
      {...rest}
    >
      {/* light sweep on hover */}
      <span className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-[120%]" />
      <span className="relative">{children}</span>
    </button>
  );
}
