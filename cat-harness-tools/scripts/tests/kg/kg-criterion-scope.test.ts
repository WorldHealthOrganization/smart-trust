/**
 * A criterion declares WHOSE corpus can answer it, and an instance run says when
 * it withheld one.
 *
 * ## Why this exists
 *
 * `kg:audit` ran only from `cat-harness/` until 2026-09-26 (bean `bjzs`). Pointing
 * it at another declared layer is one assignment — everything derives from a
 * single `root` — and the first run of it reported **76 criticals of which 73 were
 * false**: 36 repository-level actors judged against bootstrap's 4 roles, because
 * `ACTOR_DIR` resolves through `repoRootFor` and so does not follow `--instance`.
 *
 * The owner chose classifying **all 68** criteria over declaring only the one
 * measured to misfire. The risk they accepted, and the reason these tests are
 * shaped the way they are, is that a wrong `repo` SUPPRESSES a real finding and a
 * suppression reads as a clean `n/a` forever.
 *
 * ## So the assertions are about the pair, not the list
 *
 * A test that hardcoded which five are `repo` would pass over a wrong fifth and
 * go stale the day a sixth is right — the count-in-a-test failure this repository
 * has paid for twice. What is asserted instead: every criterion has decided,
 * every `repo` carries its evidence, and the suppression is VISIBLE in the
 * artefact. The one empirical claim — that the 73 are gone — is asserted by
 * spawning the auditor, because only a run can say that.
 *
 * @module cat-harness/scripts/tests/kg-criterion-scope
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { KG_CRITERIA, KG_CRITERION_SCOPES, KG_CRITERIA_BY_ID } from "../../../schemas/sdlc/kg-qa.js";
import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(INSTANCE_ROOT);

describe("every criterion has decided its scope", () => {
  test("each scope is one of the declared vocabulary", () => {
    for (const c of KG_CRITERIA) {
      expect(KG_CRITERION_SCOPES, `\`${c.id}\` has scope \`${c.scope}\``).toContain(c.scope);
    }
  });

  /**
   * The anti-vacuity floor. Without it this file passes over an empty criteria
   * list — a rename or a broken import would read as clean, which is the `dh4f`
   * shape. A floor rather than an exact count, because a count in a test goes
   * stale exactly as a count in prose does.
   */
  test("it found criteria at all — otherwise the loops above prove nothing", () => {
    expect(KG_CRITERIA.length).toBeGreaterThan(50);
    expect(Object.keys(KG_CRITERIA_BY_ID).length).toBe(KG_CRITERIA.length);
  });

  /**
   * The load-bearing one. `scope: "repo"` is the only setting that can HIDE a
   * finding, so it is the only one required to argue for itself. `instance` needs
   * no basis: it withholds nothing.
   */
  test("every `repo`-scoped criterion carries a scopeBasis, and it is evidence not a restatement", () => {
    const repoScoped = KG_CRITERIA.filter((c) => c.scope === "repo");
    expect(repoScoped.length, "no criterion is `repo`-scoped — suspicious, since actors are repo-level").toBeGreaterThan(0);
    for (const c of repoScoped) {
      const basis = c.scopeBasis ?? "";
      expect(basis.length, `\`${c.id}\` is \`repo\` with no scopeBasis`).toBeGreaterThan(80);
      // Not merely long: it has to name something a reader can go and check.
      expect(
        /repoRootFor|repository root|repository-level|MEASURED/.test(basis),
        `\`${c.id}\`'s scopeBasis states no checkable reason — name the repo-level read or the measurement`,
      ).toBe(true);
    }
  });

  test("an `instance`-scoped criterion does NOT carry a scopeBasis", () => {
    // The field would be dead text there, and dead text drifts.
    for (const c of KG_CRITERIA.filter((c) => c.scope === "instance")) {
      expect(c.scopeBasis, `\`${c.id}\` is \`instance\` but carries a scopeBasis`).toBeUndefined();
    }
  });
});

describe("the auditor acts on scope, measured by running it", () => {
  const OUT = join(REPO, "bootstrap", "test");

  /** Every file under `dir` with its mtime, so a write of any kind shows up. */
  const snapshot = (dir: string): Record<string, number> => {
    if (!existsSync(dir)) return {};
    const out: Record<string, number> = {};
    for (const rel of readdirSync(dir, { recursive: true }) as string[]) {
      const st = statSync(join(dir, rel));
      if (st.isFile()) out[rel] = st.mtimeMs;
    }
    return out;
  };

  /**
   * The whole point, and it cannot be asserted any other way: `kg-audit.ts` runs
   * its entire audit at MODULE SCOPE, with no `import.meta.main` guard, so
   * importing it to reach one function would perform an audit and write sidecars
   * as a side effect. Spawning is the only way to observe it. (Guarding that
   * module is a worthwhile separate change and is NOT done here.)
   *
   * ## Why `--check`, and why the exit code is not the assertion
   *
   * The first version of this test spawned the WRITING form and deleted
   * `bootstrap/test/` afterwards. That was a defect: `bun test` runs files in
   * parallel, so for the length of the run `bootstrap/` transiently held sidecars
   * whose `where` fields name paths above it — and
   * `graph.test.ts > only the listed structural names remain` (bean `iwtn`) reads
   * exactly that. It passed alone and failed in the suite, which is the `ymsu`
   * shape: a test that writes what another test reads.
   *
   * `--check` writes nothing and prints the same summary, so the interference is
   * removed rather than cleaned up after. The exit code is still not asserted,
   * but for a different reason than the one this comment used to give. It said
   * the code was **1** because bootstrap's sidecars were not committed and their
   * directory was not declared; both stopped being true at `e46ab4bc109`, which
   * declared `test/results/` and committed the files. Whether those sidecars are
   * CURRENT is `kg:audit:all:check`'s question, run as its own CI step, and this
   * test does not answer it a second time. The assertions are about the REPORT,
   * plus one that it wrote nothing.
   */
  test("an instance run reports ZERO criticals where it once reported 76, and writes nothing", async () => {
    const before = snapshot(OUT);
    const p = Bun.spawn(
      ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", "./bootstrap", "--check"],
      { cwd: REPO, stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(p.stdout).text();
    await p.exited;

    // It must have audited something — a run over nothing reports no criticals too.
    //
    // **The floor was 50 and that number was the defect it was blind to.** It
    // was calibrated when a bootstrap run reported 134 subjects, of which 119
    // were cat-harness's Tool nodes audited as bootstrap's, because
    // `checkTools()` took no layer root. Threading one in dropped the count
    // to 15 and this assertion failed — an anti-vacuity floor CALIBRATED ON A
    // LEAKY MEASUREMENT encodes the leak, so fixing the leak breaks the floor
    // that was supposed to guard the fix.
    //
    // 10 is re-based on what bootstrap actually declares, so it is checkable
    // rather than observed: its 7 OWN skills (`knownSkills("./bootstrap")`
    // returns 30, of which 23 are cat-harness's and pending on a fourth leak of
    // the same class) plus its 3 diagrams. The floor still fails a run over
    // nothing, which is the only thing it is for (bean `dh4f`).
    const subjects = /\((\d+) subjects,/.exec(out);
    expect(subjects, `no summary line in:\n${out.slice(0, 300)}`).not.toBeNull();
    expect(Number(subjects![1])).toBeGreaterThan(10);

    expect(
      out.includes("CRITICAL"),
      `an instance run reported criticals. Before the scope field this was 76, of which 73 were\n` +
        `\`actor-roles-resolve\` against a repository-level actor set, and 3 were\n` +
        `\`satisfies-resolves\` against repository-level capabilities. If this fires again, check\n` +
        `whether a NEW criterion reads through \`repoRootFor\` and has not declared \`scope: "repo"\`.\n\n${out.slice(0, 1200)}`,
    ).toBe(false);

    // And it must SAY it withheld things, with a number. A silent suppression is
    // the failure mode the scope field introduces, so it is asserted rather than
    // trusted.
    expect(out).toContain("instance run: bootstrap");
    const suppressed = /— (\d+) `repo`-scoped criterion result\(s\) recorded n\/a/.exec(out);
    expect(suppressed, "the instance run printed no suppression count").not.toBeNull();
    expect(Number(suppressed![1])).toBeGreaterThan(0);

    // `--check` is the reading form. If this ever fails, the test itself has
    // started polluting `bootstrap/` again and `iwtn`'s guard will follow.
    //
    // Compared file by file, not by whether the directory exists. That was the
    // first spelling, and it went vacuous when `e46ab4bc109` committed the
    // directory: present before, present after, equal whatever was written.
    expect(snapshot(OUT), "`--check` wrote into bootstrap/ — it must not").toEqual(before);
  }, 300_000);
});
