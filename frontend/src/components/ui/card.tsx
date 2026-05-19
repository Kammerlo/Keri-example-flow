import { cn } from "../../lib/cn";
export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)}
      {...rest}
    />
  );
}
