// ─── Witness network (keripy `kli witness demo`, well-known deterministic AIDs) ───
export interface WitnessInfo {
  name: string;
  aid: string;
  url: string;
}

export const WITNESSES: WitnessInfo[] = [
  { name: "wan", aid: "BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha", url: "http://witnesses:5642" },
  { name: "wil", aid: "BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM", url: "http://witnesses:5643" },
  { name: "wes", aid: "BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX", url: "http://witnesses:5644" },
];

export const TOAD = 2;

export function witnessAids(): string[] {
  return WITNESSES.map((w) => w.aid);
}

// ─── Annotated step log (core teaching mechanism) ───
export type FlowName = "connect" | "issue" | "present" | "attest";

export interface StepLog {
  ts: number;
  source: "backend" | "client";
  flow: FlowName;
  title: string;
  call?: string;
  keriMessage?: string;
  explanation: string;
  request?: unknown;
  response?: unknown;
  error?: string;
}

// ─── API DTOs ───
export interface ConfigDTO {
  keriaUrl: string;
  keriaBootUrl: string;
  schemaSaid: string;
  schemaOobi: string;
  issuerAid: string;
  issuerOobi: string;
  registrySaid: string;
  witnesses: WitnessInfo[];
  toad: number;
}

export interface IssueRequest {
  holderAid: string;
  holderOobi: string;
  name: string;
  email: string;
  role: string;
}
export interface IssueResponse {
  credentialSaid: string;
  grantExn: unknown;
  steps: StepLog[];
}

export interface PresentStartRequest {
  holderAid: string;
  holderOobi: string;
}
export interface PresentStartResponse {
  jobId: string;
  steps: StepLog[];
}
export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail: string;
}
export interface PresentStatusResponse {
  status: "pending" | "done" | "error";
  credential?: Record<string, unknown>;
  verification?: VerificationCheck[];
  error?: string;
  steps: StepLog[];
}

export interface AttestRequestBody {
  holderAid: string;
  holderOobi: string;
}
export interface AttestPayload {
  i: string;
  d: string;
  purpose: string;
  nonce: string;
  dt: string;
}
export interface AttestRequestResponse {
  payload: AttestPayload;
  steps: StepLog[];
}
export interface AttestVerifyRequest {
  holderAid: string;
  said: string;
  seq: string;
}
export interface AttestVerifyResponse {
  verification: VerificationCheck[];
  steps: StepLog[];
}
