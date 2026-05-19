// ─── KERI layer: notifications ───────────────────────────────────────────────
// IPEX is asynchronous: when a peer submits a grant/apply/offer/agree/admit
// exchange, KERIA surfaces it to the recipient as a *notification* (route like
// `/exn/ipex/grant`). There is no push — clients poll `notifications().list()`.
// `markAndDelete` clears a handled notification so it isn't processed twice.
import { type SignifyClient } from "signify-ts";

export interface Notification {
  i: string;
  dt: string;
  r: boolean;
  a: { r: string; d: string };
}

const POLL_INTERVAL_MS = 1_500;

export async function waitForNotification(
  client: SignifyClient,
  routes: string | string[],
  timeoutMs = 60_000
): Promise<Notification> {
  const routeList = Array.isArray(routes) ? routes : [routes];
  const normalised = routeList.flatMap((r) => {
    const withPrefix = r.startsWith("/exn/") ? r : `/exn${r}`;
    const withoutPrefix = r.startsWith("/exn/") ? r.slice(4) : r;
    return [r, withPrefix, withoutPrefix];
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { notes } = await client.notifications().list(0, 24);
    for (const note of notes as Notification[]) {
      if (!note.r && normalised.includes(note.a.r)) return note;
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  throw new Error(
    `[notifications] timeout waiting for routes: ${routeList.join(", ")}`
  );
}

export async function markAndDelete(
  client: SignifyClient,
  note: Notification
): Promise<void> {
  await client.notifications().mark(note.i);
  await client.notifications().delete(note.i);
}
