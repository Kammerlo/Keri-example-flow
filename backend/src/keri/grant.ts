import { type SignifyClient, Serder } from "signify-ts";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import { waitForNotification, markAndDelete } from "./notifications";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

/**
 * Issue an ACDC and IPEX-grant it to the holder.
 *
 * Adopted precisely from the Veridian team's credential-server
 * (services/credential-server/src/apis/credential.api.ts): a plain
 * `client.ipex().grant()` over the issued credential's sad/iss/anc — NOT a
 * hand-built exchange message. The real Veridian wallet only surfaces a
 * notification for this standard grant shape.
 */
export async function issueAndGrant(
  issuer: IssuerState,
  issuerName: string,
  holderAid: string,
  schemaSaid: string,
  _schemaOobi: string,
  attrs: { name: string; email: string; role: string },
  rec: StepRecorder
): Promise<{ credentialSaid: string; grantExn: unknown }> {
  const { client, registrySaid } = issuer;
  const dt = nowKeriTimestamp();

  rec.add({
    title: "Issuer creates the ACDC",
    call: "client.credentials().issue(name, { ri, s, a })",
    keriMessage: "iss",
    explanation:
      "The issuer mints a credential into its registry. `ri` is the registry, " +
      "`s` the schema SAID, `a` the subject attributes (the holder AID is `a.i`). " +
      "KERIA writes an issuance (iss) event to the credential's TEL.",
    request: { ri: registrySaid, s: schemaSaid, a: { i: holderAid, ...attrs } },
  });
  const issueResult = await client.credentials().issue(issuerName, {
    ri: registrySaid,
    s: schemaSaid,
    a: { i: holderAid, dt, name: attrs.name, email: attrs.email, role: attrs.role },
  });
  await client.operations().wait(issueResult.op, waitOpts());
  const credentialSaid = issueResult.acdc.ked.d as string;
  rec.add({
    title: "Credential minted",
    explanation:
      "The credential now exists with a SAID. It is not yet delivered — the " +
      "holder must receive and admit it over IPEX.",
    response: issueResult.acdc.ked,
  });

  // Re-fetch to get sad/iss/anc + the anc CESR attachment, then grant with the
  // built-in IPEX grant (exactly what credential-server does).
  const credential = (await client
    .credentials()
    .get(credentialSaid)) as unknown as {
    sad: Record<string, unknown>;
    iss: Record<string, unknown>;
    anc: Record<string, unknown>;
    ancatc?: string[] | string;
    ancAttachment?: string;
  };
  const ancRaw = credential.ancatc ?? credential.ancAttachment;
  const ancAttachment = Array.isArray(ancRaw) ? ancRaw[0] : ancRaw;

  rec.add({
    title: "Issuer sends IPEX grant",
    call: "client.ipex().grant(...) + submitGrant(...)",
    keriMessage: "/ipex/grant",
    explanation:
      "IPEX grant offers the credential to the holder. We use the standard " +
      "signify-ts ipex().grant — the shape the Veridian wallet expects so it " +
      "raises a notification on the phone.",
  });
  const [grant, gsigs, gend] = await client.ipex().grant({
    senderName: issuerName,
    recipient: holderAid,
    acdc: new Serder(credential.sad),
    anc: new Serder(credential.anc),
    iss: new Serder(credential.iss),
    ancAttachment,
    datetime: nowKeriTimestamp(),
  });
  await client
    .ipex()
    .submitGrant(issuerName, grant, gsigs, gend, [holderAid]);
  rec.add({
    title: "Grant delivered to the holder's KERIA mailbox",
    explanation:
      "For a Veridian wallet this raises a notification on the phone; the demo " +
      "holder admits automatically in the browser.",
    response: grant.ked,
  });

  // Block until the holder accepts (Veridian: approve on the phone now).
  rec.add({
    title: "Waiting for the holder to admit",
    keriMessage: "/ipex/admit",
    explanation:
      "submitGrant only confirms KERIA queued the message. The issuer blocks " +
      "until the holder sends /ipex/admit back.",
  });
  const admitNote = await waitForNotification(
    client,
    ["/exn/ipex/admit", "/ipex/admit"],
    180_000
  );
  await markAndDelete(client, admitNote);
  rec.add({
    title: "Holder admitted the credential",
    keriMessage: "/ipex/admit",
    explanation:
      "The holder accepted the grant; the ACDC now lives in their wallet and " +
      "can be presented later.",
  });

  return { credentialSaid, grantExn: grant.ked };
}
