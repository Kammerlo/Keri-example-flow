import { cn } from "../../lib/cn";
export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div className={cn("panel p-5", className)} {...rest} />
  );
}
