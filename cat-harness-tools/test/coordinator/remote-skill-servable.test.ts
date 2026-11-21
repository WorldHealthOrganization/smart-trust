/**
 * A remote package must not declare a skill this layer cannot serve.
 *
 * Bean `wlqd`, and the owner's instruction was specific: they wanted this "as a
 * todo that fails QA" rather than as prose. The previous pass made the
 * *documentation* honest — the generated docs now say "declared, not
 * integrated" — which left nothing that trips, so the overstatement was
 * accurate and invisible at the same time.
 *
 * ## What fails, and what deliberately does not
 *
 * `remote-skill-is-servable` is `major`, so it fails `bun run cat kg:audit`
 * (`Worst severity: major`), it is recorded as `fail` in the committed sidecar
 * `test/results/kg-qa/scenarios/kg.kg-qa.json`, and it fails
 * `bun run cat kg:audit:strict`. It does NOT fail `kg:audit:check`, which gates CI
 * and fires on `critical` only.
 *
 * **That last part is deliberate and is not timidity.** A required check that is
 * red until somebody implements a remote-package sync would be red on every
 * unrelated pull request, which is precisely the defect `AGENTS.md` documents at
 * length: `docs-site.yml` failed all 30 runs over two months and the failure
 * became invisible *because* it was constant. Making this criterion `critical`
 * would block the whole repository on one known, sized, non-urgent
 * overstatement. The owner can ask for that escalation in one line — change the
 * severity in `schemas/sdlc/kg-qa.ts` — and this comment is the argument they would
 * be overriding, recorded so the decision is not re-derived.
 *
 * ## So what does this test do
 *
 * It pins the finding set, in both directions:
 *
 * - it cannot silently **grow** — a sixth declared-but-unservable skill fails
 *   here, which is the regression that matters, because the whole point is that
 *   adding such a name is currently free;
 * - it cannot silently **vanish** — if somebody implements the sync or drops the
 *   declaration, this test fails and names what to do, so closing `wlqd` is a
 *   deliberate act with the expectation updated, not a green run nobody reads.
 *
 * @module test/remote-skill-servable
 *
 * Moved here from `cat-harness/scripts/tests/remote-skill-servable.test.ts` to
 * the checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it compares the checkout's
 * remote-package declarations with the skills its layers (fhir-harness
 * among them) serve, which only the whole checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. Paths are composed from ORIGIN_DIR, the directory
 * it was written in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { kgRoots, knownSkills, remotePackageDeclarations } from "../../scripts/known-skills.js";
import { syncedPackageDir, wrapperSkillsDirs } from "../../scripts/sync-remote-skills.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const ROOT = join(ORIGIN_DIR, "..", "..");

/**
 * **Empty, and since 2026-09-24 for the right reason** — issue #556.
 *
 * The five names were unservable, then stubbed (2026-09-20), and are now real:
 *
 * - the three scientific skills are MATERIALIZED — pinned, committed and
 *   fixity-checked (`sync-remote-skills.ts`, owner: "Commit, pinned,
 *   read-only") — and served as ordinary local packages;
 * - the two FHIR names were never skills upstream (SMARTerFHIR is a library with
 *   no skill files), so the wrapper stopped declaring them and they are AUTHORED
 *   in `fhir-harness/skills/fhir-client/` (owner: "Author them here").
 *
 * The stubs are retired to `fsh-guts/retired/remote-stubs-package.md`, bodies
 * verbatim. The pins below replace `EXPECTED_STUBS` with what each name became,
 * so an empty unservable list still cannot pass in the world where the
 * declarations were deleted instead.
 */
const EXPECTED_UNSERVABLE: string[] = [];

/** Materialized from a pinned upstream commit, and served as local packages. */
const EXPECTED_MATERIALIZED = [
  "hypothesis-generation",
  "scientific-critical-thinking",
  "scientific-visualization",
];

/** Never skills upstream; authored here, in the FHIR layer. */
const EXPECTED_AUTHORED_FHIR = ["fhir-client-operations", "smart-launch"];

describe("remote-package declarations vs what this instance can serve", () => {
  const servable = knownSkills(ROOT);
  const declared = remotePackageDeclarations(ROOT);

  test("there are declarations to check", () => {
    // A green run over zero rows reads as coverage that is not there — the same
    // vacuity guard the workflow-yaml suite carries.
    expect(declared.length).toBeGreaterThan(0);
  });

  test("the unservable set is exactly the known one — it has not grown or vanished", () => {
    const unservable = declared
      .filter((d) => !servable.has(d.skill))
      .map((d) => `${d.file}/${d.skill}`)
      .sort();

    expect(unservable).toEqual(EXPECTED_UNSERVABLE);
  });

  test("each synced name is still declared, served, and materialized — not a stub", () => {
    const declaredNames = new Set(declared.map((d) => d.skill));
    for (const name of EXPECTED_MATERIALIZED) {
      expect(declaredNames.has(name), `${name} is no longer declared by any wrapper`).toBe(true);
      expect(servable.has(name), `${name} is declared but has no body to serve`).toBe(true);
      // Asked of the wrapper's own skills directory, not the harness's: the
      // synced packages moved up with their wrapper (placement PR1, bean
      // `ybwt` — sci's `skills/content/`).
      const pkg = wrapperSkillsDirs(ROOT)
        .map((d) => syncedPackageDir(d, name))
        .find((d) => existsSync(join(d, "materialization.json")));
      expect(pkg, `${name} has no materialization record in any wrapper's skills directory`).toBeDefined();
      const rec = JSON.parse(readFileSync(join(pkg!, "materialization.json"), "utf-8"));
      expect(rec.files.length).toBeGreaterThan(0);
      for (const f of rec.files) expect(f.materialization.fixity.algorithm).toBe("sha256");
      const body = readFileSync(join(pkg!, `${name}.md`), "utf-8");
      expect(/^stub:\s*\S/m.test(body), `${name}.md is still a stub`).toBe(false);
    }
  });

  test("the two FHIR names are authored in fhir-harness, and no wrapper claims them", () => {
    const declaredNames = new Set(declared.map((d) => d.skill));
    for (const name of EXPECTED_AUTHORED_FHIR) {
      expect(declaredNames.has(name), `${name} is declared remote again, but upstream has no such skill`).toBe(false);
      const body = readFileSync(join(ROOT, "..", "fhir-harness", "skills", "fhir-client", `${name}.md`), "utf-8");
      expect(body.startsWith("---"), `${name}.md has no front matter`).toBe(true);
      expect(/^stub:\s*\S/m.test(body), `${name}.md is a stub`).toBe(false);
    }
  });

  test("every declared skill names a wrapper that exists, so a finding is actionable", () => {
    // A finding keyed on a file nobody can open is a finding nobody acts on.
    // The wrapper is a file in a declared skills root's `remote-packages/`, the
    // same directories the declarations were read from.
    const wrapperDirs = [...new Set(kgRoots(ROOT).map((d) => resolve(d, "remote-packages")))];
    for (const d of declared) {
      expect(d.file.endsWith(".json")).toBe(true);
      expect(d.skill.length).toBeGreaterThan(0);
      const at = wrapperDirs.map((dir) => join(dir, d.file)).filter((p) => existsSync(p));
      expect(at.length, `${d.file}, which declares ${d.skill}, is in no remote-packages directory`).toBeGreaterThan(0);
      // And opening it shows the skill the finding would name.
      const named = at.some((p) => ((JSON.parse(readFileSync(p, "utf-8")) as { wrapper?: { skills?: string[] } }).wrapper?.skills ?? []).includes(d.skill));
      expect(named, `${d.file} does not list ${d.skill}`).toBe(true);
    }
  });

  test("every declared skill comes from a wrapper that syncs, pinned, never auto-updating", () => {
    // The premise inverted: this asserted that a sync was declared and NOTHING
    // performed it. Now something does, so what is pinned is how.
    for (const d of declared) {
      const sync = d.sync as { autoUpdate?: boolean } | undefined;
      expect(sync, `${d.file} declares ${d.skill} with no sync`).toBeDefined();
      expect(sync?.autoUpdate).toBe(false);
    }
  });
});
