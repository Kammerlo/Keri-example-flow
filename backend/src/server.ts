import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import { loadEnv } from "./env";
import { bootstrapIssuer } from "./keri/issuer";
import { JobRegistry } from "./jobs";
import { makeRouter } from "./routes";

dotenv.config();

const schemaPath = fileURLToPath(
  new URL("../../infra/schema/keri-demo-credential.schema.json", import.meta.url)
);
const SCHEMA_SAID: string = JSON.parse(readFileSync(schemaPath, "utf8")).$id;

async function bootstrapWithRetry(env: ReturnType<typeof loadEnv>) {
  const schemaOobi = `${env.publicHost}/oobi/${SCHEMA_SAID}`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await bootstrapIssuer(env, SCHEMA_SAID, schemaOobi);
    } catch (e) {
      const wait = Math.min(attempt * 3000, 15000);
      console.error(
        `[bootstrap] attempt ${attempt} failed (${(e as Error).message}); ` +
          `retrying in ${wait}ms (is KERIA up?)`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  let ready = false;
  app.get("/readyz", (_req, res) => {
    if (ready) res.json({ ready: true });
    else res.status(503).json({ ready: false });
  });

  app.listen(env.port, () =>
    console.log(`[server] listening on :${env.port}`)
  );

  const issuer = await bootstrapWithRetry(env);
  const jobs = new JobRegistry();
  app.use(makeRouter(env, issuer, jobs));

  const dist = fileURLToPath(new URL("../../frontend/dist", import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(`${dist}/index.html`));
  }
  ready = true;
  console.log(`[server] issuer ready: ${issuer.aid}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
