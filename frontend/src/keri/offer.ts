import { type SignifyClient, Serder } from "signify-ts";
import { waitForNotification, markAndDelete } from "./notifications";
import { nowKeriTimestamp, waitOpts } from "./timeout";

/**
 * Wait for the verifier's IPEX apply, offer a matching held credential, then
 * grant it after the verifier agrees. This is the holder side of the IPEX
 * presentation cycle that backend present.ts drives from the verifier side.
 */
export async function offerOnApply(
  client: SignifyClient,
  walletName: string,
  schemaSaid: string,
  timeoutMs = 180_000
): Promise<void> {
  const applyNote = await waitForNotification(
    client,
    ["/exn/ipex/apply", "/ipex/apply"],
    timeoutMs
  );
  const applySaid = applyNote.a.d;
  const applyExchange = await client.exchanges().get(applySaid);
  const verifierAid = (applyExchange.exn as { i: string }).i;
  await markAndDelete(client, applyNote);

  const creds = (await client.credentials().list()) as Array<{
    sad: { d: string; s: string };
  }>;
  const match = creds.find((c) => c.sad.s === schemaSaid);
  if (!match) throw new Error("No credential matching the requested schema");

  // The full credential record carries the ACDC + issuance + anchor events
  // and their CESR attachments — everything the grant needs.
  const cred = (await client.credentials().get(match.sad.d)) as unknown as {
    sad: Record<string, unknown>;
    atc: string;
    iss: Record<string, unknown>;
    issatc: string;
    anc: Record<string, unknown>;
    ancatc: string;
  };
  const acdc = new Serder(cred.sad);

  const [offerExn, offerSigs, offerEnd] = await client.ipex().offer({
    senderName: walletName,
    recipient: verifierAid,
    acdc,
    applySaid,
    datetime: nowKeriTimestamp(),
  });
  const offerOp = await client
    .ipex()
    .submitOffer(walletName, offerExn, offerSigs, offerEnd, [verifierAid]);
  await client.operations().wait(offerOp, waitOpts());

  const agreeNote = await waitForNotification(
    client,
    ["/exn/ipex/agree", "/ipex/agree"],
    timeoutMs
  );
  const agreeSaid = agreeNote.a.d;
  await markAndDelete(client, agreeNote);

  const [grantExn, grantSigs, grantEnd] = await client.ipex().grant({
    senderName: walletName,
    recipient: verifierAid,
    acdc,
    acdcAttachment: cred.atc,
    iss: new Serder(cred.iss),
    issAttachment: cred.issatc,
    anc: new Serder(cred.anc),
    ancAttachment: cred.ancatc,
    agreeSaid,
    datetime: nowKeriTimestamp(),
  });
  const grantOp = await client
    .ipex()
    .submitGrant(walletName, grantExn, grantSigs, grantEnd, [verifierAid]);
  await client.operations().wait(grantOp, waitOpts());
}
