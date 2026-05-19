import { cn } from "../../lib/cn";
export function Badge(props: React.HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props;
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700",
        className
      )}
      {...rest}
    />
  );
}
