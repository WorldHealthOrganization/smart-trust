/**
 * The degradation model, executed — and the distinctions it exists to make.
 *
 * The property worth pinning is not "a missing tool blocks a skill". It is
 * that **"ran with less" and "did not run" stay different answers**: the
 * integration contract these declarations serve rests on *absent tool ⇒
 * `n/a`, never a false pass*, and collapsing the two is exactly how an
 * absent tool comes to look like a finding of nothing.
 *
 * @module src/tools/degradation.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  allSkillAvailability,
  formatSkillAvailability,
  loadSkillNeeds,
  skillAvailability,
  type SkillNeeds,
} from "./degradation.ts";
import type { Capability, CapabilityStatus } from "./capabilities.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";

// The skills and capabilities read here are the HARNESS's; this test moved up with the code (70lx).
const INSTANCE = HARNESS_ROOT;

const caps: Capability[] = [
  { id: "present-tool", name: "p", description: "", detection: { method: "always" } },
  { id: "absent-tool", name: "a", description: "", detection: { method: "always" } },
  {
    id: "has-substitute",
    name: "h",
    description: "",
    detection: { method: "always" },
    fallbackTo: "present-tool",
  },
  {
    id: "dead-substitute",
    name: "d",
    description: "",
    detection: { method: "always" },
    fallbackTo: "absent-tool",
  },
];
const statuses: CapabilityStatus[] = [
  { id: "present-tool", name: "p", present: true, missingRequires: [] },
  { id: "absent-tool", name: "a", present: false, missingRequires: [] },
  { id: "has-substitute", name: "h", present: false, missingRequires: [] },
  { id: "dead-substitute", name: "d", present: false, missingRequires: [] },
];

const skill = (id: string, reqs: SkillNeeds["requiredCapabilities"]): SkillNeeds => ({
  id,
  requiredCapabilities: reqs,
});
const run = (s: SkillNeeds, opts = {}) => skillAvailability(s, statuses, caps, opts);

describe("each strategy maps to a distinct verdict", () => {
  test("everything present is ready, with nothing to say", () => {
    const r = run(skill("s", [{ capabilityId: "present-tool", degradation: "fail" }]));
    expect([r.state, r.reasons.length]).toEqual(["ready", 0]);
  });

  test("`fail` on an absent capability blocks, and names it", () => {
    const r = run(skill("s", [{ capabilityId: "absent-tool", degradation: "fail" }]));
    expect(r.state).toBe("blocked");
    expect(r.blockedBy).toEqual(["absent-tool"]);
  });

  test("`warn` is degraded, not blocked — the skill still runs", () => {
    const r = run(skill("s", [{ capabilityId: "absent-tool", degradation: "warn" }]));
    expect(r.state).toBe("degraded");
    expect(r.blockedBy).toEqual([]);
  });

  test("`skip` is partial — the requirement is dropped, not the skill", () => {
    // `skip` and `warn` must not collapse. `skip` drops the part that needed
    // the tool; `warn` runs the whole thing regardless. A caller choosing
    // between "some of the work" and "all of it, unverified" needs both.
    const r = run(skill("s", [{ capabilityId: "absent-tool", degradation: "skip" }]));
    expect(r.state).toBe("partial");
  });

  test("`fallback` uses the capability's substitute when it is present", () => {
    const r = run(skill("s", [{ capabilityId: "has-substitute", degradation: "fallback" }]));
    expect(r.state).toBe("degraded");
    expect(r.usingFallback).toEqual([{ capabilityId: "has-substitute", fallbackTo: "present-tool" }]);
  });

  test("`fallback` blocks when the substitute is absent too", () => {
    const r = run(skill("s", [{ capabilityId: "dead-substitute", degradation: "fallback" }]));
    expect(r.state).toBe("blocked");
    expect(r.reasons[0]).toContain("absent too");
  });
});

describe("the human route", () => {
  const airGapped = skill("signer", [{ capabilityId: "absent-tool", degradation: "fallback" }]);

  test("a person takes over when no capability can, and that is DEGRADED not blocked", () => {
    // `qa-report-signing` declares `fallback` with NO `fallbackTo` on
    // purpose: there is no second tool on an air-gapped host. Without this
    // path the join reports `blocked` for a skill a person can perform.
    const r = run(airGapped, { humanFallback: () => ["publication-manager"] });
    expect(r.state).toBe("degraded");
    expect(r.viaHuman).toEqual([
      { capabilityId: "absent-tool", roles: ["publication-manager"] },
    ]);
  });

  test("with no human lane it blocks, and says both things it looked for", () => {
    const r = run(airGapped);
    expect(r.state).toBe("blocked");
    expect(r.reasons[0]).toContain("no `fallbackTo`");
    expect(r.reasons[0]).toContain("no human lane");
  });
});

describe("the guards", () => {
  test("an UNDECLARED capability blocks rather than being ignored", () => {
    // The `blv9` shape: a reference-shaped value resolving to nothing. If a
    // gap in the registry read as "no requirement", a broken reference would
    // turn into a pass — and this is not hypothetical, `git-read` was
    // referenced by 17 skills and declared by nothing until this join ran.
    const r = run(skill("s", [{ capabilityId: "never-declared", degradation: "warn" }]));
    expect(r.state).toBe("blocked");
    expect(r.reasons[0]).toContain("cannot be established");
  });

  test("a skill's state is the WORST of its requirements", () => {
    const r = run(
      skill("s", [
        { capabilityId: "present-tool", degradation: "fail" },
        { capabilityId: "absent-tool", degradation: "skip" },
        { capabilityId: "absent-tool", degradation: "fail" },
      ]),
    );
    expect(r.state).toBe("blocked");
  });

  test("an empty corpus says it checked nothing rather than printing a tick", () => {
    expect(formatSkillAvailability([])).toContain("nothing was checked");
  });
});

describe("loading the graph must not RUN it (bean `ymsu`)", () => {
  /**
   * The defect, in one sentence: importing a module executes it, and a
   * knowledge-graph root holds SCRIPTS as well as declarations. So
   * `loadSkillNeeds` — whose whole job is to read one field off some modules —
   * used to execute `skills/graph-management/kg-detangle.ts`, which writes 28
   * committed sidecars under `test/results/detangle/`.
   *
   * That made `bun test` repair an artefact 1140 lines before
   * `kg:detangle:check` read it inside the same `bun run cat gates` run, which is
   * the whole of bean `ymsu`.
   *
   * The first two tests are a PAIR and neither is worth much alone: one says a
   * file declaring nothing is never imported, the other says one that declares
   * something still is. A loader that imported nothing would pass the first and
   * fail the second.
   */
  const made: string[] = [];
  afterAll(() => {
    for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function graphWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "kg-import-"));
    made.push(root);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(root, name), body);
    return root;
  }

  test("a module that declares no capabilities is NEVER imported, so its side effects never run", async () => {
    const root = graphWith({
      // A script, exactly like `kg-detangle.ts`: it does its work at top level.
      // If the loader imports it, the marker appears.
      "script.ts":
        'import { writeFileSync } from "node:fs";\n' +
        'import { join } from "node:path";\n' +
        'writeFileSync(join(import.meta.dir, "RAN"), "x");\n',
    });
    const { skills } = await loadSkillNeeds([root]);
    expect(skills).toEqual([]);
    // The assertion that would have caught the bug. It fails on origin/main.
    expect(existsSync(join(root, "RAN"))).toBe(false);
  });

  test("...and one that DOES declare them is still imported, so the filter has not eaten the feature", async () => {
    const root = graphWith({
      "skill.ts": 'export const s = { id: "probe", requiredCapabilities: [{ capabilityId: "c" }] };\n',
    });
    const { skills, unreadable } = await loadSkillNeeds([root]);
    expect(unreadable).toEqual([]);
    expect(skills.map((s) => s.id)).toEqual(["probe"]);
  });

  test("a module that names the field and will not import is REPORTED, not skipped", async () => {
    // The direction the prefilter could have broken: moving the "looks like a
    // skill" test above the import must not turn a broken skill into a silent
    // absence. A broken skill and a skill with nothing to require are different
    // answers, and `unreadable` is what keeps them apart.
    const root = graphWith({
      "broken.ts": 'export const s = { id: "x", requiredCapabilities: [] };\nthis is not typescript(\n',
    });
    const { skills, unreadable } = await loadSkillNeeds([root]);
    expect(skills).toEqual([]);
    expect(unreadable).toHaveLength(1);
    expect(unreadable[0]!.file).toContain("broken.ts");
  });
});

describe("over the real corpus", () => {
  test("the skills load, and none is unreadable", async () => {
    const { kgRoots } = await import("../../scripts/known-skills.ts");
    const { skills, unreadable } = await loadSkillNeeds(kgRoots(INSTANCE));
    // A relative specifier resolved against THIS module, not the caller's
    // cwd, and every import failed — caught in one run because `unreadable`
    // is reported rather than skipped. Without this assertion the join would
    // silently report "no skill declares requiredCapabilities".
    expect(unreadable).toEqual([]);
    expect(skills.length).toBeGreaterThan(10);
    for (const s of skills) expect(s.requiredCapabilities.length).toBeGreaterThan(0);
  });

  test("every capability a skill requires is DECLARED", async () => {
    // The finding this join was written to make possible, now closed.
    // `git-read` was referenced by 17 skills and declared by nothing;
    // `deploy-access` by `deployment-auth` and nothing. Both are declared.
    //
    // The list is EMPTY and stays empty: a new undeclared id fails here,
    // which is the point. Never widen it to make this green — that turns
    // the check back into the thing it was written to catch.
    const { kgRoots } = await import("../../scripts/known-skills.ts");
    const { loadCapabilities } = await import("./capabilities.ts");
    const { repoRootFor } = await import("../../schemas/kg/cat-harness.ts");
    const { skills } = await loadSkillNeeds(kgRoots(INSTANCE));
    const declared = new Set(loadCapabilities(repoRootFor(INSTANCE)).map((c) => c.id));
    expect(declared.size).toBeGreaterThan(5);
    const KNOWN_UNDECLARED: string[] = [];
    const missing = [
      ...new Set(
        skills
          .flatMap((s) => s.requiredCapabilities.map((r) => r.capabilityId))
          .filter((id) => !declared.has(id)),
      ),
    ].sort();
    expect(missing).toEqual(KNOWN_UNDECLARED);
  });

  // An EXPLICIT timeout, because bun's default 5000ms is not a budget and this
  // test had crept onto the wrong side of it.
  //
  // Measured 2026-09-20: red on `main` at `a38fc2e3a3` (5012.69ms) and on a
  // feature branch at `4946c142e7` (5011.41ms) — two different commits by two
  // different sessions, both ~12ms over. That is not a flake to re-run; it is
  // a test whose runtime has arrived at its own limit, and from there it fails
  // intermittently on everything.
  //
  // `probeAll` spawns ONE PROCESS PER DECLARED CAPABILITY — 26 today, and the
  // count only grows. Locally the whole file runs in ~400ms; on a shared CI
  // runner the same work is an order of magnitude slower, which is why this
  // was invisible to every contributor and red in CI.
  //
  // The assertions are about SHAPE — a row per skill, each in one of four
  // states — and say nothing about speed, so raising the limit weakens no
  // claim. 30s is generous against the ~5s observed while still failing fast
  // if the probe ever genuinely hangs.
  //
  // TWO MORE DATA POINTS, from a third session arriving at the same fix
  // independently: `9268d23` 5007.52ms and `33edd5ab` 5008.06ms both failed,
  // while `89d9dfee` passed at 822.85ms. So four commits across three sessions,
  // every failure within ~13ms of the limit and the one pass nowhere near it —
  // which is the signature of a test sitting exactly on its budget rather than
  // of anything in a diff.
  //
  // A cause for the "order of magnitude slower on a shared runner" above: both
  // of those failures logged `Terminate orphan process: pid (…) (java)` in the
  // same job's teardown, so a JVM was competing for the runner. Nothing in
  // either diff touched capabilities or probing.
  //
  // NO COST UNDERNEATH, and an earlier version of this comment claimed one.
  // Bean `4n37` asserted that three tests in this file each call `probeAll`, so a
  // run spawned ~78 processes, and proposed hoisting it into a `beforeAll`. All of
  // it was wrong and the bean is SCRAPPED:
  //
  //   · `probeAll` is called ONCE here, and once in `src/index.ts`. No caller
  //     calls it twice, so there is nothing to hoist. The "three tests" were
  //     three tests in this `describe` calling `loadSkillNeeds`, not `probeAll`.
  //   · it ALREADY memoises within a call — the `resolved` map and `inFlight` set
  //     in `capabilities.ts` probe each capability once even when several others
  //     `require` it, and resolve a cycle to unmet rather than looping.
  //   · 26 capabilities cost 441 ms measured, against this 30 s budget: 68x
  //     headroom.
  //
  // So the budget is not a workaround for a deeper problem. It is the whole fix,
  // on its own terms.
  test("the real join runs and produces a verdict per skill", async () => {
    const { kgRoots } = await import("../../scripts/known-skills.ts");
    const { loadCapabilities, probeAll } = await import("./capabilities.ts");
    const { repoRootFor } = await import("../../schemas/kg/cat-harness.ts");
    const { skills } = await loadSkillNeeds(kgRoots(INSTANCE));
    const c = loadCapabilities(repoRootFor(INSTANCE));
    const rows = allSkillAvailability(skills, probeAll(c), c);
    expect(rows.length).toBe(skills.length);
    // Not asserting WHICH state — that depends on what is installed on the
    // machine, and pinning it would make the suite fail on a developer
    // laptop with Lean present. Asserting the shape is the honest test.
    for (const r of rows) expect(["ready", "partial", "degraded", "blocked"]).toContain(r.state);
  }, 30_000);
});
