import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { checkCorpusGate, COMMIT_ACTIVITY } from "@litlfred/cat-harness-tools/src/workflow/corpus-gate.js";
import { readBlockManifest } from "@litlfred/cat-harness-tools/pipeline/qa-utils.js";
import { loadBlockModuleSync } from "@litlfred/cat-harness-tools/pipeline/block-module.js";

/**
 * The same resolver `scripts/check-corpus-gate.ts` supplies in production.
 *
 * The gate takes it as a parameter rather than importing the content pipeline
 * itself (bean `zlmp`), so the tests have to provide the real one — a stub
 * here would leave the production path untested.
 */
function labelFor(tsPath: string): string | undefined {
  if (!readBlockManifest(tsPath)) return undefined;
  const loaded = loadBlockModuleSync(tsPath);
  if (!loaded) {
    throw new Error(
      `${tsPath} looks like a block manifest but its default export is not a labelled block`,
    );
  }
  return loaded.label;
}
import { drainSubprocess } from "@litlfred/cat-harness-tools/scripts/tests/helpers.js";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";
import { complete, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { instanceId, saveInstance } from "@litlfred/cat-harness-tools/src/workflow/store.js";

/**
 * Everything before this was answerable: `workflow_gate` tells an agent whether
 * a step is enabled, *if it asks*. This is the piece that does not depend on
 * asking — it runs from a hook or from CI, so an agent that ignored the
 * orchestration entirely still cannot land a block change no instance records
 * the editor having authorised.
 *
 * The two properties worth pinning are that it refuses by default, and that it
 * refuses when it cannot tell. A gate that fails open reports clean by not
 * looking.
 */

/**
 * The platform the gate is pointed at — cat-harness, whose code this is — and
 * the layer whose diagram it gates. The test lives here, in
 * folio-assistant-core, because its subject is `editing-hci-validation.bpmn`,
 * which this layer owns: standing alone, cat-harness has no such diagram
 * (bean `ho66`).
 */
const INSTANCE_ROOT = resolve(import.meta.dir, "../../../cat-harness");
const CORE = resolve(import.meta.dir, "../..");
const BUILDERS = JSON.stringify(resolve(import.meta.dir, "../../../cat-harness-tools/schemas/builders.ts"));

let repo: string;

const block = (slug: string, label: string): string => {
  const dir = join(repo, "folio", "paper", "ch");
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${slug}.ts`);
  writeFileSync(
    p,
    `import { remark } from ${BUILDERS};\n` +
      `export default remark({ label: ${JSON.stringify(label)}, title: "T", statement: "s" });\n`,
  );
  writeFileSync(join(dir, `${slug}.md`), "Prose.\n");
  return `folio/paper/ch/${slug}.ts`;
};

/** Drive a real instance to the point where the commit step is enabled. */
const authorise = async (label: string, decision = "accept"): Promise<void> => {
  const model = await loadProcessModel(workflowFile(CORE, "editing-hci-validation.bpmn"));
  const state = startInstance(model, { id: instanceId(model.id, label), subject: label });
  // CallActivity_Evidence sits between claiming the bean and drafting: a
  // recommendation gathers its evidence BEFORE the change is written. It is a
  // whole SUBPROCESS, so a walk of the process has to walk that too.
  complete(model, state, "Task_DescribeChange");
  // Process_BeanOpen (bean `m8gz`), then its `claimed` branch.
  drainSubprocess(model, state, "Task_ClaimBean");
  complete(model, state, "GW_BeanYours", { outcome: "claimed" });
  drainSubprocess(model, state, "CallActivity_Evidence");
  for (const n of ["Task_DraftEdit", "Task_SchemaValidate", "Task_SyntaxSpell", "Task_BuildGates"]) {
    complete(model, state, n);
  }
  complete(model, state, "Gateway_ReviewerKind", { outcome: "no" });
  complete(model, state, "Task_AgentReview");
  complete(model, state, "Task_CollateFindings");
  complete(model, state, "Task_LogFindings");
  complete(model, state, "Task_ReviewFindings");
  // The options analysis sits between the findings and the decision
  // (`u4hs`). These fixtures are ordinary edits, so they take `GW_Trigger`'s
  // "no" — the early exit `A_Frame` has always documented and, until this
  // wiring exposed the gap, the diagram did not actually have.
  drainSubprocess(model, state, "Call_OptionsAnalysis", { GW_Trigger: "no" });
  // The decision and its audit note are recorded before the gateway routes on them.
  complete(model, state, "Task_RecordDecision");
  complete(model, state, "Gateway_EditorDecision", { outcome: decision });
  saveInstance(repo, state);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "corpus-gate-"));
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

const check = (files: string[]) => checkCorpusGate(repo, { files, platformRoot: INSTANCE_ROOT, labelFor });

describe("what the gate ignores", () => {
  test("ignoresNonContent", async () => {
    writeFileSync(join(repo, "README.md"), "hi\n");
    expect(await check(["README.md", "package.json", "src/thing.ts"])).toEqual([]);
  });

  test("ignoresQaSidecar", async () => {
    block("x", "rem:x");
    // Gating these would make every qa-sweep look like an unauthorised edit.
    expect(await check(["folio/paper/ch/x.qa.json"])).toEqual([]);
  });

  test("skipsNonManifestTs", async () => {
    mkdirSync(join(repo, "folio", "paper", "ch"), { recursive: true });
    writeFileSync(join(repo, "folio/paper/ch/helper.ts"), "export const n = 1;\n");
    expect(await check(["folio/paper/ch/helper.ts"])).toEqual([]);
  });
});

describe("refusing by default", () => {
  test("noInstanceRefused", async () => {
    const f = block("carbon", "rem:carbon");
    const [finding] = await check([f]);
    expect(finding.allowed).toBe(false);
    expect(finding.label).toBe("rem:carbon");
    expect(finding.reason).toContain("no workflow instance");
    expect(finding.reason).toContain("workflow_start");
  });

  test("beforeDecisionRefused", async () => {
    const f = block("carbon", "rem:carbon");
    const model = await loadProcessModel(
      workflowFile(CORE, "editing-hci-validation.bpmn"),
    );
    const state = startInstance(model, {
      id: instanceId(model.id, "rem:carbon"),
      subject: "rem:carbon",
    });
    complete(model, state, "Task_DescribeChange");
    saveInstance(repo, state);

    const [finding] = await check([f]);
    expect(finding.allowed).toBe(false);
    expect(finding.reason).toContain("not enabled");
  });

  test("discardNeverAuthorises", async () => {
    const f = block("carbon", "rem:carbon");
    await authorise("rem:carbon", "discard");
    // The instance completed — but through the discard end event, so the commit
    // step was never enabled and never taken.
    const [finding] = await check([f]);
    expect(finding.allowed).toBe(false);
  });
});

describe("allowing what the process authorised", () => {
  test("acceptedAllowed", async () => {
    const f = block("carbon", "rem:carbon");
    await authorise("rem:carbon");
    const [finding] = await check([f]);
    expect(finding.allowed).toBe(true);
    expect(finding.instance).toBe("editing--rem-carbon");
  });

  test("alreadyCommittedAllowed", async () => {
    const f = block("carbon", "rem:carbon");
    const model = await loadProcessModel(
      workflowFile(CORE, "editing-hci-validation.bpmn"),
    );
    await authorise("rem:carbon");
    const state = (await import("@litlfred/cat-harness-tools/src/workflow/store.js")).loadInstance(
      repo,
      instanceId(model.id, "rem:carbon"),
    )!;
    complete(model, state, COMMIT_ACTIVITY);
    saveInstance(repo, state);

    const [finding] = await check([f]);
    expect(finding.allowed).toBe(true);
    expect(finding.reason).toContain("already recorded");
  });

  test("siblingMdOnce", async () => {
    block("carbon", "rem:carbon");
    await authorise("rem:carbon");
    // One block's worth of work, not two problems.
    const findings = await check(["folio/paper/ch/carbon.ts", "folio/paper/ch/carbon.md"]);
    expect(findings).toHaveLength(1);
    expect(findings[0].allowed).toBe(true);
  });
});

describe("it does not fail open", () => {
  test("unknownIdentityRefused", async () => {
    const dir = join(repo, "folio", "paper", "ch");
    mkdirSync(dir, { recursive: true });
    // Reads as a manifest textually, but the module throws on import: the
    // builder rejects a theorem label on a remark.
    writeFileSync(
      join(dir, "bad.ts"),
      `import { remark } from ${BUILDERS};\n` +
        `export default remark({ label: "theorem:x", title: "T", statement: "s" });\n`,
    );
    const [finding] = await check(["folio/paper/ch/bad.ts"]);
    expect(finding.allowed).toBe(false);
    expect(finding.reason).toContain("does not fail open");
  });

  test("unloadablePolicyStops", async () => {
    const platform = mkdtempSync(join(tmpdir(), "platform-"));
    mkdirSync(join(platform, "processes"), { recursive: true });
    mkdirSync(join(platform, "skills", "pkg"), { recursive: true });
    writeFileSync(
      join(platform, "processes/editing-hci-validation.bpmn"),
      await Bun.file(workflowFile(CORE, "editing-hci-validation.bpmn")).text(),
    );
    // A package holds a skill: policies are read from discovered packages (bean 9umr).
    writeFileSync(join(platform, "skills/pkg/a-skill.md"), "# A skill\n");
    writeFileSync(join(platform, "skills/pkg/workflow-policy.json"), "{ not json");

    // Treating a broken policy as "no relaxations" would refuse work a package
    // had legitimately declared. The gate loads the editing process and its
    // policy only once a changed file is a block (cat-harness-tools#2195: a
    // change with no block is not a corpus write), so the change carries one.
    const f = block("carbon", "rem:carbon");
    await expect(checkCorpusGate(repo, { files: [f], platformRoot: platform, labelFor })).rejects.toThrow(
      /policy is not loadable/,
    );
    rmSync(platform, { recursive: true, force: true });
  });
});
