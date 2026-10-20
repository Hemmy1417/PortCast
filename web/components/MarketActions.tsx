"use client";

/**
 * The action rail of a market: the wallet's position and every act the
 * contract would take right now, each either open (with the exact call it
 * sends) or saying in words when it will be.
 */
import { useState } from "react";

import { Button, Card, PoolBar, Tag } from "./bits";
import { Write } from "./Write";
import { calls } from "@/lib/calls";
import { filingStage, marketActs, type Act } from "@/lib/acts";
import { gen, genText, multiplier, multiplierText, toWei, wouldCollect } from "@/lib/present";
import type { Config, Market, Position } from "@/lib/types";

function StakeForm({ m, minWei }: { m: Market; minWei: bigint }) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("0.1");
  const wei = toWei(amount);
  const ok = wei !== null && wei >= minWei;
  const back = ok ? wouldCollect(side, wei, BigInt(m.yes_pool_wei), BigInt(m.no_pool_wei)) : 0n;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Side">
        {(["YES", "NO"] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={side === s} onClick={() => setSide(s)}
            className={`rounded-tab border-2 py-2.5 font-bold ${side === s ? (s === "YES" ? "border-yes bg-yes-tint text-yes" : "border-no bg-no-tint text-no") : "border-rule bg-deck"}`}>
            {s === "YES" ? "Yes" : "No"}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="label">Stake, in GEN</span>
        <input className="field mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {ok ? (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-tab border border-rule bg-rule text-center">
          <div className="bg-deck px-2 py-2"><dt className="label">Multiplier</dt><dd className="figure text-[22px]">{multiplierText(multiplier(side, BigInt(m.yes_pool_wei), BigInt(m.no_pool_wei), wei!))}</dd></div>
          <div className="bg-deck px-2 py-2"><dt className="label">If it wins</dt><dd className="figure text-[22px]">{gen(back)}</dd></div>
          <div className="bg-deck px-2 py-2"><dt className="label">Profit</dt><dd className={`figure text-[22px] ${back > wei! ? "text-yes" : ""}`}>+{gen(back - wei!)}</dd></div>
        </dl>
      ) : null}
      <p className="text-[14px] text-steel">
        {ok ? <>In GEN, at today&apos;s pools with your stake added. The pools keep moving until trading closes, so the final multiplier is set by every stake, not just yours. If {side === "YES" ? "no" : "yes"} wins this stake is lost; if the market has no answer it is refunded.</>
          : `A stake is at least ${gen(minWei)} GEN.`}
      </p>
      <Write call={calls.stake(m.market_id, side, wei ?? 0n)} label={`Stake ${ok ? gen(wei!) : ""} GEN on ${side === "YES" ? "yes" : "no"}`} disabled={!ok} />
    </div>
  );
}

function FileForm({ m, cfg }: { m: Market; cfg: Config }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const host = (() => {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return cfg.publishers.find((p) => h === p.host || h.endsWith(`.${p.host}`)) ?? null;
    } catch {
      return null;
    }
  })();
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="label">Page from a registry publisher</span>
        <input className="field mono" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
      </label>
      <p className="text-[13.5px] text-steel">{url ? (host ? `${host.name}: in the registry.` : "That host is not in the registry; the contract will refuse it.") : "Every validator reads the page when you file it, and what they agree it says joins the record."}</p>
      <label className="flex flex-col gap-1">
        <span className="label">Why it matters (optional, a claim)</span>
        <input className="field" maxLength={cfg.limits.note} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Write call={calls.filePage(m.market_id, url, note)} label="File the page" disabled={!host} />
    </div>
  );
}

function AppealForm({ m }: { m: Market }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <textarea className="field" placeholder="Which recorded page shows the answer is wrong, and why." value={text} onChange={(e) => setText(e.target.value)} />
      <p className="text-[13.5px] text-steel">The bond is {genText(m.bond_wei)}. It comes back if the appeal changes the answer; otherwise it joins what the final answer pays out.</p>
      <Write call={calls.appeal(m.market_id, text, BigInt(m.bond_wei))} label={`Appeal with ${genText(m.bond_wei)}`} disabled={text.trim().length < 20} />
    </div>
  );
}

const CALL: Partial<Record<Act["key"], (mid: string) => ReturnType<typeof calls.resolve>>> = {
  record: calls.recordSources,
  resolve: calls.resolve,
  decide_appeal: calls.decideAppeal,
  lapse_appeal: calls.lapseAppeal,
  finalize: calls.finalize,
  void: calls.voidMarket,
  collect: calls.collect,
};

export function MarketActions({ m, cfg, address, position, now }: {
  m: Market; cfg: Config; address: string | null; position: Position | null; now: number;
}) {
  const acts = marketActs(m, now, { address, position }, { perStaker: cfg.filed_per_staker, perSide: cfg.filed_per_side });
  const yes = BigInt(m.yes_pool_wei);
  const no = BigInt(m.no_pool_wei);
  const [openForm, setOpenForm] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="label">Pools</p>
        <div className="mt-2 flex items-end justify-between">
          <div><p className="figure text-[30px] leading-none text-yes">{gen(yes)}</p><p className="label mt-1">GEN on yes</p></div>
          <div className="text-right"><p className="figure text-[30px] leading-none text-no">{gen(no)}</p><p className="label mt-1">GEN on no</p></div>
        </div>
        <PoolBar yes={yes} no={no} className="mt-3" />
        {m.state === "OPEN" && now < new Date(m.trading_closes).getTime() ? <div className="mt-3 flex justify-between font-mono text-[13px]">
          <span className="text-yes">Yes pays {multiplierText(multiplier("YES", yes, no))}</span>
          <span className="text-no">No pays {multiplierText(multiplier("NO", yes, no))}</span>
        </div> : null}
        {position && BigInt(position.yes_wei) + BigInt(position.no_wei) > 0n ? (
          <div className="mt-4 border-t border-rule pt-3 text-[14px]">
            <p className="label">Your position</p>
            <p className="mt-1">{BigInt(position.yes_wei) > 0n ? `${genText(position.yes_wei)} on yes` : ""}{BigInt(position.yes_wei) > 0n && BigInt(position.no_wei) > 0n ? " and " : ""}{BigInt(position.no_wei) > 0n ? `${genText(position.no_wei)} on no` : ""}</p>
            {position.collected ? <p className="mt-1 text-steel">Collected {genText(position.paid_wei)}.</p>
              : BigInt(position.owed_wei) > 0n ? <p className="mt-1 font-bold">Yours to collect: {genText(position.owed_wei)}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card>
        <p className="label">What can be done now</p>
        {!acts.length ? <p className="mt-2 text-[15px] text-steel">Nothing is waiting on anyone. {m.state === "FINAL" || m.state === "VOID" ? "Stakers collect from this page." : ""}</p> : null}
        <ul className="mt-3 flex flex-col gap-4">
          {acts.map((a) => (
            <li key={a.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${a.open ? "bg-signal" : "bg-rule"}`} aria-hidden />
                <span className="font-bold">{a.label}</span>
              </div>
              {a.why ? <p className="text-[14px] text-steel">{a.why}</p> : null}
              {a.open && a.key === "stake" ? <StakeForm m={m} minWei={BigInt(cfg.min_stake_wei)} /> : null}
              {a.open && a.key === "file" ? (openForm === "file" ? <FileForm m={m} cfg={cfg} /> : <Button variant="secondary" onClick={() => setOpenForm("file")}>Choose a page</Button>) : null}
              {a.open && a.key === "appeal" ? (openForm === "appeal" ? <AppealForm m={m} /> : <Button variant="secondary" onClick={() => setOpenForm("appeal")}>Write the appeal</Button>) : null}
              {a.open && CALL[a.key] ? <Write call={CALL[a.key]!(m.market_id)} label={a.label} /> : null}
            </li>
          ))}
        </ul>
        {filingStage(m, now) ? <p className="mt-4"><Tag tone="signal">Evidence open</Tag></p> : null}
      </Card>
    </div>
  );
}
