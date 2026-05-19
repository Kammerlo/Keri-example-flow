import { describe, it, expect } from "vitest";
import { WITNESSES, TOAD, witnessAids } from "../src/types";

describe("witness constants", () => {
  it("exposes the three keripy demo witnesses with CESR AIDs", () => {
    expect(WITNESSES).toHaveLength(3);
    for (const w of WITNESSES) {
      expect(w.aid).toMatch(/^B[A-Za-z0-9_-]{43}$/);
      expect(w.url).toMatch(/^http:\/\/witnesses:564[2-4]$/);
    }
  });
  it("toad is a 2-of-3 threshold", () => {
    expect(TOAD).toBe(2);
  });
  it("witnessAids() returns just the AID strings", () => {
    expect(witnessAids()).toEqual(WITNESSES.map((w) => w.aid));
  });
});
