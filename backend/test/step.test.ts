import { describe, it, expect } from "vitest";
import { StepRecorder } from "../src/step";

describe("StepRecorder", () => {
  it("records ordered backend steps with explanation and raw response", () => {
    const rec = new StepRecorder("issue");
    rec.add({
      title: "Issue ACDC",
      call: "client.credentials().issue(...)",
      keriMessage: "iss",
      explanation: "The issuer creates the credential in its registry.",
      response: { d: "Ecred" },
    });
    const steps = rec.steps();
    expect(steps).toHaveLength(1);
    expect(steps[0].source).toBe("backend");
    expect(steps[0].flow).toBe("issue");
    expect(steps[0].ts).toBeTypeOf("number");
    expect(steps[0].response).toEqual({ d: "Ecred" });
  });
  it("captures errors via fail()", () => {
    const rec = new StepRecorder("present");
    rec.fail("Apply timed out", "Holder never offered — is the wallet connected?");
    expect(rec.steps()[0].error).toBe("Apply timed out");
    expect(rec.steps()[0].explanation).toMatch(/wallet connected/);
  });
});
