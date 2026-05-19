import type { SignifyClient } from "signify-ts";
import type { ConfigDTO } from "@keri-demo/shared";
import { bootClient, generateSalt } from "./client";
import { waitOpts } from "./timeout";

const SESSION_SALT = "keri-demo/companion-salt";
const COMPANION_NAME = "veridian-companion";
const VERIDIAN_AID = "keri-demo/veridian-aid";

export interface CompanionSession {
  client: SignifyClient;
  walletName: string;
  companionAid: string;
  companionOobi: string;
  veridianAid: string;
}

export async function connectCompanion(cfg: ConfigDTO): Promise<CompanionSession> {
  let salt = sessionStorage.getItem(SESSION_SALT);
  if (!salt) {
    salt = await generateSalt();
    sessionStorage.setItem(SESSION_SALT, salt);
  }
  const client = await bootClient(cfg.keriaUrl, cfg.keriaBootUrl, salt);

  const idPage = await client.identifiers().list();
  const list =
    (idPage as { aids: Array<{ name: string; prefix: string }> }).aids ?? [];
  let companionAid: string;
  const existing = list.find((i) => i.name === COMPANION_NAME);
  if (existing) {
    companionAid = existing.prefix;
  } else {
    const res = await client.identifiers().create(COMPANION_NAME, {
      transferable: true,
      toad: cfg.toad,
      wits: cfg.witnesses.map((w) => w.aid),
    });
    await client.operations().wait(await res.op(), waitOpts());
    companionAid = (await client.identifiers().get(COMPANION_NAME)).prefix;
    const roleRes = await client
      .identifiers()
      .addEndRole(COMPANION_NAME, "agent", client.agent!.pre);
    await client.operations().wait(await roleRes.op(), waitOpts());
  }
  for (const [oobi, alias] of [
    [cfg.schemaOobi, `schema-${cfg.schemaSaid}`],
    [cfg.issuerOobi, "issuer"],
  ] as const) {
    if (!oobi) continue;
    try {
      const op = await client.oobis().resolve(oobi, alias);
      await client.operations().wait(op, waitOpts());
    } catch {
      /* already resolved */
    }
  }
  const oobiRes = await client.oobis().get(COMPANION_NAME, "agent");
  const companionOobi = (oobiRes as { oobis?: string[] }).oobis?.[0] ?? "";
  return {
    client,
    walletName: COMPANION_NAME,
    companionAid,
    companionOobi,
    veridianAid: localStorage.getItem(VERIDIAN_AID) ?? "",
  };
}

export async function pairVeridian(
  client: SignifyClient,
  veridianOobi: string
): Promise<string> {
  const alias = `veridian-${Date.now()}`;
  const op = await client.oobis().resolve(veridianOobi, alias);
  await client.operations().wait(op, waitOpts());
  const m = veridianOobi.match(/\/oobi\/([^/]+)/);
  const aid = m ? m[1] : "";
  if (!aid) throw new Error("Could not extract AID from the Veridian OOBI");
  localStorage.setItem(VERIDIAN_AID, aid);
  return aid;
}
