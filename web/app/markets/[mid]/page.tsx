"use client";

/**
 * One market: the frozen criteria and sources, the lifecycle, the answer and
 * its reasons, the evidence explorer, and the action rail.
 */
import { useParams } from "next/navigation";

import { Card, Loading, Problem, Tag, TextLink } from "@/components/bits";
import { EvidenceExplorer } from "@/components/Evidence";
import { MarketActions } from "@/components/MarketActions";
import { stateTone } from "@/components/MarketRow";
import { stages } from "@/lib/acts";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import {
  chanceText, day, eventType, marketName, marketState, moment, prose, publisherKind, settledHow, span, until,
  verdict, verdictLong, yesChance,
} from "@/lib/present";
import { getConfig, getMarket, getPosition } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

const VERDICT_TONE = { YES: "yes", NO: "no", NO_RESOLUTION: "rule" } as const;

export default function MarketPage() {
  const { mid } = useParams<{ mid: string }>();
  const wallet = useWallet();
  const now = useNow();
  const market = useChain(`market.${mid}`, (f) => getMarket(mid, f));
  const cfg = useChain("config", () => getConfig());
  const position = useChain(wallet.address ? `position.${mid}.${wallet.address}` : null,
    (f) => getPosition(mid, wallet.address!, f));

  if (market.loading || cfg.loading) return <Loading what="the market" />;
  if (market.error) return <Problem title="The market could not be read">{String((market.error as Error).message)}</Problem>;
  const m = market.data;
  if (!m) return <Problem title={`${marketName(mid)} does not exist`}>Check the link, or browse the markets.</Problem>;
  if (!cfg.data) return <Problem title="The contract's settings could not be read" />;

  const chance = yesChance(m.yes_pool_wei, m.no_pool_wei);
  const steps = stages(m, now);
  const last = m.rounds[m.rounds.length - 1];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={stateTone(m.state)}>{marketState(m.state)}</Tag>
          <span className="label">{marketName(m.market_id)} · {eventType(m.event_type)} · {m.place}</span>
          {m.replay ? <Tag>Replay of a reported event</Tag> : null}
        </div>
        <h1 className="h-lg mt-3 max-w-[30ch]">{m.question}</h1>
        <p className="mono mt-3 text-steel">
          Window {day(m.window_start)} to {day(m.window_end)} · trading {now < new Date(m.trading_closes).getTime() ? "closes" : "closed"} {moment(m.trading_closes)} · resolvable from {moment(m.resolve_after)}
        </p>
        {m.replay ? (
          <p className="mt-3 max-w-[70ch] rounded-tab bg-signal/40 px-3 py-2 text-[14px]">
            This market&apos;s window had already ended when it opened. It exists to show the whole path on an event that has been reported; nothing in it is a forecast.
          </p>
        ) : null}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-8">
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="h-md">The criteria</h2>
              <span className="label">Frozen at creation</span>
            </div>
            <p className="label mt-4">Resolves yes only if</p>
            <p className="mt-1 text-[17px]">{prose(m.yes_when)}</p>
            {m.exclusions ? (<><p className="label mt-4">Does not count</p><p className="mt-1">{prose(m.exclusions)}</p></>) : null}
            <p className="label mt-5">Sources named before trading</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {m.sources.map((s, i) => (
                <li key={s.url} className="flex flex-wrap items-baseline gap-2 text-[15px]">
                  <span className="figure text-box">{i + 1}</span>
                  <TextLink href={s.url} external>{s.publisher}</TextLink>
                  <span className="label">{publisherKind(s.kind)}</span>
                </li>
              ))}
            </ul>
            <details className="mt-5 text-[14px]">
              <summary className="cursor-pointer text-sea">The lock on these terms</summary>
              <p className="mt-2 text-steel">The question, the criteria, the exclusions, the window and the source links were hashed when the market opened. Every round of the answer records this digest beside it.</p>
              <p className="mono mt-1 break-all">{m.criteria_digest}</p>
            </details>
          </Card>

          <Card>
            <h2 className="h-md">Where it stands</h2>
            <ol className="mt-4 grid gap-px overflow-hidden rounded-tab border border-rule bg-rule sm:grid-cols-5">
              {steps.map((s, i) => (
                <li key={s.key} className={`p-3 ${s.status === "now" ? "bg-hull text-deck" : s.status === "done" ? "bg-deck" : "bg-chart text-steel"}`}>
                  <p className={`figure text-[20px] leading-none ${s.status === "now" ? "text-signal" : s.status === "done" ? "text-box" : ""}`}>{String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-1 text-[14px] font-bold">{s.label}</p>
                  <p className="text-[12.5px] opacity-80">{s.status === "done" ? "Done" : s.status === "now" ? "Now" : s.status === "skipped" ? "Not needed" : "Ahead"}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-col gap-1 text-[14.5px]">
              {m.state === "OPEN" && now < new Date(m.trading_closes).getTime() ? <p>Implied chance today: <b>{chanceText(chance)}</b>, from {m.stakers} {m.stakers === 1 ? "staker" : "stakers"}.</p> : null}
              {m.state === "RECORDED" ? <p>Evidence closes {until(m.evidence_ends, now)} ({moment(m.evidence_ends)}).</p> : null}
              {m.state === "RESOLVED" ? <p>The appeal window closes {until(m.appeal_ends, now)}.</p> : null}
              {m.appeal ? <p>Appealed {moment(m.appeal.at)} against &ldquo;{verdict(m.appeal.from)}&rdquo;; pages for the appeal until {moment(m.appeal.evidence_ends)}. {m.appeal.result === "CHANGED" ? "The appeal changed the answer and its bond went back." : m.appeal.result === "HELD" ? "The answer held; the bond joined the pot." : m.appeal.result === "LAPSED" ? "Nobody decided it in time; the bond went back." : ""}</p> : null}
              {m.settled_how ? <p>{settledHow(m.settled_how)}</p> : null}
              {m.state === "OPEN" && m.page_keys.length ? <p>{m.page_keys.length} of {m.sources.length} sources recorded so far.</p> : null}
            </div>
          </Card>

          {last ? (
            <Card className="border-hull">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="h-md">The answer</h2>
                <Tag tone={VERDICT_TONE[last.verdict]}>{verdict(last.verdict)}</Tag>
                <span className="label">{last.kind === "APPEAL" ? "On appeal" : "First round"} · {moment(last.at)}</span>
              </div>
              <p className="mt-3 text-[17px] font-bold">{verdictLong(last.verdict)}</p>
              <p className="mt-2 max-w-[70ch]">{prose(last.reason)}</p>
              <p className="mt-3 text-[13.5px] text-steel">Validators agreed on the answer; the reasons are the leading validator&apos;s own words.</p>
              {m.rounds.length > 1 ? (
                <ul className="mt-4 border-t border-rule pt-3 text-[14px]">
                  {m.rounds.slice(0, -1).map((r) => <li key={r.n}>Earlier ({r.kind === "APPEAL" ? "appeal" : "first round"}, {moment(r.at)}): {verdict(r.verdict)}. {prose(r.reason)}</li>)}
                </ul>
              ) : null}
            </Card>
          ) : null}

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="h-lg">Evidence explorer</h2>
              <span className="label">{m.pages.length} {m.pages.length === 1 ? "page" : "pages"} in the record</span>
            </div>
            <p className="mt-2 max-w-[70ch] text-steel">Exactly what the validators judged: each page as they agreed it read, never fetched again.</p>
            <div className="mt-5"><EvidenceExplorer m={m} /></div>
          </section>

          <details className="text-[14px]">
            <summary className="cursor-pointer text-sea">Every event on this market</summary>
            <ul className="mono mt-3 flex flex-col gap-1">
              {m.events.map((e, i) => <li key={i}>{moment(e.at)} · {e.kind.toLowerCase().replace(/_/g, " ")}{e.detail ? ` · ${e.detail}` : ""}</li>)}
            </ul>
            <p className="mt-3"><TextLink href={addressUrl(CONTRACT_ADDRESS)} external>The contract on the explorer</TextLink> · periods: evidence {span(m.periods.evidence)}, appeal {span(m.periods.appeal)}</p>
          </details>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <MarketActions m={m} cfg={cfg.data} address={wallet.address || null} position={position.data ?? null} now={now} />
        </aside>
      </div>
    </div>
  );
}
