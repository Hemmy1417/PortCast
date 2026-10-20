/** Market shapes exactly as the contract writes them. */
import type { Market, Position } from "@/lib/types";

export const ME = "0xb549f0C168527f28E495f60f8193a24eEFBa0577";
export const T0 = Date.parse("2026-10-01T09:00:00Z");
export const H = 3_600_000;
export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

export function market(over: Partial<Market> = {}): Market {
  return {
    market_id: "mk-0001", question: "Will the canal close for 12 hours?", event_type: "CANAL", place: "Canal",
    lat: "30.00", lon: "32.55", state: "OPEN", yes_pool_wei: "1000000000000000000", no_pool_wei: "1000000000000000000",
    trading_closes: iso(T0 + 10 * H), resolve_after: iso(T0 + 20 * H), window_start: "2026-10-01",
    window_end: "2026-10-01", replay: false, verdict: "", stakers: 2, creator: ME, created_at: iso(T0),
    yes_when: "All transits suspended for 12 continuous hours.", exclusions: "", sources: [],
    periods: { evidence: 3600, appeal: 3600 }, criteria_digest: "a".repeat(64), bond_pot_wei: "0",
    page_keys: [], filed: {}, evidence_ends: "", decide_long_stop: "", record_long_stop: iso(T0 + 400 * H),
    resolved_at: "", appeal_ends: "", appeal: null, round_count: 0, settled_how: "", settled_at: "",
    events: [], pages: [], rounds: [], bond_wei: "100000000000000000", ...over,
  };
}

export function position(yes: string, no: string, over: Partial<Position> = {}): Position {
  return { yes_wei: yes, no_wei: no, collected: false, paid_wei: "0", owed_wei: "0", ...over };
}

export const LIMITS = { perStaker: 2, perSide: 4 };
