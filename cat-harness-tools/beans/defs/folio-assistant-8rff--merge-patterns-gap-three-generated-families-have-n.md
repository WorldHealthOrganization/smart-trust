---
# folio-assistant-8rff
$schema: bean/1.0.0
title: 'MERGE PATTERNS GAP: three generated families have no declared merge-conflict pattern, so merge:main refuses them and merge:overlap counts them as authored'
status: completed
type: bug
priority: normal
created_at: 2026-10-02T17:46:34Z
updated_at: 2026-10-03T00:30:58Z
parent: folio-assistant-d33q
---

Found by merge:overlap's first live run (bean blgm, PR #1895, 2026-10-02): 32 open PRs; 109 pairs overlapped on authored paths, and 19 of those overlapped ONLY on these three generated families. None is named in cat-harness/scripts/merge-conflict-patterns.ts PATTERNS or in .gitattributes, so they classify as authored.

| family | writer | check in CI | overlap count (pair-path hits) |
|---|---|---|---|
| `cat-harness/docs/assets/glossary/*.skos.jsonld` | `glossary:export` (cat-harness/scripts/glossary-export.ts) | `glossary:check` | 54 |
| `folio-assistant-core/glossary/generated/**` | `glossary:export` (verify by reading its write paths) | `glossary:check` | 50 |
| `cat-harness/docs/reference/skill-instructions/**` | `skills:docs` (cat-harness/scripts/gen-skill-docs.ts, OUT_DIR) | `skills:docs:check` | 30 |

Coordinator chose option (a): declare them as `take-base` patterns, each with its reason, following §'Adding a pattern' in the merge-conflict-patterns skill (one skill section per entry, a classify test per pattern with its authored neighbour refused). Not in PR #1895, which only reads the declaration.

Caution: `cat-harness/docs/assets/**/*.json` is already `site-data`; `.skos.jsonld` does not match it. Confirm each writer by reading the script before declaring, per the skill.

## Done when
- [x] three PATTERNS entries with reasons, and skill sections
- [x] merge-base.test.ts classifies each, with an authored neighbour refused
- [x] merge:overlap re-run shows them as generated

_2026-10-03T00:27:48Z_ — Claimed by claude/merge-patterns-8rff — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Summary of Changes — 2026-10-03

Option (a) as the coordinator chose: three `take-base` entries in
`cat-harness/scripts/merge-conflict-patterns.ts`, placed before `site-data`
and before `readme-generated-regions` because the first matching pattern wins.

| id | glob | hits |
|---|---|---|
| `skos-glossary-export` | `**/docs/assets/glossary/*.skos.jsonld` | 54 |
| `glossary-generated` | `**/glossary/generated/**` | 50 |
| `skill-instructions` | `**/docs/reference/skill-instructions/**` | 30 |

**Each writer was confirmed by reading the script, as this bean required —
and one of the three checks changed the design.**

- `gen-skill-docs.ts`: `OUT_DIR` at :63, written through `emit()` at :104.
  `emit` is compare-or-write (`CHECK_ONLY` compares and records drift,
  otherwise `writeFileSync(path, content)`) — **no merge, nothing carried
  forward.** Safe.
- `glossary-export.ts`: writes the SKOS export and the generated tree whole —
  but it **also reads the prior LEDGER and carries concepts forward**, keeping
  a term's earlier names as `skos:hiddenLabel` (#1168 B10b, and the module
  header's own argument at ll. 103–124).

So the ledger is the one artefact here that fails `.gitattributes`'s
carry-forward test, and taking a side on it would drop a term's history. Both
ledgers on disk — `cat-harness/glossary/glossary-ledger.json` and
`cat-harness/glossary/bootstrap/glossary-ledger.json` — were checked against
the new globs and match **none** of them: `glossary-generated` stops at
`generated/`, and the ledger sits one level up. Pinned by its own test rather
than left to the glob's shape.

**Four tests in `merge-base.test.ts`** (25 pass / 0 fail), following the
skill's §"Adding a pattern" step 3 — *test that the unsafe neighbour is
refused, not only that the case resolves*:

1. all three families classify to the right pattern id;
2. **both ledgers refuse** — the carry-forward neighbour;
3. the generated `skill-instructions/merge-conflict-patterns.md` is
   `take-base` while the **skill source** `skills/sdlc/sdlc-core/merge-conflict-patterns.md`
   is `refuse` — the pair that makes the entry safe;
4. `site-data` still owns `docs/assets/**/*.json`, since `.skos.jsonld` is not
   `*.json`. That was this bean's own stated caution and it is now pinned
   instead of reasoned about.

**Verified effect.** `bun run cat merge:overlap` re-run over the open PRs:
**zero** occurrences of any of the three families in an `authored_overlap`
list, where this bean measured 19 pairs overlapping ONLY on them.

## What this unblocked

PR #1894's merge with `main` (`868828849`) was refusing on **three** paths, and
two were this bean:

```
✗ cat-harness/docs/reference/skill-instructions/bean-coordination.md        [no declared pattern]
✗ cat-harness/docs/reference/skill-instructions/local-bean-coordination.md  [no declared pattern]
```

Both now classify `take-base`. The third refusal —
`beans/defs/folio-assistant-dlqu--…md`, `[beans: refuse]` — is **not** a
pattern gap: it is two sessions editing one bean, which the resolver refuses
on purpose, and the refusal text names the hazard in resolving it carelessly
("a duplicated `updated_at` … is `check-bean-front-matter`'s recorded
defect"). That stays a coordination question.
