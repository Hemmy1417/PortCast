import { createAccount, createClient } from "genlayer-js";
import { chain, loadKeys } from "./lib.mjs";
const c = createClient({ chain, account: createAccount(loadKeys().STRANGER.pk) });
const m = JSON.parse(await c.readContract({ address: process.argv[2], functionName: "get_market", args: [process.argv[3]] }));
console.log(m.state, m.evidence_ends, m.pages.map((p) => [p.publisher, p.chars, p.text.slice(0, 160)]));
