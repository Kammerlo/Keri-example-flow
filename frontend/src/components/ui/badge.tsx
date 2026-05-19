import { cn } from "../../lib/cn";
export function Badge(props: React.HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props;
  return (
    <span
      className={cn(
        "inline-block rounded-md border border-[var(--line)] bg-white px-2 py-0.5",
        "font-mono text-[11px] tracking-tight text-ink/75",
        className
      )}
      {...rest}
    />
  );
}
