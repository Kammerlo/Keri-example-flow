import type { SignifyClient } from "signify-ts";
import type { ConfigDTO } from "@keri-demo/shared";
import { bootClient, generateSalt } from "./client";
import { waitOpts } from "./timeout";

const SALT_KEY = "keri-demo/holder-salt";
const NAME_KEY = "keri-demo/holder-name";

export interface HolderSession {
  client: SignifyClient;
  walletName: string;
  aid: string;
  oobi: string;
}

export async function connectDemoHolder(cfg: ConfigDTO): Promise<HolderSession> {
  let salt = localStorage.getItem(SALT_KEY);
  let walletName = localStorage.getItem(NAME_KEY);
  const fresh = !salt;
  if (!salt) salt = await generateSalt();
  if (!walletName) walletName = `holder-${salt.slice(0, 8)}`;

  const client = await bootClient(cfg.keriaUrl, cfg.keriaBootUrl, salt);

  let aid: string;
  const idPage = await client.identifiers().list();
  const list =
    (idPage as { aids: Array<{ name: string; prefix: string }> }).aids ?? [];
  const existing = list.find((i) => i.name === walletName);
  if (existing && !fresh) {
    aid = existing.prefix;
  } else {
    const res = await client.identifiers().create(walletName, {
      transferable: true,
      toad: cfg.toad,
      wits: cfg.witnesses.map((w) => w.aid),
    });
    await client.operations().wait(await res.op(), waitOpts());
    const hab = await client.identifiers().get(walletName);
    aid = hab.prefix;
    const roleRes = await client
      .identifiers()
      .addEndRole(walletName, "agent", client.agent!.pre);
    await client.operations().wait(await roleRes.op(), waitOpts());
  }

  // Resolve issuer + schema OOBIs so the holder can validate the grant.
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

  const oobiRes = await client.oobis().get(walletName, "agent");
  const oobi = (oobiRes as { oobis?: string[] }).oobis?.[0] ?? "";

  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(NAME_KEY, walletName);
  return { client, walletName, aid, oobi };
}
