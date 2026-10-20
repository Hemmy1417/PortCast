"use client";

/**
 * Create-a-market studio: start from a template, place it on the map, write
 * the criteria, name the sources, and read the checks and the edge cases
 * before signing. What is signed is exactly the frozen terms shown.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { Card, Loading, Problem, Tag } from "@/components/bits";
import { PORTS } from "@/components/WorldMap";
import { Write } from "@/components/Write";
import { calls } from "@/lib/calls";
import { eventType, marketName, publisherKind } from "@/lib/present";
import { getConfig } from "@/lib/read";
import { edgeCases, lint, publisherOf, TEMPLATES, toJson, type Draft } from "@/lib/studio";
import type { EventType } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";

const TYPES: EventType[] = ["PORT", "CANAL", "WEATHER", "ROUTE", "CONGESTION", "FREIGHT"];

const isoIn = (days: number, hour = 12) => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
};
const dayIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="text-[13px] text-steel">{hint}</span> : null}
    </label>
  );
}

export default function Create() {
  const cfg = useChain("config", () => getConfig());
  const now = useNow();
  const [d, setD] = useState<Draft>({
    question: "", event_type: "PORT", place: "", lat: "", lon: "", yes_when: "", exclusions: "",
    window_start: dayIn(2), window_end: dayIn(16), trading_closes: isoIn(10), resolve_after: isoIn(19),
    sources: ["", ""], evidence: 86_400, appeal: 86_400,
  });
  const [created, setCreated] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const checks = useMemo(() => lint(d, cfg.data ?? null, now), [d, cfg.data, now]);
  const stops = checks.filter((c) => c.level === "stop");
  const placed = d.lat !== "" && d.lon !== "" && d.place.trim().length >= 2;

  if (cfg.loading) return <Loading what="the contract's settings" />;
  if (!cfg.data) return <Problem title="The contract's settings could not be read" />;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label">Create-a-market studio</p>
        <h1 className="h-lg mt-2">Write a market a resolver cannot misread</h1>
        <p className="mt-3 max-w-[70ch] text-steel">
          Everything on this page is frozen and hashed when you sign: the question, the criteria, the exclusions, the window and the sources.
          Nothing can be changed after anyone stakes, so the checks on the right run before you sign.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Card>
            <p className="h-sm">1. Start from a template, or write your own</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" className="rounded-tab border border-rule bg-deck px-3 py-1.5 text-[14px] hover:border-hull"
                  onClick={() => setD((x) => ({ ...x, ...t.make(x.place) }))}>{t.label}</button>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <p className="h-sm">2. Where</p>
            <div className="flex flex-wrap gap-2">
              {PORTS.map((p) => (
                <button key={p.name} type="button"
                  className={`rounded-tab border px-2.5 py-1 text-[13.5px] ${d.place === p.name ? "border-hull bg-hull text-deck" : "border-rule bg-deck hover:border-hull"}`}
                  onClick={() => setD((x) => ({ ...x, place: p.name, lat: p.lat.toFixed(2), lon: p.lon.toFixed(2) }))}>{p.name}</button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
              <Field label="Port, canal, route or area"><input className="field" maxLength={cfg.data.limits.place} value={d.place} onChange={(e) => set("place", e.target.value)} /></Field>
              <Field label="Latitude"><input className="field mono" value={d.lat} onChange={(e) => set("lat", e.target.value)} /></Field>
              <Field label="Longitude"><input className="field mono" value={d.lon} onChange={(e) => set("lon", e.target.value)} /></Field>
            </div>
            <Field label="Kind of event">
              <select className="field" value={d.event_type} onChange={(e) => set("event_type", e.target.value as EventType)}>
                {TYPES.map((t) => <option key={t} value={t}>{eventType(t)}</option>)}
              </select>
            </Field>
          </Card>

          <Card className="flex flex-col gap-4">
            <p className="h-sm">3. The question and its criteria</p>
            <Field label="Question" hint={`${d.question.length} of ${cfg.data.limits.question} characters`}>
              <input className="field" maxLength={cfg.data.limits.question} value={d.question} onChange={(e) => set("question", e.target.value)} />
            </Field>
            <Field label="Resolves yes only if" hint="Name the action, the threshold and who must report it.">
              <textarea className="field" maxLength={cfg.data.limits.criteria} value={d.yes_when} onChange={(e) => set("yes_when", e.target.value)} />
            </Field>
            <Field label="Does not count">
              <textarea className="field min-h-[72px]" maxLength={cfg.data.limits.exclusions} value={d.exclusions} onChange={(e) => set("exclusions", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Window, first day (UTC)"><input type="date" className="field" value={d.window_start} onChange={(e) => set("window_start", e.target.value)} /></Field>
              <Field label="Window, last day (UTC)"><input type="date" className="field" value={d.window_end} onChange={(e) => set("window_end", e.target.value)} /></Field>
              <Field label="Trading closes (UTC)"><input className="field mono" value={d.trading_closes} onChange={(e) => set("trading_closes", e.target.value)} /></Field>
              <Field label="May be resolved from (UTC)"><input className="field mono" value={d.resolve_after} onChange={(e) => set("resolve_after", e.target.value)} /></Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <p className="h-sm">4. Sources</p>
            <p className="text-[14px] text-steel">
              {cfg.data.min_sources} to {cfg.data.max_sources} public pages from the registry, from at least two publishers. Validators read exactly these pages after the market may be resolved; stakers can add more from the registry during the evidence period.
            </p>
            {d.sources.map((s, i) => {
              const p = s ? publisherOf(s, cfg.data!) : null;
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <input className="field mono" placeholder="https://" value={s}
                      onChange={(e) => set("sources", d.sources.map((x, j) => (j === i ? e.target.value.trim() : x)))} />
                    {d.sources.length > cfg.data!.min_sources ? (
                      <button type="button" className="px-2 text-steel" aria-label="Remove this source"
                        onClick={() => set("sources", d.sources.filter((_, j) => j !== i))}>×</button>
                    ) : null}
                  </div>
                  <span className={`text-[13px] ${s && !p ? "text-no" : "text-steel"}`}>{s ? (p ? `${p.name} · ${publisherKind(p.kind)}` : "Not from a registry publisher") : ""}</span>
                </div>
              );
            })}
            {d.sources.length < cfg.data.max_sources ? (
              <button type="button" className="self-start text-[14px] text-sea underline underline-offset-4" onClick={() => set("sources", [...d.sources, ""])}>Add a source</button>
            ) : null}
            <details className="text-[14px]">
              <summary className="cursor-pointer text-sea">The registry ({cfg.data.publishers.length} publishers)</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {cfg.data.publishers.map((p) => <li key={p.host}><span className="font-bold">{p.name}</span> <span className="mono text-steel">{p.host}</span></li>)}
              </ul>
            </details>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <p className="label">Checks before signing</p>
            {!checks.length ? <p className="mt-2 text-yes">Nothing a resolver could misread was found.</p> : null}
            <ul className="mt-3 flex flex-col gap-2">
              {checks.map((c, i) => (
                <li key={i} className="flex gap-2 text-[14px]">
                  <Tag tone={c.level === "stop" ? "no" : "signal"}>{c.level === "stop" ? "Fix" : "Check"}</Tag>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <p className="label">At the edges</p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14px]">
              {edgeCases(d).map((e) => <li key={e}>{e}</li>)}
            </ul>
          </Card>
          <Card>
            <p className="label">Sign the frozen terms</p>
            {created ? (
              <p className="mt-2">Opened. <Link className="text-sea underline" href={`/markets/${created}`}>Go to {marketName(created)}</Link></p>
            ) : (
              <>
                {!placed ? <p className="mt-2 text-[14px] text-steel">Choose a place first.</p> : null}
                <div className="mt-3">
                  <Write call={calls.createMarket(toJson(d))} label="Open this market" disabled={!!stops.length || !placed}
                    onDone={(r) => { if (r && typeof r.market_id === "string") setCreated(r.market_id); }} />
                </div>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
