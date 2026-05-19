// Computes the ACDC schema SAID (BLAKE3, label "$id") and writes the
// final self-addressing schema JSON. Run: `npm run schema:saidify`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Saider, ready } from "signify-ts";

const OUT = fileURLToPath(
  new URL("./keri-demo-credential.schema.json", import.meta.url)
);

const schema: Record<string, unknown> = {
  $id: "",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "KeriDemoCredential",
  description: "Educational demo credential issued over IPEX",
  type: "object",
  credentialType: "KeriDemoCredential",
  properties: {
    v: { type: "string" },
    d: { type: "string" },
    i: { type: "string" },
    ri: { type: "string" },
    s: { type: "string" },
    a: {
      type: "object",
      properties: {
        // `d` is the attribute-block SAID that KERIA/signify add on issuance —
        // the canonical ACDC attribute shape requires it in the schema.
        d: { type: "string" },
        i: { type: "string" },
        dt: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string" },
      },
      required: ["d", "i", "dt", "name", "email", "role"],
      additionalProperties: false,
    },
  },
  required: ["v", "d", "i", "ri", "s", "a"],
  additionalProperties: false,
};

async function main(): Promise<void> {
  await ready();
  // label "$id": ACDC/JSON-Schema SAIDs live in the `$id` field.
  const [, sad] = (Saider as unknown as {
    saidify: (
      sad: Record<string, unknown>,
      code?: string,
      kind?: string,
      label?: string
    ) => [unknown, Record<string, unknown>];
  }).saidify(schema, undefined, undefined, "$id");

  writeFileSync(OUT, JSON.stringify(sad, null, 2) + "\n");
  console.log(`schema SAID: ${sad.$id as string}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
