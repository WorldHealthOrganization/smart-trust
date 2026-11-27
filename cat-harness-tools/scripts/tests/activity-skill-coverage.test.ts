/**
 * Every activity in the corpus either names a skill or says why it has none.
 *
 * ## Why this is a test and not a CI flag
 *
 * `activity-names-skill` is `major`, which gates `bun run cat kg:audit:strict`.
 * CI runs `kg:audit:check`, which gates on `critical` only — so the severity
 * alone enforces nothing here.
 *
 * Switching CI to `:strict` would work and is the tempting one-line answer. It
 * also promotes EVERY `major` criterion to gating in the same stroke —
 * `lane-binds-role`, `role-carries-activity-skill`, `skill-servable`,
 * `call-activity-resolves` — which is a much larger commitment than the change
 * that motivated it, and would turn a sibling branch red for something its
 * author never touched. This asserts exactly the property that was just
 * established and nothing else.
 *
 * ## Why the property is assertable at all now
 *
 * It was not, until this commit. The criterion had legitimate layers it
 * could not distinguish from defects: a stakeholder's sign-off, a corpus being
 * written into, and a skill nobody has written all read as "names no skill".
 * Gating on that would have forced a fake `<folio:skill ref>` onto a real step,
 * which is worse than the gap — so it stayed advisory, and 42 findings sat
 * there being explained in prose by each pass that met them.
 *
 * Three declarations changed that, and each is READ rather than inferred:
 *
 *   - a lane whose role is `actedUpon`   — written to, never acts
 *   - a lane whose role is `judgementOnly` — acts, but no procedure decides it
 *   - `<folio:no-skill reason="…"/>`      — this step, and why it has none
 *
 * The reason on the third is required at LOAD time: a diagram carrying a
 * reasonless exemption does not parse, so the whole file records `unknown`
 * rather than quietly passing. That is what stops the exemption being the
 * cheap way out — silencing the criterion costs more than satisfying it.
 *
 * ## Read a failure here as a question, not as a chore
 *
 * The fix is one of two things and they are not interchangeable: name the
 * skill that implements the step, or declare that none could and say why.
 * Reaching for the exemption because no skill comes to mind is how the second
 * becomes a rubber stamp. If the step has a performer who could be handed
 * instructions, it wants a skill.
 */
import { describe, expect, test } from "bun:test";
import { join, relative, resolve } from "node:path";

import { loadProcessModel, isActivity, processDiagrams } from "../../src/workflow/process-model.js";
import { readRoleGraph, roleForLane } from "../../schemas/process/role-graph.js";
import { workflowFiles } from "../known-skills.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** The harness root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HARNESS = resolve(HARNESS_ROOT);

const root = resolve(HARNESS_ROOT);

describe("every activity names a skill or declares why it has none", () => {
  test("the corpus is non-empty — otherwise this proves nothing", () => {
    // Without this, renaming `processes/` turns the assertion below
    // into a vacuous pass over an empty list, which is the defect being
    // guarded against wearing a green tick.
    const files = processDiagrams(workflowFiles(HARNESS)).map((p) => relative(HARNESS, p));
    expect(files.length).toBeGreaterThan(10);
  });

  test("no activity is silently skill-less", async () => {
    // `readRoleGraph` takes the kg ROOT and returns undefined when no graph is
    // declared. Asserted rather than defaulted: with no graph, every lane looks
    // unexempt and this test would fail for the wrong reason — or, had the
    // exemptions been written the other way round, pass over everything.
    const graph = readRoleGraph(join(root, "scenarios"));
    expect(graph, "no role graph — the lane exemptions cannot be resolved").toBeDefined();
    const bare: string[] = [];

    for (const file of processDiagrams(workflowFiles(HARNESS)).map((p) => relative(HARNESS, p))) {
      const m = await loadProcessModel(join(HARNESS, file));

      const exemptLanes = new Set(
        m.lanes
          .filter((l) => {
            const role = roleForLane(graph!, l.name, l.roleRef);
            // `judgementOnly` alone: the `actedUpon` exemption was retired on
            // 2026-10-16 (owner) — a mechanical role's tasks name its contract skills.
            return role?.judgementOnly === true;
          })
          .map((l) => l.id),
      );

      for (const n of [...m.nodes.values()].filter(isActivity)) {
        if (n.skills.length > 0) continue;
        if (n.calledElement !== undefined) continue; // the called process implements it
        if (n.noSkillReason !== undefined) continue; // declared, with a reason
        if (n.laneId !== undefined && exemptLanes.has(n.laneId)) continue;
        bare.push(`${file}:${n.id} — "${n.name}"`);
      }
    }

    // Asserted as the empty list rather than as a count: a count permits a
    // swap — resolve one, introduce another — and reports the ledger balanced.
    expect(bare.sort()).toEqual([]);
  });
});
