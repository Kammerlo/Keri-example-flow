import { create } from "zustand";
import type { SignifyClient } from "signify-ts";
import type { ConfigDTO, StepLog } from "@keri-demo/shared";

type Mode = "none" | "demo" | "veridian";

interface SessionState {
  mode: Mode;
  config: ConfigDTO | null;
  client: SignifyClient | null;
  walletName: string;
  holderAid: string;
  holderOobi: string;
  veridianAid: string;
  steps: StepLog[];
  set: (p: Partial<SessionState>) => void;
  addSteps: (s: StepLog[]) => void;
  recordClient: (s: Omit<StepLog, "ts" | "source">) => void;
  clearSteps: () => void;
}

export const useSession = create<SessionState>((set) => ({
  mode: "none",
  config: null,
  client: null,
  walletName: "",
  holderAid: "",
  holderOobi: "",
  veridianAid: "",
  steps: [],
  set: (p) => set(p),
  addSteps: (s) => set((st) => ({ steps: [...st.steps, ...s] })),
  recordClient: (s) =>
    set((st) => ({
      steps: [...st.steps, { ...s, ts: Date.now(), source: "client" }],
    })),
  clearSteps: () => set({ steps: [] }),
}));
