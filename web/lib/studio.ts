/**
 * The create-a-market studio's rules, pure. A plain-language question becomes
 * explicit criteria through templates; a lint flags wording a resolver could
 * read two ways before anything is signed. The contract enforces structure
 * (registry sources, dates, lengths); this catches what structure cannot.
 */
import type { Config, EventType } from "./types";

export interface Draft {
  question: string;
  event_type: EventType;
  place: string;
  lat: string;
  lon: string;
  yes_when: string;
  exclusions: string;
  window_start: string;
  window_end: string;
  trading_closes: string;
  resolve_after: string;
  sources: string[];
  evidence: number;
  appeal: number;
}

export interface Template { key: string; label: string; make: (place: string) => Partial<Draft> }

export const TEMPLATES: Template[] = [
  {
    key: "strike", label: "Port strike",
    make: (p) => ({
      event_type: "PORT",
      question: `Will a strike stop cargo operations at ${p || "the port"} for at least 24 hours?`,
      yes_when: `A strike or walkout by port workers halts cargo handling at ${p || "the port"} for a continuous period of at least 24 hours that begins inside the window, as reported by the port authority or by at least two named sources.`,
      exclusions: "Go-slows, partial stoppages at single terminals, and announced strikes that were called off do not count.",
    }),
  },
  {
    key: "canal", label: "Canal restriction",
    make: (p) => ({
      event_type: "CANAL",
      question: `Will ${p || "the canal"} cut its maximum authorised draft below a stated limit?`,
      yes_when: `The canal authority announces a maximum authorised draft below the stated limit for ${p || "the canal"}, taking effect on a date inside the window.`,
      exclusions: "Proposals, forecasts and restrictions announced but not yet in effect inside the window do not count.",
    }),
  },
  {
    key: "storm", label: "Storm closure",
    make: (p) => ({
      event_type: "WEATHER",
      question: `Will a storm close ${p || "the port"} to all operations for at least 48 consecutive hours?`,
      yes_when: `${p || "The port"} suspends all terminal operations because of a named storm for one continuous period of at least 48 hours that begins inside the window.`,
      exclusions: "Cumulative closures made of separate shorter stoppages do not count. Suspensions of a single terminal or of empty-container handling only do not count.",
    }),
  },
  {
    key: "transit", label: "Transit suspension",
    make: (p) => ({
      event_type: "ROUTE",
      question: `Will transits through ${p || "the strait"} be suspended for at least 12 consecutive hours?`,
      yes_when: `All commercial transits through ${p || "the strait"} are suspended for a continuous period of at least 12 hours that begins inside the window, as reported by a maritime authority or by at least two named sources.`,
      exclusions: "Advisories to avoid the area, convoy rules and one-way traffic do not count as a suspension.",
    }),
  },
];

const VAGUE = [
  "significant", "major", "severe", "serious", "substantial", "widespread", "disruption", "disrupted",
  "soon", "about", "around", "roughly", "approximately", "nearly", "likely", "many", "several", "some",
  "considerable", "massive", "heavy",
];

export interface Lint { level: "stop" | "warn"; text: string }

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

export function lint(d: Draft, cfg: Config | null, now: number): Lint[] {
  const out: Lint[] = [];
  const stop = (text: string) => out.push({ level: "stop", text });
  const warn = (text: string) => out.push({ level: "warn", text });
  const q = d.question.trim();
  if (q.length < 15 || !q.endsWith("?")) stop("Write the question as one sentence ending in a question mark.");
  if (d.yes_when.trim().length < 30) stop("Say exactly what must happen for the market to resolve yes.");
  const vague = [...new Set([...words(q), ...words(d.yes_when)].filter((w) => VAGUE.includes(w)))];
  if (vague.length) warn(`These words can be read two ways by a resolver: ${vague.join(", ")}. Replace them with a number, a duration or a named action.`);
  if (!/\d/.test(d.yes_when) && !/\b(any|all|every)\b/i.test(d.yes_when)) warn("The criteria carry no number. A duration, a count or a limit makes the answer checkable.");
  if (!/consecutive|continuous|single/i.test(d.yes_when) && /hour|day/i.test(d.yes_when)) warn("Say whether the time must be continuous or may add up from separate stoppages; reports often differ on exactly this.");
  if (!d.exclusions.trim()) warn("Nothing is excluded. Name what looks like the event but should not count (partial closures, announced but cancelled actions).");
  if (!d.window_start || !d.window_end) stop("Give the window's first and last day.");
  else if (d.window_end < d.window_start) stop("The window must end on or after its first day.");
  const closes = Date.parse(d.trading_closes);
  const resolves = Date.parse(d.resolve_after);
  if (Number.isNaN(closes) || Number.isNaN(resolves)) stop("Set when trading closes and when the market may be resolved.");
  else {
    if (closes <= now) stop("Trading must close in the future.");
    if (resolves < closes) stop("The market cannot be resolved before trading closes.");
    const endMs = Date.parse(`${d.window_end}T23:59:59Z`);
    if (!Number.isNaN(endMs) && endMs >= now && resolves <= endMs) stop("A market whose window is still ahead must resolve after the window's last day.");
    if (!Number.isNaN(endMs) && endMs < now) warn("The window has already ended. The market will be marked as a replay of a reported event.");
    if (!Number.isNaN(endMs) && resolves - endMs < 2 * 86_400_000 && endMs >= now) warn("Leave reporting time after the window: news and notices can lag a day or two.");
  }
  const srcs = d.sources.map((s) => s.trim()).filter(Boolean);
  if (cfg) {
    if (srcs.length < cfg.min_sources || srcs.length > cfg.max_sources) stop(`Name ${cfg.min_sources} to ${cfg.max_sources} sources.`);
    const pubs = new Set<string>();
    for (const s of srcs) {
      const p = publisherOf(s, cfg);
      if (!p) stop(`${s.slice(0, 60)} is not from a registry publisher.`);
      else pubs.add(p.name);
    }
    if (srcs.length && pubs.size < 2) stop("The sources must come from at least two different publishers.");
    if (srcs.length && !srcs.some((s) => ["AUTHORITY", "WEATHER_SERVICE"].includes(publisherOf(s, cfg)?.kind ?? ""))) {
      warn("No source is an authority or weather service. Press reports often disagree on figures; an official notice gives the resolver something to prefer.");
    }
  }
  return out;
}

export function publisherOf(url: string, cfg: Config) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.port) return null;
    const h = u.hostname.toLowerCase();
    return cfg.publishers.find((p) => h === p.host || h.endsWith(`.${p.host}`)) ?? null;
  } catch {
    return null;
  }
}

/** The JSON create_market takes. */
export function toJson(d: Draft): string {
  return JSON.stringify({
    question: d.question.trim(), event_type: d.event_type, place: d.place.trim(), lat: d.lat, lon: d.lon,
    yes_when: d.yes_when.trim(), exclusions: d.exclusions.trim(), window_start: d.window_start,
    window_end: d.window_end, trading_closes: d.trading_closes, resolve_after: d.resolve_after,
    sources: d.sources.map((s) => s.trim()).filter(Boolean), periods: { evidence: d.evidence, appeal: d.appeal },
  });
}

/** What a resolver would face at the edges, in words, from the draft itself. */
export function edgeCases(d: Draft): string[] {
  const out = [
    "If none of the named sources mentions the event, the answer is likely no answer, and every stake is refunded.",
    "If the sources give different figures and none is official, the resolver may find no basis to prefer one, which also refunds.",
  ];
  if (/hour|day/i.test(d.yes_when)) out.push("If a report gives a cumulative total but not one continuous stretch, the wording of the criteria decides whether it counts.");
  if (d.exclusions.trim()) out.push(`Anything matching the exclusions cannot make the answer yes: ${d.exclusions.trim()}`);
  out.push("A page published before the window cannot show what happened in it.");
  return out;
}
