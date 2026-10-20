// Mutation sweep for the web rules (pnpm mutate): break one rule at a time in
// web/lib, run the tests that cover it, and require a failure. Every file is
// restored in a finally block and compared at the end.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const VITEST = join(WEB, "node_modules/vitest/vitest.mjs");

const M = [
  ["acts", "a boundary counts as passed when reached",
   "const past = (iso: string, now: number) => now > t(iso);",
   "const past = (iso: string, now: number) => now >= t(iso);"],
  ["acts", "trading stays open at the closing instant",
   "      const trading = now < t(m.trading_closes);",
   "      const trading = now <= t(m.trading_closes);"],
  ["acts", "sources recorded before the resolution time",
   "        if (now < t(m.resolve_after)) {",
   "        if (false) {"],
  ["acts", "recording never stops",
   "        } else if (!past(m.record_long_stop, now)) {",
   "        } else if (true) {"],
  ["acts", "evidence stays open",
   "  if (m.state === \"RECORDED\" && !past(m.evidence_ends, now)) return \"EVIDENCE\";",
   "  if (m.state === \"RECORDED\") return \"EVIDENCE\";"],
  ["acts", "anyone files a page",
   "        add(\"file\", \"File a page\", mine && used < limits.perStaker && !full,",
   "        add(\"file\", \"File a page\", true,"],
  ["acts", "an answer is never voided",
   "      } else if (!past(m.decide_long_stop, now)) {",
   "      } else if (true) {"],
  ["acts", "the appeal window never closes",
   "      if (!past(m.appeal_ends, now)) {",
   "      if (true) {"],
  ["acts", "a yes winner may appeal",
   "  if (m.verdict === \"YES\") return no > 0n;",
   "  if (m.verdict === \"YES\") return true;"],
  ["acts", "a no winner may appeal",
   "  if (m.verdict === \"NO\") return yes > 0n;",
   "  if (m.verdict === \"NO\") return true;"],
  ["acts", "an appeal never lapses",
   "      } else if (!past(a.lapse_at, now)) {",
   "      } else if (true) {"],
  ["acts", "a position collects twice",
   "      if (mine && me.position && !me.position.collected) {",
   "      if (mine && me.position) {"],
  ["present", "the stake preview ignores the other pool",
   "  return wei + (wei * other) / mine;",
   "  return wei;"],
  ["present", "the stake preview forgets the new stake",
   "  const mine = side === \"YES\" ? yesWei + wei : noWei + wei;",
   "  const mine = side === \"YES\" ? yesWei : noWei;"],
  ["present", "the chance is out by ten",
   "  return Number((y * 1000n) / (y + n)) / 10;",
   "  return Number((y * 1000n) / (y + n));"],
  ["present", "dates in local time",
   "  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;",
   "  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;"],
  ["studio", "trading may close in the past",
   "    if (closes <= now) stop(\"Trading must close in the future.\");",
   "    if (false) stop(\"Trading must close in the future.\");"],
  ["studio", "a market may resolve before trading closes",
   "    if (resolves < closes) stop(\"The market cannot be resolved before trading closes.\");",
   "    if (false) stop(\"The market cannot be resolved before trading closes.\");"],
  ["studio", "one publisher is enough",
   "    if (srcs.length && pubs.size < 2) stop(",
   "    if (false) stop("],
  ["studio", "plain http and ports pass",
   "    if (u.protocol !== \"https:\" || u.port) return null;",
   "    if (false) return null;"],
  ["studio", "a lookalike host passes",
   "    return cfg.publishers.find((p) => h === p.host || h.endsWith(`.${p.host}`)) ?? null;",
   "    return cfg.publishers.find((p) => h.includes(p.host)) ?? null;"],
];

const files = { acts: "lib/acts.ts", present: "lib/present.ts", studio: "lib/studio.ts" };
const tests = { acts: "tests/acts.test.ts", present: "tests/present.test.ts", studio: "tests/present.test.ts" };
const [MAJOR, MINOR] = process.versions.node.split(".").map(Number);
// A timezone away from UTC, so local time differs from UTC even on a UTC runner.
const BASE = { ...process.env, TZ: "Pacific/Auckland" };
const ENV = MAJOR < 22 || (MAJOR === 22 && MINOR < 12)
  ? { ...BASE, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --experimental-require-module`.trim() }
  : BASE;

function run(t) {
  const r = spawnSync(process.execPath, [VITEST, "run", ...t.split(" ")], { cwd: WEB, encoding: "utf8", env: ENV });
  const tail = `${r.stdout}${r.stderr}`.match(/Tests\s+[^\n]+/)?.[0] ?? "no summary";
  return { ok: r.status === 0, tail: tail.replace(/\s+/g, " ").trim() };
}

const snapshot = Object.fromEntries(Object.values(files).map((f) => [f, readFileSync(join(WEB, f), "utf8")]));
let killed = 0;
const survivors = [];
for (const [area, name, from, to] of M) {
  const path = join(WEB, files[area]);
  const original = readFileSync(path, "utf8");
  if (original.split(from).length - 1 !== 1) {
    console.log(`BAD      ${name}: pattern not found once`);
    survivors.push(name);
    continue;
  }
  try {
    writeFileSync(path, original.replace(from, to));
    const r = run(tests[area]);
    if (r.ok) { survivors.push(name); console.log(`SURVIVED ${name}  (${r.tail})`); }
    else { killed++; console.log(`killed   ${name}  (${r.tail})`); }
  } finally {
    writeFileSync(path, original);
  }
}
const control = run("tests");
console.log(`control, the code as written: ${control.ok ? "passes" : "FAILS"} (${control.tail})`);
const changed = Object.entries(snapshot).filter(([f, t]) => readFileSync(join(WEB, f), "utf8") !== t).map(([f]) => f);
console.log(`files after restore: ${changed.length ? `CHANGED ${changed.join(", ")}` : "as they were"}`);
console.log(`${killed}/${M.length} mutants killed${survivors.length ? `; survivors: ${survivors.join(", ")}` : ""}`);
if (survivors.length || !control.ok || changed.length) process.exit(1);
