import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router, type Request, type Response } from "express";
import {
  WITNESSES,
  TOAD,
  type ConfigDTO,
  type IssueRequest,
  type PresentStartRequest,
  type AttestRequestBody,
  type AttestVerifyRequest,
} from "@keri-demo/shared";
import type { Env } from "./env";
import type { IssuerState } from "./keri/issuer";
import { serialize } from "./keri/client";
import { resolveOobiOnClient } from "./keri/oobi";
import { issueAndGrant } from "./keri/grant";
import { requestPresentation } from "./keri/present";
import {
  createAttestationRequest,
  verifyAttestation,
  remoteSignAttestation,
} from "./keri/attest";
import { StepRecorder } from "./step";
import { JobRegistry } from "./jobs";

const schemaPath = fileURLToPath(
  new URL("../../infra/schema/keri-demo-credential.schema.json", import.meta.url)
);
const schemaJson = JSON.parse(readFileSync(schemaPath, "utf8"));
const SCHEMA_SAID: string = schemaJson.$id;

export function makeRouter(
  env: Env,
  issuer: IssuerState,
  jobs: JobRegistry
): Router {
  const r = Router();
  const schemaOobi = `${env.publicHost}/oobi/${SCHEMA_SAID}`;

  r.get("/oobi/:said", (req: Request, res: Response) => {
    if (req.params.said !== SCHEMA_SAID) {
      res.status(404).end();
      return;
    }
    res.type("application/json").send(JSON.stringify(schemaJson));
  });

  r.get("/healthz", (_req, res) => res.json({ ok: true }));

  r.get("/api/config", (_req, res) => {
    const cfg: ConfigDTO = {
      keriaUrl: process.env.VITE_KERIA_URL || "http://localhost:3901",
      keriaBootUrl: process.env.VITE_KERIA_BOOT_URL || "http://localhost:3903",
      schemaSaid: SCHEMA_SAID,
      schemaOobi,
      issuerAid: issuer.aid,
      issuerOobi: issuer.oobi,
      registrySaid: issuer.registrySaid,
      witnesses: WITNESSES,
      toad: TOAD,
    };
    res.json(cfg);
  });

  r.get("/api/issuer/info", (_req, res) =>
    res.json({
      issuerAid: issuer.aid,
      issuerOobi: issuer.oobi,
      registrySaid: issuer.registrySaid,
    })
  );

  // Veridian mode: the browser has no agent. The user pastes their Veridian
  // wallet OOBI; the backend resolves it and from then on talks directly to the
  // wallet AID (exactly like KeriService.resolveOobi). The phone then receives
  // the IPEX/remotesign notifications.
  r.post("/api/veridian/connect", async (req: Request, res: Response) => {
    const body = req.body as { oobi: string };
    const rec = new StepRecorder("connect");
    try {
      const aid = await serialize(async () => {
        rec.add({
          title: "Backend resolves the Veridian wallet OOBI",
          call: "client.oobis().resolve(oobi)",
          keriMessage: "oobi",
          explanation:
            "The issuer's KERIA fetches the wallet's key state from its OOBI and " +
            "stores it as a contact. After this the backend can target the wallet " +
            "AID directly, and the Veridian phone receives the notifications.",
          request: { oobi: body.oobi },
        });
        await resolveOobiOnClient(
          issuer.client,
          body.oobi,
          `veridian-${Date.now()}`
        );
        const m = body.oobi.match(/\/oobi\/([^/]+)/);
        if (!m) throw new Error("No AID found in OOBI URL");
        return m[1];
      });
      rec.add({
        title: "Veridian wallet linked",
        explanation:
          "The wallet AID is now a known contact of the issuer. Issue, present " +
          "and attest will prompt for approval on the phone.",
        response: { aid },
      });
      res.json({ aid, steps: rec.steps() });
    } catch (e) {
      rec.fail(
        (e as Error).message,
        "Could not resolve the Veridian OOBI. Make sure the Veridian app points " +
          "at this KERIA and the OOBI URL is reachable from the backend."
      );
      res.status(500).json({ steps: rec.steps(), error: (e as Error).message });
    }
  });

  r.post("/api/issuer/issue", async (req: Request, res: Response) => {
    const body = req.body as IssueRequest;
    const rec = new StepRecorder("issue");
    try {
      const out = await serialize(async () => {
        rec.add({
          title: "Verifier resolves the holder's OOBI",
          call: "client.oobis().resolve(holderOobi)",
          keriMessage: "oobi",
          explanation:
            "Each KERIA agent keeps its own contacts. The issuer must resolve the " +
            "holder's OOBI before it can target that AID in a grant.",
        });
        await resolveOobiOnClient(issuer.client, body.holderOobi, `holder-${Date.now()}`);
        return issueAndGrant(
          issuer,
          env.issuerName,
          body.holderAid,
          SCHEMA_SAID,
          schemaOobi,
          { name: body.name, email: body.email, role: body.role },
          rec
        );
      });
      res.json({ ...out, steps: rec.steps() });
    } catch (e) {
      rec.fail(
        (e as Error).message,
        "Issuance failed. Common cause: the holder's OOBI is unreachable, or KERIA " +
          "is still starting."
      );
      res.status(500).json({ steps: rec.steps(), error: (e as Error).message });
    }
  });

  r.post("/api/verifier/present/start", (req: Request, res: Response) => {
    const body = req.body as PresentStartRequest;
    const jobId = jobs.create("present");
    const rec = new StepRecorder("present");
    res.json({ jobId, steps: rec.steps() });
    void serialize(async () => {
      try {
        await resolveOobiOnClient(issuer.client, body.holderOobi, `holder-${Date.now()}`);
        const out = await requestPresentation(
          issuer,
          env.issuerName,
          body.holderAid,
          SCHEMA_SAID,
          rec
        );
        jobs.appendSteps(jobId, rec.steps());
        jobs.resolve(jobId, out);
      } catch (e) {
        rec.fail(
          (e as Error).message,
          "Presentation did not complete. The holder may not have offered the " +
            "credential (is the demo holder connected / did the Veridian user approve?)."
        );
        jobs.appendSteps(jobId, rec.steps());
        jobs.error(jobId, (e as Error).message);
      }
    });
  });

  r.get("/api/verifier/present/:jobId", (req: Request, res: Response) => {
    const j = jobs.get(String(req.params.jobId));
    if (!j) {
      res.status(404).json({ error: "unknown job" });
      return;
    }
    const result = j.result as
      | { credential: Record<string, unknown>; verification: unknown[] }
      | undefined;
    res.json({
      status: j.status,
      credential: result?.credential,
      verification: result?.verification,
      error: j.error,
      steps: j.steps,
    });
  });

  r.post("/api/verifier/attest/request", (req: Request, res: Response) => {
    const body = req.body as AttestRequestBody;
    const rec = new StepRecorder("attest");
    const payload = createAttestationRequest(body.holderAid, rec);
    res.json({ payload, steps: rec.steps() });
  });

  r.post("/api/verifier/attest/verify", async (req: Request, res: Response) => {
    const body = req.body as AttestVerifyRequest;
    const rec = new StepRecorder("attest");
    try {
      const verification = await serialize(() =>
        verifyAttestation(issuer, body.holderAid, body.said, body.seq, rec)
      );
      res.json({ verification, steps: rec.steps() });
    } catch (e) {
      rec.fail(
        (e as Error).message,
        "Could not verify the attestation against the holder's KEL."
      );
      res.status(500).json({ steps: rec.steps(), error: (e as Error).message });
    }
  });

  // Veridian attestation: backend drives remotesign to the wallet AID, then
  // verifies the anchored SAID against the wallet's KEL (Java parity).
  r.post(
    "/api/verifier/attest/veridian",
    async (req: Request, res: Response) => {
      const body = req.body as { holderAid: string; holderOobi: string };
      const rec = new StepRecorder("attest");
      try {
        const out = await serialize(async () => {
          await resolveOobiOnClient(
            issuer.client,
            body.holderOobi,
            `holder-${Date.now()}`
          );
          const { said, seq } = await remoteSignAttestation(
            issuer,
            env.issuerName,
            body.holderAid,
            rec
          );
          const verification = await verifyAttestation(
            issuer,
            body.holderAid,
            said,
            seq,
            rec
          );
          return { said, seq, verification };
        });
        res.json({ ...out, steps: rec.steps() });
      } catch (e) {
        rec.fail(
          (e as Error).message,
          "Remote-sign attestation failed. Approve the request on the Veridian " +
            "phone, and ensure the wallet supports the /remotesign route."
        );
        res
          .status(500)
          .json({ steps: rec.steps(), error: (e as Error).message });
      }
    }
  );

  return r;
}
