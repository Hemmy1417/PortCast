"use client";

/** One market as a row on the board: question, place, chance, pools, state. */
import Link from "next/link";

import { PoolBar, Tag } from "./bits";
import { chanceText, day, eventType, gen, marketState, verdict, yesChance } from "@/lib/present";
import type { MarketSummary } from "@/lib/types";

export function stateTone(s: string): "signal" | "hull" | "rule" | "sea" {
  return s === "OPEN" ? "signal" : s === "FINAL" ? "hull" : s === "VOID" ? "rule" : "sea";
}

export function MarketRow({ m, active, onHover }: { m: MarketSummary; active?: boolean; onHover?: (mid: string | null) => void }) {
  const yes = BigInt(m.yes_pool_wei);
  const no = BigInt(m.no_pool_wei);
  const chance = yesChance(yes, no);
  return (
    <Link href={`/markets/${m.market_id}`}
      onMouseEnter={() => onHover?.(m.market_id)} onMouseLeave={() => onHover?.(null)}
      className={`block border-l-4 bg-deck px-4 py-3.5 no-underline transition-colors ${active ? "border-box" : "border-transparent hover:border-rule"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={stateTone(m.state)}>{marketState(m.state)}</Tag>
        <span className="label">{eventType(m.event_type)} · {m.place}</span>
        {m.replay ? <Tag>Replay</Tag> : null}
      </div>
      <p className="mt-1.5 text-[16px] font-bold leading-snug">{m.question}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <PoolBar yes={yes} no={no} className="max-w-[180px]" />
        <span className="mono text-steel">
          {m.state === "FINAL" ? `Answer: ${verdict(m.verdict)}` : chanceText(chance)} · {gen(yes + no)} GEN staked
        </span>
      </div>
      <p className="mono mt-1 text-steel">Window {day(m.window_start)} to {day(m.window_end)}</p>
    </Link>
  );
}
