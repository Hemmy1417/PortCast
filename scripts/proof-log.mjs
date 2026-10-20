/**
 * Turn a finished live run into docs/proof-run.txt (every transaction) and
 * docs/live-proof.md (what each part proved).
 *
 *   node scripts/proof-log.mjs 0x…
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ADDRESS = process.argv[2];
const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const run = JSON.parse(readFileSync(at(`../.data/proofs-${ADDRESS}.json`), "utf-8"));
if (!run.finished_at) throw new Error("that run has not finished");
const steps = Object.values(run.steps);

const lines = [
  "PortCast live proof on GenLayer Studio Next (chain 61997)",
  `contract ${run.address}`,
  `finished ${run.finished_at}: ${run.passed.length} checks, ${steps.length} transactions, ${(run.no_consensus ?? []).length} rounds without agreement asked again`,
  "",
];
for (const s of steps) {
  lines.push(`${s.ok ? "ok      " : "refused "}${s.name.padEnd(24)} ${s.role.padEnd(10)} ${s.fn.padEnd(15)} ${String(s.consensus ?? "").padEnd(15)} ${s.hash}`);
  if (s.returned && s.returned.refused === true) lines.push(`         returned a refusal: ${String(s.returned.reason).slice(0, 140)}`);
  if (!s.ok) lines.push(`         ${s.text.replace(/\s+/g, " ").slice(0, 150)}`);
  if (s.fn === "record_sources" && s.returned) lines.push(`         source ${s.returned.source} of ${s.returned.of}: ${s.returned.readable ? "read" : "unreadable"}`);
  if ((s.fn === "resolve" || s.fn === "decide_appeal") && s.returned) {
    lines.push(`         answer ${s.returned.verdict}${s.returned.appeal ? `, appeal ${s.returned.appeal}` : ""}`);
  }
}
if (run.no_consensus?.length) lines.push("", "rounds without agreement (nothing recorded; asked again):", ...run.no_consensus.map((n) => `  ${n.name} ${n.hash} ${n.result ?? ""}`));
lines.push("", "checks passed:", ...run.passed.map((p) => `  ${p}`), "", "observed (not asserted):", ...run.observed.map((o) => `  ${o}`));
writeFileSync(at("../docs/proof-run.txt"), `${lines.join("\n")}\n`);

const link = (s) => `[${s.name}](${s.explorer})`;
const by = (prefix) => steps.filter((s) => s.name.startsWith(prefix)).map(link).join(", ");
const md = [
  "# Live proof",
  "",
  `Run by \`scripts/proofs.mjs\` on the deployment of record \`${run.address}\`, GenLayer Studio Next, finished ${run.finished_at}, against real reporting from three regions.`,
  `${run.passed.length} checks passed across ${steps.length} transactions; ${(run.no_consensus ?? []).length} rounds ended without validator agreement and were asked again (such a round records nothing). Every transaction is in [proof-run.txt](proof-run.txt).`,
  "",
  "The three markets are replays: their windows ended before they opened, so the whole path could run on events already reported. Every check below is an assertion in the script; what the validators were free to decide is listed as observed.",
  "",
  "| Market | What it proves | Transactions |",
  "|---|---|---|",
  `| A, Ningbo-Zhoushan and Typhoon Saudel (Asia) | Criteria frozen and hashed; stakes on both sides; a stake on no side refused and credited back; no record before the resolution time; three sources recorded one round each under consensus; a stranger and an unlisted host cannot file; a staker files a later page; no answer before the evidence period ends; the answer records every page by digest; a staker it paid cannot appeal; a staker it did not pay appeals with the bond and files a page for the appeal; the appeal's answer is final, the bond follows the rule, and each side is owed exactly its parimutuel share. | ${by("A.")} |`,
  `| B, Panama Canal draft (Central America) | Recorded and answered; not final inside the appeal window; an appeal after the window refused and credited back; final after it; collected. | ${by("B.")} |`,
  `| C, Hamburg seaport strike (Europe) | A stake after trading closes is refused and credited back; one named source refuses plain fetches and the validators agree it is unreadable; answered on what could be read; final; collected. | ${by("C.")} |`,
  "",
  "Both traders then drew what they were owed with `claim`, and a wallet owed nothing was refused.",
  "",
  "## Observed, not asserted",
  "",
  ...run.observed.map((o) => `- ${o}`),
  "",
];
writeFileSync(at("../docs/live-proof.md"), md.join("\n"));
console.log(`wrote docs/proof-run.txt and docs/live-proof.md (${steps.length} transactions)`);
