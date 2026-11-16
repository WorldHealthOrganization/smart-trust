/**
 * `property-skills` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/property-skills.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each resolves skills that the content
 * layers above cat-harness hold, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { resolve, join } from "node:path";
import { Glob } from "bun";

import { PROPERTY_SKILLS } from "../../schemas/kg/property-skills.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

const REPO = resolve(ORIGIN_DIR, "../..");

/**
 * Every skill stem in the tree: `<instance>/skills/**\/<name>.md`, the same
 * under a named sub-graph (`<instance>/<sub-graph>/skills/**`, e.g.
 * `cat-harness/sdlc/skills/`, cat-harness#991 step 23.2), and `SKILL.md`
 * packages by directory.
 */
function skillNames(): Set<string> {
  const out = new Set<string>();
  const paths = ["*/skills/**/*.md", "*/*/skills/**/*.md"].flatMap((g) => [...new Glob(g).scanSync({ cwd: REPO, onlyFiles: true })]);
  for (const p of paths) {
    if (p.includes("node_modules")) continue;
    const parts = p.split("/");
    const file = parts[parts.length - 1];
    out.add(file === "SKILL.md" ? parts[parts.length - 2] : file.replace(/\.md$/, ""));
  }
  return out;
}

describe("PROPERTY_SKILLS", () => {

  test("every skill named exists", () => {
    const have = skillNames();
    const bad = Object.entries(PROPERTY_SKILLS).flatMap(([k, r]) =>
      (r.skills as readonly string[]).filter((s) => !have.has(s)).map((s) => `${k}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});
