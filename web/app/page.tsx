"use client";

/**
 * The board: every market on a chart of the world's shipping lanes, the
 * feed beside it, and how a market settles. Pins and rows are the same
 * markets; hovering one lights the other.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LinkButton, Loading, Problem } from "@/components/bits";
import { MarketRow } from "@/components/MarketRow";
import { WorldMap } from "@/components/WorldMap";
import { gen, plural } from "@/lib/present";
import { listMarkets, getStats } from "@/lib/read";
import { useChain } from "@/lib/useChain";

const STEPS = [
  { n: "01", t: "Criteria frozen", d: "A market states exactly what must happen for YES, inside which dates, and what does not count. It names two to four public sources from a fixed registry of publishers. All of it is hashed and locked before anyone stakes." },
  { n: "02", t: "Stakes on both sides", d: "People stake GEN on YES or NO until trading closes. The pools give the market's implied chance; each stake is recorded against its owner." },
  { n: "03", t: "The record", d: "After the deadline every validator reads each named source itself and they agree, word for word, on what it said. Stakers can add later reports from registry publishers while the evidence period is open." },
  { n: "04", t: "The answer", d: "Validators read the criteria against that record and must agree on YES, NO or no answer. One bonded appeal is allowed. Code then pays the winning side from the losing pool, or refunds everyone." },
];

export default function Board() {
  const markets = useChain("board", (f) => listMarkets(0, 50, f));
  const stats = useChain("stats", (f) => getStats(f));
  const [hover, setHover] = useState<string | null>(null);
  const router = useRouter();
  const items = markets.data?.items ?? [];
  const open = items.filter((m) => m.state === "OPEN").length;

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[760px]">
          <p className="label">Maritime and supply-chain prediction markets on GenLayer</p>
          <h1 className="h-display mt-3">Predict the disruption. The record settles it.</h1>
          <p className="mt-4 max-w-[62ch] text-[17px]">
            Ports, canals, shipping lanes and storms at sea. Every market freezes its criteria and its sources before
            trading, and GenLayer validators resolve it from what those sources actually reported, including when the
            reports disagree.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/create">Create a market</LinkButton>
            <LinkButton href="/markets" variant="secondary">Browse markets</LinkButton>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-card border border-rule bg-rule">
          {[
            ["Markets", stats.data ? stats.data.market : "…"],
            ["Open now", markets.data ? String(open) : "…"],
            ["GEN staked", stats.data ? gen(stats.data.staked_wei) : "…"],
          ].map(([k, v]) => (
            <div key={k} className="bg-deck px-5 py-4">
              <dt className="label">{k}</dt>
              <dd className="figure mt-1 text-[34px] leading-none">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid overflow-hidden rounded-card border border-hull lg:grid-cols-[1fr_400px]">
        <div className="chart-water relative p-3 md:p-5">
          <WorldMap markets={items} selected={hover} onSelect={(mid) => router.push(`/markets/${mid}`)} />
          <ul className="absolute bottom-3 left-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.05em] text-deck/80">
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-signal" /> Trading</li>
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-box" /> Being resolved</li>
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chart" /> Final</li>
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 border border-chart" /> Chokepoint</li>
          </ul>
        </div>
        <div className="flex max-h-[560px] flex-col border-t border-hull bg-chart lg:border-l lg:border-t-0">
          <p className="label border-b border-rule bg-deck px-4 py-3">
            {markets.data ? plural(markets.data.total, "market") : "Markets"}
          </p>
          <div className="flex flex-col gap-px overflow-y-auto">
            {markets.loading ? <div className="p-4"><Loading what="the markets" /></div> : null}
            {markets.error ? <div className="p-4"><Problem title="The board could not be read">{String((markets.error as Error).message)}</Problem></div> : null}
            {markets.data && !items.length ? <p className="muted p-4">No market has been opened yet.</p> : null}
            {items.map((m) => <MarketRow key={m.market_id} m={m} active={hover === m.market_id} onHover={setHover} />)}
          </div>
        </div>
      </section>

      <section>
        <h2 className="h-lg">How a market settles</h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-card border border-rule bg-rule md:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-deck p-5">
              <p className="figure text-[40px] leading-none text-box">{s.n}</p>
              <p className="h-sm mt-3">{s.t}</p>
              <p className="mt-2 text-[15px] text-steel">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
