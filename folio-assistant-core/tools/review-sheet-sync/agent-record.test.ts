/** agent-record: the Agent tab cells made by a tool, checked by the sheet's own check. */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadBlockModuleSync } from "@litlfred/cat-harness-tools/pipeline/block-module.js";
import { readBlockManifest } from "@litlfred/cat-harness-tools/pipeline/qa-utils.js";
import { COMMIT_ACTIVITY, checkCorpusGate } from "@litlfred/cat-harness-tools/src/workflow/corpus-gate.js";
import { loadInstance } from "@litlfred/cat-harness-tools/src/workflow/store.js";
import { instanceDeclarationFilename } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import {
  blockLabelFor,
  brief,
  changedBlockLabels,
  dispositions,
  done,
  editingWorkflowInstance,
  linkNos,
  nosLabel,
  push,
  qaPass,
} from "./agent-record.js";

const comments = [["No.", "Change-sets"], ...["126", "127", "128", "129", "130", "131", "134", "135", "136", "137", "138", "139", "326"].map((n) => [n, "CS-001"]), ["132", "CS-003"], ["133", "CS-003"]];

describe("agent-record (owner, 2026-10-31, option C)", () => {
  test("numbersGrouped", () => {
    expect(nosLabel(["136"])).toBe("No. 136");
    expect(nosLabel(["139", "127", "128", "129", "130", "131", "134", "135", "138"])).toBe("Nos. 127 to 131, 134, 135, 138 and 139");
  });
  test("numbersFromSheet", () => {
    const r = dispositions({ cs: "CS-001", comments, items: [{ nos: [136, 326], word: "Accepted", why: "Done." }, { rest: true, word: "Not accepted", why: "Already reflected." }] });
    expect(r.problems).toBe("");
    expect(r.text).toBe("Nos. 136 and 326: Accepted. Done.\nNos. 126 to 131, 134, 135 and 137 to 139: Not accepted. Already reflected.");
  });
  test("historyKeptAppended", () => {
    const r = dispositions({ cs: "X", nos: [1], previous: "Decided (No. 1, d): A.\nNo. 1: Noted.", decided: ["Decided (No. 1, e): B."], overall: "All.", items: [{ nos: [1], word: "Noted" }] });
    expect(r.text).toBe("Decided (No. 1, d): A.\nDecided (No. 1, e): B.\n\nOverall: All.\nNo. 1: Noted.");
  });
  test("blueWordUsed", () => {
    const blue = [["No.", "Disposition"], ["136", "Noted"], ["127", "Pending"]];
    expect(dispositions({ cs: "CS-001", comments, blue, items: [{ nos: [136] }, { rest: true, word: "Not accepted" }] }).text)
      .toContain("No. 136: Noted.");
    expect(dispositions({ cs: "CS-001", comments, blue, items: [{ nos: [136], word: "Accepted" }, { rest: true, word: "Not accepted" }] }).problems)
      .toBe("⚠ No. 136: Accepted here, Noted in the people's Disposition");
  });
  test("numberOutsideOrMissing", () => {
    expect(dispositions({ cs: "CS-001", comments, items: [{ nos: [132], word: "Noted" }] }).problems).toContain("No. 132 is not in this change set");
    expect(dispositions({ cs: "CS-001", comments, items: [{ nos: [136], word: "Accepted" }] }).problems).toMatch(/^⚠ No disposition yet for Nos\. 126 to 131/);
  });
  test("pushTimeAndSha", () => {
    expect(push("e7b4094fd22055f205b52ba3c6c980b11285e228", 15, new Date("2026-10-31T15:27:40Z"))).toEqual({
      "PR head (change set)": "e7b4094fd22055f205b52ba3c6c980b11285e228",
      "Staging deploy (change set)": "building, expected 2026-10-31 15:42Z",
      "Agent completed (UTC, change set)": "2026-10-31 15:27Z",
    });
    expect(() => push("e7b4094", 15)).toThrow(/full 40-character/);
    expect(done(new Date("2026-10-31T15:29:59Z"))).toEqual({ "Agent completed (UTC, change set)": "2026-10-31 15:29Z", "Agent step (change set)": "idle 2026-10-31 15:29Z" });
  });
  test("briefSameLines", () => {
    expect(brief({ cs: "X", nos: [1, 2], previous: "Decided (No. 1, d): A.", overall: "All.", items: [{ nos: [1, 2], word: "Accepted", why: "Done." }] }, "3.1, second paragraph"))
      .toBe("<!-- review-brief -->\n- **Overall:** All.\n- **Nos. 1 and 2:** Accepted. Done.\n- **Where to look:** 3.1, second paragraph\n<!-- /review-brief -->");
  });
  test("pcsLinksDashboard", () => {
    const d = "https://x.io/pc/";
    // On DPI-H the sheet's No. is one below the ref: No. 136 is PC-0137.
    const refs = { "127": "PC-0128", "128": "PC-0129", "129": "PC-0130", "134": "PC-0135" };
    expect(linkNos("Nos. 127 to 129 and 134", d, refs)).toBe(`Nos. [127](${d}#PC-0128), [128](${d}#PC-0129), [129](${d}#PC-0130) and [134](${d}#PC-0135)`);
    expect(linkNos("No. 5", d, {})).toBe("No. 5");
    const rows = [["No.", "Comment ref", "Change-sets"], ["7", "PC-0008", "X"]];
    expect(brief({ cs: "X", comments: rows, overall: "All fixed.", items: [{ nos: [7], word: "Accepted" }] }, undefined, d))
      .toBe(`<!-- review-brief -->\n- **Overall:** All fixed.\n- **No. [7](${d}#PC-0008):** Accepted.\n<!-- /review-brief -->`);
    expect(() => brief({ cs: "X", nos: [7], items: [] }, undefined, d)).toThrow(/Comment ref/);
  });
});

describe("review-sheet QA pass writes editing-hci-validation instances that satisfy check:corpus-gate (#448)", () => {
  const INSTANCE_ROOT = resolve(import.meta.dir, "../../../cat-harness");
  const BUILDERS = JSON.stringify(resolve(import.meta.dir, "../../../cat-harness-tools/schemas/builders.ts"));

  function labelFor(tsPath: string): string | undefined {
    if (!readBlockManifest(tsPath)) return undefined;
    const loaded = loadBlockModuleSync(tsPath);
    if (!loaded) throw new Error(`${tsPath} is not a labelled block`);
    return loaded.label;
  }

  test("qaPassWritesInstances", async () => {
    const repo = mkdtempSync(join(tmpdir(), "agent-record-gate-"));
    try {
      // The fixture is a layer with its own `beans/` in the checkout, so
      // its workflow instances are written and read there. Without this the
      // store resolved `beans` to cat-harness's, which is kept on
      // `cat/cat-harness/beans` and is not mounted in CI.
      writeFileSync(
        join(repo, instanceDeclarationFilename("agent-record-gate")),
        JSON.stringify({ name: "agent-record-gate", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }] }),
      );
      mkdirSync(join(repo, "beans", "workflows"), { recursive: true });
      const ch = join(repo, "folio", "dth-hrh", "ch11");
      mkdirSync(ch, { recursive: true });
      writeFileSync(
        join(ch, "r-discussion-minimum-data-set.ts"),
        `import { remark } from ${BUILDERS};\n` +
          `export default remark({ label: "rem:discussion-minimum-data-set", title: "T", statement: "s" });\n`,
      );
      writeFileSync(join(ch, "r-discussion-minimum-data-set.md"), "Core data elements (CDE-HRH).\n");
      writeFileSync(
        join(ch, "ch11.ts"),
        `export default chapter({ label: "chap:ch11", title: "Ch 11", sections: [] });\n`,
      );
      writeFileSync(join(ch, "helper.ts"), `export const n = 1;\n`);

      const changedFiles = [
        "folio/dth-hrh/ch11/r-discussion-minimum-data-set.md",
        "folio/dth-hrh/ch11/r-discussion-minimum-data-set.ts",
        "folio/dth-hrh/ch11/ch11.ts",
        "folio/dth-hrh/ch11/helper.ts",
      ];

      // Before qaPass, checkCorpusGate refuses the block change.
      const before = await checkCorpusGate(repo, {
        files: changedFiles,
        platformRoot: INSTANCE_ROOT,
        labelFor,
      });
      expect(before).toHaveLength(1);
      expect(before[0]!.allowed).toBe(false);

      const res = qaPass({
        cs: "CS-001",
        qaGate: "Passed b20534f: dispositions match Blue and the diff",
        report: "https://github.com/litlfred/dth-hrh/tree/qa-reports/pr/61/b20534f",
        decision: "Ready for merge = Yes on Review Change Sets",
        repo,
        files: changedFiles,
        now: new Date("2026-10-31T21:19:00Z"),
      });

      expect(res.cells).toEqual({
        "QA gate (change set)": "Passed b20534f: dispositions match Blue and the diff",
        "QA report (change set)": "https://github.com/litlfred/dth-hrh/tree/qa-reports/pr/61/b20534f",
      });
      expect(res.blocks).toEqual(["rem:discussion-minimum-data-set"]);
      expect(res.instances).toHaveLength(1);
      expect(existsSync(res.instances[0]!)).toBe(true);

      const state = loadInstance(repo, "editing--rem-discussion-minimum-data-set")!;
      expect(state.processId).toBe("Process_Editing");
      expect(state.subject).toBe("rem:discussion-minimum-data-set");
      expect(state.bean).toBe("CS-001");
      expect(state.history.some((h) => h.node === COMMIT_ACTIVITY)).toBe(true);
      const commitEntry = state.history.find((h) => h.node === COMMIT_ACTIVITY)!;
      expect(commitEntry.note).toContain("CS-001");
      expect(commitEntry.note).toContain("Passed b20534f");
      expect(commitEntry.note).toContain("Ready for merge = Yes");

      // After qaPass, checkCorpusGate allows the block change.
      const after = await checkCorpusGate(repo, {
        files: changedFiles,
        platformRoot: INSTANCE_ROOT,
        labelFor,
      });
      expect(after).toHaveLength(1);
      expect(after[0]!.allowed).toBe(true);
      expect(after[0]!.instance).toBe("editing--rem-discussion-minimum-data-set");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("discoversBlocksFromGit", () => {
    const repo = mkdtempSync(join(tmpdir(), "agent-record-git-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: repo });

      const ch = join(repo, "folio", "dth-hrh", "ch07");
      mkdirSync(ch, { recursive: true });
      writeFileSync(
        join(ch, "fr-rec-01.ts"),
        `import { functionalRequirement } from "../../schema/dak";\n` +
          `export default functionalRequirement({ label: "freq:FR-REC-01", title: "Create record", uses: [] });\n`,
      );
      writeFileSync(join(ch, "fr-rec-01.md"), "Initial text.\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repo });

      // Edit only the .md sibling on a feature commit.
      writeFileSync(join(ch, "fr-rec-01.md"), "Updated text for CDE-HRH.\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-q", "-m", "CS-001 update"], { cwd: repo });
      const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

      expect(changedBlockLabels(repo, { since: "HEAD~1" })).toEqual(["freq:FR-REC-01"]);

      const res = qaPass({
        cs: "CS-001",
        head,
        summary: "dispositions match Blue and the diff",
        repo,
        since: "HEAD~1",
        blocks: ["prose:ch07-records"],
      });
      expect(res.blocks).toEqual(["prose:ch07-records", "freq:FR-REC-01"]);
      expect(res.cells["QA gate (change set)"]).toBe(`Passed ${head.slice(0, 7)}: dispositions match Blue and the diff`);
      expect(loadInstance(repo, "editing--freq-fr-rec-01")?.subject).toBe("freq:FR-REC-01");
      expect(loadInstance(repo, "editing--prose-ch07-records")?.subject).toBe("prose:ch07-records");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("refusesBadQaGate", () => {
    const repo = mkdtempSync(join(tmpdir(), "agent-record-refuse-"));
    try {
      expect(() =>
        qaPass({ cs: "CS-001", qaGate: "Failed b20534f: No. 136 missing from diff", repo, blocks: ["rem:x"] }),
      ).toThrow(/QA gate failed/);
      expect(() =>
        qaPass({ cs: "CS-001", qaGate: "Passed: looks fine", repo, blocks: ["rem:x"] }),
      ).toThrow(/names no commit/);
      expect(() =>
        qaPass({ cs: "CS-001", head: "b20534f", qaGate: "Passed 1234567: old commit", repo, blocks: ["rem:x"] }),
      ).toThrow(/QA gate stale/);
      expect(existsSync(join(repo, "beans", "workflows"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("blockLabelForManifestsOnly", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-record-label-"));
    try {
      const p1 = join(dir, "b.ts");
      writeFileSync(p1, `// export default chapter({ label: "chap:fake" })\nexport default prose({ label: "prose:intro" });\n`);
      expect(blockLabelFor(p1)).toBe("prose:intro");

      const p2 = join(dir, "chap.ts");
      writeFileSync(p2, `export default chapter({ label: "chap:one", title: "One", sections: [] });\n`);
      expect(blockLabelFor(p2)).toBeUndefined();

      const p3 = join(dir, "util.ts");
      writeFileSync(p3, `export const label = "prose:not-a-block";\n`);
      expect(blockLabelFor(p3)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("instanceRecordsDecision", () => {
    const inst = editingWorkflowInstance("prose:annex-1", {
      cs: "CS-001",
      qaGate: "Passed b20534f: all 6 checks green",
      decision: "Owner merge OK (Q-MERGE1 A)",
      now: new Date("2026-10-31T21:19:00Z"),
    });
    expect(inst.id).toBe("editing--prose-annex-1");
    expect(inst.tokens).toEqual(["Task_Commit"]);
    expect(inst.history.map((h) => h.node)).toContain("Task_Commit");
    const raw = JSON.parse(JSON.stringify(inst));
    expect(raw.$schema).toBe("folio-workflow-instance/v1");
  });
});
