import { type SignifyClient } from "signify-ts";
import { waitOpts } from "./timeout";

export async function resolveOobiOnClient(
  client: SignifyClient,
  oobi: string,
  alias = `peer-${Date.now()}`
): Promise<void> {
  const op = await client.oobis().resolve(oobi, alias);
  await client.operations().wait(op, waitOpts());
}
