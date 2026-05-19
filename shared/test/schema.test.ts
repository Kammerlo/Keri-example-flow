import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(
  new URL("../../infra/schema/keri-demo-credential.schema.json", import.meta.url)
);

describe("KeriDemoCredential schema", () => {
  it("is generated and self-addressing", () => {
    expect(existsSync(schemaPath)).toBe(true);
    const s = JSON.parse(readFileSync(schemaPath, "utf8"));
    expect(s.$id).toMatch(/^E[A-Za-z0-9_-]{43}$/);
    expect(s.title).toBe("KeriDemoCredential");
    expect(s.properties.a.properties).toHaveProperty("name");
    expect(s.properties.a.properties).toHaveProperty("email");
    expect(s.properties.a.properties).toHaveProperty("role");
    expect(s.properties.a.required).toEqual(["i", "dt", "name", "email", "role"]);
  });
});
