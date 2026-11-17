/**
 * A field retired from `SkillDefinition` does not quietly come back.
 *
 * ## Why this exists at all
 *
 * Two fields were retired from `SkillDefinition` on 2026-09-20 — `schemaRefs`
 * (beans `3w0i`, `t2yg`) and `roles` (bean `y1w9`) — and both were retired
 * the same way: the property stayed **optional and deprecated** so a
 * downstream layer still validates, while every declaration in this
 * layer was removed. `roles` was then deleted outright in #1168 B8 (the
 * schema is not strict, so data still carrying it still validates); the
 * guard below holds either way.
 *
 * That shape has a hole in it. An optional property re-declared typechecks
 * cleanly, so nothing fails, nothing warns outside an editor, and the field
 * is back with no reader — which is the state it was retired from.
 *
 * The cost of not pinning a decision is already measured here. `dhol`: the
 * `*.test.ts` exclusion in `check-declared-paths` was written and never
 * argued, and survived three breakages because there was nothing to disagree
 * with. This is the cheapest possible way not to repeat that.
 *
 * **This is not a ban.** Reinstating either field is fine — the rule both
 * retirement records state is *write the consumer first*. Do that, and
 * update this test in the same change; the diff is then a decision somebody
 * reviewed rather than a line that reappeared.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { Glob } from "bun";

import { fshGutsDirectory } from "../../schemas/kg/fsh-guts.js";
import { skillDefinitionDirs } from "../../schemas/kg/skill-definitions-dir.js";
import { kgRoots } from "../known-skills.js";
import { notApplicableAlone } from "../../test/support/checkout.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * Retired property → the record that says why, and how to bring it back.
 *
 * The two records live in different places on purpose, and neither is wrong:
 * `roles` earned a standalone note because the measurement is long and the
 * first reading of it was mistaken, while `schemaRefs` is documented inline
 * on the {@link SchemaRef} type it belongs to. What matters is that each path
 * RESOLVES — asserted below, because the first draft of this very registry
 * pointed at an `fsh-guts/retired/schema-refs.md` that was never written.
 */
const RETIRED: Record<string, string> = {
  // Inside the DECLARED trashcan, never a spelled `fsh-guts/` (bean `gz47`):
  // the trashcan is moving to its own branch (`9c7h`).
  roles: join(relative(resolve(ROOT, ".."), fshGutsDirectory(resolve(ROOT, ".."))), "retired", "skill-definition-roles.md"),
  schemaRefs: "cat-harness-tools/schemas/conduct/assistant-types.ts",
};

function skillDefinitionFiles(): string[] {
  const out: string[] = [];
  // The harness's own trees, plus every skills root the checkout resolves:
  // the paper adapter's fourteen definitions moved up to sci with their
  // skills (placement PR1, bean `ybwt`), and they still type as
  // `SkillDefinition` from the harness's framework.
  const dirs = new Set([resolve(ROOT, "skills"), ...["adapters", "src"].map((d) => resolve(TOOLS_ROOT, d)), ...kgRoots(ROOT).map((d) => resolve(d))]);
  for (const dir of dirs) {
    for (const rel of new Glob("**/*.ts").scanSync({ cwd: dir })) {
      const abs = resolve(dir, rel);
      if (out.includes(abs)) continue;
      if (abs.endsWith(".test.ts")) continue;
      const text = readFileSync(abs, "utf-8");
      // The literals, not the schema that defines the shape.
      if (/:\s*SkillDefinition\s*=/.test(text)) out.push(abs);
    }
  }
  // cat-harness's own definitions are JSON data since y9r6 step 4a
  // (cat-harness#749: its eight `: SkillDefinition =` literals became
  // `skills/skill-definitions/*.json`), so the TypeScript sweep above no
  // longer reaches them. Read every JSON definition directory the harness and
  // the checkout beside it resolve, so the retired fields are still swept there.
  for (const dir of new Set([...skillDefinitionDirs(ROOT), ...skillDefinitionDirs(resolve(ROOT, ".."))])) {
    for (const rel of new Glob("*.json").scanSync({ cwd: dir })) {
      const abs = resolve(dir, rel);
      if (!out.includes(abs)) out.push(abs);
    }
  }
  return out;
}

/** Whether a definition file declares `field`: a top-level key of a JSON one, a property line of a TypeScript one. */
function declaresField(file: string, field: string): boolean {
  const text = readFileSync(file, "utf-8");
  if (file.endsWith(".json")) {
    const def = JSON.parse(text) as unknown;
    return typeof def === "object" && def !== null && Object.hasOwn(def, field);
  }
  return new RegExp(`^\\s*${field}:`, "m").test(text);
}

/**
 * Two of the things this file reads exist only in a COMPOSED checkout, so
 * standing alone the tests over them are not applicable and say so; composed,
 * they run exactly as before.
 *
 * - The floor of 15 below counts the skill definitions of the layers
 *   composed ABOVE cat-harness too — `kgRoots` resolves the checkout's skills
 *   roots, and most of the definitions are folio-assistant-sci's (measured
 *   2026-10-09: 24 composed, 15 of them sci's, 8 cat-harness's own).
 * - The `roles` record sits in the `fsh-guts` trashcan, kept on a state branch.
 */
const COMPOSED_SKILLS_ABSENT = notApplicableAlone(
  "the skill definitions of the instances composed above cat-harness (folio-assistant-sci, folio-assistant-core), which the 15-definition floor counts",
);
const NO_TRASHCAN = notApplicableAlone(
  "the `fsh-guts` trashcan, which holds the `roles` retirement record (kept on its state branch, mounted only in a composed checkout)",
);

describe("retired SkillDefinition fields", () => {
  const files = skillDefinitionFiles();

  test.skipIf(COMPOSED_SKILLS_ABSENT)("the sweep found the skill definitions — otherwise nothing below holds", () => {
    // Vacuity first. A rename of the annotation, or a move of these trees,
    // turns every assertion below into a pass over an empty list.
    expect(files.length, "no `: SkillDefinition =` literals found at all").toBeGreaterThan(15);
  });

  test("the sweep found cat-harness's OWN skill definitions", () => {
    // The same vacuity guard over the trees that are here in every checkout,
    // so a standalone run is not a pass over an empty list either.
    const own = files.filter((f) => f.startsWith(ROOT + sep));
    expect(own.length, "no skill definitions (`: SkillDefinition =` literals or JSON) in cat-harness's own trees").toBeGreaterThan(0);
  });

  test.skipIf(NO_TRASHCAN)("every record named here dereferences", () => {
    // A link-shaped value that does not dereference is the `blv9` class, and
    // a retirement note is the one place it hurts most: the reader who most
    // needs it is the one about to reinstate the field.
    const repo = resolve(ROOT, "..");
    const dead = Object.entries(RETIRED)
      .filter(([, record]) => !existsSync(resolve(repo, record)))
      .map(([field, record]) => `${field} → ${record}`);
    expect(dead, "a retirement record was named but never written").toEqual([]);
  });

  test.each(Object.entries(RETIRED))("no SkillDefinition declares `%s`", (field, record) => {
    const declaring = files
      .filter((f) => declaresField(f, field))
      .map((f) => f.slice(ROOT.length + 1));
    expect(
      declaring,
      `\`${field}\` is retired and read by nothing — see ${record}. ` +
        "Reinstating it means writing the consumer FIRST, then updating this test.",
    ).toEqual([]);
  });
});
