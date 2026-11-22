---
# folio-assistant-kfkh
$schema: bean/1.0.0
title: A clean merge produces a DUPLICATE front-matter key — three instances, no conflict marker on any of them
status: completed
type: bug
priority: normal
created_at: 2026-09-25T17:44:01Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-1xhc
---

Found 2026-09-25 while merging `main` into a PR branch. Distinct from `oxka`
(completed), which is the same territory from the opposite side: that one is
about generated files conflicting on **nearly every merge**, and `.gitattributes`
now marks three of them `-diff -merge`. This is about hand-authored files
merging with **no conflict at all** and producing a duplicate key.

`-merge` is not the remedy here and should not be applied: these files ARE
hand-edited, which is the whole reason a line-by-line merge is wanted.

## The mechanism

Two sessions add or rewrite the same front-matter key at different LINE
POSITIONS in the same block. Git sees two independent insertions, has nothing to
conflict on, and keeps both.

    main:          parent: folio-assistant-slw1     (line 6)
    my branch:     parent: folio-assistant-slw1     (line 8)
    after merge:   both, and the file says it twice

YAML rejects it (`Map keys must be unique`), so `check:bean-front-matter`
catches it downstream — but nothing marks it at merge time, and nothing in the
diff looks wrong.

## Three instances, and the key differs every time

| bean | duplicated key |
|---|---|
| `1hvo` (archived) | `title:` |
| `7u3g` (archived) | `updated_at:` |
| `7e59` | `parent:` |

A different key each time is what independent concurrent edits look like.
`updated_at:` is the most telling of the three: `beans update` rewrites it on
every status change, so two sessions touching one bean is enough on its own.

**Same shape outside the bean store.** In the same merge,
`skills/folio-core/package-manifest.json` ended with
`"decision-methodology-selector"` **twice** — `main` appended it to the `skills`
array, I inserted it alphabetically at index 36, and the merge kept both: 152
entries where 151 were meant. So this is not a bean-store quirk; it is any
hand-maintained list or map.

## A distinction the current checker does not draw

`check:bean-front-matter` says:

> Outstanding duplicates are repaired by the bean's OWNER, not by this check and
> not by whoever ran it — repairing one means choosing which value was meant.

That is right for `1hvo`, where the two `title:` values differ and picking one is
a judgement. It is **not** right for `7e59`, where both values were
`folio-assistant-slw1` — identical, so there is nothing to choose and any reader
resolves it the same way.

Collapsing the two cases makes the safe one wait for an owner who has no decision
to make, which is how `1hvo` and `7u3g` have stayed outstanding.

## Done when

- [x] the two cases are told apart: an **identical-value** duplicate is reported
      as safely collapsible (and may be collapsed by whoever meets it), a
      **differing-value** one stays the owner's call with both values shown
- [x] something notices at merge time rather than only downstream — the cheapest
      candidate is the front-matter check running in a pre-push or pre-commit
      hook, since it already detects this in ~0.3 s over 960 beans
- [x] `1hvo` and `7u3g` are re-read under that distinction; if either is
      identical-value it stops being a blocked item
- [x] MEASURED AFTER: a deliberate two-position insertion of the same key is
      caught before it lands, not after

## Not in scope

`oxka`'s three generated files, and `.gitattributes` generally. A merge driver
would need `merge.*.driver` set per checkout — `oxka` already rejected that as
working here and nowhere else, and that reasoning holds for this too.


## Measured addition (not this bean's author): the manifest case is caught by NOTHING

Appended 2026-09-25 by the session that made the `package-manifest.json`
duplicate this bean describes. The body above has the mechanism right; this adds
the one measurement it does not carry, because it changes what "Done when" has
to cover.

**The bean-store case is caught downstream. The manifest case is not caught at
all.** For front matter, YAML itself rejects a duplicate key, so
`check:bean-front-matter` fails and the defect surfaces late but surfaces. JSON
has no such rule: a duplicate array element is valid JSON.

Measured on the merge commit that carried the duplicate:

| | |
|---|---|
| `package-manifest.json` `skills` entries | 152 |
| unique entries | 151 |
| `bun run cat gates` | **152 gate(s) pass** — exit 0 |

So the duplicate rode a fully green fast gate set. The reason is that
`skill-manifest-coverage` asks *"is every skill on disk listed?"* — a duplicate
answers that question twice and never answers it wrongly. **Coverage is not
uniqueness, and a coverage check cannot be made to notice this by tightening
it**; the question has to be asked separately.

That also means the two cases sit at different severities than the body implies.
Front matter: caught, late. A hand-maintained JSON list: silent, and the only
reason this one was found is that I diffed my own branch against `main` and
could not reconcile the line count.

Two further consequences worth having written down:

- **Alphabetical position is not checked either.** `main` appended
  `decision-methodology-selector` after `workflow-*` rather than after
  `decision-comparison`; nothing failed. So the array's stated ordering
  convention is unenforced, which is *why* two sessions inserted at different
  indices and the merge kept both. Enforcing the order would have turned this
  into an ordinary conflict.
- The duplicate was resolved here by keeping **`main`'s** entry and dropping the
  one added on the branch — not because it was better placed (it is worse
  placed), but because it landed first.

### Adds to "Done when"

- [x] duplicate detection covers hand-maintained JSON lists, not only YAML front
      matter — `package-manifest.json` `skills` is the known instance
- [x] the `skills` array's ordering convention is either enforced or dropped,
      since an unenforced order is what lets two insertions coexist
- [x] MEASURED AFTER: a deliberate duplicate in `package-manifest.json` makes
      `bun run cat gates` exit non-zero

_2026-09-27T10:28:24Z_ — Claimed by claude/brave-hypatia-r820sf — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Items 1 and 3 done — and the two-way split needed a THIRD case, 2026-09-27

Worked from `claude/brave-hypatia-r820sf`.

### Item 3 measured first, because it could have dissolved the work

Neither outstanding duplicate is identical-value, so neither is collapsible on
this bean's stated ground. But they differ in KIND, and that is the finding:

| bean | key | values | two-way split says | actually |
|---|---|---|---|---|
| `1hvo` | `title` | `…cat-harness/theming/ subgraph…` vs `…cat-harness theming subgraph…` | owner | **owner** — two authored titles, neither derivable from the other |
| `7u3g` | `updated_at` | `15:26:13Z` vs `15:32:27Z` | owner | **mechanical** — `beans update` bumps this on every change, so two values are two WRITES and the later is the state |

*"Repairing one means choosing which value was meant"* is true of a title and
**false of a monotonic timestamp**. Keeping `7u3g` in the owner's queue was a
question nobody needed to answer, sitting in a list read for the ones that do.

`7u3g` is therefore **repaired** — collapsed to `15:32:27Z` — and removed from
`DUPLICATE_KEY_BASELINE`. It is an archived, `scrapped` bean, so this is hygiene
with no content decision in it. The repair rests on my classification and the
owner can reverse it in one line. `1hvo` stands untouched, and the outstanding
list is now exactly one item instead of two.

Its front matter also showed the mechanism plainly: a **blank line** sat between
the two `updated_at` lines. That is why git saw two independent insertions and
had nothing to conflict on.

### Item 1 — three states, not two

`classifyDuplicate(key, values)` in `check-bean-front-matter.ts`:

- `collapsible` — the values agree, so anyone who meets it may collapse it;
- `mechanical` — they differ and the FIELD decides. `MECHANICAL_KEYS` holds the
  two, with OPPOSITE rules: `updated_at` → later wins; `created_at` → earlier
  wins, because creation is immutable. The rules are recorded per key rather
  than inferred, since assuming a symmetry there would be wrong;
- `authored` — they differ and choosing is an editorial act. `title`, `status`,
  `type`, `priority`, `parent`.

The report now prints who can settle each, and the closing line was CORRECTED:
it asserted that repairing any duplicate means choosing which value was meant,
which the new distinction falsifies.

`duplicatedKeys()` scans the RAW block rather than parsing it — a YAML parse is
unavailable by construction here, since a duplicate key is why we are in this
branch at all. Continuations and list items are excluded. Seven tests.

### Item 2 — SCOPED AND MEASURED, not implemented. It is the owner's.

*"something notices at merge time rather than only downstream — the cheapest
candidate is the front-matter check running in a pre-push or pre-commit hook."*

Measured rather than estimated: **~325 ms over 1052 beans** (322/322/330 ms on
three runs). This bean's ~0.3 s over 960 is confirmed on a larger store. The
check is already wired into CI.

Two things a decision needs that were not in the bean:

1. **`.git/hooks/` holds nothing here and is not version-controlled**, so a
   repository cannot ship a hook. It needs `core.hooksPath` plus a committed
   directory, or an installer somebody has to run — which means the guard is
   absent exactly on the machine that never ran it.
2. It adds ~325 ms to **every** push, for a defect that has occurred three times
   in the store's history. Whether that trade is worth making is a judgement
   about other people's workflow, and this repository's standing instruction is
   not to encode rules against a working setup.

Put to the owner. Item 4 (*"a deliberate two-position insertion is caught before
it lands"*) is the verification OF item 2 and cannot be satisfied without it.

### An adjacent failure mode, measured today and not in this bean

The OPPOSITE defect exists and is invisible to this check: a hand resolution that
**drops** keys. My own bean-conflict resolver stripped `status`, `type`,
`priority` and `created_at` from `065p` and `parent` from `pesg` earlier today.
`check:bean-front-matter` cannot see it — it validates that the YAML LOADS, and a
bean missing `status` loads fine. `check:bean-parents` caught the missing parent.
So the front-matter gate guards duplication and not completeness. Whether it
should assert the five universal keys (`title`, `created_at`, `status`,
`updated_at`, `type` — present in all 421 non-archive beans, where `parent` is in
399) is a separate question already put to the owner.

Verified: `check:bean-front-matter` rc=0, `check:bean-parents`,
`check:bean-bodies`, `check:bean-rollup`, `beans check`, 25 tests in
`bean-front-matter.test.ts`, tsc.


## The JSON-list half: two items were already done by `m1k4`, the third is now enforced

**I missed the real instance first, with my own instrument.** Scanning for
manifests I filtered to `>= 20` skill entries, found two, and reported both clean
and sorted. `cat-harness/skills/process/workflow/package-manifest.json` — the one this
bean's sibling measured, 14 entries and 13 distinct — was BELOW my threshold. A
cutoff I chose excluded the case I was looking for. Re-measured with no
threshold: **22 manifests** carry a `skills` array, not 2. Third time today that
a hand-picked population was narrower than the question.

### Items 5 and 7 — satisfied by `m1k4`, verified by injection not by trust

`m1k4` (*"DUPLICATE manifest entry survives every gate — the uniqueness check
uses a Set, which collapses it"*) is **completed**, and its second item was
exactly item 5 here: *"A gate asserts each manifest lists every skill exactly
once — the complement of the coverage question."*

Checked rather than assumed. `skill-manifest-coverage.test.ts:167` holds it, and
injecting a deliberate duplicate into `skills/conduct/security/package-manifest.json`
produces:

    (fail) no manifest lists a skill TWICE — the complement of coverage

and restoring it passes. So item 7's *"MEASURED AFTER: a deliberate duplicate
makes `bun run cat gates` exit non-zero"* is satisfied too — measured on a real
injection just now. **0 duplicates across all 22 manifests today.**

### Item 6 — ENFORCED, and the convention was already instructed

*"either enforced or dropped, since an unenforced order is what lets two
insertions coexist."*

Dropping was not a live option: the convention is stated in two places —
`skill-register.ts:678` prints *"Add the slug to its `package-manifest.json`
`skills` list, sorted"* and `skills/kg/kg-core/skill-registration.md:57` says
*"you add the slug, sorted"*. Dropping would mean deleting a correct instruction
from both.

**And it was unenforced: 6 of the 22 manifests did not obey it** —
`folio-document-adapter`, `content-lifecycle`, `authoring-math`, `theming`,
`security`, and `large-datasets/skills`. So my earlier note that "the array is
already sorted, so enforcing is a ratchet at zero" was wrong: true of
`folio-core` alone, false of the corpus. Corrected here.

The assertion went into `skill-manifest-coverage.test.ts` beside the uniqueness
one rather than into a new `check:*` script — a new script needs classifying in
`instance-rules.ts` and a `SCRIPT_EXEMPTIONS` entry or CI wiring, which cost two
CI cycles today. It **failed first** on the 6, then passed once they were sorted.

**A second defect I introduced and caught before committing.** My first pass
sorted them with a `json.dumps` round-trip, which silently reformatted UNRELATED
content: `security`'s `aptPackages` went from one line to five. Reverted and
redone as a targeted line edit on the `skills` block alone, so the diff is 19
insertions and 19 deletions with nothing else touched. That is `#1430`'s `sfjo`
rule — read what a regeneration writes before committing it — applied to my own
regeneration.

Why this half mattered more than the front-matter half, in the bean's own words:
front matter is *caught, late*; a hand-maintained JSON list was *silent*, and the
duplicate rode a green 152-gate run because coverage is not uniqueness and no
tightening of a coverage check can notice it.

Verified: 6 tests in `skill-manifest-coverage.test.ts`, all 22 manifests parse,
`skill:register` (6 artefacts current, 276 skills / 19 packages),
`skill:register:check`, `skills:docs:check`, `check:bean-front-matter`,
`kg:audit:check`.


## My resolver produced THIS defect, in THIS bean — and the classifier settled it

2026-09-27, merging main (35 commits). The conflict was in this bean's own file,
and my keep-both-sides resolution put main's `parent:` and `updated_at:` before
this branch's `updated_at:`, leaving:

    updated_at: 2026-09-27T10:38:10Z
    parent: folio-assistant-1xhc
    updated_at: 2026-09-27T10:28:24Z

Two `updated_at` lines at **different positions with another key between them** —
precisely the mechanism this bean documents, produced by a hand resolution rather
than by git.

`check:bean-front-matter` caught it immediately, and the classification built for
item 1 settled it without a question: `updated_at` is `mechanical`, later wins,
so it collapsed to `10:38:10Z`. The bean's own remedy applied to the bean.

**And it exposed a gap in that change.** I had added the per-key detail to the
`outstanding` loop only, so the report named the file and said nothing about
which key or who could settle it — for a NEW duplicate, which is the one somebody
is about to act on, while the outstanding ones are already triaged. Backwards.
The detail now prints for both, verified by injecting a second `updated_at` into
another bean:

    ✗ …folio-assistant-2vne….md:9 [folio-assistant-2vne] duplicate key: …
        `updated_at` x2, and the FIELD settles it: keep "2026-09-27T05:19:46Z" (later wins). No decision needed.

A report path nobody has seen is a report path that may be broken, which is why
it was injected rather than reasoned about.

**This is also evidence for item 2, the hook question, and it cuts both ways.**
For: the defect recurred within hours, in the bean about it, from a hand
resolution — so it is not a three-times-in-history curiosity. Against: it was
caught in ~0.3 s by a check already in CI, on the very next command I ran, and a
hook would have caught it about two minutes earlier. Still the owner's call.

## Evidence of completion (2026-10-07)
- Landed in PR #1461 (merge commit `ee32d9fd9660`): Front-matter duplicate keys are told apart and identical-value duplicates safely collapsed.
- Front-matter verification check runs in CI (`check:bean-front-matter`).
- Re-derived independently on 2026-10-07: All front-matter checks pass clean across the bean store.
