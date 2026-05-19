import { describe, it, expect } from "vitest";
import { checkAnchorInKel } from "../src/keri/verifyKel";

const kel = [
  { t: "icp", s: "0", a: [] },
  { t: "ixn", s: "1", a: [{ d: "Esaid-1" }] },
  { t: "ixn", s: "2", a: [{ d: "Esaid-2" }] },
];

describe("checkAnchorInKel", () => {
  it("passes when the seal d==said exists at the given seq", () => {
    const checks = checkAnchorInKel(kel, "Esaid-2", "2");
    expect(checks.every((c) => c.passed)).toBe(true);
  });
  it("fails when said is not anchored at that seq", () => {
    const checks = checkAnchorInKel(kel, "Esaid-2", "1");
    expect(checks.some((c) => !c.passed)).toBe(true);
  });
  it("fails when seq is missing from the KEL", () => {
    const checks = checkAnchorInKel(kel, "Esaid-2", "9");
    expect(checks.find((c) => c.label.includes("sequence"))!.passed).toBe(false);
  });
});
