"use client";

/** Every market, filterable by kind of event, by stage and by place. */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { LinkButton, Loading, Problem } from "@/components/bits";
import { MarketRow } from "@/components/MarketRow";
import { WorldMap } from "@/components/WorldMap";
import { eventType, plural } from "@/lib/present";
import { listMarkets } from "@/lib/read";
import type { EventType } from "@/lib/types";
import { useChain } from "@/lib/useChain";

const TYPES: EventType[] = ["PORT", "CANAL", "WEATHER", "ROUTE", "CONGESTION", "FREIGHT"];
const STAGES = [
  { key: "live", label: "Trading", match: (s: string) => s === "OPEN" },
  { key: "resolving", label: "Being resolved", match: (s: string) => ["RECORDED", "RESOLVED", "APPEALED"].includes(s) },
  { key: "ended", label: "Final or void", match: (s: string) => s === "FINAL" || s === "VOID" },
];

export default function Markets() {
  const markets = useChain("markets", (f) => listMarkets(0, 50, f));
  const [type, setType] = useState<EventType | "">("");
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const router = useRouter();

  const items = useMemo(() => (markets.data?.items ?? []).filter((m) =>
    (!type || m.event_type === type)
    && (!stage || STAGES.find((s) => s.key === stage)?.match(m.state))
    && (!q || `${m.question} ${m.place}`.toLowerCase().includes(q.toLowerCase()))), [markets.data, type, stage, q]);

  const chip = (on: boolean) => `rounded-tab border px-3 py-1.5 text-[14px] ${on ? "border-hull bg-hull text-deck" : "border-rule bg-deck hover:border-hull"}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-lg">Markets</h1>
          <p className="mt-2 text-steel">{markets.data ? `${plural(markets.data.total, "market")} on this deployment, newest first.` : "Reading the markets."}</p>
        </div>
        <LinkButton href="/create">Create a market</LinkButton>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(!type)} onClick={() => setType("")}>Every kind</button>
          {TYPES.map((t) => <button key={t} type="button" className={chip(type === t)} onClick={() => setType(t)}>{eventType(t)}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(!stage)} onClick={() => setStage("")}>Every stage</button>
          {STAGES.map((s) => <button key={s.key} type="button" className={chip(stage === s.key)} onClick={() => setStage(s.key)}>{s.label}</button>)}
          <input className="field ml-auto max-w-[280px]" placeholder="Port, canal, region" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search markets" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="self-start overflow-hidden rounded-card bg-hull p-2 lg:sticky lg:top-24">
          <WorldMap markets={items} selected={hover} onSelect={(mid) => router.push(`/markets/${mid}`)} />
        </div>
        <div className="flex flex-col gap-px overflow-hidden rounded-card border border-rule bg-rule">
          {markets.loading ? <div className="bg-deck p-4"><Loading what="the markets" /></div> : null}
          {markets.error ? <Problem title="The markets could not be read">{String((markets.error as Error).message)}</Problem> : null}
          {markets.data && !items.length ? <p className="bg-deck p-4 text-steel">No market matches.</p> : null}
          {items.map((m) => <MarketRow key={m.market_id} m={m} active={hover === m.market_id} onHover={setHover} />)}
        </div>
      </div>
    </div>
  );
}
