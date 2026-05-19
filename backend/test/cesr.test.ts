import { describe, it, expect } from "vitest";
import { parseCesrData, makeCesrStream, reduceCesrChain } from "../src/keri/cesr";

const vcp = { v: "ACDC", t: "vcp", i: "Ereg" };
const iss = { v: "ACDC", t: "iss", i: "Ecred" };
const acdc = { v: "ACDC", d: "Ecred", i: "Eiss", s: "Eschema", a: { x: 1 } };
const ixn = { v: "KERI", t: "ixn", i: "Eaid" };

const stream =
  JSON.stringify(vcp) + "-ATC1" +
  JSON.stringify(iss) + "-ATC2" +
  JSON.stringify(ixn) + "-ATC3" +
  JSON.stringify(acdc);

describe("cesr", () => {
  it("parseCesrData splits events and trailing attachments", () => {
    const parsed = parseCesrData(stream);
    expect(parsed).toHaveLength(4);
    expect(parsed[0].event.t).toBe("vcp");
    expect(parsed[0].atc).toBe("-ATC1");
    expect(parsed[3].event.d).toBe("Ecred");
    expect(parsed[3].atc).toBe("");
  });
  it("makeCesrStream round-trips events+atc", () => {
    expect(makeCesrStream([vcp], ["-ATC1"])).toBe(JSON.stringify(vcp) + "-ATC1");
  });
  it("reduceCesrChain keeps only vcp, iss, acdc and drops ixn", () => {
    const reduced = parseCesrData(reduceCesrChain(stream));
    expect(reduced.map((e) => e.event.t ?? "acdc")).toEqual(["vcp", "iss", "acdc"]);
  });
});
