"use client";

/** How to check this deployment: the one page where machine values are the point. */
import { Card, Loading, TextLink } from "@/components/bits";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS, CONTRACT_CONFIGURED, IS_RECORD, REPO_URL, SOURCE_SHA256, SOURCE_URL } from "@/lib/config";
import { gen, publisherKind, span } from "@/lib/present";
import { getConfig } from "@/lib/read";
import { useChain } from "@/lib/useChain";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-rule py-3 md:grid-cols-[240px_1fr]">
      <dt className="label pt-0.5">{k}</dt>
      <dd className="text-[15px]">{v}</dd>
    </div>
  );
}

export default function Verify() {
  const cfg = useChain(CONTRACT_CONFIGURED ? "config" : null, () => getConfig());
  const c = cfg.data;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="h-lg">Check it yourself</h1>
        <p className="mt-2 max-w-[62ch] text-[17px]">This app reads one contract on GenLayer Studio Next. No server and no database: every figure comes from the contract.</p>
      </div>
      <Card>
        <dl>
          <Row k="Contract" v={<span className="mono break-all">{CONTRACT_ADDRESS}</span>} />
          <Row k="Deployment" v={IS_RECORD ? "The deployment of record" : "A test deployment set by this build"} />
          <Row k="On the explorer" v={<TextLink href={addressUrl(CONTRACT_ADDRESS)} external>Studio explorer</TextLink>} />
          <Row k="Source" v={<TextLink href={SOURCE_URL} external>contracts/portcast.py</TextLink>} />
          <Row k="Source sha256" v={<span className="mono break-all">{SOURCE_SHA256 || "Recorded once the deployment of record is made"}</span>} />
          <Row k="Repository" v={<TextLink href={REPO_URL} external>{REPO_URL.replace("https://", "")}</TextLink>} />
        </dl>
      </Card>
      <Card>
        <p className="h-md">The contract reports</p>
        {cfg.loading ? <div className="mt-3"><Loading what="the contract's rules" /></div> : c ? (
          <dl className="mt-3">
            <Row k="Rule set" v={<span className="mono">{c.ruleset}</span>} />
            <Row k="Smallest stake" v={`${gen(c.min_stake_wei)} GEN`} />
            <Row k="Appeal bond" v={`${c.bond_bps / 100}% of the market's pools, at least ${gen(c.min_bond_wei)} GEN`} />
            <Row k="Sources per market" v={`${c.min_sources} to ${c.max_sources}, from at least two publishers`} />
            <Row k="Pages kept per source" v={`The first ${c.page_excerpt_chars.toLocaleString("en-GB")} characters of its text; a page under ${c.page_min_chars} characters counts as unreadable`} />
            <Row k="Filed pages" v={`${c.filed_per_staker} per staker and ${c.filed_per_side} per side of a market, for each of the evidence period and an appeal`} />
            <Row k="Periods" v={`Between ${span(c.min_period_seconds)} and ${span(c.max_period_seconds)}`} />
            <Row k="Long stops" v={`Sources not recorded ${c.record_long_stop_days} days after the resolution time void the market; an answer or appeal not obtained in ${c.long_stop_periods} further periods voids it or lapses`} />
            <Row k="Publisher registry" v={
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {c.publishers.map((p) => <li key={p.host}><span className="font-bold">{p.name}</span> <span className="mono text-steel">{p.host}</span> <span className="text-[13px] text-steel">{publisherKind(p.kind)}</span></li>)}
              </ul>} />
          </dl>
        ) : <p className="mt-3">The contract did not answer. Reload in a moment.</p>}
      </Card>
      <Card>
        <p className="h-md">From a terminal</p>
        <p className="mt-2 max-w-[64ch] text-[15px]">The GenLayer command line prints the code a deployment holds; its sha256 should match the file in the repository.</p>
        <pre className="mono mt-4 overflow-x-auto rounded-tab bg-hull p-4 text-deck">{`genlayer code ${CONTRACT_ADDRESS} > deployed.py
sha256sum deployed.py contracts/portcast.py`}</pre>
      </Card>
    </div>
  );
}
