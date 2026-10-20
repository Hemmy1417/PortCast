import { createAccount, createClient } from "genlayer-js";
import { chain, loadKeys } from "./lib.mjs";
const c = createClient({ chain, account: createAccount(loadKeys().STRANGER.pk) });
const m = JSON.parse(await c.readContract({ address: process.argv[2], functionName: "get_market", args: [process.argv[3]] }));
console.log(m.state, m.verdict, JSON.stringify(m.rounds.map(r=>({v:r.verdict,reason:r.reason,pages:r.pages}))));
for (const p of m.pages) console.log(p.publisher, p.chars, p.text.slice(0, 300));
