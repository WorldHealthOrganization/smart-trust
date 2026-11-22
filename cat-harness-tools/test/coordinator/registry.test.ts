/**
 * `scripts/generate-registry.ts` writes `.claude/skills/registry.json`, whose
 * contract is `SkillRegistrySchema`. Nothing ever checked that it satisfied it,
 * and it did not:
 *
 *   INVALID — 15 issues
 *     packages.0.repo  Required
 *     packages.0.path  Required
 *     packages.0.ref   Required   … × 5 packages
 *
 * The generator's own output type declared all six collections as `any[]`, so
 * `packages` was filled with `skills/<name>/package-manifest.json` files while
 * the schema asked for `SkillPackageRef` — a reference to an *external* package
 * in another repo. On top of that the generator never emitted
 * `roleAssignments` at all, though `.claude/scenarios/role-assignments.json`
 * has three rules in it and the field is required.
 *
 * This runs the generator and validates its output. It is the check whose
 * absence let a registry that could not be parsed ship as the framework's
 * machine-readable manifest.
 *
 * Moved here from `cat-harness/scripts/tests/registry.test.ts` to the
 * checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it generates and reads the skill
 * registry at the aggregate root's `.claude/skills/`, from the root's
 * `.claude/scenarios/role-assignments.json`, which only the whole checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. Paths are
 * composed from ORIGIN_DIR, the directory it was written in, so nothing it
 * reads changed.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, readFileSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { SkillRegistrySchema } from "../../schemas/constraints.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { packageDirsIn } from "../../scripts/skill-topics.js";
import { noRootManifest } from "../support/checkout.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const ROOT = join(ORIGIN_DIR, "..", "..");
const OUT = join(repoRootFor(ROOT), ".claude", "skills", "registry.json");
/** `generate-registry` names the registry after the checkout root's `package.json`. */
const NO_ROOT = noRootManifest(repoRootFor(ROOT), "the name `generate-registry` gives the registry");
const SAVED = `${OUT}.testbak`;

// The generator writes to a fixed path in the working tree. Preserve whatever
// is there so a developer's copy is not clobbered by running the suite.
let hadExisting = false;
beforeAll(() => {
  if (NO_ROOT) return;
  hadExisting = existsSync(OUT);
  if (hadExisting) renameSync(OUT, SAVED);
  const r = spawnSync("bun", ["run", join(import.meta.dir, "..", "..", "scripts", "generate-registry.ts")], {
    cwd: ROOT, stdio: "pipe",
  });
  if (r.status !== 0) throw new Error(`generate-registry failed: ${r.stderr?.toString()}`);
});
afterAll(() => {
  try {
    if (hadExisting) renameSync(SAVED, OUT);
    else if (existsSync(OUT)) unlinkSync(OUT);
  } catch {}
});

describe.skipIf(NO_ROOT)("generated skill registry", () => {
  test("satisfies SkillRegistrySchema", () => {
    const raw: unknown = JSON.parse(readFileSync(OUT, "utf-8"));
    const parsed = SkillRegistrySchema.safeParse(raw);
    const detail = parsed.success
      ? ""
      : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    expect(detail).toBe("");
    expect(parsed.success).toBe(true);
  });

  test("carries the role rules that are on disk", () => {
    // Required by the schema, and never populated before: the registry
    // advertised no role assignments while three sat in
    // `.claude/scenarios/role-assignments.json`.
    const reg = SkillRegistrySchema.parse(JSON.parse(readFileSync(OUT, "utf-8")));
    expect(reg.roleAssignments.length).toBeGreaterThan(0);
    // Highest priority first — the evaluation order the type documents.
    const priorities = reg.roleAssignments.map((r) => r.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
    // And they are THE rules on disk: every rule in the file, nothing else,
    // in the file's own order once sorted highest priority first.
    const file: unknown = JSON.parse(readFileSync(join(repoRootFor(ROOT), ".claude", "scenarios", "role-assignments.json"), "utf-8"));
    const onDisk = (Array.isArray(file) ? file : (file as { assignments?: { priority?: number }[] }).assignments ?? []) as { priority?: number }[];
    expect(onDisk.length).toBeGreaterThan(0);
    const raw = JSON.parse(readFileSync(OUT, "utf-8")) as { roleAssignments: unknown[] };
    expect(raw.roleAssignments).toEqual([...onDisk].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)));
  });

  test("hooks are HookCommands, not raw settings entries", () => {
    // `.claude/settings.json` nests `{ matcher, hooks: [...] }` inside each
    // event; the old mapping put that object into `commands[]` verbatim.
    const reg = SkillRegistrySchema.parse(JSON.parse(readFileSync(OUT, "utf-8")));
    for (const h of reg.hooks) {
      for (const c of h.commands) {
        expect(c.type).toBe("command");
        expect(typeof c.command).toBe("string");
      }
    }
  });

  test("every package manifest on disk is in the registry", () => {
    const reg = SkillRegistrySchema.parse(JSON.parse(readFileSync(OUT, "utf-8")));
    // The same walk the generator uses, so a package inside a topic directory
    // (bean 9umr) counts as on disk — a one-level readdir would miss it.
    const onDisk = packageDirsIn(join(ROOT, "skills"))
      .filter((d) => existsSync(join(d.dir, "package-manifest.json")))
      .map((d) => d.name);
    expect(onDisk.length).toBeGreaterThan(0);
    expect(reg.packages.map((p) => p.name).sort()).toEqual([...onDisk].sort());
  });
});
