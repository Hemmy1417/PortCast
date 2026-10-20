"use client";

/**
 * The evidence explorer: every page in the market's record, as the
 * validators read it, with who chose it, when it was read, the digest this
 * browser recomputes from the recorded text, and what the deciding round said
 * each page supports. Pages that point opposite ways sit side by side.
 */
import { useEffect, useState } from "react";

import { Tag, TextLink } from "./bits";
import { sha256Hex } from "@/lib/hash";
import { moment, publisherKind, sideWord } from "@/lib/present";
import type { Market, Page, PageNote } from "@/lib/types";

function Digest({ page }: { page: Page }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (page.text) sha256Hex(page.text).then((h) => { if (alive) setOk(h === page.sha256); });
    return () => { alive = false; };
  }, [page.text, page.sha256]);
  if (!page.text) return null;
  return (
    <span className={`mono ${ok === false ? "text-no" : "text-steel"}`} title={page.sha256}>
      {ok === null ? "checking digest" : ok ? "text matches its recorded digest" : "text does not match its recorded digest"}
    </span>
  );
}

const SUPPORT_TONE = { YES: "yes", NO: "no", NEITHER: "rule" } as const;

function PageCard({ page, note }: { page: Page; note?: PageNote }) {
  const [open, setOpen] = useState(false);
  const who = page.stage === "SOURCE" ? "Named when the market was created"
    : `Filed by a staker on ${sideWord(page.side ?? "")}${page.stage === "APPEAL" ? " for the appeal" : ""}`;
  return (
    <article className="flex flex-col gap-2 rounded-card border border-rule bg-deck p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="figure text-[22px] leading-none text-box">{String(page.n).padStart(2, "0")}</span>
        <span className="font-bold">{page.publisher}</span>
        <span className="label">{publisherKind(page.kind)}</span>
        {note ? <Tag tone={SUPPORT_TONE[note.supports]}>{note.supports === "NEITHER" ? "Neither side" : `Supports ${note.supports.toLowerCase()}`}</Tag> : null}
      </div>
      <p className="text-[13.5px] text-steel">{who} · read {moment(page.at)}</p>
      {note?.says ? <p className="border-l-2 border-box pl-3 text-[15px]">{note.says}</p> : null}
      {page.note ? <p className="text-[14px]"><span className="muted">The filer says: </span>{page.note}</p> : null}
      {page.text ? (
        <>
          <blockquote className={`overflow-hidden whitespace-pre-wrap rounded-tab bg-chart p-3 text-[14px] ${open ? "" : "max-h-32"}`}>
            {open ? page.text : `${page.text.slice(0, 600)}${page.text.length > 600 ? "…" : ""}`}
          </blockquote>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="text-[14px] text-sea underline underline-offset-4" onClick={() => setOpen((v) => !v)}>
              {open ? "Show less" : `Read all ${page.chars.toLocaleString("en-GB")} characters the validators kept`}
            </button>
            <Digest page={page} />
          </div>
        </>
      ) : (
        <p className="rounded-tab bg-chart p-3 text-[14px] text-steel">No validator could read this page when the record was made, so it says nothing in the record.</p>
      )}
      <p className="text-[13.5px]"><TextLink href={page.url} external>Open the page as it is today</TextLink> <span className="muted">(it may have changed; the record above is what was judged)</span></p>
    </article>
  );
}

export function EvidenceExplorer({ m }: { m: Market }) {
  const last = m.rounds[m.rounds.length - 1];
  const notes = new Map((last?.pages ?? []).map((p) => [p.n, p]));
  const yes = m.pages.filter((p) => notes.get(p.n)?.supports === "YES");
  const no = m.pages.filter((p) => notes.get(p.n)?.supports === "NO");
  const rest = m.pages.filter((p) => !yes.includes(p) && !no.includes(p));
  if (!m.pages.length) {
    return <p className="muted">Nothing has been recorded yet. Once the market may be resolved, anyone can ask the validators to read the named sources.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {yes.length && no.length ? (
        <div>
          <p className="label mb-3">The record points both ways</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4"><p className="font-bold text-yes">Pages read as supporting yes</p>{yes.map((p) => <PageCard key={p.n} page={p} note={notes.get(p.n)} />)}</div>
            <div className="flex flex-col gap-4"><p className="font-bold text-no">Pages read as supporting no</p>{no.map((p) => <PageCard key={p.n} page={p} note={notes.get(p.n)} />)}</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{[...yes, ...no].map((p) => <PageCard key={p.n} page={p} note={notes.get(p.n)} />)}</div>
      )}
      {rest.length ? <div className="grid gap-4 md:grid-cols-2">{rest.map((p) => <PageCard key={p.n} page={p} note={notes.get(p.n)} />)}</div> : null}
      {last ? <p className="text-[13.5px] text-steel">Which way each page points is the leading validator&apos;s reading in the latest round. Validators agree only on the answer itself.</p> : null}
    </div>
  );
}
