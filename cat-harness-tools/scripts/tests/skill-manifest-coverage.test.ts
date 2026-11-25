/**
 * Every skill `.md` in a package is listed in that package's manifest.
 *
 * Found 2026-09-18. `skills/folio-core/` held 58 skill files and its
 * `package-manifest.json` listed 49. The nine unlisted ones — among them
 * `directory-conventions`, `process-state` and `swarm-management`, all added
 * days earlier — were on disk and reachable by anyone who already knew the
 * path, and invisible to everyone else.
 *
 * That is the failure mode worth naming, because it does not look like one.
 * `scripts/generate-registry.ts` builds the skill registry from
 * `loadPackageManifests()`, so the manifest is what an agent asking the
 * knowledge graph for a skill actually sees. A file omitted from it is not
 * broken, not red, and not missing — it is simply never offered. The author
 * who added it can still open it, which is exactly why nobody notices.
 *
 * Nothing checked the two against each other before this test: the manifest is
 * hand-maintained and adding a skill is two steps, of which only the first has
 * any feedback.
 *
 * Direction matters, and the two directions are not in the same state.
 *
 * A file with no manifest entry is unreachable; that check is hard.
 *
 * A manifest entry with no skill behind it is a dangling reference the registry
 * will publish. **19 when this test was written, then 8, now 0**, and the two
 * steps down had different causes worth keeping apart.
 *
 * Bean `x180` wrote the eleven missing instruction bodies. Bean `nup0` resolved
 * the remaining eight — and found that the check itself had been asking the
 * wrong question. *
 * **"A skill exists" was two different questions.** This file asked whether
 * `<package>/<name>.md` was present. `scripts/known-skills.ts` — extracted
 * precisely so checkers could not disagree about this — also counts
 * `schemas/skills/<name>/`, a directory of input/output JSON schemas with no
 * instruction body. Eleven of the nineteen "dangling" entries were skills that
 * exist by the shared definition and not by this file's narrower one, and
 * `docs/concepts/skills.md` documents them as deliberate: those packages "ship the
 * manifest + JSON definitions" with bodies TBD.
 *
 * So this now uses `knownSkills()`. Two definitions of existence in one
 * repository is the defect; the checker that disagreed with the shared one was
 * this file.
 *
 * What remained were eight entries, all FIXED rather than pinned: four were a
 * completed rename whose manifest never moved, one claimed another package's
 * skill, and three named skills that `git log --diff-filter=A` shows were never
 * added in any commit.
 *
 * ## One reading was overturned, and the evidence is worth recording
 *
 * The 8-entry version of this list called `authoring-document` a deliberate
 * **bundle manifest** — a package that legitimately lists skills held
 * elsewhere — and treated resolving it as a modelling question.
 *
 * It is not a pattern this repository has. Measured across all six packages:
 * every other one lists **exactly** what it holds, `folio-document-adapter`
 * held the four bodies with **no manifest of its own**, and both
 * `known-skills.ts` and `gen-skill-docs.ts` list `folio-document-adapter` as a
 * live package while neither mentions `authoring-document`. "Bundle manifest"
 * appears nowhere in the codebase outside that note.
 *
 * So it was a rename whose manifest never moved, and consolidating it makes the
 * corpus uniform: after `nup0`, **no package claims a skill it does not hold**.
 * If bundling is wanted as a real concept, it needs a field that says so rather
 * than an empty directory that looks like one.
 *
 * ## The other half of that reading, added 2026-09-19
 *
 * The three entries this file's `knownSkills()` switch surfaced —
 * `scientific-visualization`, `hypothesis-generation`,
 * `scientific-critical-thinking` — ARE declared, by
 * `folio-assistant-sci/skills/remote-packages/claude-scientific-skills.json`, and `kg-audit.ts`
 * accepted that as resolution. So for two hours the two checkers disagreed:
 * this one said delete, the audit said keep, and the corpus followed whichever
 * ran last.
 *
 * Measured, and this file was right: nothing in the repository syncs or serves a
 * remote package — `shallow-clone` is a Zod enum value, neither
 * `src/tools/skill-fetch.ts` nor `scripts/generate-registry.ts` reads that
 * directory, and the one real consumer reads it for Docker requirements. The
 * audit's allowance has been closed, so the two now agree by construction.
 * `scripts/tests/manifest-remote-resolution.test.ts` holds that argument and the
 * evidence it rests on.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { knownSkills } from "../known-skills.js";
import { packageDirsIn } from "../skill-topics.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const SKILLS = join(HARNESS_ROOT, "skills");

/** Not skills: companion modules, the manifest itself, package metadata. */
function skillFilesIn(pkgDir: string): string[] {
  return readdirSync(pkgDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
}

function packages(): Array<{ name: string; dir: string; listed: string[] }> {
  if (!existsSync(SKILLS)) return [];
  const out: Array<{ name: string; dir: string; listed: string[] }> = [];
  // Topic-aware (bean 9umr): a one-level readdir skipped every package inside
  // a topic directory, so their manifests went unchecked.
  for (const { name, dir } of packageDirsIn(SKILLS)) {
    const manifest = join(dir, "package-manifest.json");
    if (!existsSync(manifest)) continue;
    const parsed = JSON.parse(readFileSync(manifest, "utf-8")) as { skills?: string[] };
    out.push({ name, dir, listed: parsed.skills ?? [] });
  }
  return out;
}

/**
 * Manifest entries with nothing behind them. **Empty, and it should stay that
 * way** — bean `nup0` cleared all nineteen. Kept as a list rather than deleted
 * so a future entry is added here consciously, with the reason, instead of the
 * check being loosened.
 */
const KNOWN_DANGLING: readonly string[] = [];
describe("skill package manifests cover the package", () => {
  test("there are packages to check — otherwise this suite proves nothing", () => {
    // Without this, a rename of `skills/` turns every assertion below into a
    // vacuous pass over an empty list, which is the defect being guarded
    // against wearing a green tick.
    expect(packages().length).toBeGreaterThan(3);
  });

  test("every skill file is listed in its package manifest", () => {
    const unlisted: string[] = [];
    for (const p of packages()) {
      const listed = new Set(p.listed);
      for (const s of skillFilesIn(p.dir)) {
        if (!listed.has(s)) unlisted.push(`${p.name}/${s}.md`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  test("no manifest lists a skill TWICE — the complement of coverage", () => {
    // Bean `m1k4`. The coverage test above asks "is this skill listed?" and
    // answers it with `new Set(p.listed)` — which is exactly right for that
    // question and STRUCTURALLY CANNOT answer "is it listed once?", because
    // the Set collapses the duplicate before the assertion runs. So this is
    // the complement of the coverage question, not a widening of it.
    //
    // ## Both duplicates were created by MERGE COMMITS, and one was mine
    //
    // Measured on `main` 2026-09-26, by walking each file's history:
    //
    //   folio-core / decision-methodology-selector
    //     7296cb442fe  added it (this session, porting a base-branch fix)
    //     5286dea8ea7  added it (a sibling, same fix, same day)
    //     9e6ddb41b7e  MERGE -> 2
    //
    //   workflow / release-epic-planning
    //     1b962ab310c  added it (#1364)
    //     11a2186b4d8  added it (#1383)
    //     cf466e2ba8a  MERGE -> 2
    //
    // Two sessions each append the same correct entry; git appends both array
    // elements; nothing rejects the result. The merge that produced the first
    // one shipped in a commit claiming 152/154 gates and 700 e2e passing —
    // true, and useless, because no gate could see it. That is why this test
    // exists rather than a review habit.
    const duplicated: string[] = [];
    for (const p of packages()) {
      const seen = new Set<string>();
      for (const s of p.listed) {
        if (seen.has(s)) duplicated.push(`${p.name}/${s}`);
        else seen.add(s);
      }
    }
    expect(duplicated.sort()).toEqual([]);
  });

  test("each manifest's `skills` list is SORTED — the convention that is instructed", () => {
    // WHY THIS IS A GATE AND NOT A STYLE NOTE. Bean `kfkh`: an unenforced order
    // is what lets two sessions insert the same entry at different INDICES, so
    // git sees two independent additions and keeps both. Enforcing the order
    // turns that into an ordinary conflict, which a person resolves, instead of
    // a silent duplicate the test above then has to catch after the fact.
    //
    // The convention is already INSTRUCTED, in two places — `skill-register.ts`
    // prints "Add the slug to its `package-manifest.json` `skills` list, sorted"
    // and `skills/kg/kg-core/skill-registration.md` says "you add the slug,
    // sorted". Measured 2026-09-27: 6 of the 22 manifests carrying a `skills`
    // array did not obey it. An instruction nothing checks is an instruction
    // that drifts, and `kfkh` asked for it to be enforced or dropped; dropping
    // would mean deleting a correct instruction from two places.
    const unsorted: string[] = [];
    for (const p of packages()) {
      const sorted = [...p.listed].sort();
      if (p.listed.join("\u0000") !== sorted.join("\u0000")) {
        const at = p.listed.findIndex((s, i) => s !== sorted[i]);
        unsorted.push(`${p.name}: ${p.listed[at]} should come after ${sorted[at]}`);
      }
    }
    expect(unsorted.sort()).toEqual([]);
  });

  test("no NEW manifest entry is missing its skill file", () => {
    const dangling: string[] = [];
    const known = knownSkills(join(HARNESS_ROOT));
    for (const p of packages()) {
      // The shared definition — `<name>.md` in a skill directory OR an
      // input/output contract under `schemas/skills/<name>/`. Asking only the
      // first question is what produced eleven false "dangling" entries.
      for (const s of p.listed) {
        if (!known.has(s)) dangling.push(`${p.name}/${s}`);
      }
    }
    expect(dangling.sort()).toEqual([...KNOWN_DANGLING].sort());
  });

  test("the known-dangling list has no entry that is now resolved", () => {
    // The ratchet's other half. Without it, fixing one of the 19 turns the
    // test above red and the cheapest way out is to re-add the broken entry.
    const live = new Set<string>();
    const known = knownSkills(join(HARNESS_ROOT));
    for (const p of packages()) {
      for (const s of p.listed) if (!known.has(s)) live.add(`${p.name}/${s}`);
    }
    const stale = [...KNOWN_DANGLING].filter((k) => !live.has(k));
    expect(stale).toEqual([]);
  });
});
