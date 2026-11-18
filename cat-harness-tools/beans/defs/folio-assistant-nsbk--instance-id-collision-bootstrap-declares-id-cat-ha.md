---
# folio-assistant-nsbk
$schema: bean/1.0.0
title: 'INSTANCE ID COLLISION: bootstrap declares id ''cat-harness'' too, so its 5 skills are dropped from the overlay and unreachable'
status: completed
type: bug
priority: high
created_at: 2026-09-22T13:54:27Z
updated_at: 2026-10-09T11:35:00Z
parent: folio-assistant-1swy
---

_2026-09-22T14:00:00Z_ — Found while fixing `oe98`'s dead links. `oe98` went 262 non-resolving → 5, and the last 5 would not move. They are not a link defect at all; they are the visible edge of this.

## The collision

Two instances declare a directory with the **same id**:

    root instance   cat-harness.json   id "cat-harness"      -> skills/      => cat-harness/skills
    bootstrap       bootstrap.json     id "cat-harness"      -> skills/      => bootstrap/skills

`AGENTS.md` states the override rule outright and it is correct as designed:

> **Overrides match on the entry's `id`, not its `path`** — matching on path makes two knowledge graphs out of one relocation, and every consumer then scans a directory that is not there.

So the root's entry wins and **`bootstrap/skills` is dropped from the overlay entirely.** The mechanism is working as specified. The accident is that two unrelated directories were given one id.

Measured:

    kgDirectories(cat-harness)  ->  cat-harness -> /home/user/folio-assistant/cat-harness/skills
                                    (bootstrap/skills appears nowhere)
    skillMdDirs(cat-harness)    ->  18 dirs; the only bootstrap entry is ../bootstrap/tools

## What it costs, and one of the costs is a false claim in `AGENTS.md`

**Five real skills are unreachable.** `bootstrap/skills/` holds `bootstrap-kg-navigation.md`, `confirm-harness.md`, `discussion.md`, `log-message.md` and `root-readme.md`. They are present, current, and invisible to `skill_list` and `skill_fetch`.

That contradicts the banner in `AGENTS.md`:

> **A dependency's skills ARE reachable** — `resolveSkillDirs` … computes the cross-instance overlay and `LOCAL_PACKAGES` … is built from it, so `skill_list` and `skill_fetch` serve a dependency's packages. This entry said the opposite until 2026-09-19 — *"no caller … not yet reachable"* — and a stale gap notice is worse than none.

The general claim is right and the mechanism exists. **It is false for `bootstrap` specifically**, for this one reason, and the banner's own argument applies to itself: an agent that believes a dependency's skills are reachable will not go looking when bootstrap's are missing.

**Five orphaned pages on the published site.** `docs/reference/skill-instructions/` still carries a page for each — written when the directory was still discovered, never regenerated since (mtime 06:05, hours older than every sibling), and never pruned. They are the 5 pages `oe98` cannot fix: their `../bootstrap/skills` prefix comes from `skillMdDirs` returning a path that climbs out of the instance, and no live group produces them any more.

**The generator cannot see this.** `gen-skill-docs.ts` guards *collisions* — two groups claiming one published name, which it fails the run over, writing mode included, on the stated reasoning that *"dropping a document is not a staleness problem that a re-run fixes"*. It has no equivalent for the inverse: a page it no longer produces. `--check` compares what the generator writes against what is committed, so a file it never writes is outside the comparison entirely.

## Why it is filed rather than fixed

Renaming a declared id is a **cross-instance** change. The id is the override key, so changing either side alters what every consumer resolves, and `bootstrap` is the floor of the stack — `AGENTS.md` calls it *"what the stack rests on"*. Which side should be renamed, and to what, is a judgement about the instance naming scheme rather than a defect with one correct repair. Doing it on an agent's own initiative is exactly the speculative change this repository forbids.

Note that the SAME pair collides harmlessly on a second id: both declare `bootstrap-render`, root as `bootstrap/tools/` and bootstrap as `tools/`, which resolve to the same directory. So the override does the right thing there. That is worth knowing before anyone "fixes" the mechanism rather than the names.

## Done when

- [x] Whichever id is renamed, it is the owner's call — and the other instances are checked for the same shape rather than this one pair being fixed in isolation
- [x] `bootstrap/skills`' five skills are reachable by `skill_list` / `skill_fetch`, verified by asking for one by name rather than by reading the resolver
- [x] The five orphaned pages regenerate with resolving links, OR are removed with the owner's confirmation — never deleted on an agent's initiative
- [x] `gen-skill-docs.ts` reports a page it no longer owns, the way it already reports a dropped document. Byte-comparison structurally cannot see an unwritten file
- [x] `AGENTS.md`'s "a dependency's skills ARE reachable" is re-checked against bootstrap specifically, since the banner's own history is about a stale claim in that exact sentence

## Re-measured 2026-09-29 on main @ `35402147f55` — the premise may no longer hold

Rescued onto main from `claude/oe98-generator-prefix` (no open PR) by a
goal-review sweep. Landing the record, NOT adjudicating the bean — its author
closes it, on evidence.

The evidence as it stands today:

```
bootstrap/bootstrap.json  directory ids -> skills, schemas, scenarios,
                                           processes, models,
                                           swimlane-glossary, qa
```

**No `cat-harness` id among them**, and `resolveSkillDirs` returns 4 dirs with
`bootstrap/skills` present:

```
/home/user/folio-assistant/bootstrap/skills
/home/user/folio-assistant/folio-assistant-sci/skills
/home/user/folio-assistant/cat-harness/skills
/home/user/folio-assistant/folio-assistant-core/skills
```

So bootstrap's skills are not being dropped on main right now. Whether that is
because the collision was fixed, or because the declaration moved and the bug
is latent elsewhere, is **not** established here — one measurement of the
symptom's absence is not a measurement of the cause.

## Closed 2026-10-09

Closed on evidence following `skills/sdlc/sdlc-core/bean-coordination.md`:

### 1. Directory ID Declarations

The premise of this bug was that both `cat-harness` and `bootstrap` declared a directory with ID `"cat-harness"`, causing `bootstrap/skills` to be dropped during overlay resolution.
Verification shows this collision was resolved at the source:
- `bootstrap/bootstrap.json` (line 76) declares ID `"skills"` (`path: "skills/"`), NOT `"cat-harness"`.
- `cat-harness/cat-harness.json` (line 608) declares ID `"skills"` (`path: "skills/"`). Its description documents:
  > *"Its id is `skills`, so its qualified name is `cat-harness.skills`; it was `cat-harness` until 2026-09-23 (bean iwtn), and `resolveDirectories` still reads that id as this one. Ids are stable across a relocation, paths are not."*

Neither instance declares `"cat-harness"` as its skills directory ID.

### 2. Cross-Instance Overlay Resolution

Running `resolveSkillDirs('.')`:
```sh
bun -e "import { resolveSkillDirs } from './cat-harness/schemas/harness-config.ts'; console.log(resolveSkillDirs('.'));"
```
Output:
```
[
  "/Users/litlfred/space_cats/folio-assistant-backup/bootstrap/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/bootstrap-tools/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/cat-harness/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/cat-harness/openapi",
  "/Users/litlfred/space_cats/folio-assistant-backup/folio-assistant-core/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/fhir-harness/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/who-iris/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/folio-assistant-sci/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/smart-base/skills",
  "/Users/litlfred/space_cats/folio-assistant-backup/folio-assistant-sci/skills/lean",
  "/Users/litlfred/space_cats/folio-assistant-backup/folio-assistant-sci/skills/data"
]
```
`bootstrap/skills` is present and at the start of the overlay list (deepest-dependency-first order).

### 3. Package Discovery & Skill Reachability

Running `discoverLocalPackages('.')`:
```sh
bun -e "import { discoverLocalPackages } from './cat-harness/scripts/skill-packages.ts'; console.log(Object.keys(discoverLocalPackages('.')));"
```
Discovered packages include `"bootstrap"` (mapping directly to `/Users/litlfred/space_cats/folio-assistant-backup/bootstrap/skills`) and `"bootstrap-tools"`.

Verified that `LOCAL_PACKAGES["bootstrap"]` contains 12 skills (including `confirm-harness`, `bootstrap-kg-navigation`, `discussion`, `log-message`, `root-readme`), and skills can be fetched and read by name directly via `skill_fetch` / `LOCAL_PACKAGES`.

### 4. Tests Passed

Ran harness config and remote skills tests:
```sh
bun test cat-harness-tools/schemas/harness-config.test.ts cat-harness/scripts/tests/sync-remote-skills.test.ts
```
Result: 36 passed, 0 failed across 2 files.

Ran bean rollup check:
```sh
bun cat-harness/scripts/check-bean-rollup.ts
```
Result: 0 violations (`no bean's status is refuted by its own children`).
