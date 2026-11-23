---
# folio-assistant-j0zs
$schema: bean/1.0.0
title: 'INJECTION: the gate reads `run:` only — `actions/github-script` blocks are JavaScript and carry the same laundering'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T13:59:53Z
updated_at: 2026-09-26T16:57:07Z
parent: folio-assistant-1xhc
---

Split out of `6bhf` rather than widened into it, because extending the scanner to
a second language changes what the gate CLAIMS to read, and that is a decision
rather than a fix.

## What is true today, measured 2026-09-26

`check-workflow-injection.ts` grades `${{ }}` expressions inside `run:` blocks.
Its docblock says so, and `scanWorkflows` enforces it. That was the right scope
when the surface was bash.

`actions/github-script` `script:` blocks are a SECOND shell in the same sense: a
`${{ }}` is substituted into the script **text** before V8 parses it, so a value
containing an apostrophe closes the surrounding JavaScript string exactly as it
closes a bash one. Two sites in this corpus:

    .github/workflows/feature-staging.yml:1164   const slug = '${{ steps.slug.outputs.slug }}';
    .github/workflows/feature-staging.yml:1449   const slug = '${{ steps.slug.outputs.slug }}';

**Neither is exploitable today**, and the reason is not the quoting. Its producer
reduces the value to `[A-Za-z0-9._-]` with a `sed`, so it cannot contain `'`.
That is the same character-class constraint the provenance work (#1408)
deliberately declined to recognise for `run:` blocks — so if the scanner is
extended, these two sites will report, and the remedy there is not `env:` (a
`script:` block does not read process env the way bash does) but the
`github-script` `with:` inputs, read as `process.env` or via a parameter.

## Why this is not just "run the same regex over `script:`"

Three things differ and each is a decision:

1. **The remedy is different.** `env:` plus `"$VAR"` is the answer for bash. For
   `github-script` it is `env:` plus `process.env.X`, and the gate's advice
   string currently names only the first.
2. **A `script:` block's safe band is not bash's.** `${{ }}` into a JS
   *expression* position (`if (${{ ... }})`) is worse than into a string, and a
   gate that reports both identically teaches nothing.
3. **`with:` is currently declared NOT graded**, on the reasoning that `with:` is
   where values are passed as data. `script:` lives under `with:`. So the scope
   line "`run:` blocks only" and "`with:` is the remedy" now conflict at exactly
   one key, and that conflict is the real content of this bean.

## Done when

- [x] Decided, with reasons written down, whether the gate reads `script:` —
      **YES**, and not on taste: the measurement found a live injection. See below
- [x] ~~the two `feature-staging.yml` sites~~ — **there were not two**, see
      §"The count in this bean was wrong". Both `script:` blocks in that file now
      bind to `env:` and read `process.env`; the gate reports 2 free-text findings
      against the pre-fix file and 0 after
- [x] `injection-boundaries` loses its out-of-scope paragraph — replaced by
      §"`script:` blocks are the SECOND surface — decided yes", and `security.md`'s
      boundary row no longer says "`script:` blocks are JS and unread"

## Decided 2026-09-26: YES — and the scope question turned out to hide a finding

### The count in this bean was wrong

The body above says "Two sites in this corpus" and names
`const slug = '${{ steps.slug.outputs.slug }}'`. That came from grepping for a
**spelling**. Enumerating the SHAPE — every `${{ }}` inside every `script:` block —
gives **12 interpolations across 3 blocks in 3 workflows**: `feature-staging.yml`
(3), `publish.yml` (7), and two further blocks with none.

Second time in one day that grepping for a spelling undercounted a surface, after
the tar member-name regex. **The shape is the unit, never the phrasing**, and this
bean is now its own worked example: the bean that exists to enumerate a surface
undercounted that surface in its opening paragraph.

### The finding the count was hiding

`feature-staging.yml` interpolated `steps.slug.outputs.branch` — the RAW fork
branch name, not the sanitised slug — into a JavaScript **template literal**:

    **Branch:** \`${{ steps.slug.outputs.branch }}\`

Inside a template literal `${…}` is **evaluated**, so the value need not close a
quote to become program. Measured with `git check-ref-format --branch`:

| branch name | verdict |
|---|---|
| `a${process.exit(1)}b` | **LEGAL** |
| `` x`id` `` | **LEGAL** |
| `x${7*7}` | refused — for the `*`, not for the `${` |

No fork guard on the job, which triggers on
`pull_request: [opened, synchronize, reopened]`. So: arbitrary JavaScript execution
in the step, reachable by opening a fork PR, capped by `pull_request`'s read-only
token rather than by anything in the workflow. The same file's `Determine staging
slug` step binds that exact value to `env:` and says in a comment that it is
attacker-controlled. The `script:` block slipped.

### The remedy was already in the corpus, in the workflow next door

`folio-staging.yml` does the same job — comment the staging URL on the PR — and has
always written `const slug = process.env.SLUG` and
`` **Branch:** \`${process.env.BRANCH}\` ``. Two workflows doing one job, one
right and one wrong, and **nothing checked which pattern a file used**. `1wef` a
third time, in the surface the gate had declared out of scope:

> **A scope exclusion is a place defects collect, not a place they are absent.**

### Why it is a separate surface rather than a wider regex

The three reasons the bean listed as "decisions" resolved like this:

1. **The remedy differs** — confirmed, and it is the strongest of the three. A
   `script:` block is Node: `env:` plus `process.env.VAR`. The gate emits a
   different sentence, because `"$VAR"` in JavaScript is advice that does not apply.
2. **The bands differ by position** — true, and deliberately NOT modelled. Telling
   a template literal from a plain string means tracking backticks across lines,
   and a detector that quietly missed the multi-line case would be worse than none.
   The bands grade the value; the docblock carries the position fact.
3. **`script:` lives under `with:`** — resolved by moving exactly that one key. An
   ordinary `with:` input is still ungraded, and a test pins that.

`baselineKey` now carries the surface, since one expression in two surfaces is two
decisions. The baseline gained exactly one entry,
`publish.yml (script): github.event.pull_request.base.ref`; the other six
interpolations there are `filename-base`, which is `date -u` plus a short SHA.

### Evidence

- 2 free-text findings in `script:` blocks against the pre-fix `feature-staging.yml`
  (`git show HEAD:` into a temp dir), including line 1173 `via stage.slug` — that
  attribution only works because `6bhf`'s provenance pass grades the producer
- 0 after; gate green with 8 `run:` and 1 `script:` constrained, all baselined
- 28 tests, one asserting the **real corpus has a scanned `script:` block**: a
  broken detector would otherwise make this entire surface silently green
- `tsc` clean; BPMN prose re-read and attested

## Closed 2026-09-26 — merged as 694425c961 (PR #1415)

Three of three. Evidence, not authorship: the merge commit carries the `Surface`
type, `resolveProvenance`'s `script:` walker, the surface in `baselineKey`, the
two `env:`-bound `script:` blocks in `feature-staging.yml`, the six new tests and
the rewritten `injection-boundaries` section.

Verified before merge: 2 free-text findings in `script:` blocks against the
pre-fix file and 0 after; gate green at 8 `run:` + 1 `script:`; 28 tests, one of
which asserts the real corpus HAS a scanned `script:` block so a broken detector
cannot make the surface silently green; `ns:check` 168 terms; `tsc` clean;
`End-to-end + accessibility` and `stage` green in CI on the merged base.

The one red check at merge was `translation:drift:check` — the owner's deliberate
decision (bean `ngxj`, issue #206), 11999 pass / 44 skip / 1 fail.
