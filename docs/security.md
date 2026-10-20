# Security review

What was checked before the deployment of record, what the live network taught us, and the limits that remain.

## Found on the live network before the record

- **Rendering pages in a browser timed out the validators.** The first design recorded every named source in one round and rendered each page with a headless browser. On Studio Next the validators timed out, and nothing was recorded. Now each source is its own round, and pages are fetched over plain HTTP with their visible text extracted by the contract's own code. A probe market recorded three real pages this way, under consensus, and was answered.
- **A total was read as a continuous period.** In the probe, the validators answered yes on a page that gave a 78-hour closure "in the past 7 days" against criteria requiring 72 continuous hours. The answer prompt now tells the resolver to read every figure exactly as its page states it, and never to supply a qualifier the page does not give.

## Found in review

- **One side could crowd the record.** Filed pages were capped per market, first come first served, so a few cheap stakes on one side could fill every slot. Now each side of a market has its own allowance per stage, counted by the side the filer holds more on.
- **A lookalike host was not tested.** The registry match was right, but no test caught a host that merely ends with a publisher's name; one does now.
- **A filter could never fire.** The first round excluded appeal pages, which cannot exist before the first round; the filter was removed rather than kept as untested code.

## Standing protections

- Sources come only from a registry of publishers fixed at deployment, at least two of them different, so nobody staking on a market can write the page the validators read.
- The criteria, window and sources are hashed at creation; every round records that digest and the digest of every page it judged.
- A leader cannot add words to a page, cut it short, or call a readable page unreadable.
- The answer and any appeal judge the record, never a fresh fetch.
- Party notes and appeal statements are fenced and defused; page text cannot close a fence.
- Only the agreed answer moves money; every payout, refund and bond is computed in code.
- Every stage has a long stop: no record or no answer voids and refunds; an undecided appeal lapses with its bond returned.
- A random walk over every write, in any order, checks that every wei that came in is held, owed or paid at every step.

## Mutation sweeps

`tests/mutation/mutate.py` breaks each rule of the contract one at a time, and the suite must fail for each; `web/tests/mutation/mutate.mjs` does the same for the app's action rules, its words and the studio's checks.

## Limits that remain

- The registry decides who counts as a publisher; a registry publisher can still be wrong, late, or change a page before it is recorded. The record captures the page as it was when read.
- Pages are read over plain HTTP. A publisher that serves its text only through scripts, or refuses plain fetches, is recorded as unreadable.
- Only the first 8,000 characters of a page's visible text are kept; an article buried below a long header may be cut.
- Validators agree on the answer only; the reasons and the per-page notes are the leading validator's words.
- Rounding in the parimutuel split leaves at most a few wei per market in the contract.
- A replay market's outcome may already be public when it opens; it exists to demonstrate the path and is labelled as such.
- Studio Next is a test network; consensus rounds can time out or end without agreement, which records nothing and can be asked again.
