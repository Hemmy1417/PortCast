"""Mutation check: break each rule of contracts/portcast.py and prove the
direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py [words...]
Exit status 0 only if every mutant is killed and the control passes. Works on
a temporary copy; the repository's files are never touched.
"""
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "portcast.py").read_text(encoding="utf-8")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mutants import MUTATIONS  # noqa: E402

TESTS = ["tests/direct"]


def suite_passes(work):
    env = dict(os.environ, PORTCAST_WALK_SEEDS=os.environ.get("PORTCAST_WALK_SEEDS", "20"))
    r = subprocess.run([sys.executable, "-m", "pytest", *TESTS, "-x", "-q", "--tb=no", "-p", "no:cacheprovider"],
                       cwd=work, capture_output=True, text=True, env=env)
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    return r.returncode == 0, tail[0]


def apply(text, edits):
    for old, new in edits:
        if text.count(old) != 1:
            return None
        text = text.replace(old, new)
    return text


def main():
    words = [a.lower() for a in sys.argv[1:]]
    chosen = [m for m in MUTATIONS if not words or any(w in m[0].lower() for w in words)]
    survivors = []
    with tempfile.TemporaryDirectory(prefix="portcast-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests", ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        target = work / "contracts" / "portcast.py"
        for name, old, new in chosen:
            mutant = apply(TEXT, [(old, new)])
            if mutant is None:
                print(f"SKIPPED  {name}: a target is missing or ambiguous", flush=True)
                survivors.append(name)
                continue
            target.write_text(mutant, encoding="utf-8", newline="\n")
            passed, tail = suite_passes(work)
            print(f"{'SURVIVED' if passed else 'killed  '} {name}  ({tail})", flush=True)
            if passed:
                survivors.append(name)
                if os.environ.get("GITHUB_ACTIONS"):
                    print(f"::error title=mutant survived::{name}", flush=True)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = suite_passes(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(chosen) - len(survivors)}/{len(chosen)} mutants killed")
    if survivors:
        print("survivors: " + "; ".join(survivors))
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())
