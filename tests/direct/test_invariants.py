"""Random walks over every write, in any order, at any time, by anyone:
every wei that came in is either held, owed or paid, at every step; nothing
moves after a market ends; and once every position is collected only rounding
dust stays behind."""
import json
import os
import random
from datetime import timedelta

import pytest

from conftest import (ALICE, BOB, CAROL, FILED, GEN, STRANGER, _ANSWERS, _NOW, as_, get, market_json,
                      serve_sources, set_now, T_CREATE)

PEOPLE = (ALICE, BOB, CAROL, STRANGER)
SEEDS = int(os.environ.get("PORTCAST_WALK_SEEDS", "40"))


def _owed_and_paid(c) -> int:
    total = 0
    for row in c.ledger.values():
        r = json.loads(row)
        total += int(r["claimable"]) + int(r["claimed"])
    return total


@pytest.mark.parametrize("seed", range(SEEDS))
def test_value_is_conserved(module, c, seed):
    rnd = random.Random(seed)
    set_now(T_CREATE)
    serve_sources()
    sent = 0
    mids = []
    as_(module, ALICE)
    for _ in range(2):
        mids.append(json.loads(c.create_market(market_json(periods={"evidence": 600, "appeal": 7200})))["market_id"])
    for _ in range(160):
        mid = rnd.choice(mids)
        who = rnd.choice(PEOPLE)
        act = rnd.randrange(12)
        _ANSWERS["judge"]["leader"].clear()
        _ANSWERS["judge"]["validator"].clear()
        verdict = rnd.choice(["YES", "NO", "NO_RESOLUTION"])
        body = json.dumps({"verdict": verdict, "reason": "r", "pages": []})
        _ANSWERS["judge"]["leader"].append(body)
        _ANSWERS["judge"]["validator"].append(body)
        try:
            if act <= 2:
                wei = rnd.choice([10**15, 10**16, GEN // 10, GEN])
                as_(module, who, wei)
                sent += wei
                c.stake(mid, rnd.choice(["YES", "NO", "MAYBE"]))
            elif act == 3:
                as_(module, who)
                c.record_sources(mid)
            elif act == 4:
                as_(module, who)
                c.file_page(mid, FILED, "note")
            elif act == 5:
                as_(module, who)
                c.resolve(mid)
            elif act == 6:
                m = get(c, mid)
                wei = int(m["bond_wei"]) if rnd.random() < 0.8 else GEN
                as_(module, who, wei)
                sent += wei
                c.appeal(mid, "The recorded pages show the opposite of the answer.")
            elif act == 7:
                as_(module, who)
                rnd.choice([c.decide_appeal, c.lapse_appeal, c.finalize, c.void_market])(mid)
            elif act == 8:
                as_(module, who)
                c.collect(mid)
            elif act == 9:
                as_(module, who)
                c.claim()
            else:
                _NOW[0] = _NOW[0] + timedelta(seconds=rnd.choice([60, 300, 700, 1800, 3600, 86400, 20 * 86400]))
        except module.gl.vm.UserError:
            pass
        finally:
            as_(module, STRANGER)
        held = int(json.loads(c.get_stats())["held_wei"])
        assert held >= 0
        assert sent == held + _owed_and_paid(c), f"seed {seed}: value created or lost"

    # Run every market to its end and collect every position.
    _NOW[0] = _NOW[0] + timedelta(days=400)
    for mid in mids:
        for fn in (c.void_market, c.lapse_appeal, c.finalize):
            try:
                as_(module, STRANGER)
                fn(mid)
            except module.gl.vm.UserError:
                pass
        for who in PEOPLE:
            try:
                as_(module, who)
                c.collect(mid)
            except module.gl.vm.UserError:
                pass
    held = int(json.loads(c.get_stats())["held_wei"])
    assert 0 <= held < 10, f"seed {seed}: {held} wei left behind"
    assert sent == held + _owed_and_paid(c)
    REACHED.update(e["kind"] for mid in mids for e in get(c, mid)["events"])


REACHED: set = set()


def test_the_walks_reach_every_stage():
    """Run after the walks: they must have exercised the whole lifecycle."""
    if not REACHED:
        pytest.skip("run with the walks")
    assert {"RECORDED", "RESOLVED", "APPEALED", "PAGE_FILED", "FINAL", "VOID"} <= REACHED, REACHED
