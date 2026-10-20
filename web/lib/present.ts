/**
 * Every word a person reads passes through here. Machine values (enum names,
 * ids, wei) become sentences in one place, so no page can print them raw.
 * Identifiers and digests appear only on Verify and in a page's record, where
 * somebody asked to see them.
 */
import type { EventType, MarketState, PublisherKind, Verdict } from "./types";

export function humanize(value: string): string {
  const t = String(value ?? "").trim();
  if (!t) return "";
  const s = t.replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const label = (map: Record<string, string>, k: string | null | undefined) =>
  map[String(k ?? "")] ?? humanize(String(k ?? ""));

const EVENT: Record<EventType, string> = {
  PORT: "Port disruption",
  CANAL: "Canal restriction",
  WEATHER: "Weather at sea",
  ROUTE: "Shipping route",
  CONGESTION: "Congestion",
  FREIGHT: "Freight market",
};
export const eventType = (t: string) => label(EVENT, t);

const STATE: Record<MarketState, string> = {
  OPEN: "Open",
  RECORDED: "Evidence open",
  RESOLVED: "Answered, open to appeal",
  APPEALED: "Under appeal",
  FINAL: "Final",
  VOID: "Void, refunded",
};
export const marketState = (s: string) => label(STATE, s);

const VERDICT: Record<Verdict, string> = { YES: "Yes", NO: "No", NO_RESOLUTION: "No answer" };
export const verdict = (v: string) => label(VERDICT, v);

const VERDICT_LONG: Record<Verdict, string> = {
  YES: "The record shows the criteria were met.",
  NO: "The record shows the criteria were not met.",
  NO_RESOLUTION: "The record does not settle the question, so every stake is refunded.",
};
export const verdictLong = (v: string) => label(VERDICT_LONG, v);

const KIND: Record<PublisherKind, string> = {
  AUTHORITY: "Port or canal authority",
  WEATHER_SERVICE: "Weather or disaster service",
  NEWS: "International news",
  TRADE_PRESS: "Trade press",
  OPERATOR: "Carrier or forwarder advisory",
};
export const publisherKind = (k: string) => label(KIND, k);

const HOW: Record<string, string> = {
  RESOLUTION: "Final on the validators' answer; nobody appealed.",
  APPEAL: "Final on the appeal's answer.",
  APPEAL_LAPSED: "The appeal could not be decided in time, so the first answer stands.",
  NO_RECORD: "The sources could not be recorded in time, so every stake is refunded.",
  NO_ANSWER: "No answer could be obtained in time, so every stake is refunded.",
};
export const settledHow = (s: string) => label(HOW, s);

export const sideWord = (s: string) => (s === "YES" ? "Yes" : s === "NO" ? "No" : s === "BOTH" ? "both sides" : "");

const WEI = 10n ** 18n;
export function gen(wei: string | bigint | number | null | undefined): string {
  let v: bigint;
  try {
    v = BigInt(wei ?? 0);
  } catch {
    return "0";
  }
  const whole = v / WEI;
  const frac = ((v % WEI) * 10_000n) / WEI;
  const f = frac === 0n ? "" : `.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;
  return `${whole.toLocaleString("en-GB")}${f}`;
}
export const genText = (wei: string | bigint | number) => `${gen(wei)} GEN`;

export function toWei(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  return BigInt(w ?? "0") * WEI + BigInt((f + "0".repeat(18)).slice(0, 18));
}

/** The market's implied chance of YES, in whole percent, or null with no stakes. */
export function yesChance(yesWei: string | bigint, noWei: string | bigint): number | null {
  const y = BigInt(yesWei || 0);
  const n = BigInt(noWei || 0);
  if (y + n === 0n) return null;
  return Number((y * 1000n) / (y + n)) / 10;
}
export function chanceText(c: number | null): string {
  return c === null ? "No stakes yet" : `${Math.round(c)}% yes`;
}

/** What a stake of `wei` on `side` would collect if that side wins, at today's pools. */
export function wouldCollect(side: "YES" | "NO", wei: bigint, yesWei: bigint, noWei: bigint): bigint {
  if (wei <= 0n) return 0n;
  const mine = side === "YES" ? yesWei + wei : noWei + wei;
  const other = side === "YES" ? noWei : yesWei;
  return wei + (wei * other) / mine;
}

/**
 * What one GEN staked on a side returns if that side wins, at these pools,
 * counting the stake itself (it joins its side's pool). Null when the side's
 * pool would still be empty, or when nobody is on the other side yet (a win
 * then only returns the stake).
 */
export function multiplier(side: "YES" | "NO", yesWei: bigint, noWei: bigint, stakeWei = 0n): number | null {
  const mine = (side === "YES" ? yesWei : noWei) + stakeWei;
  const other = side === "YES" ? noWei : yesWei;
  if (mine <= 0n) return null;
  return Number(((mine + other) * 10_000n) / mine) / 10_000;
}
export function multiplierText(m: number | null): string {
  return m === null ? "no stakes yet" : `×${m.toFixed(2)}`;
}

export function plural(n: number, word: string, many?: string): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? word : many ?? `${word}s`}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Aug 2026" for a date or a timestamp, always in UTC. */
export function day(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function moment(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return `${day(iso)}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}
export function span(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 2 * 86400 || (s >= 86400 && s % 86400 === 0)) return plural(Math.round(s / 86400), "day");
  if (s >= 2 * 3600 || (s >= 3600 && s % 3600 === 0)) return plural(Math.round(s / 3600), "hour");
  if (s >= 120) return plural(Math.round(s / 60), "minute");
  return plural(s, "second");
}
export function until(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "";
  const d = (t - nowMs) / 1000;
  return d >= 0 ? `in ${span(d)}` : `${span(-d)} ago`;
}

/** "Market 12": never the raw id. */
export const marketName = (mid: string) => `Market ${Number(mid.replace(/^mk-0*/, "")) || ""}`.trim();

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function refusal(text: string): string {
  const t = String(text ?? "").replace(/\[EXPECTED\]\s*/g, "").replace(/\[LLM_ERROR\]\s*/g, "")
    .replace(/^.*?UserError\(['"]?/, "").replace(/['"]?\)\s*$/, "").trim();
  if (!t) return "The contract refused it.";
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}
export function prose(text: string): string {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}
