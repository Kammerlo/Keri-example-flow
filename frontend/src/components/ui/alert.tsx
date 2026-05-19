import { cn } from "../../lib/cn";
export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-ink/15 bg-white text-ink/80",
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-accent/40 bg-accent-soft text-ink",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border px-3.5 py-2.5 text-sm",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        tone === "success" && "before:bg-accent",
        tone === "error" && "before:bg-red-500",
        tone === "info" && "before:bg-ink/30",
        tones[tone]
      )}
    >
      {children}
    </div>
  );
}
