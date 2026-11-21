/**
 * The engine is STRICT (owner rulings, 2026-09-24; issue #1207, bean `n2l9`):
 * `owner` and `collaborator` may perform every task, because every write role
 * collapses into `collaborator`; `viewer` and nobody may perform none; and the
 * principal is the one GitHub vouches for, never a typed actor.
 *
 * This is the measurement the skill used to quote as prose, made a test so a
 * lane added without a grant, or a grant lost, fails here instead of in a
 * paragraph nobody re-runs.
 */
import { describe, expect, test } from "bun:test";
import { basename } from "node:path";

import { isActivity, loadProcessModel, processDiagrams } from "../../src/workflow/process-model.js";
import { authorizeTask } from "../../src/workflow/authorize.js";
import { loadAccessContext, principalFromEnv } from "../../src/core/access.js";
import { githubPrincipalFor } from "../../src/core/github-auth.js";
import { workflowFile, workflowFiles } from "../known-skills.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

// The access context, permissions and diagrams are the HARNESS's; this test moved up with the code (70lx).
const ROOT = HARNESS_ROOT;
const CTX = loadAccessContext(ROOT);

/**
 * Every step of every harness diagram, parsed ONCE for the file. Parsing the
 * whole process corpus takes seconds on a CI runner, and the second test below
 * re-parsed all of it to take the first step — which is how it ran past bun's
 * 5 s limit. Memoised, the corpus is read by the first test that asks.
 */
let stepsOnce: Promise<{ process: string; task: string; role?: string }[]> | undefined;
function everyStep() {
  return (stepsOnce ??= collectSteps());
}

async function collectSteps() {
  const out: { process: string; task: string; role?: string }[] = [];
  for (const f of processDiagrams(workflowFiles(ROOT)).map((p) => basename(p))) {
    const m = await loadProcessModel(workflowFile(ROOT, f));
    for (const n of m.nodes.values()) {
      if (isActivity(n) || n.kind === "exclusive") out.push({ process: m.id, task: n.id, role: n.roleRef });
    }
  }
  return out;
}

describe("strict: who may perform which task", () => {
  test("owner and collaborator may perform every task; viewer and nobody none", async () => {
    const steps = await everyStep();
    // Vacuity guard: an empty process directory would pass everything below.
    expect(steps.length).toBeGreaterThan(100);
    const refusedFor = (actor: string | null) =>
      steps.filter(
        (s) =>
          !authorizeTask(
            CTX,
            { ...s, principal: { actor, authenticatedBy: actor ? "github" : "none", account: "x" } },
            "strict",
          ).allowed,
      ).length;
    expect(refusedFor("owner")).toBe(0);
    expect(refusedFor("collaborator")).toBe(0);
    expect(refusedFor("viewer")).toBe(steps.length);
    expect(refusedFor(null)).toBe(steps.length);
    // The whole process corpus is parsed here (see `everyStep`): a real-corpus
    // read, so it is given room beyond bun's 5 s default.
  }, 60_000);

  test("a typed actor is refused in strict mode, even one policy would permit", async () => {
    const [step] = await everyStep();
    const typed = principalFromEnv("collaborator", {});
    expect(typed.authenticatedBy).toBe("asserted");
    expect(authorizeTask(CTX, { ...step!, principal: typed }, "strict").allowed).toBe(false);
  });
});

describe("the engine's principal is the one GitHub vouches for", () => {
  test("a collaborator's token yields the collaborator actor, with the login as account", async () => {
    const fake = async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("/user")
          ? { login: "octo" }
          : { owner: { type: "User" }, visibility: "public", permissions: { push: true, pull: true } },
    });
    const { principal } = await githubPrincipalFor(ROOT, { GH_TOKEN: "t", GITHUB_REPOSITORY: "o/r" }, fake);
    expect(principal).toEqual({ actor: "collaborator", authenticatedBy: "github", account: "octo" });
  });

  test("no credential yields nobody, which strict refuses", async () => {
    const { principal } = await githubPrincipalFor(ROOT, { GITHUB_REPOSITORY: "o/r" });
    expect(principal).toEqual({ actor: null, authenticatedBy: "none" });
  });
});
