"""How a page becomes text: fetched over HTTP, its visible words extracted in
the contract's own code, the same way on every node."""
import json

import pytest

from conftest import (SRC_A, SRC_B, SRC_C, T_RESOLVE, TEXT_B, TEXT_C, as_, err, get, set_now, staked,
                      STRANGER, web_page)

HTML = """<!doctype html><html><head><title>Ignored title</title><style>p{color:red}</style>
<script>var token = "abc123"; document.write("Canal open");</script></head>
<body><nav>Home | Shipping | Ports</nav>
<article><h1>Canal reopens</h1><p>Transits were suspended for <b>twelve hours</b> on 4&nbsp;October 2026
after a grounding.</p><p>The authority said convoys resumed at 18:10 &amp; a backlog formed.</p>
<noscript>Enable scripts</noscript><svg><text>chart</text></svg>
<form><button>Subscribe</button></form></article>
<footer>Copyright notice</footer></body></html>""" + "<p>" + "More reporting on the canal. " * 10 + "</p>"


def test_visible_words_only(module):
    text = module._html_text(HTML)
    assert text.startswith("Canal reopens Transits were suspended for twelve hours on 4 October 2026")
    assert "convoys resumed at 18:10 & a backlog formed." in text
    for hidden in ("Ignored title", "abc123", "color:red", "Home | Shipping", "Enable scripts", "chart",
                   "Subscribe", "Copyright notice"):
        assert hidden not in text


def test_block_tags_separate_words(module):
    assert module._html_text("<div>one</div><div>two</div><br/>three") == "one two three"


def test_a_page_is_recorded_from_its_html(module, c):
    mid = staked(c, module)
    web_page(SRC_A, HTML)
    web_page(SRC_B, TEXT_B)
    web_page(SRC_C, TEXT_C)
    set_now(T_RESOLVE)
    as_(module, STRANGER)
    c.record_sources(mid)
    text = get(c, mid)["pages"][0]["text"]
    assert text.startswith("Canal reopens") and "abc123" not in text


def test_a_redirect_or_error_reads_as_empty(module, c):
    mid = staked(c, module)
    web_page(SRC_A, HTML, status=301)
    set_now(T_RESOLVE)
    as_(module, STRANGER)
    assert json.loads(c.record_sources(mid))["readable"] is False


def test_plain_text_is_kept_as_it_is(module):
    assert module._html_text("no markup at all here") == "no markup at all here"


def test_the_excerpt_is_capped(module, c):
    mid = staked(c, module)
    web_page(SRC_A, "<p>" + "x" * 20_000 + "</p>")
    set_now(T_RESOLVE)
    as_(module, STRANGER)
    c.record_sources(mid)
    assert get(c, mid)["pages"][0]["chars"] == module.PAGE_EXCERPT_CHARS


def test_a_validator_reading_different_html_disagrees(module, c):
    mid = staked(c, module)
    web_page(SRC_A, HTML, validator=HTML.replace("twelve hours", "nine hours"))
    set_now(T_RESOLVE)
    as_(module, STRANGER)
    with pytest.raises(err(module)):
        c.record_sources(mid)
