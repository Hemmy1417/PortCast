/**
 * Live proofs on a PortCast deployment, on GenLayer Studio Next, against real
 * reporting from three regions. Every claim is an assertion; what the
 * validators were free to decide is logged as observed, never asserted.
 *
 *   node scripts/proofs.mjs 0x…            run every proof in order (resumable)
 *
 *   A  Asia, weather: Ningbo-Zhoushan and Typhoon Saudel, 72 continuous hours.
 *      The pages give a 78-hour figure without saying it was continuous.
 *      Staked both ways, sources recorded, a page filed, answered, appealed
 *      by the side it went against with a further page, decided again.
 *   B  Central America, canal: the Panama Canal's Neopanamax draft cut below
 *      48 feet in its 2026 drought. Answered, finalized, collected.
 *   C  Europe, port strike: Germany's 48-hour seaport strike from 2 September.
 *      One named source refuses plain fetches and is recorded as unreadable.
 *   plus refusals at every boundary, and both sides draw what they are owed.
 *
 * These are replay markets: their windows ended before they opened, so the
 * whole path can be run on events that have already been reported.
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, leaderOf, loadKeys, plainFees, resultText, sleep, transferFees, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node scripts/proofs.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/proofs-${ADDRESS}.json`, import.meta.url));
const KEYS = loadKeys();
const run = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { address: ADDRESS, steps: {}, ids: {}, passed: [], observed: [], at: {} };
const save = () => writeFileSync(OUT, JSON.stringify(run, null, 2));
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });
const PERIOD = 600;
const STAKE = GEN / 10n;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

function assert(cond, message) {
  if (!cond) {
    say(`ASSERTION FAILED: ${message}`);
    process.exit(2);
  }
  if (!run.passed.includes(message)) run.passed.push(message);
  save();
}
async function once(message, check) {
  if (run.passed.includes(message)) return say(`checked earlier: ${message}`);
  assert(await check(), message);
}
function observe(what) {
  if (!run.observed.includes(what)) run.observed.push(what);
  save();
  say(`observed: ${what}`);
}

async function read(fn, args) {
  for (let i = 0; i < 8; i++) {
    try {
      return await reader.readContract({ address: ADDRESS, functionName: fn, args });
    } catch (e) {
      if (i === 7) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}
const readJson = async (fn, args) => JSON.parse(await read(fn, args));
const market = (mid) => readJson("get_market", [mid]);
const position = (mid, role) => readJson("get_position", [mid, KEYS[role].addr]);
const owed = async (role) => BigInt((await readJson("get_balance", [KEYS[role].addr])).claimable);
const ROUNDS = new Set(["record_sources", "file_page", "resolve", "decide_appeal"]);
const AGREED = new Set(["MAJORITY_AGREE", "AGREE"]);

async function step(name, role, fn, args, { value = 0n, transfer = false, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier`);
    return run.steps[name];
  }
  run.pending ??= {};
  const attempts = ROUNDS.has(fn) ? 3 : 1;
  let hash, t, secs;
  for (let ask = 1; ; ask++) {
    hash = run.pending[name];
    if (!hash) {
      for (let attempt = 0; ; attempt++) {
        try {
          const client = clientFor(role);
          const fees = transfer
            ? await transferFees(client, { address: ADDRESS, functionName: fn, args, value })
            : await plainFees(client);
          hash = await client.writeContract({ address: ADDRESS, functionName: fn, args, value, fees });
          break;
        } catch (e) {
          if (attempt >= 4) throw e;
          say(`${name}: send failed (${String(e.message).slice(0, 80)}), retrying`);
          await sleep(8000 * (attempt + 1));
        }
      }
      run.pending[name] = hash;
      save();
      say(`${name}: ${role} ${fn} ${hash}`);
    } else {
      say(`${name}: waiting again on ${hash}`);
    }
    const t0 = Date.now();
    let failed = null;
    try {
      t = await waitFinal(hash, { label: name, tries: ROUNDS.has(fn) ? 450 : 150 });
      secs = Math.round((Date.now() - t0) / 1000);
      // A round the validators did not agree on changed nothing, whatever the leader said.
      if (!AGREED.has(t.result_name)) failed = `${t.result_name}`;
    } catch (e) {
      if (!/UNDETERMINED|CANCELED/.test(e.message)) throw e;
      failed = e.message;
    }
    if (!failed) break;
    delete run.pending[name];
    (run.no_consensus ??= []).push({ name, hash, result: failed, at: new Date().toISOString() });
    save();
    if (ask >= attempts) throw new Error(`${name}: no agreement after ${attempts} tries (${failed})`);
    say(`${name}: no agreement (${failed}), nothing recorded; asking again (${ask + 1} of ${attempts})`);
    await sleep(15000);
  }
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  say(`${name}: ${t.status} ${t.result_name} leader=${leader?.execution_result} in ${secs} s`);
  if (refused) {
    assert(!ok, `${name} should have been refused`);
    assert(text.includes(refused), `${name} refusal should say "${refused}", said "${text.slice(0, 200)}"`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 300)}`);
  }
  const i = text.indexOf("{");
  let returned = null;
  try { returned = i >= 0 ? JSON.parse(text.slice(i)) : null; } catch { returned = null; }
  const rec = { name, role, fn, hash, secs, ok, consensus: t.result_name, returned, text: text.slice(0, 600), explorer: `${EXPLORER}/tx/${hash}` };
  run.steps[name] = rec;
  save();
  return rec;
}

async function after(isoTime, label) {
  const at = Date.parse(isoTime) + 20_000;
  while (Date.now() < at) {
    say(`waiting for ${label}: ${Math.ceil((at - Date.now()) / 60000)} min left`);
    await sleep(Math.min(60_000, at - Date.now()));
  }
}

// ── the three markets ────────────────────────────────────────────────────────

const SPECS = {
  A: {
    question: "Did Ningbo-Zhoushan port stop all operations for at least 72 consecutive hours because of Typhoon Saudel?",
    event_type: "WEATHER", place: "Ningbo-Zhoushan", lat: "29.87", lon: "121.55",
    yes_when: "Ningbo-Zhoushan port suspended all terminal operations because of Typhoon Saudel for one continuous stretch of at least 72 hours that began between 25 August and 10 September 2026.",
    exclusions: "Cumulative closures made of separate shorter stoppages do not count. Suspensions of empty-container handling or of single terminals only do not count.",
    window_start: "2026-08-25", window_end: "2026-09-10",
    sources: [
      "https://mykn.kuehne-nagel.com/news/article/port-operational-updates-from-08-09-2026",
      "https://wwd.com/sourcing-journal/logistics/typhoon-saudel-china-ports-congestion-shanghai-ningbo-closed-1239173025/",
      "https://www.apllogistics.com/insights/typhoon-saudel-disrupting-ningbo-port-operations-amid-severe-north-asia-congestion",
    ],
  },
  B: {
    question: "Did the Panama Canal cut the maximum Neopanamax draft below 48 feet between 20 August and 15 September 2026?",
    event_type: "CANAL", place: "Panama Canal", lat: "9.08", lon: "-79.68",
    yes_when: "The Panama Canal Authority set a maximum authorised draft for the Neopanamax Locks below 48 feet, taking effect on a date between 20 August and 15 September 2026.",
    exclusions: "Forecasts, proposals and limits announced for dates outside the window do not count.",
    window_start: "2026-08-20", window_end: "2026-09-15",
    sources: [
      "https://www.dtnpf.com/agriculture/web/ag/columns/cash-market-moves/article/2026/09/02/panama-canal-authority-adopts-new",
      "https://www.telesurenglish.net/panama-canal-1st-transit-restriction/",
      "https://www.nautilusshipping.com/news-and-insights/panama-canal-draft-restrictions-2026-what-shipowners-need-to-know",
    ],
  },
  C: {
    question: "Did a strike halt container terminal operations at the port of Hamburg for at least 48 consecutive hours between 1 and 10 September 2026?",
    event_type: "PORT", place: "Hamburg", lat: "53.54", lon: "9.98",
    yes_when: "A strike halted container terminal operations at the port of Hamburg for one continuous period of at least 48 hours that began between 1 and 10 September 2026, as reported after it began.",
    exclusions: "Strikes that were only announced or called, warning strikes shorter than 48 hours, and strikes outside the window do not count.",
    window_start: "2026-09-01", window_end: "2026-09-10",
    sources: [
      "https://mykn.kuehne-nagel.com/news/article/german-seaport-strike-set-to-halt-container",
      "https://container-news.com/thousands-join-warning-strike-across-six-german-seaports/",
      "https://www.hapag-lloyd.com/pt/services-information/offices-localinfo/local-news/2026/08/germany--24-hour-warning-strike-at-german-seaports-may-affect-op.html",
    ],
  },
};

async function open(key) {
  if (!run.at[key]) {
    const now = Date.now();
    run.at[key] = { closes: iso(now + 12 * 60e3), resolves: iso(now + 13 * 60e3) };
    save();
  }
  const spec = { ...SPECS[key], trading_closes: run.at[key].closes, resolve_after: run.at[key].resolves,
                 periods: { evidence: PERIOD, appeal: PERIOD } };
  const rec = await step(`${key}.create`, "CREATOR", "create_market", [JSON.stringify(spec)]);
  run.ids[key] ??= rec.returned.market_id;
  save();
  const mid = run.ids[key];
  await once(`${key}: the market froze its criteria and named its sources from the registry`, async () => {
    const m = await market(mid);
    return m.state === "OPEN" && m.criteria_digest.length === 64 && m.sources.length === 3 && m.replay === true;
  });
  return mid;
}

async function stakeBoth(key, mid) {
  const y = await step(`${key}.stake-yes`, "YES_TRADER", "stake", [mid, "YES"], { value: STAKE });
  assert(y.returned?.refused === false, `${key}: a stake on yes is recorded against its owner`);
  const n = await step(`${key}.stake-no`, "NO_TRADER", "stake", [mid, "NO"], { value: STAKE * 2n });
  assert(n.returned?.refused === false, `${key}: a stake on no is recorded against its owner`);
}

async function record(key, mid) {
  const m0 = await market(mid);
  await after(m0.resolve_after, `${key}'s resolution time`);
  for (let i = 1; i <= 3; i++) {
    if (!run.steps[`${key}.record-${i}`] && (await market(mid)).page_keys.length >= i) {
      observe(`${key}: source ${i} was already recorded by an earlier call`);
      continue;
    }
    const r = await step(`${key}.record-${i}`, "STRANGER", "record_sources", [mid]);
    observe(`${key}: source ${i} ${r.returned?.readable ? "was read" : "was agreed to be unreadable"}`);
  }
  const m = await market(mid);
  await once(`${key}: every named source is in the record, each with the digest of its text`, async () =>
    m.state === "RECORDED" && m.pages.length === 3 && m.pages.every((p) => (p.text ? p.sha256.length === 64 : p.sha256 === "")));
  return m;
}

async function resolve(key, mid) {
  const m = await market(mid);
  await after(m.evidence_ends, `${key}'s evidence period`);
  const r = await step(`${key}.resolve`, "STRANGER", "resolve", [mid]);
  observe(`${key}: the validators answered ${r.returned.verdict}`);
  return r.returned.verdict;
}

async function collectAll(key, mid) {
  for (const role of ["YES_TRADER", "NO_TRADER"]) {
    const p = await position(mid, role);
    if (BigInt(p.yes_wei) + BigInt(p.no_wei) === 0n) continue;
    const want = BigInt(p.owed_wei);
    const c = await step(`${key}.collect-${role}`, role, "collect", [mid]);
    assert(BigInt(c.returned.collected_wei) === want || run.steps[`${key}.collect-${role}`].returned.collected_wei === c.returned.collected_wei,
      `${key}: ${role} collects exactly what the position view said it was owed`);
  }
  await step(`${key}.collect-twice`, "NO_TRADER", "collect", [mid], { refused: "already been collected" });
}

function share(m, side, mine) {
  const y = BigInt(m.yes_pool_wei), n = BigInt(m.no_pool_wei), pot = BigInt(m.bond_pot_wei);
  const win = m.verdict === "YES" ? y : m.verdict === "NO" ? n : 0n;
  if (m.verdict !== "NO_RESOLUTION" && win > 0n && side === m.verdict) return mine + (mine * (y + n - win + pot)) / win;
  if (m.verdict !== "NO_RESOLUTION" && win > 0n) return 0n;
  return mine + (mine * pot) / (y + n);
}

// ── A: the record does not say continuous; appealed ─────────────────────────

async function proveA() {
  const mid = await open("A");
  await stakeBoth("A", mid);
  await step("A.stake-bad-side", "YES_TRADER", "stake", [mid, "MAYBE"], { value: STAKE })
    .then((r) => assert(r.returned?.refused === true && /YES or on NO|closed/.test(r.returned.reason), "A: a malformed stake is refused by returning, and its value credited back"));
  await record("A", mid);
  await step("A.file-stranger", "STRANGER", "file_page", [mid, "https://www.gcaptain.com/", "x"], { refused: "holding a stake" });
  await step("A.file-unlisted", "NO_TRADER", "file_page", [mid, "https://example.com/report", "x"], { refused: "not in the registry" });
  await step("A.file", "NO_TRADER", "file_page",
    [mid, "https://mykn.kuehne-nagel.com/news/article/port-operational-updates-from-23-09-2026", "A later update from the same forwarder."]);
  await once("A: the filed page joined the record as the validators read it", async () => {
    const m = await market(mid);
    const p = m.pages[3];
    return m.pages.length === 4 && p.stage === "EVIDENCE" && p.side === "NO" && p.text.length >= 200;
  });
  await step("A.resolve-too-early", "STRANGER", "resolve", [mid], { refused: "evidence period has not ended" });
  const verdict = await resolve("A", mid);
  const m = await market(mid);
  assert(m.rounds.length === 1 && m.rounds[0].record.length === 4 && m.rounds[0].criteria_digest === m.criteria_digest,
    "A: the answer records every page it judged by digest, beside the criteria digest");
  const appellant = verdict === "YES" ? "NO_TRADER" : "YES_TRADER";
  const winner = verdict === "YES" ? "YES_TRADER" : verdict === "NO" ? "NO_TRADER" : null;
  if (winner) {
    const w = await step("A.appeal-by-winner", winner, "appeal", [mid, "The answer favoured me but I appeal anyway."], { value: BigInt(m.bond_wei) });
    assert(w.returned?.refused === true && /did not pay/.test(w.returned.reason), "A: a staker the answer paid cannot appeal");
  }
  const a = await step("A.appeal", appellant, "appeal",
    [mid, "The pages give a 78-hour total for the past seven days, not one continuous stoppage; the criteria exclude cumulative closures."],
    { value: BigInt(m.bond_wei) });
  assert(a.returned?.refused === false, "A: a staker the answer did not pay appeals with the bond");
  await step("A.file-appeal", appellant, "file_page",
    [mid, "https://wwd.com/sourcing-journal/logistics/typhoon-saudel-china-ports-congestion-shanghai-ningbo-closed-1239173025/?appeal=1",
     "The closing and reopening times, for the appeal."]);
  await once("A: a page filed during the appeal joins the record for the appeal only", async () =>
    (await market(mid)).pages.at(-1).stage === "APPEAL");
  const ma = await market(mid);
  await after(ma.appeal.evidence_ends, "A's appeal evidence period");
  const d = await step("A.decide-appeal", "STRANGER", "decide_appeal", [mid]);
  observe(`A: the appeal answered ${d.returned.verdict} (${d.returned.appeal})`);
  const mf = await market(mid);
  assert(mf.state === "FINAL" && mf.rounds.length === 2 && mf.settled_how === "APPEAL", "A: the appeal's answer is final");
  assert(mf.appeal.result === (d.returned.verdict === mf.appeal.from ? "HELD" : "CHANGED"), "A: the bond went where the rule says");
  for (const role of ["YES_TRADER", "NO_TRADER"]) {
    const p = await position(mid, role);
    const mine = role === "YES_TRADER" ? BigInt(p.yes_wei) : BigInt(p.no_wei);
    assert(BigInt(p.owed_wei) === share(mf, role === "YES_TRADER" ? "YES" : "NO", mine), `A: ${role} is owed exactly the parimutuel share of the final answer`);
  }
  await collectAll("A", mid);
}

// ── B: finalized without appeal ─────────────────────────────────────────────

async function proveB() {
  const mid = await open("B");
  await stakeBoth("B", mid);
  await record("B", mid);
  await resolve("B", mid);
  const m = await market(mid);
  await step("B.finalize-too-early", "STRANGER", "finalize", [mid], { refused: "appeal window is still open" });
  await after(m.appeal_ends, "B's appeal window");
  await step("B.appeal-late", m.verdict === "YES" ? "NO_TRADER" : "YES_TRADER", "appeal", [mid, "Too late, but trying anyway to appeal this."], { value: BigInt(m.bond_wei) })
    .then((r) => assert(r.returned?.refused === true && /standing answer|closed/.test(r.returned.reason), "B: an appeal after its window is refused and the bond credited back"));
  await step("B.finalize", "STRANGER", "finalize", [mid]);
  const mf = await market(mid);
  assert(mf.state === "FINAL" && mf.settled_how === "RESOLUTION", "B: an answer nobody appealed becomes final after its window");
  await collectAll("B", mid);
}

// ── C: one source refuses plain fetches ─────────────────────────────────────

async function proveC() {
  const mid = await open("C");
  await stakeBoth("C", mid);
  const mc = await market(mid);
  await after(mc.trading_closes, "C's trading close");
  await step("C.stake-late", "YES_TRADER", "stake", [mid, "YES"], { value: STAKE })
    .then((r) => assert(r.returned?.refused === true && /closed/.test(r.returned.reason), "C: a stake after trading closes is refused and its value credited back"));
  await record("C", mid);
  const m = await market(mid);
  observe(`C: ${m.pages.filter((p) => !p.text).length} of 3 sources were agreed to be unreadable`);
  await resolve("C", mid);
  const r = await market(mid);
  await after(r.appeal_ends, "C's appeal window");
  await step("C.finalize", "STRANGER", "finalize", [mid]);
  await collectAll("C", mid);
}

async function draw(role) {
  const key = `draw.${role}`;
  if (run.steps[key]) return say(`${key}: done earlier`);
  if ((await owed(role)) === 0n) return say(`${role} is owed nothing`);
  await step(key, role, "claim", [], { transfer: true });
  assert((await owed(role)) === 0n, `${role}'s ledger is empty after drawing`);
}

const cfg = await readJson("get_config", []);
assert(cfg.ruleset === "portcast-rules-1", "the deployment runs this rule set");
// The three markets run side by side: open all, then walk each through.
for (const k of ["A", "B", "C"]) await open(k);
for (const k of ["A", "B", "C"]) await stakeBoth(k, run.ids[k]);
await proveB();
await proveC();
await proveA();
await draw("YES_TRADER");
await draw("NO_TRADER");
await step("claim-nothing", "STRANGER", "claim", [], { refused: "nothing is owed" });
const writes = new Set(Object.values(run.steps).map((s) => s.fn));
say(`writes reached: ${[...writes].sort().join(", ")} (${writes.size})`);
run.checks = run.passed.length;
run.finished_at = new Date().toISOString();
save();
say(`EVERY CHECK PASSED (${run.checks} checks, ${Object.keys(run.steps).length} transactions, `
  + `${(run.no_consensus ?? []).length} rounds without agreement asked again)`);
