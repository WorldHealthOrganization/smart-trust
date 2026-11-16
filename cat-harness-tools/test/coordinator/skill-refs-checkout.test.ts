/**
 * `skill-refs` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/skill-refs.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each resolves every skill reference across
 * every layer in the checkout, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Glob } from "bun";

import { kgRoots, resolvableSkillIndex, resolveSkillRef } from "../../scripts/known-skills.js";
import { tools } from "../../tools/discover.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");
const ROOT = join(REPO, "cat-harness");

describe("the corpus: every skill reference resolves to one skill", () => {
  // Own skills plus the `needs` chain, as kg-audit and check-tools resolve.
  const index = resolvableSkillIndex(ROOT);

  const refs: { where: string; ref: string }[] = [];
  for (const t of tools()) for (const s of t.satisfies) refs.push({ where: `tool ${t.id} satisfies`, ref: s });
  const roles = (JSON.parse(readFileSync(join(ROOT, "scenarios", "roles.json"), "utf-8")) as {
    roles: { id: string; skills?: string[] }[];
  }).roles;
  for (const r of roles) for (const s of r.skills ?? []) refs.push({ where: `role ${r.id}`, ref: s });
  // A skill's `inherits:` names the skill it shares mechanics with (#1168 B10d,
  // owner 2026-09-30: "Typed SkillRef"). It was `local/integration-watcher`,
  // which named no package, in six of seven files.
  //
  // Over every skills root of the CHECKOUT, not `skills/` here alone: two of
  // the seven (`proof-integration-watcher`, `q-usage-watcher`) moved up to
  // sci with the paper adapter (placement PR1, bean `ybwt`) and inherit DOWN
  // into the harness, which is exactly the edge this resolves.
  for (const dir of new Set(kgRoots(ROOT).map((d) => resolve(d)))) {
    for (const rel of new Glob("**/*.md").scanSync({ cwd: dir })) {
      const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(dir, rel), "utf-8"))?.[1] ?? "";
      const m = /^inherits:\s*(\S+)\s*$/m.exec(fm);
      if (m) refs.push({ where: `${relative(REPO, join(dir, rel))} inherits`, ref: m[1]! });
    }
  }
  for (const rel of new Glob("**/summaries.json").scanSync({ cwd: join(ROOT, "library") })) {
    const text = readFileSync(join(ROOT, "library", rel), "utf-8");
    for (const m of text.matchAll(/"skill":\s*"([^"]+)"/g)) refs.push({ where: `library/${rel}`, ref: m[1]! });
  }

  test("the corpus is non-empty, so the assertions below are not vacuous", () => {
    expect(index.size).toBeGreaterThan(100);
    expect(refs.some((r) => r.ref.includes("/"))).toBe(true);
    expect(refs.some((r) => !r.ref.includes("/"))).toBe(true);
  });

  test("no bare name is held by two packages", () => {
    const shared = [...index].filter(([, pkgs]) => pkgs.length > 1).map(([n, pkgs]) => `${n}: ${pkgs.join(", ")}`);
    expect(shared).toEqual([]);
  });

  test("skill inherits: is counted, so its resolution below is not vacuous", () => {
    expect(refs.filter((r) => r.where.endsWith(" inherits")).length).toBeGreaterThanOrEqual(7);
  });

  test("every reference resolves", () => {
    const bad = refs
      .map((r) => ({ ...r, res: resolveSkillRef(r.ref, index) }))
      .filter((r) => r.res.kind !== "ok")
      .map((r) => `${r.where} → ${r.ref} (${r.res.kind})`);
    expect([...new Set(bad)]).toEqual([]);
  });
});
