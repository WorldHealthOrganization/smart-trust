---
# folio-assistant-7pp6
$schema: bean/1.0.0
title: A column-0 pseudo-tag in a published markdown source is caught only AFTER merge — five hand-fixes and no gate
status: completed
type: bug
priority: normal
created_at: 2026-10-01T06:29:56Z
updated_at: 2026-10-07T11:50:39Z
parent: folio-assistant-o3xy
---

## The class, and why a sixth hand-fix is the wrong answer

A markdown source line whose first character is `<` followed by a non-HTML name
makes kramdown open a **raw HTML block**. With no closing tag the rest of the
page stays raw, so headings, lists and tables after it render as literal text.
The usual cause is an inline code span **wrapped across a line break**, leaving
its continuation at column 0.

**This has now been fixed by hand five times.** `7w1a` records four —
`<agentId>`, `<branch>`, `<file.json>`, `<name>.config.json` — closed by
*"the four skill sources reflowed so no line begins with `<word`"*. #1726/#1730
is the fifth, `<slide>` in `library-ingestion.md`, and it cost
**nine consecutive `Docs site (GitHub Pages)` failures on main**.

## Why the existing gate cannot catch it

`check:escaped-markup` scans a **built tree**. Measured on main: it appears
**once** in all of `.github/workflows/`, at `docs-site.yml:593` as
`bun run cat check:escaped-markup ./_site`, and **0 times** in
`code-quality-gates.yml`. So it runs only after merge, and `bun run cat gates`
cannot run it at all.

That is the whole mechanism of the recurrence: #1615 was green on its PR and
red on main, and so was every one of the four before it.

## The sweep, with its denominator

Measured on main, outside fences, column 0, non-HTML name:

| corpus | files | hits |
|---|---|---|
| all markdown across 8 declared roots | 2314 | 6 |
| published sources only (`cat-harness/skills`, `cat-harness/docs`) | 1022 | **0** |

The six break down as: 2 autolinks `<https://…>` (valid markdown), 1 real
`<caption>`, 1 the generated copy of the defect, 1 the source (fixed by #1730),
and 1 **latent** — Lean anonymous-constructor syntax
`<kunnethMap_injective C D n, …>` unfenced in `folio-assistant-sci/library/
arxiv-2602.16554v1/sections/sec-014-…md`.

**The guard lands green**, so it locks the class rather than opening a backlog.

## The adversarial pass, before the code

Four of those six are cases the defect never included, so both axes narrow:

- **SCOPE** — published sources only. `library/` ingested content publishes
  **0 of 1460** built pages, so covering it would flag a Lean snippet nobody
  renders. And the *generated* copy is excluded: that directory must never be
  hand-edited, so flagging it points at the wrong file.
- **STATE** — **column 0 only**, outside fences and front matter. `` `<slug>` ``
  mid-line is the normal, safe way to write a placeholder; the defect is
  specifically a span wrapped so its continuation begins a line.

Autolinks and real HTML elements are excused by name — including the
`<details markdown="1">` that `7w1a` *deliberately introduced*. The file's own
`BLOCK_TAGS` comment states the stake: *"a check that fires on documentation is
a check that gets switched off."*

**The case that must still fire:** `library-ingestion.md` as #1730 found it.

## Done when

1. [x] A source-side check flags a column-0 non-HTML pseudo-tag in published
       markdown, excusing autolinks, real HTML and fenced regions.
2. [x] It is wired into `code-quality-gates.yml`, so `bun run cat gates` runs it and
       a PR fails instead of main.
3. [x] Falsified against the REAL historical defect: re-plant `<slide>`, watch
       it fire, restore, watch it pass.
4. [x] The latent `library/` instance is recorded rather than covered, with the
       0-of-1460 measurement that says why.

## Not in scope

Changing what the built-site check does. It catches the **effect** (a leaked
table) on the rendered page; this catches the **cause** in the source. Both are
wanted — the built check still covers mounted replicas and anything a generator
emits that no source line explains.


## Built 2026-10-01 — `check:escaped-markup --source`, wired into the gate set

`cat-harness/scripts/check-escaped-markup.ts` gains a source mode beside its
built-tree mode: same concept, two inputs, one file. The built scan sees the
**effect** (a table printed as pipes on a rendered page); this sees the
**cause** (a source line that opens a raw HTML block). Both are wanted — the
built one still covers mounted replicas and anything a generator emits that no
source line explains.

`check:escaped-markup:source` in `package.json`, and a step in
`code-quality-gates.yml`. `gates.ts` derives its list from that workflow, so
`bun run cat gates` picks it up with nothing further to declare.

### Falsified against the REAL defect, not a synthetic one

Re-planted #1730's exact line by splitting the code span so a line begins
`<slide>`, which is how the corpus actually had it:

```
✗ 1 line(s) open a raw HTML block, across 706 markdown source(s):
    · cat-harness/skills/library/library-core/library-ingestion.md:301  <slide>  <slide>`, …
```

Restored → green. **The first attempt to plant it failed silently** — my
replacement string did not match the real wrapping, so the guard reported green
over an unplanted tree. That green was vacuous, and had I stopped there I would
have reported a falsification that never happened.

### Two defects of my own, both found by assertion rather than reading

**1 — the generated-tree exclusion did nothing.** It matched
`docs/reference/skill-instructions/` against the path relative to the SCAN
directory, so scanning `cat-harness/docs` produced
`reference/skill-instructions/…` and the prefix never matched. The corpus
figure was therefore **1024**, not the 706 it is now: 318 generated files were
being scanned, and a finding in one of them would have named a file nobody may
hand-edit while the source that produced it went unreported. Now matched on a
path SEGMENT of the absolute path, and falsified both ways — planting `<slide>`
in a generated file does not fire, and the count stays 706, so it is not even
walked.

**2 — sorting `package.json`'s scripts churned the block**, 65 added / 64
removed for a one-line addition. Restored and inserted in place: 1 / 0.

### The discrimination, as tests

13 tests in `cat-harness/scripts/tests/escaped-markup-source.test.ts`. Every
must-NOT-fire case is a **real line from this corpus**, found by the sweep
rather than imagined: the two autolinks from `LICENSE-CONTENT.md`, `<caption>`
from `harnessed-kg-overview.md`, and the `<details markdown="1">` that `7w1a`
deliberately introduced. Plus the safe spelling `` `library/<slug>/` ``
mid-line, fenced regions in both markers, front matter, html comments, and an
indented code block — which cannot trip it at all, since a line indented four
spaces does not begin with `<`. The column-0 rule pays for itself there.

- [x] 1. A source-side check, excusing autolinks, real HTML and fenced regions.
- [x] 2. Wired into `code-quality-gates.yml`.
- [x] 3. Falsified against the real historical defect.
- [x] 4. The latent `library/` instance recorded rather than covered.

### Done-when 4 — the latent instance, recorded not covered

`folio-assistant-sci/library/arxiv-2602.16554v1/sections/sec-014-agent-discovered-helper-lemma.md:175`
carries Lean anonymous-constructor syntax unfenced:

```
LinearEquiv.ofBijective (kunnethMap C D n)
<kunnethMap_injective C D n,
kunnethMap_surjective C D n>
```

Same mechanism, and it would leak that page from line 175 on. **Not covered,
and the measurement is why:** `library/` publishes **0 of 1460** built pages,
so a gate reaching it would fail over a page nobody renders — the scope axis
widened past the problem. If `library/` ever publishes, add its directories to
the `--source` argument list and this becomes the first finding.

_2026-10-06T23:37:28Z_ — Claimed by claude/7pp6-close-landed-escaped-markup-source — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

1. Implementation landed in commit `02f16ae98bb52a1662accaff24699f6f5a271283` via PR #1743 ("A column-0 pseudo-tag in a published source now fails the PR, not main (#1743)").
2. `check:escaped-markup` gained `--source` mode, wired into `code-quality-gates.yml` and `package.json` (`check:escaped-markup:source`).
3. Re-derived and re-tested clean source execution:
   `bun run cat check:escaped-markup:source`
   Result: `✓ no markdown source line opens a raw HTML block, across 759 source(s)` (exit 0).
4. Re-tested and verified regression tests:
   `bun test ./cat-harness-tools/scripts/tests/escaped-markup-source.test.ts`
   Result: 13 pass, 0 fail, 25 expect() calls across all real-world edge cases.
5. All repository quality checks pass: `bun run typecheck`, `bun run cat lint` (0 errors), `bun run cat check:retired-front-matter`, `bun run cat check:bean-parents`.
