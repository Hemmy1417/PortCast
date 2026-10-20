/** The shapes the contract's views return, field for field. */

export type EventType = "PORT" | "CANAL" | "WEATHER" | "ROUTE" | "CONGESTION" | "FREIGHT";
export type Side = "YES" | "NO";
export type Verdict = "YES" | "NO" | "NO_RESOLUTION";
export type MarketState = "OPEN" | "RECORDED" | "RESOLVED" | "APPEALED" | "FINAL" | "VOID";
export type PublisherKind = "AUTHORITY" | "WEATHER_SERVICE" | "NEWS" | "TRADE_PRESS" | "OPERATOR";
export type Stage = "SOURCE" | "EVIDENCE" | "APPEAL";

export interface Publisher { host: string; name: string; kind: PublisherKind }

export interface Config {
  ruleset: string;
  deployer: string;
  event_types: EventType[];
  verdicts: Verdict[];
  states: MarketState[];
  publishers: Publisher[];
  min_stake_wei: string;
  min_bond_wei: string;
  bond_bps: number;
  min_sources: number;
  max_sources: number;
  min_period_seconds: number;
  max_period_seconds: number;
  max_horizon_days: number;
  record_long_stop_days: number;
  long_stop_periods: number;
  filed_per_staker: number;
  filed_per_side: number;
  page_excerpt_chars: number;
  page_min_chars: number;
  page_slack_chars: number;
  limits: { question: number; criteria: number; exclusions: number; place: number; statement: number; note: number; url: number };
}

export interface Stats {
  market: string;
  round: string;
  staked_wei: string;
  paid_wei: string;
  held_wei: string;
  final: string;
  void: string;
}

export interface Source { url: string; host: string; publisher: string; kind: PublisherKind }

export interface Page {
  n: number;
  stage: Stage;
  url: string;
  host: string;
  publisher: string;
  kind: PublisherKind;
  by: string;
  side?: "YES" | "NO" | "BOTH";
  note: string;
  text: string;
  at: string;
  chars: number;
  sha256: string;
}

export interface PageNote { n: number; supports: "YES" | "NO" | "NEITHER"; says: string }

export interface Round {
  n: number;
  kind: "RESOLUTION" | "APPEAL";
  at: string;
  ruleset: string;
  verdict: Verdict;
  reason: string;
  pages: PageNote[];
  record: { n: number; stage: Stage; sha256: string }[];
  criteria_digest: string;
}

export interface Appeal {
  by: string;
  statement: string;
  bond_wei: string;
  at: string;
  from: Verdict;
  evidence_ends: string;
  lapse_at: string;
  result: "" | "CHANGED" | "HELD" | "LAPSED";
}

export interface MarketEvent { kind: string; at: string; by: string; detail: string }

export interface MarketSummary {
  market_id: string;
  question: string;
  event_type: EventType;
  place: string;
  lat: string;
  lon: string;
  state: MarketState;
  yes_pool_wei: string;
  no_pool_wei: string;
  trading_closes: string;
  resolve_after: string;
  window_start: string;
  window_end: string;
  replay: boolean;
  verdict: Verdict | "";
  stakers: number;
}

export interface Market extends MarketSummary {
  creator: string;
  created_at: string;
  yes_when: string;
  exclusions: string;
  sources: Source[];
  periods: { evidence: number; appeal: number };
  criteria_digest: string;
  bond_pot_wei: string;
  page_keys: string[];
  filed: Record<string, number>;
  evidence_ends: string;
  decide_long_stop: string;
  record_long_stop: string;
  resolved_at: string;
  appeal_ends: string;
  appeal: Appeal | null;
  round_count: number;
  settled_how: string;
  settled_at: string;
  events: MarketEvent[];
  pages: Page[];
  rounds: Round[];
  bond_wei: string;
}

export interface MarketList { total: number; items: MarketSummary[] }

export interface Position { yes_wei: string; no_wei: string; collected: boolean; paid_wei: string; owed_wei: string }

export interface Balance { claimable: string; claimed: string }
