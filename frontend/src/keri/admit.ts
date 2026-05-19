import type { SignifyClient } from "signify-ts";
import { waitForNotification, markAndDelete } from "./notifications";
import { nowKeriTimestamp, waitOpts } from "./timeout";

export async function admitGrantOnWallet(
  client: SignifyClient,
  walletName: string,
  issuerAid: string,
  timeoutMs = 120_000
): Promise<string> {
  const grantNote = await waitForNotification(
    client,
    ["/exn/ipex/grant", "/ipex/grant"],
    timeoutMs
  );
  const grantSaid = grantNote.a.d;
  const [admitExn, admitSigs, admitAtc] = await client.ipex().admit({
    senderName: walletName,
    recipient: issuerAid,
    datetime: nowKeriTimestamp(),
    grantSaid,
    message: "",
  });
  const op = await client
    .ipex()
    .submitAdmit(walletName, admitExn, admitSigs, admitAtc, [issuerAid]);
  await client.operations().wait(op, waitOpts());
  await markAndDelete(client, grantNote);
  return grantSaid;
}
