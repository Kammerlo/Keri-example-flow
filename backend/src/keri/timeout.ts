const DEFAULT_TIMEOUT_MS = 60_000;

export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`[keri] timeout (${ms}ms): ${label}`)),
        ms
      )
    ),
  ]);
}

export function waitOpts(ms = DEFAULT_TIMEOUT_MS): { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(ms) };
}

export function nowKeriTimestamp(): string {
  return new Date().toISOString().replace("Z", "000+00:00");
}
