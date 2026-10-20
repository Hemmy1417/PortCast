"""Direct-mode harness for PortCast: the real contract module against a
stub `genlayer` that is as strict as the runtime where it matters.

  VALIDATORS RUN. `gl.vm.run_nondet` runs the leader, then the validator
  closure on the leader's result; a validator returning False fails the round
  with nothing written, like the network.

  THE MODEL. `exec_prompt` answers from per-role queues, so a test can make
  the leader and a validator read the same record differently.

  THE WEB. `web_page(url, text)` serves a page to every node, or another text
  to the validators, so a test can make a leader misreport what it read.

  THE CLOCK. `set_now(iso)` sets the transaction datetime; nothing advances
  on its own, so both sides of every window are testable.

  MONEY. `as_(module, who, wei)` sets sender and value; `_Payee.emit_transfer`
  appends to `transfers()`. A public write that raises reverts every tree,
  like the runtime, so a refusal can never leave half a state behind.
"""

import importlib.util
import json
import os
import pathlib
import sys
import types
from datetime import datetime, timezone

import pytest
from eth_utils import to_checksum_address

CONTRACT_PATH = (pathlib.Path(__file__).resolve().parents[2]
                 / "contracts" / "portcast.py")

# EIP-55 checksummed, the form the contract records signers in.
CREATOR = to_checksum_address("0x691e25a08e00fa16fc95b159589ba563727d77a8")
ALICE = to_checksum_address("0x56e71175c0772a21a6170e3d95184f126526e9f2")
BOB = to_checksum_address("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")
CAROL = to_checksum_address("0x90f79bf6eb2c4f870365e785982e1f101e93b906")
STRANGER = to_checksum_address("0xd41fca7210904c6d2f4e00c377e76f8aad43ec9e")
DEPLOYER = to_checksum_address("0x26ed19d786db6c920d0969b2d8a25f6a0fc8e338")

GEN = 10**18

_ROLE = ["leader"]
_ANSWERS = {"judge": {"leader": [], "validator": []}}
_CALLS = {"judge": {"leader": 0, "validator": 0}}
_PROMPTS = []
_FORGED = []
_ACCEPTED = []
_PRINTS = []
_TRANSFERS = []
_PAGES = {"leader": {}, "validator": {}}
_FETCHES = []
_NOW = [datetime(2026, 10, 1, 9, 0, 0, tzinfo=timezone.utc)]


class _NoAnswer(BaseException):
    """A test forgot to queue a model answer. BaseException, so no handler
    in the contract can swallow a harness mistake."""


class _UserError(Exception):
    def __init__(self, data):
        super().__init__(data)
        self.data = data

    def __str__(self):
        return str(self.data)


class _VMError:
    def __init__(self, message):
        self.message = message


class _Return:
    def __init__(self, calldata):
        self.calldata = calldata


def _roundtrip(value):
    """Consensus serializes the leader's result; round-tripping enforces
    that everything returned is plain data."""
    return json.loads(json.dumps(value))


def _run_nondet(leader_fn, validator_fn):
    if _ACCEPTED:
        # A result the network accepted whatever it says: tests the contract's
        # own boundary checks, the layer behind the validators.
        return _ACCEPTED.pop(0)
    if _FORGED:
        forged = _FORGED.pop(0)
        _ROLE[0] = "validator"
        try:
            ok = validator_fn(_Return(forged))
        except Exception:
            ok = False
        finally:
            _ROLE[0] = "leader"
        if not ok:
            raise _UserError("[LLM_ERROR] validators did not agree with the leader")
        return forged
    try:
        value = _roundtrip(leader_fn())
    except _UserError as e:
        _ROLE[0] = "validator"
        try:
            agreed = validator_fn(e)
        except Exception:
            agreed = False
        finally:
            _ROLE[0] = "leader"
        raise _UserError(e.data if agreed else
                         "[LLM_ERROR] validators disagreed with the leader's failure")
    _ROLE[0] = "validator"
    try:
        ok = validator_fn(_Return(value))
    except Exception:
        ok = False
    finally:
        _ROLE[0] = "leader"
    if not ok:
        raise _UserError("[LLM_ERROR] validators did not agree with the leader")
    return value


class _TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls

    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _Address:
    def __init__(self, v):
        text = str(v).strip()
        if not (text.startswith("0x") and len(text) == 42):
            raise ValueError("not an address")
        int(text[2:], 16)
        self.as_hex = to_checksum_address(text)

    def __str__(self):
        return self.as_hex


class _ViewDeco:
    def __call__(self, fn):
        return fn


class _WriteDeco:
    payable = staticmethod(lambda fn: fn)

    def __call__(self, fn):
        return fn


class _Public:
    view = _ViewDeco()
    write = _WriteDeco()


def _exec_prompt(prompt, response_format=None, images=None):
    role = _ROLE[0]
    kind = "judge"
    _PROMPTS.append({"role": role, "kind": kind, "prompt": prompt})
    queue = _ANSWERS[kind][role] or _ANSWERS[kind]["leader"]
    if not queue:
        raise _NoAnswer(f"test ran a {kind} prompt without an answer for it")
    idx = min(_CALLS[kind][role], len(queue) - 1)
    _CALLS[kind][role] += 1
    answer = queue[idx]
    if callable(answer):
        answer = answer(prompt)
    if isinstance(answer, BaseException):
        raise answer
    return answer


class _Fetched:
    def __init__(self, status, body):
        self.status = status
        self.body = body


def _web_get(url):
    role = _ROLE[0]
    _FETCHES.append({"role": role, "url": url})
    served = _PAGES[role].get(url, _PAGES["leader"].get(url))
    if served is None:
        return _Fetched(404, b"")
    if isinstance(served, BaseException):
        raise served
    return _Fetched(*served)


def _web_render(url, mode="text"):
    """A page as text, from the same served pages as web.get."""
    r = _web_get(url)
    if r.status >= 400:
        raise RuntimeError(f"HTTP {r.status}")
    body = r.body
    return body.decode() if isinstance(body, bytes) else str(body)


class _PayeeProxy:
    def __init__(self, addr):
        self.addr = str(addr)

    def emit_transfer(self, value=0):
        _TRANSFERS.append({"to": self.addr, "wei": int(value)})


def _contract_interface(cls):
    return _PayeeProxy


def _print_hook(*args, **kwargs):
    _PRINTS.append(" ".join(str(a) for a in args))


def _install():
    gl = types.ModuleType("genlayer")
    gl.public = _Public()
    gl.contract = types.SimpleNamespace(Contract=type("Contract", (), {}))
    gl.storage = types.SimpleNamespace(TreeMap=_TreeMap)
    gl.vm = types.SimpleNamespace(UserError=_UserError, VMError=_VMError,
                                  Return=_Return, run_nondet=_run_nondet)
    gl.nondet = types.SimpleNamespace(exec_prompt=_exec_prompt,
                                      web=types.SimpleNamespace(get=_web_get, render=_web_render))
    gl.message = types.SimpleNamespace(sender_address=DEPLOYER, value=0)
    gl.evm = types.SimpleNamespace(contract_interface=_contract_interface)
    gl_types = types.ModuleType("genlayer.types")
    gl_types.u256 = _U256
    gl_types.Address = _Address
    gl.types = gl_types
    sys.modules["genlayer"] = gl
    sys.modules["genlayer.types"] = gl_types
    return gl


class _FakeDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return _NOW[0]


def _load():
    _install()
    spec = importlib.util.spec_from_file_location("portcast_contract", CONTRACT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.print = _print_hook
    mod.datetime = _FakeDateTime
    return mod


@pytest.fixture
def module():
    # The stub SDK must not outlive its test: the official-runner suite loads
    # the real `genlayer` in the same session.
    saved = {k: v for k, v in sys.modules.items()
             if k == "genlayer" or k.startswith("genlayer.")}
    try:
        yield _load()
    finally:
        for k in [k for k in sys.modules if k == "genlayer" or k.startswith("genlayer.")]:
            del sys.modules[k]
        sys.modules.update(saved)


if sys.platform == "win32":
    # genlayer-test's direct loader unlinks a temp file it still holds open,
    # which POSIX allows and Windows refuses; tolerate exactly that locally.
    _real_unlink = os.unlink

    def _tolerant_unlink(path, *args, **kwargs):
        try:
            _real_unlink(path, *args, **kwargs)
        except PermissionError:
            pass

    os.unlink = _tolerant_unlink


_TREES = ("counters", "markets", "positions", "index", "rounds", "pages", "ledger")

_PUBLIC_WRITES = ("create_market", "stake", "record_sources", "file_page", "resolve", "appeal",
                  "decide_appeal", "lapse_appeal", "finalize", "void_market", "collect", "claim")


def _revert_on_raise(inst, name):
    fn = getattr(inst, name)

    def wrapped(*args, **kwargs):
        snapshot = {t: dict(getattr(inst, t)) for t in _TREES}
        n_transfers = len(_TRANSFERS)
        try:
            return fn(*args, **kwargs)
        except BaseException:
            for t, data in snapshot.items():
                tree = getattr(inst, t)
                tree.clear()
                tree.update(data)
            del _TRANSFERS[n_transfers:]
            raise

    return wrapped


def _fresh_instance(mod):
    inst = mod.PortCast.__new__(mod.PortCast)
    for name in _TREES:
        setattr(inst, name, _TreeMap())
    mod.gl.message.sender_address = DEPLOYER
    mod.gl.message.value = 0
    inst.__init__()
    for name in _PUBLIC_WRITES:
        setattr(inst, name, _revert_on_raise(inst, name))
    return inst


def _reset():
    _ROLE[0] = "leader"
    for kind in _ANSWERS:
        for role in _ANSWERS[kind]:
            _ANSWERS[kind][role].clear()
            _CALLS[kind][role] = 0
    _PROMPTS.clear()
    _FORGED.clear()
    _ACCEPTED.clear()
    _PRINTS.clear()
    _TRANSFERS.clear()
    _PAGES["leader"].clear()
    _PAGES["validator"].clear()
    _FETCHES.clear()
    _NOW[0] = datetime(2026, 10, 1, 9, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def c(module):
    _reset()
    return _fresh_instance(module)


# ── helpers ──────────────────────────────────────────────────────────────────

def as_(module, who, value=0):
    module.gl.message.sender_address = who
    module.gl.message.value = value


def err(module):
    return module.gl.vm.UserError


def set_now(iso):
    _NOW[0] = datetime.fromisoformat(iso.replace("Z", "+00:00"))


def prompts(role=None):
    return [p for p in _PROMPTS if role is None or p["role"] == role]


def prints():
    return list(_PRINTS)


def transfers():
    return list(_TRANSFERS)


def web_page(url, body, status=200, validator=None):
    """Serve a page to every node; `validator` serves that role another text."""
    _PAGES["leader"][url] = body if isinstance(body, BaseException) else (status, body)
    if validator is not None:
        _PAGES["validator"][url] = validator if isinstance(validator, BaseException) else (status, validator)


def fetches(role=None):
    return [f["url"] for f in _FETCHES if role is None or f["role"] == role]


def forge_leader(value):
    _FORGED.append(value)


def network_accepts(value):
    """The next round's consensus result, as if the network had accepted it."""
    _ACCEPTED.append(value)


def answer(verdict, reason="The recorded pages settle it.", pages=None, validator=None):
    """Queue the model's answer for the next judgment: the leader's, and the
    validators' (the same unless `validator` says otherwise)."""
    body = {"verdict": verdict, "reason": reason, "pages": pages or []}
    _ANSWERS["judge"]["leader"].append(json.dumps(body))
    v = body if validator is None else {"verdict": validator, "reason": reason, "pages": []}
    _ANSWERS["judge"]["validator"].append(json.dumps(v))


def answer_raw(leader, validator=None):
    _ANSWERS["judge"]["leader"].append(leader)
    _ANSWERS["judge"]["validator"].append(leader if validator is None else validator)


# ── a market ─────────────────────────────────────────────────────────────────

SRC_A = "https://www.gcaptain.com/canal-transits-suspended-after-grounding/"
SRC_B = "https://www.reuters.com/world/canal-reopens-after-twelve-hours/"
SRC_C = "https://apnews.com/article/canal-traffic-resumes"
FILED = "https://splash247.com/canal-authority-confirms-suspension-length/"
FILED_2 = "https://theloadstar.com/canal-backlog-clears/"

TEXT_A = ("Canal transits were suspended on 4 October 2026 after a bulk carrier grounded in the "
          "southern section. The canal authority said all northbound and southbound convoys were "
          "halted from 06:00 local time while tugs worked to refloat the vessel. ") * 2
TEXT_B = ("The canal reopened to traffic late on 4 October 2026, about twelve hours after the "
          "grounding closed it, the authority said. Convoys resumed at 18:10 local time and a "
          "backlog of 61 ships is expected to clear within two days. ") * 2
TEXT_C = ("Traffic through the canal resumed on Saturday evening. Shipping agents said the stoppage "
          "lasted roughly ten hours, though the authority has given a longer figure. ") * 3
FILED_TEXT = ("In a notice published on 5 October 2026 the canal authority confirmed the suspension "
              "of all transits ran from 06:00 to 18:10 local time on 4 October, twelve hours and ten "
              "minutes in total, after which convoys resumed in both directions. ") * 2

T_CREATE = "2026-10-01T09:00:00Z"
T_CLOSE = "2026-10-10T00:00:00Z"
T_RESOLVE = "2026-10-12T00:00:00Z"
PERIOD = 3600


def market_json(**over) -> str:
    m = {
        "question": "Will canal transits be suspended for at least 12 consecutive hours in early October 2026?",
        "event_type": "CANAL", "place": "Southern canal section", "lat": "30.00", "lon": "32.55",
        "yes_when": "The canal authority, or at least two named sources, report that all transits through "
                    "the canal were suspended for a continuous period of at least 12 hours that began "
                    "between 1 and 9 October 2026.",
        "exclusions": "Partial restrictions such as one-way convoys or draft limits do not count.",
        "window_start": "2026-10-01", "window_end": "2026-10-09",
        "trading_closes": T_CLOSE, "resolve_after": T_RESOLVE,
        "sources": [SRC_A, SRC_B, SRC_C], "periods": {"evidence": PERIOD, "appeal": PERIOD},
    }
    m.update(over)
    return json.dumps(m)


def serve_sources():
    web_page(SRC_A, TEXT_A)
    web_page(SRC_B, TEXT_B)
    web_page(SRC_C, TEXT_C)
    web_page(FILED, FILED_TEXT)


def market(c, module, **over) -> str:
    set_now(T_CREATE)
    as_(module, CREATOR)
    return json.loads(c.create_market(market_json(**over)))["market_id"]


def stake(c, module, mid, who, side, wei):
    as_(module, who, wei)
    out = json.loads(c.stake(mid, side))
    as_(module, who, 0)
    return out


def get(c, mid) -> dict:
    return json.loads(c.get_market(mid))


def staked(c, module, yes=((ALICE, GEN),), no=((BOB, GEN),), **over) -> str:
    mid = market(c, module, **over)
    for who, wei in yes:
        assert stake(c, module, mid, who, "YES", wei)["refused"] is False
    for who, wei in no:
        assert stake(c, module, mid, who, "NO", wei)["refused"] is False
    return mid


def recorded(c, module, **kw) -> str:
    mid = staked(c, module, **kw)
    serve_sources()
    set_now(T_RESOLVE)
    record_all(c, module, mid)
    return mid


def record_all(c, module, mid):
    as_(module, STRANGER)
    for _ in range(len(get(c, mid)["sources"])):
        out = json.loads(c.record_sources(mid))
    return out


def after(iso, seconds=1):
    from datetime import timedelta
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")) + timedelta(seconds=seconds)
    _NOW[0] = t


def resolved(c, module, verdict="YES", **kw) -> str:
    mid = recorded(c, module, **kw)
    after(get(c, mid)["evidence_ends"])
    answer(verdict)
    as_(module, STRANGER)
    c.resolve(mid)
    return mid


def balance(c, who) -> int:
    return int(json.loads(c.get_balance(who))["claimable"])


def held(c) -> int:
    return int(json.loads(c.get_stats())["held_wei"])
