import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type SignifyClient } from "signify-ts";
import type { Env } from "../env";
import { bootClient, generateSalt } from "./client";
import { withTimeout, waitOpts } from "./timeout";

export interface IssuerState {
  client: SignifyClient;
  aid: string;
  oobi: string;
  registrySaid: string;
}

const SALT_FILE = "data/issuer.salt";

function resolveSalt(env: Env): string {
  if (env.issuerSalt) return env.issuerSalt;
  if (existsSync(SALT_FILE)) return readFileSync(SALT_FILE, "utf8").trim();
  return "";
}

export async function bootstrapIssuer(
  env: Env,
  schemaSaid: string,
  schemaOobi: string
): Promise<IssuerState> {
  let salt = resolveSalt(env);
  if (!salt) {
    salt = await generateSalt();
    mkdirSync(dirname(SALT_FILE), { recursive: true });
    writeFileSync(SALT_FILE, salt);
  }

  const client = await bootClient(env.keriaUrl, env.keriaBootUrl, salt);

  // Identifier (witnessed).
  let aid: string;
  const idPage = await withTimeout(client.identifiers().list(), "identifiers list");
  const idList =
    (idPage as { aids: Array<{ name: string; prefix: string }> }).aids ?? [];
  const existing = idList.find((id) => id.name === env.issuerName);
  if (existing) {
    aid = existing.prefix;
  } else {
    // No witnesses for the issuer — credential-server parity
    // (`client.identifiers().create(aidName)`). A witnessed issuer makes KERIA
    // reject the indexer end-role / loc-scheme reply ("unable to verify end
    // role reply message"), which the Veridian wallet needs to locate the
    // ACDC schema. The demo holder is still witnessed (the toad>0 lesson).
    const result = await withTimeout(
      client.identifiers().create(env.issuerName, { transferable: true }),
      "identifier create"
    );
    await client.operations().wait(await result.op(), waitOpts());
    const hab = await withTimeout(
      client.identifiers().get(env.issuerName),
      "identifier get"
    );
    aid = hab.prefix;
    const roleResult = await withTimeout(
      client.identifiers().addEndRole(env.issuerName, "agent", client.agent!.pre),
      "addEndRole"
    );
    await client.operations().wait(await roleResult.op(), waitOpts());
  }

  // Indexer end-role + loc scheme (credential-server ensureEndRoles parity).
  // The Veridian wallet discovers where to resolve the ACDC schema by querying
  // the issuer's `indexer` endpoint on KERIA and reading this loc-scheme url —
  // without it the wallet receives the credential but can't resolve its schema
  // when opened. `url` must be reachable from KERIA (the wallet's KERIA), i.e.
  // the schema-OOBI host, not a LAN IP. Idempotent: ignore "already exists".
  try {
    const idxRes = await client
      .identifiers()
      .addEndRole(env.issuerName, "indexer", aid);
    await client.operations().wait(await idxRes.op(), waitOpts());
  } catch (e) {
    console.warn(`[issuer] indexer end-role skipped: ${(e as Error).message}`);
  }
  try {
    const scheme = new URL(env.schemaOobiHost).protocol.replace(":", "");
    const locRes = await client
      .identifiers()
      .addLocScheme(env.issuerName, { url: env.schemaOobiHost, scheme });
    await client.operations().wait(await locRes.op(), waitOpts());
  } catch (e) {
    console.warn(`[issuer] loc scheme skipped: ${(e as Error).message}`);
  }

  // Registry.
  let registrySaid: string;
  const registries = await withTimeout(
    client.registries().list(env.issuerName),
    "registries list"
  );
  if (registries && (registries as unknown[]).length > 0) {
    registrySaid = (registries as Array<{ regk: string }>)[0].regk;
  } else {
    const regResult = await withTimeout(
      client.registries().create({
        name: env.issuerName,
        registryName: env.issuerRegistry,
        noBackers: true,
      }),
      "registry create"
    );
    await client.operations().wait(await regResult.op(), waitOpts());
    registrySaid = regResult.regser.pre;
  }

  // Schema OOBI (self-hosted) — must resolve before issuance.
  const schemaOp = await withTimeout(
    client.oobis().resolve(schemaOobi, `schema-${schemaSaid}`),
    "schema OOBI resolve"
  );
  await client.operations().wait(schemaOp, waitOpts());

  // Own OOBI (so holders can verify the grant signature).
  let oobi = "";
  try {
    const r = await withTimeout(
      client.oobis().get(env.issuerName, "agent"),
      "own OOBI"
    );
    oobi = (r as { oobis?: string[] }).oobis?.[0] ?? "";
  } catch (e) {
    console.error("[issuer] own OOBI fetch failed (non-fatal):", e);
  }

  return { client, aid, oobi, registrySaid };
}
