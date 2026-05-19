import { describe, it, expect } from "vitest";
import { JobRegistry } from "../src/jobs";

describe("JobRegistry", () => {
  it("creates pending jobs and resolves them", () => {
    const reg = new JobRegistry();
    const id = reg.create("present");
    expect(reg.get(id)!.status).toBe("pending");
    reg.resolve(id, { credential: { d: "X" }, verification: [] });
    expect(reg.get(id)!.status).toBe("done");
    expect(reg.get(id)!.result).toEqual({ credential: { d: "X" }, verification: [] });
  });
  it("records errors", () => {
    const reg = new JobRegistry();
    const id = reg.create("present");
    reg.error(id, "boom");
    expect(reg.get(id)!.status).toBe("error");
    expect(reg.get(id)!.error).toBe("boom");
  });
  it("appends steps", () => {
    const reg = new JobRegistry();
    const id = reg.create("present");
    reg.appendSteps(id, [
      { ts: 1, source: "backend", flow: "present", title: "x", explanation: "y" },
    ]);
    expect(reg.get(id)!.steps).toHaveLength(1);
  });
});
