"""Recording the named sources, and pages filed by stakers."""
import json

import pytest

from conftest import (ALICE, BOB, CAROL, FILED, FILED_2, FILED_TEXT, GEN, SRC_A, SRC_B, SRC_C, STRANGER,
                      T_RESOLVE, TEXT_A, TEXT_B, TEXT_C, after, as_, err, fetches, forge_leader, get,
                      network_accepts, prints, record_all, recorded, serve_sources, set_now, staked, web_page)


def test_every_named_source_is_read_and_kept(module, c):
    mid = recorded(c, module)
    m = get(c, mid)
    assert m["state"] == "RECORDED"
    texts = [p["text"] for p in m["pages"]]
    assert texts == [" ".join(t.split()) for t in (TEXT_A, TEXT_B, TEXT_C)]
    assert all(len(p["sha256"]) == 64 and p["stage"] == "SOURCE" for p in m["pages"])
    # every validator read every source itself
    assert sorted(fetches("validator")) == sorted([SRC_A, SRC_B, SRC_C])


def test_not_before_the_resolution_time(module, c):
    mid = staked(c, module)
    serve_sources()
    set_now("2026-10-11T23:59:59Z")
    with pytest.raises(err(module)) as e:
        c.record_sources(mid)
    assert "cannot be resolved yet" in str(e.value)


def test_one_source_per_round_in_order(module, c):
    mid = staked(c, module)
    serve_sources()
    set_now(T_RESOLVE)
    as_(module, STRANGER)
    first = json.loads(c.record_sources(mid))
    assert first == {"market_id": mid, "source": 1, "of": 3, "readable": True}
    assert get(c, mid)["state"] == "OPEN" and fetches("validator") == [SRC_A]
    json.loads(c.record_sources(mid))
    last = json.loads(c.record_sources(mid))
    assert last["source"] == 3 and "evidence_ends" in last and get(c, mid)["state"] == "RECORDED"
    with pytest.raises(err(module)):
        c.record_sources(mid)


def test_a_leader_cannot_add_words(module, c):
    mid = staked(c, module)
    serve_sources()
    set_now(T_RESOLVE)
    forge_leader(" ".join(TEXT_A.split()) + " The authority later said the closure lasted thirty hours.")
    with pytest.raises(err(module)):
        c.record_sources(mid)
    assert get(c, mid)["page_keys"] == []


def test_a_leader_cannot_cut_a_page_short(module, c):
    mid = staked(c, module)
    web_page(SRC_A, TEXT_A * 4)
    set_now(T_RESOLVE)
    forge_leader(" ".join((TEXT_A * 4).split())[:300])
    with pytest.raises(err(module)):
        c.record_sources(mid)


def test_a_leader_cannot_hide_a_readable_source(module, c):
    mid = staked(c, module)
    serve_sources()
    set_now(T_RESOLVE)
    forge_leader("")
    with pytest.raises(err(module)):
        c.record_sources(mid)
    assert any("reads" in p for p in prints())


def test_an_unreadable_source_is_kept_as_unreadable(module, c):
    mid = staked(c, module)
    web_page(SRC_A, TEXT_A)
    web_page(SRC_B, "", status=403)
    web_page(SRC_C, "Access denied")
    set_now(T_RESOLVE)
    out = record_all(c, module, mid)
    assert out["source"] == 3 and out["readable"] is False and "evidence_ends" in out
    pages = get(c, mid)["pages"]
    assert [bool(p["text"]) for p in pages] == [True, False, False] and pages[1]["sha256"] == ""


def test_nothing_readable_clears_the_attempt(module, c):
    mid = staked(c, module)
    for u in (SRC_A, SRC_B, SRC_C):
        web_page(u, "", status=500)
    set_now(T_RESOLVE)
    out = record_all(c, module, mid)
    assert out.get("cleared") is True
    m = get(c, mid)
    assert m["state"] == "OPEN" and m["page_keys"] == [] and m["pages"] == []
    serve_sources()
    record_all(c, module, mid)                       # tried again, and now read
    assert get(c, mid)["state"] == "RECORDED"


def test_recording_stops_at_the_long_stop(module, c):
    mid = staked(c, module)
    serve_sources()
    set_now(T_RESOLVE)
    after(get(c, mid)["record_long_stop"])
    with pytest.raises(err(module)) as e:
        c.record_sources(mid)
    assert "voided" in str(e.value)


def test_the_network_result_is_checked_at_the_boundary(module, c):
    mid = staked(c, module)
    set_now(T_RESOLVE)
    network_accepts(["x" * 300])
    with pytest.raises(err(module)):
        c.record_sources(mid)
    network_accepts(None)
    with pytest.raises(err(module)):
        c.record_sources(mid)
    network_accepts("short")                     # under the floor: kept as unreadable
    assert json.loads(c.record_sources(mid))["readable"] is False


def test_a_staker_files_a_page(module, c):
    mid = recorded(c, module)
    as_(module, ALICE)
    out = json.loads(c.file_page(mid, FILED, "The authority's own figure."))
    p = get(c, mid)["pages"][-1]
    assert out["page"].endswith("|4") and p["stage"] == "EVIDENCE" and p["by"] == ALICE
    assert p["side"] == "YES" and p["publisher"] == "Splash247" and p["text"] == " ".join(FILED_TEXT.split())


@pytest.mark.parametrize("who,url,words", [
    (STRANGER, FILED, "holding a stake"),
    (ALICE, "https://example.org/notice", "not in the registry"),
    (ALICE, SRC_A, "already in the record"),
])
def test_filing_refusals(module, c, who, url, words):
    mid = recorded(c, module)
    as_(module, who)
    with pytest.raises(err(module)) as e:
        c.file_page(mid, url, "")
    assert words in str(e.value)


def test_filing_closes_with_the_evidence_period(module, c):
    mid = recorded(c, module)
    after(get(c, mid)["evidence_ends"])
    as_(module, ALICE)
    with pytest.raises(err(module)) as e:
        c.file_page(mid, FILED, "")
    assert "evidence period" in str(e.value)


def test_filing_before_the_record_is_refused(module, c):
    mid = staked(c, module)
    as_(module, ALICE)
    with pytest.raises(err(module)):
        c.file_page(mid, FILED, "")


def test_each_staker_has_an_allowance(module, c):
    mid = recorded(c, module)
    urls = [f"https://splash247.com/report-{i}" for i in range(3)]
    for u in urls:
        web_page(u, FILED_TEXT)
    as_(module, ALICE)
    c.file_page(mid, urls[0], "")
    c.file_page(mid, urls[1], "")
    with pytest.raises(err(module)) as e:
        c.file_page(mid, urls[2], "")
    assert "at most 2" in str(e.value)
    as_(module, BOB)
    c.file_page(mid, urls[2], "")          # Bob's allowance is his own


def test_each_side_has_a_ceiling(module, c):
    from eth_utils import to_checksum_address
    yes_side = [to_checksum_address("0x%040x" % (0x1000 + i)) for i in range(3)]
    no_side = [to_checksum_address("0x%040x" % (0x2000 + i)) for i in range(1)]
    mid = recorded(c, module, yes=[(s, GEN) for s in yes_side], no=[(s, GEN) for s in no_side])
    n = 0
    for s in yes_side:
        for _ in range(2):
            u = f"https://splash247.com/r{n}"
            web_page(u, FILED_TEXT)
            as_(module, s)
            if n < 4:
                c.file_page(mid, u, "")
            else:
                with pytest.raises(err(module)) as e:
                    c.file_page(mid, u, "")
                assert "stakers on YES have already filed 4" in str(e.value)
            n += 1
    # The yes side's allowance is spent; the no side still has its own.
    web_page("https://splash247.com/no-side", FILED_TEXT)
    as_(module, no_side[0])
    c.file_page(mid, "https://splash247.com/no-side", "")
    assert get(c, mid)["filed"]["EVIDENCE|NO"] == 1


def test_a_two_sided_staker_counts_on_the_side_held_more(module, c):
    mid = recorded(c, module, yes=((CAROL, GEN),), no=((CAROL, 3 * GEN), (BOB, GEN)))
    as_(module, CAROL)
    c.file_page(mid, FILED, "")
    assert get(c, mid)["filed"]["EVIDENCE|NO"] == 1


def test_a_filed_page_is_read_by_every_validator(module, c):
    mid = recorded(c, module)
    web_page(FILED_2, FILED_TEXT, validator="Page not found " * 20)
    as_(module, BOB)
    with pytest.raises(err(module)):
        c.file_page(mid, FILED_2, "")
    forge_leader(" ".join(FILED_TEXT.split()) + " Ships waited thirty hours.")
    with pytest.raises(err(module)):
        c.file_page(mid, FILED, "")


def test_a_near_empty_page_is_refused(module, c):
    mid = recorded(c, module)
    web_page(FILED_2, "Subscribe to read.")
    as_(module, BOB)
    with pytest.raises(err(module)):
        c.file_page(mid, FILED_2, "")
    assert len(get(c, mid)["pages"]) == 3


def test_both_sides_label(module, c):
    mid = recorded(c, module, yes=((CAROL, GEN),), no=((CAROL, GEN), (BOB, GEN)))
    as_(module, CAROL)
    c.file_page(mid, FILED, "")
    assert get(c, mid)["pages"][-1]["side"] == "BOTH"
