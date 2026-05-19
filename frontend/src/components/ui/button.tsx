import { cn } from "../../lib/cn";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, children, ...rest } = props;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-accent",
        "px-4 py-2 text-sm font-semibold text-white",
        "shadow-[0_1px_2px_rgba(17,22,28,0.10)]",
        "transition-colors duration-150 hover:bg-[#0a655e]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-accent",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
