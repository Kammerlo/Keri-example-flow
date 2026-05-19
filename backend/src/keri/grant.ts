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
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

function parseCesrEvents(
  cesr: string
): Array<{ event: Record<string, unknown>; atc: string }> {
  const result: Array<{ event: Record<string, unknown>; atc: string }> = [];
  let i = 0;
  while (i < cesr.length) {
    if (cesr[i] !== "{") {
      i++;
      continue;
    }
    let depth = 0;
    let jsonEnd = i;
    for (let j = i; j < cesr.length; j++) {
      if (cesr[j] === "{") depth++;
      else if (cesr[j] === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = j + 1;
          break;
        }
      }
    }
    const jsonStr = cesr.slice(i, jsonEnd);
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      i = jsonEnd;
      continue;
    }
    let atcEnd = cesr.length;
    for (let j = jsonEnd; j < cesr.length; j++) {
      if (cesr[j] === "{") {
        atcEnd = j;
        break;
      }
    }
    result.push({ event, atc: cesr.slice(jsonEnd, atcEnd) });
    i = atcEnd;
  }
  return result;
}

async function getAncAttachment(
  client: SignifyClient,
  credentialSaid: string
): Promise<string | undefined> {
  const cesrText = (await client.credentials().get(credentialSaid, true)) as string;
  const events = parseCesrEvents(cesrText);
  return events.find((e) => e.event.t === "ixn")?.atc;
}

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
    const sigs: string[] = await keeper.sign(b(args.anc.raw as unknown as string));
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
  const { client, aid: issuerAid, registrySaid } = issuer;
  const dt = nowKeriTimestamp();

  rec.add({
    title: "Issuer creates the ACDC",
    call: "client.credentials().issue(name, { i, ri, s, a })",
    keriMessage: "iss",
    explanation:
      "The issuer mints a credential into its registry. `i` is the issuer AID, " +
      "`ri` the registry, `s` the schema SAID, `a` the subject attributes (the " +
      "holder AID is `a.i`). KERIA writes an issuance (iss) event to the TEL.",
    request: { i: issuerAid, ri: registrySaid, s: schemaSaid, a: { i: holderAid, ...attrs } },
  });
  const issueResult = await client.credentials().issue(issuerName, {
    i: issuerAid,
    ri: registrySaid,
    s: schemaSaid,
    a: { i: holderAid, dt, name: attrs.name, email: attrs.email, role: attrs.role },
  });
  await client.operations().wait(issueResult.op, waitOpts());
  const credentialSaid = issueResult.acdc.ked.d as string;
  rec.add({
    title: "Credential minted",
    explanation:
      "The credential now exists with a SAID (self-addressing id). It is not yet " +
      "delivered — the holder must receive and admit it over IPEX.",
    response: issueResult.acdc.ked,
  });

  const ancAttachment = await getAncAttachment(client, credentialSaid);

  rec.add({
    title: "Issuer sends IPEX grant",
    call: "client.ipex().submitGrant(...)",
    keriMessage: "/ipex/grant",
    explanation:
      "IPEX (Issuance & Presentation EXchange) is the consent protocol. The grant " +
      "bundles the ACDC + issuance + anchor events, and embeds the schema SAID and " +
      "OOBI so the holder can fetch and validate the schema before accepting.",
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
    title: "Grant delivered to holder's KERIA mailbox",
    explanation:
      "The holder will see an `/exn/ipex/grant` notification and must `admit` it " +
      "to store the credential. Until then the holder does not have the credential.",
    response: grantExn,
  });

  return { credentialSaid, grantExn };
}
