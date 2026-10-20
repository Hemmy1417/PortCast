"use client";

/**
 * The wallet's markets: each position, its exposure by side, what the
 * market's answer means for it, and what is waiting to be collected.
 */
import Link from "next/link";
import { useMemo } from "react";

import { Card, Loading, Problem, Tag } from "@/components/bits";
import { stateTone } from "@/components/MarketRow";
import { Write } from "@/components/Write";
import { calls } from "@/lib/calls";
import { eventType, gen, genText, marketName, marketState, verdict } from "@/lib/present";
import { getPosition, marketsOf } from "@/lib/read";
import type { MarketSummary, Position } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

function Row({ m, addr }: { m: MarketSummary; addr: string }) {
  const p = useChain(`position.${m.market_id}.${addr}`, (f) => getPosition(m.market_id, addr, f));
  const pos: Position | undefined = p.data;
  const yes = pos ? BigInt(pos.yes_wei) : 0n;
  const no = pos ? BigInt(pos.no_wei) : 0n;
  const owed = pos ? BigInt(pos.owed_wei) : 0n;
  return (
    <tr className="border-t border-rule align-top">
      <td className="py-3 pr-4">
        <Link href={`/markets/${m.market_id}`} className="font-bold no-underline hover:underline">{m.question}</Link>
        <p className="label mt-1">{marketName(m.market_id)} · {eventType(m.event_type)} · {m.place}</p>
      </td>
      <td className="py-3 pr-4"><Tag tone={stateTone(m.state)}>{marketState(m.state)}</Tag>{m.verdict ? <p className="mt-1 text-[14px]">Answer: {verdict(m.verdict)}</p> : null}</td>
      <td className="mono py-3 pr-4 text-yes">{yes ? gen(yes) : "·"}</td>
      <td className="mono py-3 pr-4 text-no">{no ? gen(no) : "·"}</td>
      <td className="py-3">
        {!pos ? <span className="muted text-[14px]">…</span>
          : pos.collected ? <span className="text-[14px]">Collected {genText(pos.paid_wei)}</span>
            : (m.state === "FINAL" || m.state === "VOID") ? (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-bold">{genText(owed)}</span>
                <Write call={calls.collect(m.market_id)} label="Collect" variant="secondary" />
              </div>
            ) : <span className="text-[14px] text-steel">After the answer</span>}
      </td>
    </tr>
  );
}

export default function Portfolio() {
  const wallet = useWallet();
  const addr = wallet.address || null;
  const mine = useChain(addr ? `marketsOf.${addr}` : null, (f) => marketsOf(addr!, f));
  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of mine.data?.items ?? []) counts.set(m.event_type, (counts.get(m.event_type) ?? 0) + 1);
    return [...counts.entries()];
  }, [mine.data]);

  if (!addr) return <Problem title="Connect a wallet to see your positions">Positions are read from the contract for the connected address; nothing is stored anywhere else.</Problem>;
  if (mine.loading) return <Loading what="your markets" />;
  if (mine.error) return <Problem title="Your markets could not be read">{String((mine.error as Error).message)}</Problem>;
  const items = mine.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h-lg">Portfolio</h1>
        <p className="mt-2 text-steel">Every market this wallet has staked on. Winnings and refunds move to the bar at the top when you collect them, and leave the contract when you draw.</p>
      </div>
      {byType.length ? (
        <div className="flex flex-wrap gap-2">{byType.map(([t, n]) => <Tag key={t}>{eventType(t)}: {n}</Tag>)}</div>
      ) : null}
      <Card className="overflow-x-auto">
        {!items.length ? <p className="text-steel">This wallet has not staked on any market yet. <Link href="/markets" className="text-sea underline">Browse markets</Link>.</p> : (
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="label"><th className="pb-2 font-normal">Market</th><th className="pb-2 font-normal">Stage</th><th className="pb-2 font-normal">On yes, GEN</th><th className="pb-2 font-normal">On no, GEN</th><th className="pb-2 font-normal">Collect</th></tr></thead>
            <tbody>{items.map((m) => <Row key={m.market_id} m={m} addr={addr} />)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
