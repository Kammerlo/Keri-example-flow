import { type SignifyClient } from "signify-ts";
import type { VerificationCheck } from "@keri-demo/shared";
import { nowKeriTimestamp, waitOpts } from "./timeout";
import { waitForNotification, markAndDelete } from "./notifications";
import type { IssuerState } from "./issuer";
import type { StepRecorder } from "../step";

export async function requestPresentation(
  verifier: IssuerState,
  verifierName: string,
  holderAid: string,
  schemaSaid: string,
  rec: StepRecorder,
  timeoutMs = 180_000
): Promise<{ credential: Record<string, unknown>; verification: VerificationCheck[] }> {
  const client = verifier.client;

  rec.add({
    title: "Verifier sends IPEX apply",
    call: "client.ipex().apply({ schemaSaid }) + submitApply(...)",
    keriMessage: "/ipex/apply",
    explanation:
      "Presentation is verifier-driven. `apply` asks the holder to present a " +
      "credential of this schema. We use the standard signify-ts ipex().apply — " +
      "the exact call the Veridian team's credential-server uses, so the wallet " +
      "raises a disclosure prompt on the phone.",
  });
  const [applyExn, applySigs] = await client.ipex().apply({
    senderName: verifierName,
    recipient: holderAid,
    schemaSaid,
    datetime: nowKeriTimestamp(),
  });
  const applyOp = await client
    .ipex()
    .submitApply(verifierName, applyExn, applySigs, [holderAid]);
  await client.operations().wait(applyOp, waitOpts());

  rec.add({
    title: "Waiting for holder's offer",
    keriMessage: "/ipex/offer",
    explanation:
      "The holder (browser demo agent, or the Veridian phone) responds with an " +
      "`offer` containing the credential it is willing to present.",
  });
  const offerNote = await waitForNotification(
    client,
    ["/exn/ipex/offer", "/ipex/offer"],
    timeoutMs
  );
  const offerSaid = offerNote.a.d;
  await markAndDelete(client, offerNote);

  rec.add({
    title: "Verifier agrees to the offer",
    call: "client.ipex().agree({ offerSaid })",
    keriMessage: "/ipex/agree",
    explanation: "`agree` confirms the verifier wants the offered credential.",
  });
  const [agreeExn, agreeSigs, agreeAtc] = await client.ipex().agree({
    senderName: verifierName,
    recipient: holderAid,
    offerSaid,
    datetime: nowKeriTimestamp(),
  });
  const agreeOp = await client
    .ipex()
    .submitAgree(verifierName, agreeExn, agreeSigs, [holderAid]);
  await client.operations().wait(agreeOp, waitOpts());

  const grantNote = await waitForNotification(
    client,
    ["/exn/ipex/grant", "/ipex/grant"],
    timeoutMs
  );
  const grantSaid = grantNote.a.d;
  const grantExchange = await client.exchanges().get(grantSaid);
  const exn = grantExchange.exn as {
    e?: { acdc?: Record<string, unknown> & { d?: string } };
  };
  const acdc = exn.e?.acdc;
  if (!acdc?.d) throw new Error("[present] grant exchange has no acdc.d");

  rec.add({
    title: "Holder grants the credential",
    keriMessage: "/ipex/grant",
    explanation:
      "The holder discloses the credential. The verifier now validates it before " +
      "admitting.",
    response: acdc,
  });

  const [admitExn, admitSigs] = await client.ipex().admit({
    senderName: verifierName,
    recipient: holderAid,
    grantSaid,
    datetime: nowKeriTimestamp(),
  });
  // Java reuses the agree message's attachment for the admit submit.
  const admitOp = await client
    .ipex()
    .submitAdmit(verifierName, admitExn, admitSigs, agreeAtc, [holderAid]);
  await client.operations().wait(admitOp, waitOpts());
  await markAndDelete(client, grantNote);

  const verification: VerificationCheck[] = [
    {
      label: "Schema SAID matches the requested schema",
      passed: acdc.s === schemaSaid,
      detail: `Presented schema ${String(acdc.s)} ${
        acdc.s === schemaSaid ? "==" : "!="
      } requested ${schemaSaid}.`,
    },
    {
      label: "Issuer is the trusted demo issuer",
      passed: acdc.i === verifier.aid,
      detail: `Credential issuer ${String(acdc.i)} ${
        acdc.i === verifier.aid ? "==" : "!="
      } this issuer ${verifier.aid}.`,
    },
    {
      label: "Credential is bound to the presenting holder",
      passed:
        (acdc.a as Record<string, unknown> | undefined)?.i === holderAid,
      detail: `Subject a.i ${String(
        (acdc.a as Record<string, unknown> | undefined)?.i
      )} ${
        (acdc.a as Record<string, unknown> | undefined)?.i === holderAid
          ? "=="
          : "!="
      } presenter ${holderAid}.`,
    },
  ];
  rec.add({
    title: "Verification complete",
    explanation:
      "Each check is a distinct trust question: right schema? trusted issuer? " +
      "bound to the party that presented it? All must pass to trust the claim.",
    response: verification,
  });

  return { credential: acdc, verification };
}
