import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env";

describe("loadEnv", () => {
  it("returns defaults and the configured port", () => {
    const env = loadEnv({
      KERIA_URL: "http://keria:3901",
      KERIA_BOOT_URL: "http://keria:3903",
      PORT: "3001",
    });
    expect(env.keriaUrl).toBe("http://keria:3901");
    expect(env.issuerName).toBe("keri-demo-issuer");
    expect(env.schemaResolveHost).toBe("http://app:3001");
    expect(env.schemaOobiHost).toBe("http://app:3001");
    expect(env.port).toBe(3001);
  });
  it("throws when KERIA_URL is missing", () => {
    expect(() => loadEnv({})).toThrow(/KERIA_URL/);
  });
});
