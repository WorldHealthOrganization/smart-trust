---
name: bootstrap-contract-semver
description: >
  What MAJOR, MINOR and PATCH mean for bootstrap's PUBLISHED schemas and graph,
  and why the bump is computed from a diff of the generated documents rather
  than asserted. Read before changing any Zod that bootstrap's
  `schemas/*.schema.json` are generated from, and before publishing one.
---

# Bootstrap contract semver

The bump bootstrap's published schemas require is **computed** from a diff of
the generated schemas, never asserted. It answers the question a third party
following one of bootstrap's `$id`s has: **will a document that validated
yesterday fail today?** It is not the version of a layer as a whole.

## Why this needs its own rules

bootstrap's `schemas/*.schema.json` sit at `$id`s that are published and
cited: from `discussion.bpmn`, from the generated skill docs and from `.pot`
catalogues in five languages. Their contract is **what validates**, and a
change moves the set of accepted documents in one of two directions: it grows,
or it shrinks. The direction decides the bump.

## The rules

| bump | the change | examples |
|---|---|---|
| **MAJOR** | something that validated at the base can now **fail** | a field removed from a closed object; a field made required; a type, enum or bound narrowed; a `pattern` or `format` added; **strictness tightened** (`additionalProperties: false` added); a conditional (`allOf` branch) added; a `$id` or `$schema` changed; a schema withdrawn |
| **MINOR** | only **widens** — everything that validated still does | an optional field added; a required field relaxed; a type, enum or bound widened; `additionalProperties: false` removed; a new schema published |
| **PATCH** | **what validates is unchanged** | `title`, `description`, `$comment`, `examples`, `default`; key order, indentation and other format-neutral changes |

Two consequences that read wrong at first:

- **Adding a field can be MAJOR.** Adding it to `required` is; adding it as
  optional is MINOR. The field and its required-ness are graded separately.
- **Tightening strictness is MAJOR even though it "only" catches typos.** Once
  a producer exists, it rejects a document that validated, whatever the
  intent.

**A `$id` moving to the next release is not a change.** bootstrap mints each
`$id` from its declared iriBase and the MAJOR of its version
(`…/bootstrap/v<major>/…`), so a minor or patch release leaves it as it is,
and a new major moves it. The classifier blanks the release segment
(`v<major>`, or a full version) before comparing; any OTHER change to a `$id`
repoints consumers and is MAJOR.

A keyword the classifier does not recognise is graded **MAJOR**. A change that
cannot be proved harmless is not called harmless.

## The bump is computed, never asserted

```sh
bun run semver                     # against origin/main
bun run semver -- --base <ref>     # against any commit-ish
bun run semver -- --root <dir>     # the bootstrap checkout at <dir>
```

[`scripts/schema-semver.ts`](../scripts/schema-semver.ts) diffs each generated
`bootstrap/schemas/*.schema.json` against the same file at the base and prints
the bump each one requires, with every graded change and its location.

It has a **fourth answer, `could not determine`**, when the base cannot be read
— no such ref, no git, a file that will not parse. It exits non-zero and says
so. It never falls back to "patch", which would report "nothing important
changed" for a change nobody looked at.

The diff is over the **generated JSON Schema**, not the Zod. Zod is one
authoring tool and may be replaced; the published document is the contract,
so it is what gets graded.

## Where it sits in the render pipeline

1. Change the Zod under `bootstrap-tools/schemas/`, where bootstrap's Zod
   lives.
2. `bun run schemas` — regenerate. The `--check` twin is a gate.
3. `bun run validate` — parse bootstrap's own documents against the Zod. A
   schema change that breaks a document bootstrap itself carries is caught
   here, before any consumer sees it.
4. `bun run semver` — read the required bump. **MAJOR needs the owner's
   say-so before merge**: it breaks a promise to whoever follows the `$id`,
   and the published `$id` does not change with it.
5. Publish — the site build copies the documents to their `$id`s.

## What this does not cover

- **The graph document's bump.** Its schema is `GraphExportSchema`, beside
  `export-graph.ts`, and `validate` builds and parses it. But it is built at
  deploy time with no committed base to diff against, so `semver` does not
  grade it; its bump is `could not determine` by construction. Do not report
  it as unchanged.
- **Which version number gets written.** This computes the minimum bump; it
  does not write a version, and an author may always bump further.
