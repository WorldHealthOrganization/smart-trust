/**
 * Every skill this layer can resolve is a graph node AND a published page.
 *
 * ## The defect these assert against
 *
 * Three places answer "which directories hold skills", and until 2026-09-19
 * they answered differently:
 *
 * | reader | how it decided | saw |
 * |---|---|---|
 * | `scripts/known-skills.ts` | hardcoded `SKILL_MD_DIRS` | 4 of 6 packages |
 * | `scripts/gen-skill-docs.ts` | hardcoded `GROUPS` | 4 of 6 packages |
 * | `scripts/kg-export.ts` | scanned `skills/*` | 6 of 6 |
 *
 * `authoring-math` (3 skills) and `authoring-who-smart-guidelines` (9) were
 * absent from the first two. The consequences differed, which is why only one
 * of them was visible at all:
 *
 * - **In the docs generator it was silent data loss.** All twelve instruction
 *   bodies went unpublished, and four of them — `fhir-validation`,
 *   `l2-dak-authoring`, `bpmn-authoring`, `latex-authoring` — are named by
 *   `<folio:skill ref>` in the BPMN diagrams. An agent following
 *   `workflow_next` to one of those steps got a skill whose reference page
 *   404s.
 * - **In `known-skills.ts` it was a latent false-dangling.** Nothing broke,
 *   because all twelve happened to resolve through a SECOND home: eleven have a
 *   `schemas/skills/<name>/` I/O contract, and `smart-base-tools` has
 *   `.claude/skills/local/smart-base-tools.json` (since bean `rqao`,
 *   `smart-base/skills/skill-definitions/`). Delete any one of those and
 *   `check-workflow-refs` calls a real, present skill dangling — the failure
 *   its own header says it exists to prevent.
 *
 * The lists are gone; all three now discover. These tests are what stops them
 * diverging again, and they assert the INVARIANT rather than a count, so a new
 * package does not have to be added here too.
 *
 * @module scripts/tests/skill-coverage.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { isSkillMd, knownSkills, skillMdDirs } from "../known-skills.js";
import { packageDirsIn } from "../skill-topics.js";
import { buildExport } from "../kg-export.js";
import { isPublishedSkill, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { ownElementPattern } from "../../schemas/kg/namespaces.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";
import { overlayPath } from "../lib/layer-output.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * The exported graph, built ONCE at module scope.
 *
 * Bean `sff8`. This was `await buildExport(...)` inside the test body and timed out
 * at **5312 ms** in a loaded full-suite run — the FOURTH test in this family to do
 * so, and the one that appeared immediately after the previous three were fixed.
 *
 * It is the same remedy as `activity-log.test.ts` and `kg-export.test.ts`: module
 * scope belongs to no test's timeout. Not a raised budget, which `sff8` rules out
 * because a number decays as the corpus grows.
 *
 * Worth knowing rather than repeating: fixing one of these has twice surfaced the
 * next, because the population is every test whose own work approaches the default
 * 5000 ms while inheriting it silently — ~50 of them at half the budget under load.
 * `bun run cat check:test-budgets` now NAMES them, so the next one need not be found by a red
 * run on somebody's machine.
 */
const EXPORTED = await buildExport({ baseUrl: "https://example.invalid/fa" });
const PUBLISHED = overlayPath(join(ROOT, siteDirFor(ROOT), "reference/skill-instructions"));
/** The published reference pages are written at publish and gitignored (bean w1gy F18). */
const NOT_PUBLISHED = (): boolean =>
  siteNotBuilt("the skill reference pages `skills:docs` writes at publish (gitignored)", PUBLISHED);

/**
 * Packages under `skills/` that hold at least one SKILL `.md`, read from disk.
 *
 * The `.md` test alone was not enough and was falsified the day it was
 * written: `skills/memory/` then held 25 agent-memory nodes, every one a `.md` and
 * none a skill, so this reported `memory` as a package and the test below
 * demanded 25 published reference pages for it.
 *
 * It shares {@link isSkillMd} with `known-skills.ts` — the per-FILE contract —
 * while keeping its own directory walk, which is what this test is actually
 * for: catching a package list that stopped tracking the filesystem. Copying
 * the file-level rule instead would recreate the two-definitions-that-agree-
 * by-coincidence defect `known-skills.ts` exists to prevent.
 */
function packagesOnDisk(): string[] {
  const root = join(ROOT, "skills");
  if (!existsSync(root)) return [];
  // Through the topic-aware walk, so a package inside a declared topic
  // (`skills/kg/graph-management/`, bean `9umr`) is on disk too. Keyed by the
  // path under `skills/`, which is what `skillMdDirs` yields after its root.
  return packageDirsIn(root)
    .filter((d) => readdirSync(d.dir).some((f) => f.endsWith(".md") && isSkillMd(join(d.dir, f))))
    .map((d) => d.rel)
    .sort();
}

describe("skill coverage", () => {
  test("every skill package on disk is discovered, not listed", () => {
    // The assertion is set equality against the FILESYSTEM, so adding a package
    // needs no edit here — which is the property a hardcoded list cannot have
    // and the reason two packages went missing for as long as they did.
    const discovered = skillMdDirs(ROOT)
      .filter((p) => p[0] === "skills")
      .map((p) => p.slice(1).join("/"))
      .sort();
    expect(discovered).toEqual(packagesOnDisk());
    // Guard against a scan that finds nothing and reports agreement: an empty
    // corpus would satisfy the equality above and prove nothing.
    expect(discovered.length).toBeGreaterThan(0);
  });

  test("every resolvable skill is a node in the exported graph", () => {
    const doc = EXPORTED;
    const nodes = new Set(
      (doc["@graph"] as Array<Record<string, unknown>>)
        .filter((n) => String(n["@type"]).endsWith("Skill"))
        .map((n) => n.name as string),
    );
    // UNPUBLISHED_GRAPH_TYPOLOGIES names skills that are deliberately stripped
    // from the published graph — `fsh-guts` documents the trashcan, and the
    // owner's rule is that no published graph references it. They are
    // resolvable skills that must NOT be nodes, so this invariant excludes
    // them rather than being weakened. Bean `folio-assistant-uv09`.
    //
    // THIS LAYER's skills, not the corpus's: since bean `4ak5` item 2 the
    // graph is built in layer scope, and a skill held by a layer
    // stacked on this one is a node in THAT layer's document.
    const known = new Set([...knownSkills(ROOT, "instance")].filter(isPublishedSkill));

    // The exclusion must be doing something, or a later change that stops
    // stripping would pass here unnoticed.
    expect([...knownSkills(ROOT)].filter((n) => !isPublishedSkill(n)).sort()).toEqual([
      "fsh-guts",
    ]);

    // Both directions. A skill the graph omits is unfindable through the KG; a
    // node with no skill behind it is a ref that resolves to nothing.
    expect([...known].filter((n) => !nodes.has(n)).sort()).toEqual([]);
    expect([...nodes].filter((n) => !known.has(n)).sort()).toEqual([]);
  });

  test.skipIf(NOT_PUBLISHED())("every skill in a `skills/` package has a published reference page", () => {
    // Scoped to `skills/` packages deliberately: `.claude/skills/local/`
    // publishes under a `local-` prefix and `src/skills` under its own
    // category, both already covered by `gen-skill-docs --check`. What was
    // UNCOVERED was a whole package missing from the generator's list, which is
    // exactly what this walks.
    const missing: string[] = [];
    for (const pkg of packagesOnDisk()) {
      for (const f of readdirSync(join(ROOT, "skills", pkg))) {
        // Per FILE, not per package: admitting a package says the directory
        // holds skills, never that everything in it is one. A non-skill node
        // has no instruction body, so demanding a published page for it is
        // demanding documentation of something that is not documentation.
        if (!f.endsWith(".md") || !isSkillMd(join(ROOT, "skills", pkg, f))) continue;
        if (!existsSync(join(PUBLISHED, f))) missing.push(`skills/${pkg}/${f}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test.skipIf(NOT_PUBLISHED())("a skill named by a BPMN diagram resolves and is published", () => {
    // The consequence that made the docs gap worth fixing rather than noting:
    // `workflow_next` hands an agent a skill ref, and four of the twelve
    // unpublished ones were named by real diagrams.
    //
    // Refs are read with a regex rather than a parser on purpose. The claim
    // here is only that each NAME resolves and has a page; whether the diagram
    // is well-formed, and whether the ref sits on a real activity, is
    // `check-workflow-refs`'s and `kg:audit`'s to make.
    const wf = join(ROOT, "processes");
    const refs = new Set<string>();
    const scan = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) scan(p);
        else if (e.name.endsWith(".bpmn") || e.name.endsWith(".dmn")) {
          const xml = readFileSync(p, "utf-8");
          for (const m of xml.matchAll(ownElementPattern(xml, "skill", String.raw`\s+ref="([^"]+)"`))) {
            refs.add(m[1]!);
          }
        }
      }
    };
    if (existsSync(wf)) scan(wf);
    // An empty ref set would satisfy every assertion below and prove nothing —
    // the same "clean run over a corpus it never read" this repo keeps hitting.
    expect(refs.size).toBeGreaterThan(0);

    const known = knownSkills(ROOT);
    const dangling = [...refs].filter((r) => !known.has(r)).sort();
    const unpublished = [...refs]
      .filter((r) => known.has(r))
      .filter(
        (r) =>
          !existsSync(join(PUBLISHED, `${r}.md`)) && !existsSync(join(PUBLISHED, `local-${r}.md`)),
      )
      .sort();
    expect(dangling).toEqual([]);
    expect(unpublished).toEqual([]);
  });
});
