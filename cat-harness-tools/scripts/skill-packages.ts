/**
 * Which skill packages this checkout can serve, discovered from the declared
 * knowledge-graph directories.
 *
 * @module scripts/skill-packages
 * @covers cat-harness
 *
 * Shared by `scripts/kg-audit.ts`, the workflow engine's `loadRelaxations` and
 * `src/tools/skill-fetch.ts`, which import it from here rather than from a
 * Tool.
 */
import { readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { isSkillMd, kgRoots, corpusScopeFor, type CorpusScope } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { resolveSkillDirs } from "../schemas/kg/harness-config.js";
// The `folio` graph typology is registered by CORE. This module is a LIBRARY, so it
// does NOT import that registration: a library's edge is inherited by every
// module that imports it, and the harness may not depend on core. The
// COMMAND that runs carries it — and since #840 every caller does, because
// the trigger sits at the foot of `cat-harness.ts` and a reader lives in that
// module, so loading it is a precondition of calling one.
//
// THIS COMMENT NAMED `check:composition-roots` AS THE GUARANTEE UNTIL
// 2026-09-22, in SEVEN files, AND THAT SCRIPT DOES NOT EXIST. `bun run
// check:composition-roots` exits "Script not found". The safety argument for
// a library omitting the registration rested on a gate nobody built, and no
// gate failed to say so — the same silence this repository keeps paying for.
// It is moot now rather than fixed: #840 made the registration automatic, so
// there is no longer a command that can forget it (bean `z9ax`).
import { readDeclaration, findInstanceRoot } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** A directory is a skill PACKAGE when it directly holds at least one skill `.md`. */
export function holdsSkill(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".md") && isSkillMd(join(dir, f)));
  } catch {
    return false;
  }
}

/**
 * Every servable skill package, discovered from the DECLARED knowledge-graph
 * directories rather than listed by hand.
 *
 * ## Why discovered, and why it took until now
 *
 * This was a hardcoded table, and the cost of that is on the record: a package
 * missing from it is a package `skill_fetch` answers "not found" for, which is
 * how `content-lifecycle` — named by **52** `<bootstrap.processes:skill ref>` activities —
 * was unservable until 2026-09-18.
 *
 * It is discovered through {@link resolveSkillDirs}, which reads each
 * layer's declaration, so a DEPENDENCY's packages are served too. That is
 * the overlay `AGENTS.md` describes as outstanding Phase 0.1 work.
 *
 * ## The filter is the whole design
 *
 * A naive scan of the declared directory is measurably wrong. Taken plainly it
 * adds seven non-package directories — `roles`, `workflows`, `permissions`,
 * `requirements`, `framework`, `remote-packages` and `memory` — and `memory`
 * is the one already on the record for making `kg-audit` write **25 bogus
 * sidecars** against agent-memory nodes that are not instruction bodies.
 *
 * That list is the 2026-09-19 MEASUREMENT and is kept as measured. Three of
 * the seven have since left `skills/` — `roles` and `workflows` became the
 * sibling `scenarios/` and `processes/` on 2026-09-21, and `memory` became a
 * declared directory of its own — so a scan today meets fewer of them. The
 * argument is unaffected and is the reason not to re-derive it: the filter
 * exists because a directory's CONTENTS declare what they are, which is what
 * makes it hold when the layout moves under it.
 *
 * {@link isSkillMd} is what excludes them, and it is **declaration over
 * location**: a markdown file carrying `$schema:` is stating that it is
 * something else. With that filter, discovery reproduces the hand-written
 * table exactly — measured 2026-09-19, no gain and no loss — which is the
 * evidence that this is a refactor and not a behaviour change.
 *
 * ## Later entries win, and that is the overlay order
 *
 * `resolveSkillDirs` returns deepest-dependency-first with the root last, so
 * assigning in order means a root package of the same name overrides a
 * dependency's. Same rule the directory declaration uses, one level down.
 */
export function discoverLocalPackages(root: string, scope?: CorpusScope): Record<string, string> {
  const out: Record<string, string> = {};
  // Collected first and named in a SECOND PASS, because which directly-held
  // directory gets the layer name depends on how many there are — see
  // `nameDirectlyHeld`. Deciding it inline made the answer depend on
  // iteration order, which is the defect rather than the implementation.
  const held: string[] = [];
  // The overlay (dependencies, then this layer), and on the platform's own
  // run the CORPUS stacked on it — which the 19 `scope: "repository"` mirrors
  // supplied until placement PR0 (bean `ejye`), so core's, sci's and the
  // others' packages stay servable from here with the arrow the right way round.
  // When `scope === "instance"` (bean `t5zb`), only `root`'s OWN declared skill
  // directories are read, never its `needs` overlay or sibling layers.
  const kgDirs =
    scope === "instance"
      ? [...new Set(kgRoots(root, "instance").map((d) => resolve(d)))]
      : [...new Set([...resolveSkillDirs(root), ...kgRoots(root, scope ?? corpusScopeFor(root))].map((d) => resolve(d)))];
  for (const kgDir of kgDirs) {
    // A kg directory may hold skills DIRECTLY as well as in subdirectories,
    // and BOTH shapes are real: `skills/` holds none directly and every
    // package is a subdirectory, while `bootstrap/skills/` and
    // the IRIS replica's `skills/` hold theirs at their root with no subdirectory.
    //
    // The worked example through the rest of this comment is `src/skills/`,
    // which held `corpus-grep.md` beside the `.ts` implementing it. It is GONE
    // as of #760 — `skills/folio-core/` already co-located eight such pairs,
    // so the separate directory bought nothing and cost a name: this function
    // called it `cat-harness` while the declaration gave that id to `skills/`.
    // The history below is kept because the RULES it explains are unchanged
    // and were paid for; only their subject moved.
    //
    // A directly-held set is the LAYER's own package, named after the
    // layer, because that is what it is — there is no subdirectory name to
    // take. Before `src/skills/` was declared this was a hand-written
    // exception in this file; now it falls out of the declaration.
    //
    // NAMED BY THE LAYER THE DIRECTORY LIVES IN, not by the caller's root.
    // `readDeclaration(root)` gave the ROOT's name to every directly-held set
    // regardless of which layer contributed it, which is correct only while
    // exactly one such directory is ever discovered. The moment a second one
    // is — `bootstrap/skills/`, once `ownDirectories` resolved its declared
    // repository scope — both are assigned the same key and the later wins.
    // Not an error, not a collision report: bootstrap's skills would have
    // been found and then silently dropped, which is the same `dh4f` shape one
    // layer up from the one that hid them in the first place.
    //
    // `findInstanceRoot` walks to the nearest enclosing declaration, so the
    // name is a property of where the skills live rather than of who asked:
    // `src/skills/` → `cat-harness/harness.json` → `folio-assistant`,
    // unchanged and measured; `bootstrap/skills/` → `bootstrap/harness.json`
    // → `bootstrap`. A directory under no declaration at all is skipped rather
    // than guessed at.
    //
    // ...AND THE LAYER NAME IS TAKEN BY THE `skills` DIRECTORY ALONE.
    // The paragraph above fixed the CROSS-instance half of this collision and
    // left the within-instance half, which `1hvo` walked straight into:
    // `cat-harness` declares `src/skills/` AND now `theming/`, both hold their
    // skills directly, both resolved to the name `folio-assistant`, and the
    // later won — theming's six skills were found and silently dropped, with
    // `kg:audit` reporting all six as `manifest-skill-exists` criticals. The
    // same `dh4f` shape the paragraph above describes, one scope in.
    //
    // Resolved BY A RULE rather than by first-wins, because first-wins is the
    // defect: whichever directory `resolveSkillDirs` happened to yield last
    // took the name. A directory basenamed `skills` IS the layer's own
    // package — there is no other name for it — so it takes the layer name;
    // any other directly-held directory takes its own basename, which is what
    // a person calls it anyway. `src/skills/` stayed `folio-assistant` and
    // `bootstrap/skills/` stays `bootstrap`, both measured unchanged
    // at the time; `theming/` becomes `theming`. Since #760 removed
    // `src/skills/`, the live subjects of rule 1 are `bootstrap/skills/` and
    // the IRIS replica's `skills/` — `kg-navigation/skills/` was one until bean `byql`
    // folded it into `skills/kg/kg-navigation/`, and `large-datasets/skills/`
    // until bean `j7ql` dissolved it into `skills/library/large-datasets/`.
    //
    // Two `skills`-named directly-held directories in ONE layer would still
    // collide. That is a narrower and more obviously wrong configuration than
    // the one this fixes, and inventing a disambiguator for it now would be a
    // rule with no subject.
    if (holdsSkill(kgDir)) held.push(kgDir);
    // One level, or two inside a topic `skills.json` declares (bean `9umr`).
    for (const p of packageDirsIn(kgDir)) {
      if (holdsSkill(p.dir)) out[p.name] = p.dir;
    }
  }
  Object.assign(out, nameDirectlyHeld(held));
  return out;
}

/**
 * Name the directly-held kg directories, in one pass over all of them.
 *
 * ## Why this cannot be decided one directory at a time
 *
 * Three rules, and the third needs the whole set:
 *
 * 1. A directory basenamed **`skills`** is the layer's own package — there
 *    is no other name for it — so it takes the layer's name. `src/skills/`
 *    stays `folio-assistant`; `bootstrap/skills/` stays `bootstrap`.
 * 2. Otherwise, if it is the layer's **only** directly-held directory, it
 *    takes the layer's name, because there is nothing to disambiguate it
 *    from and the layer's name is the better one.
 * 3. Otherwise it takes its **basename** — `theming/`, `skills/process/crdm/`.
 *
 * Rule 2 is the one that needs the set, and stating it as "unique" rather than
 * "first" is the whole point: FIRST-WINS was the defect. `cat-harness`
 * declared `src/skills/`, `theming/`, `sdlc/skills/crdm/` (now
 * `skills/process/crdm/`, cat-harness#1266) and
 * `skills/process/raci/` — four directly-held directories, all resolving to the
 * name `folio-assistant`, with the last assignment winning. Measured on
 * 2026-09-20 (bean `1hvo`): three packages were found and silently dropped,
 * `kg:audit` reported six `manifest-skill-exists` CRITICALs for theming alone,
 * and 27 further MAJORs were CRDM activities whose skills nothing could serve.
 * No collision was reported and nothing threw — `dh4f` one scope in from the
 * cross-instance half the caller's docs describe.
 *
 * Two `skills`-basenamed directories in ONE layer would still collide. That
 * is a narrower and more obviously wrong configuration, and inventing a
 * disambiguator for it now would be a rule with no subject.
 */
function nameDirectlyHeld(dirs: readonly string[]): Record<string, string> {
  const instanceOf = new Map<string, string | undefined>();
  for (const dir of dirs) {
    const r = findInstanceRoot(dir);
    // A directory under no declaration at all is skipped rather than guessed
    // at, exactly as before.
    instanceOf.set(dir, r === undefined ? undefined : readDeclaration(r)?.name);
  }
  const count = new Map<string, number>();
  for (const name of instanceOf.values()) {
    if (name !== undefined) count.set(name, (count.get(name) ?? 0) + 1);
  }
  const out: Record<string, string> = {};
  for (const dir of dirs) {
    const name = instanceOf.get(dir);
    if (name === undefined) continue;
    const base = basename(dir);
    out[base === "skills" || count.get(name) === 1 ? name : base] = dir;
  }
  return out;
}

// EXPORTED because reachability is not a property of a manifest: a skill is
// reachable when something can SERVE it. `scripts/kg-audit.ts` reads this table
// rather than keeping its own copy, so a package added here cannot be reported
// as unreachable, and one removed here cannot pass.
export const LOCAL_PACKAGES: Record<string, string> = discoverLocalPackages(
  resolve(HARNESS_ROOT),
);
