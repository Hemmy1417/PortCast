/**
 * What can be done to a market right now, and by whom, as the contract would
 * answer. Pure: the market, the clock and the wallet's position in, a list of
 * acts out. Each act either opens (with the call it would send) or says when
 * it will, in words; nothing is hidden and nothing is greyed out without a
 * reason. The contract remains the authority; this only spares a refusal.
 */
import type { Market, Position } from "./types";
import { until } from "./present";

export type ActKey =
  | "stake" | "record" | "file" | "resolve" | "appeal" | "decide_appeal"
  | "lapse_appeal" | "finalize" | "void" | "collect";

export interface Act { key: ActKey; label: string; open: boolean; why: string }

const t = (iso: string) => (iso ? new Date(iso).getTime() : NaN);
const past = (iso: string, now: number) => now > t(iso);

export function holds(p: Position | null): boolean {
  return !!p && BigInt(p.yes_wei) + BigInt(p.no_wei) > 0n;
}

/** Whether the standing answer leaves this position without a win. */
export function unpaidBy(m: Market, p: Position | null): boolean {
  if (!p) return false;
  const yes = BigInt(p.yes_wei);
  const no = BigInt(p.no_wei);
  if (m.verdict === "YES") return no > 0n;
  if (m.verdict === "NO") return yes > 0n;
  return yes + no > 0n;
}

/** Which stage a page filed now would join, or null when filing is shut. */
export function filingStage(m: Market, now: number): "EVIDENCE" | "APPEAL" | null {
  if (m.state === "RECORDED" && !past(m.evidence_ends, now)) return "EVIDENCE";
  if (m.state === "APPEALED" && m.appeal && !past(m.appeal.evidence_ends, now)) return "APPEAL";
  return null;
}

/** The side a staker's filings count against: the one they hold more on. */
export function quotaSide(p: Position | null): "YES" | "NO" {
  return p && BigInt(p.yes_wei) >= BigInt(p.no_wei) ? "YES" : "NO";
}

export function filedBy(m: Market, stage: string, addr: string): number {
  return m.filed[`${stage}|${addr}`] ?? 0;
}

export function marketActs(m: Market, now: number, me: { address: string | null; position: Position | null }, limits: { perStaker: number; perSide: number }): Act[] {
  const acts: Act[] = [];
  const add = (key: ActKey, label: string, open: boolean, why = "") => acts.push({ key, label, open, why });
  const mine = holds(me.position);

  switch (m.state) {
    case "OPEN": {
      const trading = now < t(m.trading_closes);
      if (trading) add("stake", "Stake on this market", !!me.address, me.address ? "" : "Connect a wallet to stake.");
      if (!trading) {
        if (now < t(m.resolve_after)) {
          add("record", "Record the sources", false, `Trading has closed. The sources can be recorded ${until(m.resolve_after, now)}.`);
        } else if (!past(m.record_long_stop, now)) {
          const next = m.page_keys.length + 1;
          add("record", `Record source ${next} of ${m.sources.length}`, !!me.address,
            me.address ? "Each source is read in its own round, by every validator." : "Connect a wallet to ask for the record.");
        } else {
          add("void", "Void and refund", !!me.address, me.address ? "Nobody recorded the sources in time." : "Connect a wallet to void it.");
        }
      }
      break;
    }
    case "RECORDED": {
      const stage = filingStage(m, now);
      if (stage) {
        const used = me.address ? filedBy(m, stage, me.address) : 0;
        const full = (m.filed[`${stage}|${quotaSide(me.position)}`] ?? 0) >= limits.perSide;
        add("file", "File a page", mine && used < limits.perStaker && !full,
          !me.address ? "Connect a wallet that holds a stake to file a page."
            : !mine ? "Only someone holding a stake may file a page."
              : used >= limits.perStaker ? `You have filed your ${limits.perStaker} pages for this stage.`
                : full ? "Stakers on your side have filed their full number of pages for this stage." : "");
        add("resolve", "Ask for the answer", false, `Stakers may file pages until the evidence period ends, ${until(m.evidence_ends, now)}.`);
      } else if (!past(m.decide_long_stop, now)) {
        add("resolve", "Ask for the answer", !!me.address, me.address ? "" : "Connect a wallet to ask for the answer.");
      } else {
        add("void", "Void and refund", !!me.address, "No answer was obtained in time.");
      }
      break;
    }
    case "RESOLVED": {
      if (!past(m.appeal_ends, now)) {
        const can = unpaidBy(m, me.position);
        add("appeal", "Appeal the answer", can,
          !me.address ? "Connect a wallet that holds a stake the answer did not pay."
            : can ? "" : "Only a staker the answer did not pay may appeal.");
        add("finalize", "Make it final", false, `Anyone may make it final once the appeal window closes, ${until(m.appeal_ends, now)}.`);
      } else {
        add("finalize", "Make it final", !!me.address, me.address ? "" : "Connect a wallet to make it final.");
      }
      break;
    }
    case "APPEALED": {
      const a = m.appeal;
      if (!a) break;
      const stage = filingStage(m, now);
      if (stage) {
        const used = me.address ? filedBy(m, stage, me.address) : 0;
        add("file", "File a page for the appeal", mine && used < limits.perStaker,
          mine ? (used >= limits.perStaker ? `You have filed your ${limits.perStaker} pages for the appeal.` : "")
            : "Only someone holding a stake may file a page.");
        add("decide_appeal", "Ask for the appeal's answer", false, `Pages may be filed until ${until(a.evidence_ends, now)}.`);
      } else if (!past(a.lapse_at, now)) {
        add("decide_appeal", "Ask for the appeal's answer", !!me.address, me.address ? "" : "Connect a wallet to ask.");
      } else {
        add("lapse_appeal", "Close the lapsed appeal", !!me.address, "The appeal was not decided in time; the first answer stands.");
      }
      break;
    }
    case "FINAL":
    case "VOID": {
      if (mine && me.position && !me.position.collected) {
        add("collect", "Collect your share", true);
      }
      break;
    }
  }
  return acts;
}

/** The lifecycle as steps, for the tracker: done, now, or ahead. */
export function stages(m: Market, now: number): { key: string; label: string; status: "done" | "now" | "ahead" | "skipped" }[] {
  const order = ["OPEN", "RECORDED", "RESOLVED", "APPEALED", "FINAL"];
  const at = m.state === "VOID" ? -1 : order.indexOf(m.state);
  const appealed = !!m.appeal;
  const rows = [
    { key: "OPEN", label: now < t(m.trading_closes) ? "Trading" : "Trading closed" },
    { key: "RECORDED", label: "Sources recorded, evidence open" },
    { key: "RESOLVED", label: "Validators answer" },
    { key: "APPEALED", label: "Appeal" },
    { key: "FINAL", label: m.state === "VOID" ? "Void, refunded" : "Final, collect" },
  ];
  return rows.map((r, i) => {
    if (m.state === "VOID") return { ...r, status: r.key === "FINAL" ? "now" : "skipped" };
    if (r.key === "APPEALED" && !appealed && at > i) return { ...r, status: "skipped" };
    return { ...r, status: i < at ? "done" : i === at ? "now" : "ahead" };
  });
}
