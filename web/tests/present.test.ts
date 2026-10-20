import { describe, expect, it } from "vitest";

import { chanceText, day, gen, marketName, moment, toWei, wouldCollect, yesChance } from "@/lib/present";
import { edgeCases, lint, publisherOf, toJson, type Draft } from "@/lib/studio";
import type { Config } from "@/lib/types";

const G = 10n ** 18n;

describe("words", () => {
  it("prints GEN and percentages", () => {
    expect(gen((G * 3n) / 2n)).toBe("1.5");
    expect(toWei("0.25")).toBe(G / 4n);
    expect(toWei("1,5")).toBeNull();
    expect(yesChance(G, 3n * G)).toBe(25);
    expect(chanceText(yesChance("0", "0"))).toBe("No stakes yet");
  });
  it("dates are UTC", () => {
    expect(day("2026-10-04")).toBe("4 Oct 2026");
    expect(moment("2026-10-04T23:30:00Z")).toBe("4 Oct 2026, 23:30 UTC");
    expect(marketName("mk-0012")).toBe("Market 12");
  });
  it("previews what a stake would collect", () => {
    expect(wouldCollect("YES", G, G, G)).toBe(G + G / 2n);
    expect(wouldCollect("NO", G, 3n * G, 0n)).toBe(G + 3n * G);
    expect(wouldCollect("YES", 0n, G, G)).toBe(0n);
  });
});

const cfg = {
  min_sources: 2, max_sources: 4,
  publishers: [
    { host: "pancanal.com", name: "Panama Canal Authority", kind: "AUTHORITY" },
    { host: "reuters.com", name: "Reuters", kind: "NEWS" },
    { host: "gcaptain.com", name: "gCaptain", kind: "TRADE_PRESS" },
  ],
} as unknown as Config;

const NOW = Date.parse("2026-10-01T09:00:00Z");
const good: Draft = {
  question: "Will the canal cut its maximum draft below 48 feet in October 2026?", event_type: "CANAL",
  place: "Panama Canal", lat: "9.08", lon: "-79.68",
  yes_when: "The canal authority announces a maximum authorised draft below 48 feet taking effect between 1 and 31 October 2026.",
  exclusions: "Proposals do not count.", window_start: "2026-10-01", window_end: "2026-10-31",
  trading_closes: "2026-10-20T00:00:00Z", resolve_after: "2026-11-04T00:00:00Z",
  sources: ["https://pancanal.com/en/advisories/1", "https://www.reuters.com/world/canal"], evidence: 3600, appeal: 3600,
};

describe("the studio's checks", () => {
  it("passes a clear market", () => {
    expect(lint(good, cfg, NOW)).toEqual([]);
  });
  it("flags vague words", () => {
    expect(lint({ ...good, question: "Will there be a major disruption at the canal?" }, cfg, NOW)
      .some((l) => /major, disruption/.test(l.text))).toBe(true);
  });
  it("asks for continuous or cumulative time", () => {
    expect(lint({ ...good, yes_when: "Transits through the canal are stopped for 12 hours inside the window." }, cfg, NOW)
      .some((l) => /continuous/.test(l.text))).toBe(true);
  });
  it("stops structural problems the contract would refuse", () => {
    const stops = (d: Partial<Draft>) => lint({ ...good, ...d }, cfg, NOW).filter((l) => l.level === "stop").map((l) => l.text).join(" | ");
    expect(stops({ question: "Canal?" })).toMatch(/question mark/);
    expect(stops({ sources: ["https://pancanal.com/a"] })).toMatch(/2 to 4/);
    expect(stops({ sources: ["https://pancanal.com/a", "https://example.com/b"] })).toMatch(/registry/);
    expect(stops({ sources: ["https://reuters.com/a", "https://www.reuters.com/b"] })).toMatch(/two different publishers/);
    expect(stops({ trading_closes: "2026-09-30T00:00:00Z" })).toMatch(/future/);
    expect(stops({ resolve_after: "2026-10-19T00:00:00Z" })).toMatch(/before trading closes/);
    expect(stops({ resolve_after: "2026-10-30T00:00:00Z" })).toMatch(/after the window/);
    expect(stops({ window_end: "2026-09-01" })).toMatch(/end on or after/);
  });
  it("warns that a finished window makes a replay", () => {
    const l = lint({ ...good, window_start: "2026-09-01", window_end: "2026-09-05", resolve_after: "2026-10-21T00:00:00Z" }, cfg, NOW);
    expect(l.some((x) => /replay/.test(x.text))).toBe(true);
    expect(l.filter((x) => x.level === "stop")).toEqual([]);
  });
  it("matches publishers like the contract", () => {
    expect(publisherOf("https://www.reuters.com/x", cfg)?.name).toBe("Reuters");
    expect(publisherOf("https://reuters.com.evil.io/x", cfg)).toBeNull();
    expect(publisherOf("https://reuters.com:8443/x", cfg)).toBeNull();
    expect(publisherOf("http://reuters.com/x", cfg)).toBeNull();
  });
  it("writes the JSON the contract takes", () => {
    const j = JSON.parse(toJson({ ...good, sources: [...good.sources, " "] }));
    expect(j.sources).toHaveLength(2);
    expect(j.periods).toEqual({ evidence: 3600, appeal: 3600 });
    expect(edgeCases(good).length).toBeGreaterThan(2);
  });
});
