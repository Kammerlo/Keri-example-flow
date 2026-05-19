export function nowKeriTimestamp(): string {
  return new Date().toISOString().replace("Z", "000+00:00");
}
export function waitOpts(ms = 60_000): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(ms) };
}
