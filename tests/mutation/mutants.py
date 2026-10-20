"""The rules the mutation sweep breaks, one at a time: (name, exact source text, replacement)."""

MUTATIONS = [
    # ── creating a market ───────────────────────────────────────────────────
    ("a question need not be a question",
     '    if len(question) < 15 or not question.endswith("?"):', '    if len(question) < 15:'),
    ("trading may close in the past", "    if closes <= now:", "    if False:"),
    ("a market may resolve before trading closes", "    if resolves < closes:", "    if False:"),
    ("a future window may resolve inside itself",
     "    if resolves.date() <= end and end >= now.date():", "    if False:"),
    ("a source may be named twice", "        if url in seen:", "        if False:"),
    ("one publisher is enough",
     '    if len({PUBLISHERS[s["host"]][0] for s in sources}) < 2:', '    if len(sources) < 2:'),
    ("a lookalike host passes the registry",
     '        if host == known or host.endswith("." + known):', '        if host.endswith(known):'),
    ("a finished window is not a replay", '            "replay": end < now.date(),', '            "replay": False,'),

    # ── staking ─────────────────────────────────────────────────────────────
    ("trading stays open at the closing instant",
     '            if m["state"] != "OPEN" or _now() >= _parse_iso(m["trading_closes"]):',
     '            if m["state"] != "OPEN" or _now() > _parse_iso(m["trading_closes"]):'),
    ("a dust stake is taken", "            if wei < MIN_STAKE_WEI:", "            if False:"),
    ("a refused stake strands its value",
     "            if wei:\n                self._credit(sender, wei)\n            return json.dumps({\"refused\": True,\n"
     "                               \"reason\": f\"{str(e).replace(ERROR_EXPECTED + ' ', '')}; \"\n"
     "                                         \"any value sent is claimable back\"})\n\n    # ── the record",
     "            return json.dumps({\"refused\": True,\n"
     "                               \"reason\": f\"{str(e).replace(ERROR_EXPECTED + ' ', '')}; \"\n"
     "                                         \"any value sent is claimable back\"})\n\n    # ── the record"),

    # ── the record ──────────────────────────────────────────────────────────
    ("sources are recorded before the resolution time",
     '        if now < _parse_iso(m["resolve_after"]):', "        if False:"),
    ("sources are recorded after the long stop",
     '        if now > _parse_iso(m["record_long_stop"]):', "        if False:"),
    ("a leader may hide a readable page",
     "        return len(mine) < PAGE_MIN_CHARS", "        return True"),
    ("a leader may add words",
     "            and mine.startswith(theirs) and len(theirs) >= len(mine) - PAGE_SLACK_CHARS)",
     "            and len(theirs) >= len(mine) - PAGE_SLACK_CHARS)"),
    ("a leader may cut a page short",
     "            and mine.startswith(theirs) and len(theirs) >= len(mine) - PAGE_SLACK_CHARS)",
     "            and mine.startswith(theirs))"),
    ("an empty record opens the evidence period", "            if read == 0:", "            if False:"),

    # ── filed pages ─────────────────────────────────────────────────────────
    ("pages are filed after the evidence period",
     '        if m["state"] == "RECORDED" and now <= _parse_iso(m["evidence_ends"]):',
     '        if m["state"] == "RECORDED":'),
    ("a stranger files pages",
     '        if self._held(m["market_id"], sender) <= 0:', "        if False:"),
    ("no allowance per staker", "        if mine >= FILED_PER_STAKER:", "        if False:"),
    ("no ceiling per side", "        if total >= FILED_PER_SIDE:", "        if False:"),
    ("a two-sided staker files on the smaller side",
     '        quota_side = "YES" if yes_held >= no_held else "NO"', '        quota_side = "YES" if yes_held else "NO"'),

    # ── the answer ──────────────────────────────────────────────────────────
    ("validators need not agree on the answer",
     '            if mine["verdict"] != res.calldata.get("verdict"):', "            if False:"),
    ("the answer comes before the evidence period ends",
     '        if _now() <= _parse_iso(m["evidence_ends"]):', "        if False:"),
    ("a page note may cite a page that is not in the record",
     '        known = {p["n"] for p in pages}', '        known = set(range(100))'),
    ("the criteria leave the prompt",
     "            f\"<<<CRITERIA The market resolves YES only if: {_defuse(m['yes_when'])} END CRITERIA>>>\\n\",",
     "            \"<<<CRITERIA END CRITERIA>>>\\n\","),

    # ── appeals ─────────────────────────────────────────────────────────────
    ("a winner on yes may appeal", '            return int(p["no_wei"]) > 0', "            return True"),
    ("a winner on no may appeal", '            return int(p["yes_wei"]) > 0', "            return True"),
    ("a second appeal is taken",
     '            if m["state"] != "RESOLVED":', '            if m["state"] not in ("RESOLVED", "APPEALED"):'),
    ("an appeal after its window", '            if _now() > _parse_iso(m["appeal_ends"]):', "            if False:"),
    ("any bond will do", "            if wei != bond:", "            if wei < 1:"),
    ("the bond floor is gone", "        return max(MIN_BOND_WEI, self._pool(m) * BOND_BPS // 10_000)",
     "        return self._pool(m) * BOND_BPS // 10_000"),
    ("an appeal decided inside its evidence period",
     '        if _now() <= _parse_iso(a["evidence_ends"]):', "        if False:"),
    ("a failed appeal keeps its bond",
     "        changed = rec[\"verdict\"] != a[\"from\"]", "        changed = True"),
    ("a winning appeal loses its bond",
     "        changed = rec[\"verdict\"] != a[\"from\"]", "        changed = False"),
    ("an appeal lapses at once", '        if _now() <= _parse_iso(a["lapse_at"]):', "        if False:"),

    # ── the end ─────────────────────────────────────────────────────────────
    ("final inside the appeal window", '        if _now() <= _parse_iso(m["appeal_ends"]):', "        if False:"),
    ("voided while sources can still be recorded",
     '        if m["state"] == "OPEN" and now <= _parse_iso(m["record_long_stop"]):', "        if False:"),
    ("voided while an answer can still be had",
     '        if m["state"] == "RECORDED" and now <= _parse_iso(m["decide_long_stop"]):', "        if False:"),

    # ── money out ───────────────────────────────────────────────────────────
    ("winners do not share the losing pool",
     "            return mine + mine * (yp + np_ - win_pool + pot) // win_pool", "            return mine"),
    ("the bond pot is not paid to winners",
     "            return mine + mine * (yp + np_ - win_pool + pot) // win_pool",
     "            return mine + mine * (yp + np_ - win_pool) // win_pool"),
    ("an empty winning side is not refunded",
     '        if verdict in ("YES", "NO") and win_pool > 0:', '        if verdict in ("YES", "NO"):'),
    ("a refund drops the bond pot",
     "        return yes + no + ((yes + no) * pot // total if total else 0)", "        return yes + no"),
    ("a position collects twice", '        if p["collected"]:', "        if False:"),
    ("collected is never recorded", '        p["collected"] = True', '        p["collected"] = False'),
    ("claim pays without zeroing", '        row["claimable"] = "0"\n', ""),
]
