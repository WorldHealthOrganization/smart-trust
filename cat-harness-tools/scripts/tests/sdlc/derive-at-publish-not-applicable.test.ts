/**
 * A writer that does not apply to a root is SKIPPED with its reason, never a
 * failure — and only the writer can say so (smart-ra#66, run 38714163952).
 *
 * The falsifiers: a writer that declines (exit 78) is reported skipped with
 * the reason it handed over; any other non-zero exit is still a failure; the
 * artefacts that name a skipped writer are excused, and only those; and the
 * QA-working-copy readers decline in a root without the gates workflow while
 * a root WITH it (the folio-assistant index) still builds the copy.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { excused, outcomeOf, runWriter, type DeclaredArtefact } from "../../derive-at-publish.ts";
import { GATES_WORKFLOW } from "../../lib/gates-workflow.ts";
import { NOT_APPLICABLE_EXIT } from "../../lib/not-applicable.ts";
import { workingCopyUnbuildable } from "../../qa-working-copy.ts";

const SCRIPTS = resolve(import.meta.dir, "..", "..");

function scratch(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "derive-na-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("a writer's exit, read", () => {
  test("0 ran, 78 skipped with its reason, anything else failed", () => {
    expect(outcomeOf(0, undefined)).toEqual({ kind: "ran" });
    expect(outcomeOf(NOT_APPLICABLE_EXIT, "no gates workflow\n")).toEqual({ kind: "skipped", why: "no gates workflow" });
    expect(outcomeOf(NOT_APPLICABLE_EXIT, undefined)).toEqual({ kind: "skipped", why: "the writer gave no reason" });
    expect(outcomeOf(2, "ignored: only a decline hands a reason")).toEqual({ kind: "failed", exit: 2 });
    expect(outcomeOf(1, undefined)).toEqual({ kind: "failed", exit: 1 });
    expect(outcomeOf(null, undefined)).toEqual({ kind: "failed", exit: null });
  });

  test("a real writer that declines hands its reason through the runner", () => {
    const s = scratch();
    try {
      const w = join(s.dir, "writer.ts");
      writeFileSync(w, `import { exitNotApplicable } from ${JSON.stringify(join(SCRIPTS, "lib", "not-applicable.ts"))};\nexitNotApplicable("fake:writer", "this root has no frobnicator");\n`);
      expect(runWriter(["bun", w], s.dir)).toEqual({ kind: "skipped", why: "this root has no frobnicator" });
      const bad = join(s.dir, "bad.ts");
      writeFileSync(bad, "process.exit(2);\n");
      expect(runWriter(["bun", bad], s.dir)).toEqual({ kind: "failed", exit: 2 });
      const ok = join(s.dir, "ok.ts");
      writeFileSync(ok, "\n");
      expect(runWriter(["bun", ok], s.dir)).toEqual({ kind: "ran" });
    } finally {
      s.cleanup();
    }
  });
});

describe("the artefacts of a skipped writer are excused, and only those", () => {
  const a = (path: string, writer: string[]): DeclaredArtefact => ({ instance: "cat-harness", abs: `/x/${path}`, path, writer, because: "checkout" });
  test("an entry naming a skipped writer is excused, even beside another writer", () => {
    const plan = [a("uml/overview/", ["uml:overview"]), a("docs/both/", ["docs:pages", "uml:overview"]), a("docs/subgraph/", ["subgraph:jsonld"])];
    const r = excused(plan, new Map([["uml:overview", "why"]]));
    expect(r.excused.map((x) => x.path)).toEqual(["uml/overview/", "docs/both/"]);
    expect(r.judged.map((x) => x.path)).toEqual(["docs/subgraph/"]);
  });
  test("nothing skipped: every entry is judged", () => {
    const plan = [a("uml/overview/", ["uml:overview"])];
    expect(excused(plan, new Map())).toEqual({ excused: [], judged: plan });
  });
});

describe("the QA working copy's readers decline only where it cannot be built", () => {
  test("no gates workflow at the root: unbuildable, naming it", () => {
    const s = scratch();
    try {
      expect(workingCopyUnbuildable(s.dir)).toContain(GATES_WORKFLOW);
    } finally {
      s.cleanup();
    }
  });

  test("the gates workflow present (the folio-assistant index): buildable, so the writer runs and its failures count", () => {
    const s = scratch();
    try {
      mkdirSync(join(s.dir, ".github", "workflows"), { recursive: true });
      writeFileSync(join(s.dir, GATES_WORKFLOW), "jobs: {}\n");
      expect(workingCopyUnbuildable(s.dir)).toBeNull();
    } finally {
      s.cleanup();
    }
  });

  test("a content index (index.config.json present, bean rn24): buildable, so the writer runs and its failures count", () => {
    const s = scratch();
    try {
      writeFileSync(join(s.dir, "index.config.json"), "{}\n");
      expect(workingCopyUnbuildable(s.dir)).toBeNull();
    } finally {
      s.cleanup();
    }
  });

  test("requireCurrentWorkingCopy exits 78 with its reason in a root without the workflow, before building anything", () => {
    const s = scratch();
    try {
      const reason = join(s.dir, "reason.txt");
      const r = Bun.spawnSync(
        ["bun", "-e", `import { requireCurrentWorkingCopy } from ${JSON.stringify(join(SCRIPTS, "qa-working-copy.ts"))}; requireCurrentWorkingCopy(${JSON.stringify(s.dir)}, "uml:overview");`],
        { cwd: s.dir, stdout: "pipe", stderr: "pipe", env: { ...process.env, QA_WORKING_COPY_BUILDING: "", CAT_NOT_APPLICABLE_REASON_FILE: reason } },
      );
      expect(r.exitCode).toBe(NOT_APPLICABLE_EXIT);
      expect(r.stdout.toString()).toContain("uml:overview: NOT APPLICABLE");
      expect(readFileSync(reason, "utf-8")).toContain(GATES_WORKFLOW);
    } finally {
      s.cleanup();
    }
  });
});
