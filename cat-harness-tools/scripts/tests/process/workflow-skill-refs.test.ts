/**
 * A `<folio:skill ref="…"/>` names a skill that exists.
 *
 * AGENTS.md requires every activity to name the skill that implements it, and
 * nothing checked that the name resolved. Two diagrams referenced skills that
 * had never existed — `corpus-search` and `paper-relevance-triage` — so
 * `workflow_next` would hand an agent the name of something it cannot open,
 * which is worse than naming nothing: it looks like an answer.
 *
 * The full report (including per-diagram coverage, which is NOT gated here) is
 * `bun run cat check:workflow-refs`. This test gates only the unambiguous half.
 *
 * The tests of this file that read the whole checkout (resolves every
 * layer's declared diagrams) live in
 * `test/workflow-skill-refs-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { join, basename } from "node:path";
import { loadProcessModel, isActivity, processDiagrams } from "../../../src/workflow/process-model.ts";
import { knownSkills as canonicalKnownSkills, workflowFile, workflowFiles } from "../../known-skills.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

// A real-corpus sweep: about five seconds on a loaded runner, past bun's 5s default.
const CORPUS_TIMEOUT = 60_000;

const ROOT = join(HARNESS_ROOT);

/**
 * Skill names, from the ONE definition of where a skill lives.
 *
 * ## This was the THIRD copy, and it was the stalest
 *
 * It listed **five directories by hand**, four of them under `skills/`. That
 * is the exact defect `known-skills.ts`'s own header records fixing —
 * *"It was five hardcoded entries … `authoring-math` (3 skills) and
 * `authoring-who-smart-guidelines` (9) were absent"* — left standing in a copy
 * the fix did not reach.
 *
 * Measured 2026-09-20 against the canonical resolver: the hand-written list
 * missed **19** real skills, among them `bpmn-authoring` and `l2-dak-authoring`
 * (named by `<folio:skill ref>` in the diagrams this very test checks),
 * `bpmn-processes` and `process-state` the moment they moved into
 * `skills/process/workflow/`, and both of bootstrap's. A list somebody must remember
 * to extend is not a single answer; it is a copy that happens to match today,
 * and this one had stopped matching.
 *
 * It is how the defect announces itself: this test failed on a diagram whose
 * refs `check:workflow-refs` had already resolved. Two checkers, two answers,
 * and the wrong one gating.
 */
function knownSkills(): Set<string> {
  return canonicalKnownSkills(ROOT);
}

describe("declared diagram paths resolve", () => {

  test("every declared extractModule / injectModule exists", async () => {
    // `bpmn` declared NEITHER while its note described a working re-render,
    // so the capability read as built and was not.
    const { CONTENT_TYPE_TRANSLATIONS, resolveTranslationPath } = await import("../../../schemas/library/translation-tools.ts");
    const missing: string[] = [];
    for (const ct of CONTENT_TYPE_TRANSLATIONS) {
      for (const f of ct.formats) {
        for (const rel of [f.extractModule, f.injectModule]) {
          if (rel && resolveTranslationPath(ct, rel) === undefined) missing.push(`${ct.contentType}/${f.id} → ${rel}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("workflow skill refs resolve", () => {
  test("the skill index is not empty — a broken index would pass everything", () => {
    // Without this the suite is satisfiable by a resolver that finds nothing
    // and a corpus that references nothing, which is not the property wanted.
    expect(knownSkills().size).toBeGreaterThan(20);
  });

  test("every folio:skill ref names a skill in this repository", async () => {
    const skills = knownSkills();
    const dangling: string[] = [];

    for (const file of processDiagrams(workflowFiles(ROOT)).map((p) => basename(p)).sort()) {
      const model = await loadProcessModel(workflowFile(ROOT, file));
      for (const node of [...model.nodes.values()].filter(isActivity)) {
        for (const ref of node.skills ?? []) {
          if (!skills.has(ref)) dangling.push(`${file} · ${node.id} → "${ref}"`);
        }
      }
    }
    expect(dangling).toEqual([]);
  }, CORPUS_TIMEOUT);
});
