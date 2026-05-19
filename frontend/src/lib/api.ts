import type {
  ConfigDTO,
  IssueRequest,
  IssueResponse,
  PresentStartResponse,
  PresentStatusResponse,
  AttestRequestResponse,
  AttestVerifyResponse,
  VeridianConnectResponse,
  AttestVeridianResponse,
} from "@keri-demo/shared";

const base = import.meta.env.VITE_API_BASE || "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok && r.status >= 500) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || "request failed");
  }
  return r.json() as Promise<T>;
}

export const api = {
  config: () => fetch(base + "/api/config").then((r) => r.json() as Promise<ConfigDTO>),
  issue: (b: IssueRequest) => post<IssueResponse>("/api/issuer/issue", b),
  presentStart: (b: { holderAid: string; holderOobi: string }) =>
    post<PresentStartResponse>("/api/verifier/present/start", b),
  presentStatus: (jobId: string) =>
    fetch(base + `/api/verifier/present/${jobId}`).then(
      (r) => r.json() as Promise<PresentStatusResponse>
    ),
  attestRequest: (b: { holderAid: string; holderOobi: string }) =>
    post<AttestRequestResponse>("/api/verifier/attest/request", b),
  attestVerify: (b: { holderAid: string; said: string; seq: string }) =>
    post<AttestVerifyResponse>("/api/verifier/attest/verify", b),
  veridianConnect: (oobi: string) =>
    post<VeridianConnectResponse>("/api/veridian/connect", { oobi }),
  attestVeridian: (b: { holderAid: string; holderOobi: string }) =>
    post<AttestVeridianResponse>("/api/verifier/attest/veridian", b),
};
