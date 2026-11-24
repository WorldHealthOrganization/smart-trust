---
# folio-assistant-wwi6
$schema: bean/1.0.0
title: 'INITIATION: uploads/ and library/ are created at initiation, one as state and one not'
status: completed
type: feature
priority: normal
created_at: 2026-09-20T06:19:54Z
updated_at: 2026-10-07T17:24:00Z
parent: folio-assistant-o3xy
---

## The ask, owner 2026-09-20 (verbatim)

> also please add back uploads/ folder. it should be initiation skill of
> folio-asst-core/ and preseverd in the current folio-asst/ repo as state.
> library/ should also be added in at initation, but not as state by KG-Content.

## MEASURED FIRST, because "add back" turned out not to mean what it sounds like

Both directories are **present**, declared, and populated in this checkout,
measured 2026-09-20 on `claude/wonderful-gauss-7frcrw`:

| directory | declared in `cat-harness/harness.json` | on disk |
|---|---|---|
| `cat-harness/uploads/` | yes, `{id: "uploads", path: "uploads/", graphs: ["uploads"]}` | **present, 5 entries** |
| `cat-harness/library/` | yes, `{id: "library", path: "library/", graphs: ["library"]}` | **present, 5 entries** |

So nothing is missing here and nothing needs restoring. Recording that up front
so the next agent does not go looking for a deletion to revert, or "restore" a
directory over one that already has contents in it.

**The ask is therefore about INITIATION**, not about this checkout: what a
*newly initiated* instance gets. That makes it a direct sibling of `mggs`, which
just built the initiation step that creates and declares `folio/`
(`cat-harness/scripts/ensure-landing-sticky.ts`). The same script is the obvious
home, and `FOLIO_DIRECTORY_ENTRY` the obvious pattern to copy.

## Three distinctions in the ask that I cannot resolve from the repository

Flagged rather than guessed at, because each changes what gets built:

1. **"as state" vs "not as state."** `uploads/` is to be *"preserved in the
   current folio-asst repo as state"*; `library/` is to be added at initiation
   *"but not as state"*. Nothing in `schemas/cat-harness.ts` carries a notion of
   a directory being "state" — `ContentDirectory` has `id`, `path`, `graphs`,
   `scope`, `description` and the label shape, and `GraphKindDef` has `type`,
   `renderable` and `summary`. The nearest existing concept is
   `UNPUBLISHED_GRAPH_KINDS` (`["fsh-guts"]`) and `DeclarationScopeSchema`
   (`instance` | `repository`), and neither is obviously this. **Is "state" a
   new declared property, or an existing one under another name?**
2. **"initiation skill of folio-asst-core/."** `folio-assist-core` is a layer of
   the not-yet-done split (issue #223) and does not exist as a directory here —
   the roots today are `bootstrap/` and `cat-harness/`. `mggs` put the folio
   step in cat-harness initiation on the owner's ruling (*"cat-harness initaton
   craetes the folio/"*). **Does `uploads/` belong to a different layer's
   initiation than `folio/` does, and if so, where does that live before the
   split?**
3. **"by KG-Content."** A term that appears nowhere in the repository (`grep -ri
   "kg-content"` finds nothing). The `folio` graph kind's summary is *"Authored
   content, rendered to a website"*, and the sub-graph overview sticky calls
   this grouping **content**. **Is KG-Content the `folio` graph kind, the layer
   that owns it, or a third thing?**

## What is NOT in doubt

That initiation should create these alongside `folio/`, and that the mechanism
exists: `ensureLandingSticky` already creates a directory, declares it in
`harness.json` by a byte-preserving splice, and is idempotent with a `--check`
mode. Extending it to a list of directories is small. The three questions above
are about WHICH properties each entry carries, not about how to write it.

## Done when

- [ ] the three questions are answered
- [ ] initiation creates `uploads/` and `library/` when absent, declaring each in
      the same step (so `initialization.md` step 2's "create the directories the
      declaration names, and only those" stays true)
- [ ] whatever "state" turns out to be is a DECLARED property rather than a
      convention, since a convention is what `harness.json` exists to replace
- [ ] idempotent, and covered by the same `--check` gate as the folio step
- [ ] a test that the two are distinguishable, and that it can fail


_2026-09-20_ — **MEASURED, and the creation half is already true.**

## A newly initiated instance already gets both — proved, not argued

Built a throwaway folio whose `harness.config.json` depends on this instance,
and ran the one answer for "which directories does an instance have":

```
CREATED  uploads    uploads/    by=folio-assistant
CREATED  library    library/    by=folio-assistant
CREATED  folio      folio/      by=folio-assistant
   (+ tools, schemas, cat-harness, qa, health, voices, translation-sources, cat-harness-src)
```

The chain, all four links of which already existed:

1. `cat-harness/harness.json` declares `uploads` and `library`,
   **instance-scoped** (no `scope` key — absent means instance);
2. `resolveDirectories` hands an instance-scoped entry to every dependent,
   resolving `absPath` against the DEPENDENT's root, not the declarer's;
3. `materialiseDeclaredDirectories` — *"THE ONE ANSWER … called by every
   getting-started / instantiation path so there is not a second one free to
   disagree"* — creates them, idempotently;
4. `scripts/init-folio.ts:598` calls it.

So **nothing needed building** for "created at initiation". Recording it rather
than writing a second creation path beside the one that works, which is how a
repository ends up with two answers.

## What I DID add, and why it is not nothing

That property holds by a chain of four facts, **none of them stated anywhere**,
and one of them is a single absent JSON key. Adding `"scope": "repository"` to
the `uploads` entry is a plausible-looking edit that silently stops every
downstream folio getting an ingestion queue — `resolveDirectories` skips a
repository-scoped entry for a dependency *on purpose* — and the folio would
simply have nowhere to drop a file. Nothing would fail.

Four tests in `schemas/harness-config.test.ts` pin it: both are materialised in
the dependent's OWN root, they are inherited rather than `(default)`, the work
plan (`beans/`, `todos/`) is NOT inherited — the contrast that shows the test
can tell the two apart — and the two are distinct declarations rather than one
directory twice.

**Falsified before being trusted:** patching `uploads` to `scope: repository`
turns 3 of the 4 red. A guard that cannot fire is worse than none.

## Still BLOCKED, and all three are the owner's

The three questions this bean raised before any work are unchanged, and one of
them I tried to resolve by measurement and could not:

1. **"as state" vs "not as state"** — my plausible reading was *committed vs
   gitignored*. **Measured and falsified:** both are fully tracked in this
   checkout (`uploads/` 5 files, `library/` **1455**), and their keep-markers
   ignore nothing on purpose. So "state" is not that, and nothing in
   `ContentDirectory` (`id`, `path`, `graphs`, `scope`, `description`) or
   `GraphKindDef` (`type`, `renderable`, `summary`) carries it. It needs either
   a new declared property or a name for an existing one.
2. **"initiation skill of folio-asst-core/"** — that layer does not exist as a
   directory yet (#223); the roots today are `bootstrap/` and `cat-harness/`.
3. **"by KG-Content"** — appears nowhere in the repository.

Not guessed at, because each changes what gets built. Asked as one question
with the other two counted, per `interaction-modality` §4.1.

_2026-09-20_ — **The implementation half is MERGED** in [#481](https://github.com/litlfred/folio-assistant/pull/481)
(`5fe9b498`): the four tests pinning the inheritance, and the contrast proving
they discriminate.

**Kept open because a question is still the owner's, not because work remains.**
Two, and the first has been measured:

1. **"as state" vs "not as state"** — my reading was *committed vs gitignored*,
   and that is **falsified**: both are fully tracked. Nothing in
   `ContentDirectory` or `GraphKindDef` carries the notion. Also *"KG-Content"*,
   which appears nowhere in the repository.
2. **Where `uploads/` lives** turned out to be a live question and is now
   answered, but NOT by this bean and not by changing its scope. Measured
   2026-09-20: giving `uploads` `scope: "repository"` turns **6 tests red**,
   three of them this bean's own inheritance guarantee. The root got its own
   `harness.json` instead (`889e003012`), which leaves every property here
   intact. `qmjh` carries the schema distinction that would let a declaration
   say this directly.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #481 (One initiation receipt per harness, the todo board inside the landing board, theme-art intake, a reverse sweep for undeclared files).
