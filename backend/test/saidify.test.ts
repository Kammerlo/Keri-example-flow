import { describe, it, expect, beforeAll } from "vitest";
import { ready } from "signify-ts";
import { saidify } from "../src/keri/saidify";

describe("saidify", () => {
  beforeAll(async () => {
    await ready();
  });
  it("computes a deterministic Blake3 SAID and embeds it in d", async () => {
    const a = await saidify({ i: "Eaid", d: "", purpose: "demo", nonce: "abc" });
    const b = await saidify({ i: "Eaid", d: "", purpose: "demo", nonce: "abc" });
    expect(a.said).toMatch(/^E[A-Za-z0-9_-]{43}$/);
    expect(a.said).toBe(b.said);
    expect(a.sad.d).toBe(a.said);
  });
});
