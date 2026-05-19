import {
  type SignifyClient,
  type Serder,
  Siger,
  b,
  d,
  messagize,
  serializeACDCAttachment,
  serializeIssExnAttachment,
} from "signify-ts";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import { waitForNotification, markAndDelete } from "./notifications";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

/**
 * Build the IPEX grant exchange the way cip113 KeriService.buildGrantExchange
 * does (KeriService.java#L721-744). The decisive part is line 739:
 * `data = { m, s: schemaSAID, oobiUrl: schemaUrl }`. The Veridian wallet reads
 * `exn.a.oobiUrl` to resolve the ACDC schema when the user opens the credential
 * notification — a plain `ipex().grant()` omits it, so the wallet receives the
 * notification but errors on open. signify-ts's built-in grant cannot inject
 * these fields, so we assemble the exchange message ourselves.
 */
async function buildGrantExchange(
  client: SignifyClient,
  args: {
    senderName: string;
    recipient: string;
    datetime: string;
    acdc: Serder;
    iss: Serder;
    anc: Serder;
    ancAttachment: string | undefined;
    schemaSaid: string;
    schemaOobi: string;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<[any, string[], string]> {
  const hab = await client.identifiers().get(args.senderName);

  let ancAtc = args.ancAttachment;
  if (ancAtc === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keeper = (client as any).manager.get(hab);
    const sigs: string[] = await keeper.sign(
      b(args.anc.raw as unknown as string)
    );
    const sigers = sigs.map((sig: string) => new Siger({ qb64: sig }));
    const ims = d(messagize(args.anc, sigers));
    ancAtc = ims.substring(args.anc.size);
  }

  const acdcAtc = d(serializeACDCAttachment(args.iss));
  const issAtc = d(serializeIssExnAttachment(args.anc));

  const embeds = {
    acdc: [args.acdc, acdcAtc],
    iss: [args.iss, issAtc],
    anc: [args.anc, ancAtc],
  };

  // KeriService.java#L736-739 — `oobiUrl` lets the wallet resolve the schema.
  const data = { m: "", s: args.schemaSaid, oobiUrl: args.schemaOobi };

  return client
    .exchanges()
    .createExchangeMessage(
      hab,
      "/ipex/grant",
      data,
      embeds as never,
      args.recipient,
      args.datetime
    );
}

export async function issueAndGrant(
  issuer: IssuerState,
  issuerName: string,
  holderAid: string,
  schemaSaid: string,
  schemaOobi: string,
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
      "`s` the schema SAID, `a` the subject attributes (holder AID is `a.i`).",
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
      "The credential exists with a SAID. It is not delivered until the holder " +
      "admits it over IPEX.",
    response: issueResult.acdc.ked,
  });

  // anc attachment (KeriService re-fetches the credential for ancatc).
  const credential = (await client
    .credentials()
    .get(credentialSaid)) as unknown as { ancatc?: string[] | string };
  const ancRaw = credential.ancatc;
  const ancAttachment = Array.isArray(ancRaw) ? ancRaw[0] : ancRaw;

  rec.add({
    title: "Issuer sends IPEX grant (with schema oobiUrl)",
    call: 'client.exchanges().createExchangeMessage(hab, "/ipex/grant", ...)',
    keriMessage: "/ipex/grant",
    explanation:
      "The grant embeds acdc/iss/anc plus `s` and `oobiUrl` in exn.a. The wallet " +
      "uses `oobiUrl` to resolve the schema when you open the credential " +
      "notification (KeriService.java#L739). Without it the phone shows the " +
      "notification but errors on open.",
  });
  const [grantExn, grantSigs, grantAtc] = await buildGrantExchange(client, {
    senderName: issuerName,
    recipient: holderAid,
    datetime: nowKeriTimestamp(),
    acdc: issueResult.acdc,
    iss: issueResult.iss,
    anc: issueResult.anc,
    ancAttachment,
    schemaSaid,
    schemaOobi,
  });
  const grantOp = await client
    .ipex()
    .submitGrant(issuerName, grantExn, grantSigs, grantAtc, [holderAid]);
  await client.operations().wait(grantOp, waitOpts());
  rec.add({
    title: "Grant delivered to the holder's KERIA mailbox",
    explanation:
      "For a Veridian wallet this raises a notification on the phone; the demo " +
      "holder admits automatically in the browser.",
    response: grantExn.ked,
  });

  rec.add({
    title: "Waiting for the holder to admit",
    keriMessage: "/ipex/admit",
    explanation:
      "submitGrant only confirms KERIA queued the message. The issuer blocks " +
      "until the holder sends /ipex/admit back (approve on the phone in " +
      "Veridian mode).",
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
    explanation: "The credential now lives in the holder's wallet.",
  });

  return { credentialSaid, grantExn: grantExn.ked };
}
