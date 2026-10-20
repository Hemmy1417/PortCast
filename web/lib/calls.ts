/**
 * The exact contract call each write sends. Pure, so tests/calls.test.ts can
 * check every one against the deployment's own schema.
 */
export interface Call { method: string; args: unknown[]; value?: bigint }

export const calls = {
  createMarket: (json: string): Call => ({ method: "create_market", args: [json] }),
  stake: (mid: string, side: "YES" | "NO", wei: bigint): Call => ({ method: "stake", args: [mid, side], value: wei }),
  recordSources: (mid: string): Call => ({ method: "record_sources", args: [mid] }),
  filePage: (mid: string, url: string, note: string): Call => ({ method: "file_page", args: [mid, url, note] }),
  resolve: (mid: string): Call => ({ method: "resolve", args: [mid] }),
  appeal: (mid: string, statement: string, bond: bigint): Call => ({ method: "appeal", args: [mid, statement], value: bond }),
  decideAppeal: (mid: string): Call => ({ method: "decide_appeal", args: [mid] }),
  lapseAppeal: (mid: string): Call => ({ method: "lapse_appeal", args: [mid] }),
  finalize: (mid: string): Call => ({ method: "finalize", args: [mid] }),
  voidMarket: (mid: string): Call => ({ method: "void_market", args: [mid] }),
  collect: (mid: string): Call => ({ method: "collect", args: [mid] }),
  claim: (): Call => ({ method: "claim", args: [] }),
};

/** Writes that send value, and answer a refusal by returning, not failing. */
export const PAYABLE = new Set(["stake", "appeal"]);
/** Writes a consensus round decides, which take minutes. */
export const ROUNDS = new Set(["record_sources", "file_page", "resolve", "decide_appeal"]);
