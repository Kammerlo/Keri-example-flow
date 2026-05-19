import { randomUUID } from "node:crypto";
import type { FlowName, StepLog } from "@keri-demo/shared";

interface Job {
  status: "pending" | "done" | "error";
  flow: FlowName;
  steps: StepLog[];
  result?: unknown;
  error?: string;
  createdAt: number;
}

const TTL_MS = 30 * 60_000;

export class JobRegistry {
  private jobs = new Map<string, Job>();

  create(flow: FlowName): string {
    this.gc();
    const id = randomUUID();
    this.jobs.set(id, { status: "pending", flow, steps: [], createdAt: Date.now() });
    return id;
  }
  appendSteps(id: string, steps: StepLog[]): void {
    const j = this.jobs.get(id);
    if (j) j.steps.push(...steps);
  }
  resolve(id: string, result: unknown): void {
    const j = this.jobs.get(id);
    if (j) {
      j.status = "done";
      j.result = result;
    }
  }
  error(id: string, error: string): void {
    const j = this.jobs.get(id);
    if (j) {
      j.status = "error";
      j.error = error;
    }
  }
  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }
  private gc(): void {
    const now = Date.now();
    for (const [id, j] of this.jobs)
      if (now - j.createdAt > TTL_MS) this.jobs.delete(id);
  }
}
