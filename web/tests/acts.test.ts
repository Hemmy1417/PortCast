import { describe, expect, it } from "vitest";

import { filingStage, marketActs, stages, unpaidBy } from "@/lib/acts";
import { H, iso, LIMITS, market, ME, position, T0 } from "./fixtures";

const GEN = "1000000000000000000";
type M = ReturnType<typeof market>;
const acts = (m: M, now: number, pos = position(GEN, "0"), address: string | null = ME) =>
  marketActs(m, now, { address, position: pos }, LIMITS);
const get = (list: ReturnType<typeof acts>, key: string) => list.find((a) => a.key === key);

describe("trading and the record", () => {
  it("stakes until trading closes, and not at the closing instant", () => {
    const m = market();
    expect(get(acts(m, T0), "stake")?.open).toBe(true);
    expect(get(acts(m, T0 + 10 * H - 1), "stake")?.open).toBe(true);
    expect(get(acts(m, T0 + 10 * H), "stake")).toBeUndefined();
  });
  it("needs a wallet to stake", () => {
    expect(get(acts(market(), T0, position("0", "0"), null), "stake")?.open).toBe(false);
  });
  it("records only from the resolution time", () => {
    const m = market();
    expect(get(acts(m, T0 + 20 * H - 1), "record")?.open).toBe(false);
    expect(get(acts(m, T0 + 20 * H), "record")?.open).toBe(true);
  });
  it("names the next source", () => {
    const m = market({ page_keys: ["mk-0001|1"], sources: [
      { url: "a", host: "a", publisher: "A", kind: "NEWS" }, { url: "b", host: "b", publisher: "B", kind: "NEWS" }] });
    expect(get(acts(m, T0 + 21 * H), "record")?.label).toBe("Record source 2 of 2");
  });
  it("offers a void only after the record long stop", () => {
    const m = market();
    expect(get(acts(m, T0 + 400 * H), "void")).toBeUndefined();
    expect(get(acts(m, T0 + 400 * H + 1), "void")?.open).toBe(true);
  });
});

describe("evidence and the answer", () => {
  const m = market({ state: "RECORDED", evidence_ends: iso(T0 + 30 * H), decide_long_stop: iso(T0 + 33 * H) });
  it("files while evidence is open, for a staker only", () => {
    expect(filingStage(m, T0 + 30 * H)).toBe("EVIDENCE");
    expect(filingStage(m, T0 + 30 * H + 1)).toBeNull();
    expect(get(acts(m, T0 + 29 * H), "file")?.open).toBe(true);
    expect(get(acts(m, T0 + 29 * H, position("0", "0")), "file")?.open).toBe(false);
  });
  it("respects the allowance and the ceiling", () => {
    expect(get(acts({ ...m, filed: { [`EVIDENCE|${ME}`]: 2 } }, T0 + 29 * H), "file")?.open).toBe(false);
    expect(get(acts({ ...m, filed: { "EVIDENCE|YES": 4 } }, T0 + 29 * H), "file")?.open).toBe(false);
    expect(get(acts({ ...m, filed: { "EVIDENCE|NO": 4 } }, T0 + 29 * H), "file")?.open).toBe(true);
    expect(get(acts({ ...m, filed: { "EVIDENCE|NO": 4 } }, T0 + 29 * H, position("0", GEN)), "file")?.open).toBe(false);
  });
  it("asks for the answer only after the evidence period", () => {
    expect(get(acts(m, T0 + 30 * H), "resolve")?.open).toBe(false);
    expect(get(acts(m, T0 + 30 * H + 1), "resolve")?.open).toBe(true);
  });
  it("voids when no answer came by the long stop", () => {
    expect(get(acts(m, T0 + 33 * H + 1), "void")?.open).toBe(true);
    expect(get(acts(m, T0 + 33 * H), "void")).toBeUndefined();
  });
});

describe("appeals", () => {
  const r = market({ state: "RESOLVED", verdict: "YES", appeal_ends: iso(T0 + 40 * H) });
  it("lets only an unpaid staker appeal", () => {
    expect(unpaidBy(r, position("0", GEN))).toBe(true);
    expect(unpaidBy(r, position(GEN, "0"))).toBe(false);
    expect(unpaidBy({ ...r, verdict: "NO" }, position(GEN, "0"))).toBe(true);
    expect(unpaidBy({ ...r, verdict: "NO" }, position("0", GEN))).toBe(false);
    expect(unpaidBy({ ...r, verdict: "NO_RESOLUTION" }, position(GEN, "0"))).toBe(true);
    expect(unpaidBy(r, null)).toBe(false);
    expect(get(acts(r, T0 + 39 * H, position("0", GEN)), "appeal")?.open).toBe(true);
    expect(get(acts(r, T0 + 39 * H, position(GEN, "0")), "appeal")?.open).toBe(false);
  });
  it("finalizes only after the appeal window", () => {
    expect(get(acts(r, T0 + 40 * H), "finalize")?.open).toBe(false);
    expect(get(acts(r, T0 + 40 * H + 1), "finalize")?.open).toBe(true);
  });
  it("decides the appeal after its evidence, then lapses at its long stop", () => {
    const a = market({ state: "APPEALED", verdict: "YES", appeal: {
      by: ME, statement: "x", bond_wei: "1", at: iso(T0), from: "YES",
      evidence_ends: iso(T0 + 50 * H), lapse_at: iso(T0 + 53 * H), result: "" } });
    expect(get(acts(a, T0 + 50 * H), "decide_appeal")?.open).toBe(false);
    expect(get(acts(a, T0 + 50 * H + 1), "decide_appeal")?.open).toBe(true);
    expect(get(acts(a, T0 + 53 * H + 1), "lapse_appeal")?.open).toBe(true);
    expect(get(acts(a, T0 + 53 * H), "lapse_appeal")).toBeUndefined();
  });
});

describe("the end", () => {
  it("collects once", () => {
    const f = market({ state: "FINAL", verdict: "YES" });
    expect(get(acts(f, T0), "collect")?.open).toBe(true);
    expect(get(acts(f, T0, position(GEN, "0", { collected: true })), "collect")).toBeUndefined();
    expect(get(acts(f, T0, position("0", "0")), "collect")).toBeUndefined();
  });
  it("tracks the stages", () => {
    expect(stages(market(), T0).map((s) => s.status)).toEqual(["now", "ahead", "ahead", "ahead", "ahead"]);
    expect(stages(market({ state: "FINAL" }), T0).map((s) => s.status)).toEqual(["done", "done", "done", "skipped", "now"]);
    expect(stages(market({ state: "VOID" }), T0).at(-1)?.label).toBe("Void, refunded");
  });
});
