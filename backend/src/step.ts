import type { FlowName, StepLog } from "@keri-demo/shared";

export class StepRecorder {
  private _steps: StepLog[] = [];
  constructor(private readonly flow: FlowName) {}

  add(s: {
    title: string;
    call?: string;
    keriMessage?: string;
    explanation: string;
    request?: unknown;
    response?: unknown;
  }): void {
    this._steps.push({
      ts: Date.now(),
      source: "backend",
      flow: this.flow,
      ...s,
    });
  }

  fail(error: string, explanation: string): void {
    this._steps.push({
      ts: Date.now(),
      source: "backend",
      flow: this.flow,
      title: "Error",
      explanation,
      error,
    });
  }

  steps(): StepLog[] {
    return this._steps;
  }
}
