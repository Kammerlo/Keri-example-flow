import { type SignifyClient } from "signify-ts";
import { waitOpts } from "./timeout";

/**
 * Resolve an OOBI and register the resulting connection as a contact.
 *
 * Adopted from the Veridian team's credential-server (utils.ts `resolveOobi`):
 * the `?name=` query param is stripped before resolving, and once resolved the
 * connection id from the operation response is written to the contacts list via
 * `contacts().update`. Without that contact entry, `submitGrant([aid])` does
 * not route to the wallet and the phone never gets a notification.
 */
export async function resolveOobiOnClient(
  client: SignifyClient,
  url: string,
  alias?: string
): Promise<string | undefined> {
  const urlObj = new URL(url);
  const aliasFromUrl = urlObj.searchParams.get("name");
  urlObj.searchParams.delete("name");
  const stripped = urlObj.toString();

  const op = (await client
    .operations()
    .wait(await client.oobis().resolve(stripped), waitOpts())) as {
    done?: boolean;
    response?: { i?: string; dt?: string };
  };

  const connectionId = op.response?.i;
  // Contact metadata is best-effort: the resolve above is what actually makes
  // the AID routable. contacts().update 400s for a local identifier (and may
  // fail for already-known contacts); that must NOT abort the connection.
  if (connectionId) {
    try {
      await client.contacts().update(connectionId, {
        alias: alias ?? aliasFromUrl ?? `peer-${Date.now()}`,
        oobi: url,
        createdAt: op.response?.dt ? new Date(op.response.dt) : new Date(),
      });
    } catch (e) {
      console.warn(
        `[oobi] contacts().update skipped for ${connectionId}: ${
          (e as Error).message
        }`
      );
    }
  }
  return connectionId;
}
