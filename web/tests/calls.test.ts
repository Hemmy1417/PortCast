/**
 * Every call the interface composes, checked against the deployment's own
 * schema (lib/contract-schema.json, read by scripts/schema.mjs): arity, types,
 * which writes take value, and that every write is reachable from the app.
 */
import { describe, expect, it } from "vitest";

import { calls, PAYABLE } from "@/lib/calls";
import schema from "@/lib/contract-schema.json";

type W = { params: string[]; types: string[]; payable: boolean };
const writes = schema.writes as Record<string, W>;

const typeOk = (t: string, v: unknown) =>
  t === "string" ? typeof v === "string" : t === "bool" ? typeof v === "boolean" : t === "int" ? typeof v === "number" || typeof v === "bigint" : true;

const composed = [
  calls.createMarket("{}"), calls.stake("mk-0001", "YES", 1n), calls.recordSources("mk-0001"),
  calls.filePage("mk-0001", "https://gcaptain.com/x", "note"), calls.resolve("mk-0001"),
  calls.appeal("mk-0001", "words", 1n), calls.decideAppeal("mk-0001"), calls.lapseAppeal("mk-0001"),
  calls.finalize("mk-0001"), calls.voidMarket("mk-0001"), calls.collect("mk-0001"), calls.claim(),
];

describe("composed calls match the deployed schema", () => {
  for (const call of composed) {
    it(call.method, () => {
      const w = writes[call.method];
      expect(w, `${call.method} is not a write on the deployment`).toBeTruthy();
      expect(call.args.length).toBe(w!.params.length);
      call.args.forEach((a, i) => expect(typeOk(w!.types[i]!, a), `${call.method} arg ${i}`).toBe(true));
      expect(call.value !== undefined).toBe(w!.payable);
      expect(PAYABLE.has(call.method)).toBe(w!.payable);
    });
  }
  it("reaches every write", () => {
    expect([...new Set(composed.map((c) => c.method))].sort()).toEqual(Object.keys(writes).sort());
  });
});
