---
# folio-assistant-mcdj
$schema: bean/1.0.0
title: The 20 kg witnesses each copy the auditor hash the manifest already holds, so one auditor edit still rewrites 21 files
status: completed
type: task
priority: normal
created_at: 2026-09-23T17:21:08Z
updated_at: 2026-09-24T06:32:51Z
parent: folio-assistant-1swy
---

The residue `cflw` named and said *"wants its own bean"*. This is it, with the
number re-derived rather than inherited.

## Measured 2026-09-23, with `cflw`'s own probe

Append one comment line to `scripts/kg-audit.ts`, then:

| run | files changed |
|---|---|
| `bun run cat kg:audit` alone | **2** — the probe itself, and `skills/kg-qa.manifest.json` |
| `bun run cat regen` (43 verify/write pairs) | **2** — same |
| …then `bun run gen-docs-pages.ts` | **24** |

So an auditor-only edit costs **21 files besides the edit**: the manifest plus
**20** `qa-witness/v1` kg witnesses under `test/results/witnesses/`. That is
`cflw`'s stated residue, confirmed at its stated size.

**Down from 218, and the remaining 21 are one value copied 21 times.**
`content/pipeline/qa-witness.ts:565` reads the auditor from the manifest —
`readJson<KgQaManifest>(KG_QA_MANIFEST_PATH)?.auditor` — and line 582 writes
`scriptHash: auditor?.script_hash` into **every criterion of every kg witness**.
The manifest is already the single source; the witnesses are 20 projections of
it, so they cannot carry information it does not, which is `cflw`'s own sentence:
*"the per-file auditor hash never added precision the generator could deliver."*

## A trap for the next reader, and it caught me

The same fact is spelled two ways in two artefacts:

| artefact | key |
|---|---|
| `skills/kg-qa.manifest.json` | `script_hash` |
| `test/results/witnesses/**/*.kg.json` | `scriptHash` |

`grep -rl script_hash --include='*.kg.json'` returns **0**, and I read that as
*the residue is already gone* and nearly closed `cflw` on it. It is not gone —
`grep -rl scriptHash` returns **20**. A grep-and-stop reading here returns the
opposite of the truth, which is why the probe above runs the generator instead
of searching for a string.

## Why this is NOT the neighbouring beans

- **Not `cflw`.** That one is done at the level it claimed: 218 → 21, by moving
  the auditor's identity into the manifest. This is its named leftover.
- **Not `v556`.** That is a **third** family, `qa-results/v1`, with two sidecars
  and a different remedy surface. `cflw` does not name it; this does not either.
- **Not `nytj`.** That family is an artefact *recorded but not in force*. This is
  artefacts **colliding** — same root cause, committed derived state, different
  remedy.

## The question `cflw` asked first, and it should still be asked first

> *"Whether `test/results/witnesses/` needs to be committed at all is a separate
> question: it is derived from the sidecars plus the manifest, and the docs site
> regenerates it at publish time. If it does not need committing, the residual 20
> goes to 0 without touching the shared schema. **Worth asking before touching
> the schema.**"*

Still right, and the reason is stronger now that the mechanism is traced: the
cheap fix and the shape-changing fix are different sizes.

| option | cost | what it loses |
|---|---|---|
| **A — stop committing the 20** | no schema change; one `.gitignore` line and whatever reads them at publish time | a reviewer can no longer see a kg verdict in a diff |
| **B — omit `scriptHash` on the kg branch only** | one line in `qa-witness.ts`; the field stays optional and the block family keeps it | the panel loses a per-criterion hash that was the same 20 times |
| **C — leave it** | nothing | 21 files churn per auditor edit, and every open branch is invalidated |

**B is the narrow one and does not touch the shared shape**: `qa-witness/v1` is
shared with the **block** family, where per-criterion script hashes are REAL
information (`qa-checkers-voice.ts` and `qa-checkers-extended.ts` are genuinely
different scripts on different criteria of one block — measured: **113** block
witnesses carry `scriptHash`). Making the field optional-and-unset on the kg
branch leaves that untouched. It does mean the docs QA panel must read the
auditor from the manifest for kg subjects, which is the e2e surface `cflw`
flagged.

**Not choosing here.** A is cheaper and answers a question nobody has put; B is
narrower and costs a panel change. Both are the owner's, and the wrong order —
changing the schema before asking whether the files need committing — is the one
`cflw` explicitly warned against.

## 2026-09-23 — the prior question is ANSWERED: the published site does not need them

The owner ruled the ORDER: establish whether the witnesses need committing
before touching the shared schema. Established, from the workflows and the
generator rather than from reasoning about them.

### The site regenerates them; it does not serve the committed copies

`docs-site.yml` runs `gen-docs-pages.ts` at **line 140** and copies
`test/results/witnesses/` into `_site/assets/qa/` at **line 532** — generator
first, same job. `feature-staging.yml` is the same shape (204, then 893). So
what a reader fetches is **regenerated at publish**, never the committed bytes.

`gen-docs-pages.ts` says so in its own header, and it is right:

> *"`docs-site.yml` and `feature-staging.yml` both run this generator in full
> before copying `test/results/witnesses/` into `_site/assets/qa/`, so the
> projections a reader actually fetches are regenerated at publish. **The
> committed copies are a cache for local work and for review.**"*

**A correction I am keeping.** My first reading of `docs-site.yml` stopped at the
`cp -rT` and concluded the committed copies ARE the published artefact, so
option A would 404 every badge. That was wrong — I had read the copy step and
not looked for what ran before it, which is the grep-and-stop failure this bean
already records once, in a second form. The workflow line numbers above are the
check I should have run first.

### So the committed copies buy exactly two things

1. **A reviewer can see a kg verdict move in a diff.** Real, and the reason this
   is a question rather than a deletion.
2. **`d2kp`'s existence gate.** `emit(..., "verdict")` gates these on EXISTENCE
   only and deliberately not on contents — *"a missing file IS an omission: the
   badge would point at a 404 forever"*. That guard catches a generator that
   stopped emitting, and it needs a committed file to exist.

**Their contents are gated by nothing.** `d2kp` is explicit that gating them
could only ever fire on a graph that changed. So the 20 files churn on every
auditor edit while no check reads what is in them, and the site never sees them.

### What that does to the three options

| option | now known |
|---|---|
| **A — stop committing** | the **published site is unaffected**, proven above. Costs the diff-review benefit AND `d2kp`'s existence guard, which would need somewhere else to live |
| **B — omit `scriptHash` on the kg branch** | **not free**: `docs-ui.js:7312-7314` renders it as a *"checker source hash"* field, so the panel must read the manifest for kg subjects instead. Exactly the e2e surface `cflw` flagged |
| **C — leave it** | 21 files churn per auditor edit, and every open branch touching the graph is invalidated |

**Still not choosing.** A is cheaper than it looked and costs a guard nobody has
re-homed; B is narrower and costs a panel change. Both are the owner's, and both
are now informed rather than guessed.

## 2026-09-24 — the owner ruled B, and it is done: 21 files become 1

**Ruling: B — omit `scriptHash` on the kg branch only.**

### 21 → 1, measured with `cflw`'s own probe

Append one comment to `scripts/kg-audit.ts`, run `kg:audit` then
`gen-docs-pages.ts`:

| | before | after |
|---|---|---|
| files changed besides the edit | **21** | **1** — the manifest |
| kg witnesses carrying `scriptHash` | 20 | **0** |

That is `cflw`'s Done-when verbatim — *"an auditor-only edit changes one file.
Currently 21; 1 after the residue above is resolved."*

### A document-level copy would NOT have fixed it

Worth writing down because it is the obvious first design and it is wrong. One
hash per witness file instead of one per criterion is still one per file, and
all 20 still move together when the auditor does. **The churn goes away only
when the witness stops carrying the value at all.** `QaWitnessDoc` gained no
field; the kg branch simply omits one.

`id` and `version` stay. They are stable strings — `scripts/kg-audit.ts`, `"1"` —
that do not move when the script's bytes do, so the witness can still say WHO
ruled without saying which build of them.

### The block family is untouched, and that was the constraint

`qa-witness/v1` is shared, and there the per-criterion hash is **real
information**: `qa-checkers-voice.ts` and `qa-checkers-extended.ts` are
genuinely different scripts ruling on different criteria of one block. **113**
block witnesses carry `scriptHash` and still do. The field stays optional on
`QaWitness` for exactly this reason, and the existing panel spec that asserts a
block's checker hash still passes.

### The reader loses nothing — the panel asks the manifest once

`docs-ui.js` gains `qaWithKgAuditor`: for a `family === "kg"` document it
fetches `assets/qa/kg-qa.manifest.json` **once**, cached per URL, and fills the
hash in before the panel renders. The manifest is now published beside the
witnesses by **both** `docs-site.yml` and `feature-staging.yml` — mirrored,
because a test asserts they are and publishing it in one would give two
different sites.

**A failed manifest fetch is not an error.** The verdicts are the point of the
panel and are already in hand; refusing to render them because a provenance
field could not be resolved would trade the finding for the footnote. The field
falls back to `qaField`'s existing *"not recorded"*.

### Both directions are covered, and the pass is not vacuous

Two specs in `qa-panel.e2e.ts`, using the `page.route` fixture already there:

- manifest served → the panel shows the hash, asserted **by value from the
  manifest**, never as a literal. Writing the hash out would be `iumj`'s defect:
  a value the corpus holds asserted as a property of the panel, red on the next
  correct edit to `kg-audit.ts`.
- manifest 404 → the panel still renders, the criteria are visible, and the
  field reads *"not recorded"*. **The 404 is the DEFAULT** in the fixture, so
  every other kg spec exercises the fallback rather than the happy path.

`kgAuditorManifest()` **throws by name** if the manifest ever stops carrying a
hash — otherwise a spec asserting "the panel shows it" would compare against
`undefined` and pass over a panel showing nothing, which is the empty-set pass
`iumj` records finding twice.

**Mutation-checked rather than assumed.** Disabling the enrichment
(`if (true) return doc`) turns the served-manifest spec **red** and leaves the
404 spec green — so the pass is evidence, not coincidence. 9 of 9 with it
restored; `bun run cat gates` 136 of 136.

## Done when

- [x] The prior question is answered with evidence, not reasoning: the published
      site regenerates the witnesses and does not serve the committed copies
      (`docs-site.yml` 140 then 532; `feature-staging.yml` 204 then 893)
- [x] The owner has ruled between A, B and C — asked as selectable options, with
      this measurement, not as a description of the code. **A is cheaper than it
      read and costs `d2kp`'s existence guard; B costs a panel change at
      `docs-ui.js:7312`**
- [x] Whichever is chosen is measured with the same probe: an auditor-only edit
      changes **1** file — measured 2026-09-24, down from 21
- [x] The `script_hash` / `scriptHash` spelling trap is closed for the kg family
      by construction: no kg witness carries `scriptHash` at all now, so the
      grep that returned the opposite of the truth returns 0 and is RIGHT. It
      is recorded in `qa-witness.ts` at the omission and in `cflw`, because the
      manifest still spells it `script_hash` and the block family still spells
      it `scriptHash`
