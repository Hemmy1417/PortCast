"""Opening a market and staking on it."""
import json

import pytest

from conftest import (ALICE, BOB, CREATOR, GEN, SRC_A, SRC_B, STRANGER, T_CLOSE, T_CREATE, as_, err,
                      get, held, market, market_json, set_now, stake, balance)


def create(c, module, **over):
    set_now(T_CREATE)
    as_(module, CREATOR)
    return c.create_market(market_json(**over))


def refused(c, module, words, **over):
    with pytest.raises(err(module)) as e:
        create(c, module, **over)
    assert words in str(e.value), str(e.value)


def test_a_market_freezes_its_criteria_and_sources(module, c):
    out = json.loads(create(c, module))
    m = get(c, out["market_id"])
    assert m["state"] == "OPEN" and m["creator"] == CREATOR
    assert [s["publisher"] for s in m["sources"]] == ["gCaptain", "Reuters", "Associated Press"]
    assert len(m["criteria_digest"]) == 64 and out["criteria_digest"] == m["criteria_digest"]
    assert m["replay"] is False


def test_the_digest_covers_the_criteria(module, c):
    a = json.loads(create(c, module))["criteria_digest"]
    b = json.loads(create(c, module, exclusions="Nothing is excluded."))["criteria_digest"]
    d = json.loads(create(c, module, sources=[SRC_B, SRC_A]))["criteria_digest"]
    assert len({a, b, d}) == 3


@pytest.mark.parametrize("over,words", [
    ({"question": "Canal shut?"}, "question mark"),
    ({"question": "Will the canal close for a long time in October"}, "question mark"),
    ({"event_type": "PIRACY"}, "event type"),
    ({"place": ""}, "name the port"),
    ({"lat": "91"}, "latitude"),
    ({"lon": "nan"}, "longitude"),
    ({"yes_when": "It closes."}, "criteria"),
    ({"window_start": "2026-10-09", "window_end": "2026-10-01"}, "window must end"),
    ({"window_end": "9 Oct"}, "YYYY-MM-DD"),
    ({"trading_closes": "2026-10-10"}, "UTC time"),
    ({"trading_closes": "2026-09-30T00:00:00Z"}, "close in the future"),
    ({"resolve_after": "2026-10-09T00:00:00Z"}, "before trading closes"),
    ({"resolve_after": "2028-01-01T00:00:00Z", "trading_closes": "2027-12-01T00:00:00Z"}, "within 400 days"),
    ({"trading_closes": "2026-10-05T00:00:00Z", "resolve_after": "2026-10-06T00:00:00Z"}, "after the window"),
    ({"sources": [SRC_A]}, "2 to 4 sources"),
    ({"sources": [SRC_A, SRC_A]}, "named once"),
    ({"sources": [SRC_A, "https://example.com/canal"]}, "not in the registry"),
    ({"sources": [SRC_A, "http://www.reuters.com/x"]}, "https"),
    ({"sources": [SRC_A, "https://www.reuters.com:8443/x"]}, "port"),
    ({"sources": [SRC_A, "https://user@reuters.com/x"]}, "https"),
    ({"sources": [SRC_A, "https://reuters.com.evil.io/x"]}, "not in the registry"),
    ({"sources": [SRC_A, "https://evilreuters.com/x"]}, "not in the registry"),
    ({"sources": [SRC_A, "https://gcaptain.com/another-story"]}, "two different publishers"),
    ({"sources": ["https://www.bbc.com/a", "https://www.bbc.co.uk/b"]}, "two different publishers"),
    ({"periods": {"evidence": 60, "appeal": 3600}}, "evidence period"),
    ({"periods": {"evidence": 3600}}, "appeal period"),
])
def test_creation_refusals(module, c, over, words):
    refused(c, module, words, **over)


def test_not_json(module, c):
    set_now(T_CREATE)
    as_(module, CREATOR)
    with pytest.raises(err(module)):
        c.create_market("{nope")
    with pytest.raises(err(module)):
        c.create_market("[1]")


def test_a_finished_window_is_a_replay(module, c):
    out = json.loads(create(c, module, window_start="2026-09-01", window_end="2026-09-05"))
    assert out["replay"] is True
    # A replay may resolve right after trading closes; its window is already over.
    out = json.loads(create(c, module, window_start="2026-09-01", window_end="2026-09-05",
                            trading_closes="2026-10-01T09:30:00Z", resolve_after="2026-10-01T09:40:00Z"))
    assert out["replay"] is True


def test_subdomains_belong_to_their_publisher(module, c):
    out = json.loads(create(c, module, sources=["https://mykn.kuehne-nagel.com/news/x", SRC_A]))
    assert get(c, out["market_id"])["sources"][0]["publisher"] == "Kuehne+Nagel"


def test_stakes_are_recorded_against_their_owner(module, c):
    mid = market(c, module)
    assert stake(c, module, mid, ALICE, "YES", GEN)["refused"] is False
    assert stake(c, module, mid, ALICE, "YES", GEN // 2)["refused"] is False
    assert stake(c, module, mid, ALICE, "NO", GEN // 10)["refused"] is False
    assert stake(c, module, mid, BOB, "NO", 2 * GEN)["refused"] is False
    m = get(c, mid)
    assert m["yes_pool_wei"] == str(GEN * 3 // 2) and m["no_pool_wei"] == str(GEN * 21 // 10)
    assert m["stakers"] == 2
    p = json.loads(c.get_position(mid, ALICE))
    assert p["yes_wei"] == str(GEN * 3 // 2) and p["no_wei"] == str(GEN // 10)
    assert held(c) == GEN * 36 // 10
    assert json.loads(c.markets_of(ALICE, 0, 10))["total"] == 1


@pytest.mark.parametrize("side,wei,when,words", [
    ("MAYBE", GEN, T_CREATE, "YES or on NO"),
    ("YES", 10**15, T_CREATE, "at least"),
    ("YES", GEN, T_CLOSE, "closed"),
])
def test_stake_refusals_return_the_value(module, c, side, wei, when, words):
    mid = market(c, module)
    set_now(when)
    out = stake(c, module, mid, ALICE, side, wei)
    assert out["refused"] is True and words in out["reason"]
    assert balance(c, ALICE) == wei and held(c) == 0
    assert get(c, mid)["yes_pool_wei"] == "0"


def test_staking_on_a_missing_market_returns_the_value(module, c):
    out = stake(c, module, "mk-9999", ALICE, "YES", GEN)
    assert out["refused"] is True and balance(c, ALICE) == GEN


def test_views_page_newest_first(module, c):
    for _ in range(3):
        market(c, module)
    page = json.loads(c.list_markets(0, 2))
    assert page["total"] == 3 and [i["market_id"] for i in page["items"]] == ["mk-0003", "mk-0002"]
    assert [i["market_id"] for i in json.loads(c.list_markets(2, 50))["items"]] == ["mk-0001"]
    with pytest.raises(err(module)):
        c.list_markets("x", 1)


def test_config_lists_the_registry(module, c):
    cfg = json.loads(c.get_config())
    hosts = {p["host"] for p in cfg["publishers"]}
    assert {"reuters.com", "pancanal.com", "kuehne-nagel.com"} <= hosts
    assert cfg["ruleset"] == "portcast-rules-1"
