/**
 * `workflow:instances` — bean `folio-assistant-5ulq` (advisory by owner ruling).
 *
 * The instance directory is asked of the bean graph rather than written here,
 * and git is injected, so every state is reached without a repository.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveBeanDefs, resolveBeanGraphNode } from "../../beans.ts";
import { report, sweepWorkflowInstances, workflowInstances } from "../../workflow-instances.ts";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A checkout with the default bean graph and the given instance files (plus optional bean files). */
function fixture(
  instances: Record<string, unknown>,
  beans?: Record<string, { status: string; title?: string; tags?: string[] }>,
): { root: string; dir: string; defsDir?: string } {
  const root = mkdtempSync(join(tmpdir(), "wf-instances-"));
  roots.push(root);
  const dir = resolveBeanGraphNode(root, "workflow-state").dir!;
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(instances)) {
    writeFileSync(join(dir, name), typeof body === "string" ? body : JSON.stringify(body));
  }
  let defsDir: string | undefined;
  if (beans) {
    defsDir = resolveBeanDefs(root).dir!;
    mkdirSync(defsDir, { recursive: true });
    for (const [id, b] of Object.entries(beans)) {
      const tagsYaml = b.tags?.length ? `tags:\n${b.tags.map((t) => `  - ${t}`).join("\n")}\n` : "";
      const md = `---\n# ${id}\ntitle: ${b.title ?? id}\nstatus: ${b.status}\n${tagsYaml}---\n`;
      writeFileSync(join(defsDir, `${id}.md`), md);
    }
  }
  return { root, dir, defsDir };
}

const git = (merges: string, shallow = "false") => (args: string[]) =>
  args[0] === "rev-parse" ? shallow : merges;

describe("workflowInstances", () => {
  test("more merges than instances is a FINDING, and the report says advisory", () => {
    const { root } = fixture({
      "a.json": { startedAt: "2026-10-01T00:00:00Z" },
      "b.json": { startedAt: "2026-09-01T00:00:00Z" },
    });
    const c = workflowInstances({ root, git: git("40") });
    expect(c).toMatchObject({ state: "finding", instances: 2, startedSince: 1, merges: 40, gatesReading: [] });
    const text = report(c);
    expect(text).toContain("FINDING (advisory)");
    expect(text).toContain("upper bound");
  });

  test("an instance with no startedAt is dated by its first history entry", () => {
    const { root } = fixture({ "r.json": { history: [{ at: "2026-10-02T00:00:00Z" }] } });
    expect(workflowInstances({ root, git: git("1") })).toMatchObject({ state: "ok", startedSince: 1, merges: 1 });
  });

  test("an instance that cannot be dated or parsed makes the count UNKNOWN, not smaller", () => {
    const { root } = fixture({ "x.json": "{ not json", "y.json": { status: "running" } });
    const c = workflowInstances({ root, git: git("5") });
    expect(c.state).toBe("unknown");
    expect(report(c)).toContain("x.json");
  });

  test("a shallow clone is UNKNOWN: its merge count is not the repository's", () => {
    const { root } = fixture({});
    expect(workflowInstances({ root, git: git("3", "true") })).toMatchObject({ state: "unknown" });
  });

  test("a declared but absent directory is UNKNOWN, never zero instances", () => {
    const { root, dir } = fixture({});
    rmSync(dir, { recursive: true });
    expect(workflowInstances({ root, git: git("3") }).state).toBe("unknown");
  });

  test("a CI workflow naming the graph is counted as reading it", () => {
    const { root } = fixture({});
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "w.yml"), "run: bun run cat workflow:instances\n");
    writeFileSync(join(root, ".github", "workflows", "other.yml"), "run: echo hi\n");
    expect(workflowInstances({ root, git: git("0") })).toMatchObject({ state: "ok", gatesReading: ["w.yml"] });
  });

  test("reports running instances on closed or missing work items and in-progress process work items without a running instance (#988)", () => {
    const { root } = fixture(
      {
        "closed-bean.json": {
          id: "crdm--done",
          status: "running",
          bean: "folio-assistant-done",
          tokens: ["Task_1"],
          startedAt: "2026-10-10T00:00:00Z",
        },
        "missing-bean.json": {
          id: "crdm--gone",
          status: "running",
          bean: "folio-assistant-gone",
          tokens: ["Task_1"],
          startedAt: "2026-10-10T00:00:00Z",
        },
        "tracked.json": {
          id: "ccr--tracked",
          status: "running",
          bean: "folio-assistant-tracked",
          tokens: ["Task_1"],
          startedAt: "2026-10-10T00:00:00Z",
        },
      },
      {
        "folio-assistant-done": { status: "completed", tags: ["process:Process_CRDM"] },
        "folio-assistant-tracked": { status: "in-progress", tags: ["process:Process_CodeChangeReview"] },
        "folio-assistant-untracked": { status: "in-progress", tags: ["process:Process_CodeChangeReview"] },
      },
    );
    const c = workflowInstances({ root, git: git("0") });
    expect(c).toMatchObject({
      state: "finding",
      staleInstances: [
        { file: "closed-bean.json", instance: "crdm--done", bean: "folio-assistant-done", reason: "bean-closed", beanStatus: "completed" },
        { file: "missing-bean.json", instance: "crdm--gone", bean: "folio-assistant-gone", reason: "bean-missing" },
      ],
      untrackedProcessBeans: [{ bean: "folio-assistant-untracked", processes: ["Process_CodeChangeReview"] }],
    });
    const text = report(c);
    expect(text).toContain("running instances on closed/missing work items: 2");
    expect(text).toContain("in-progress process work items without a running instance: 1");
    expect(text).toContain("folio-assistant-untracked (Process_CodeChangeReview)");
  });

  test("sweepWorkflowInstances closes running instances (and children) whose work item is completed, scrapped, or missing (#988)", () => {
    const { root } = fixture(
      {
        "closed.json": {
          id: "crdm--done",
          status: "running",
          bean: "folio-assistant-done",
          tokens: ["Call_Sub"],
          startedAt: "2026-10-10T00:00:00Z",
          history: [{ at: "2026-10-10T01:00:00Z", node: "Call_Sub" }],
          children: {
            Call_Sub: {
              id: "crdm--done/Call_Sub",
              status: "running",
              tokens: ["Task_Inner"],
              history: [{ at: "2026-10-10T01:00:00Z", node: "Task_Inner" }],
            },
          },
        },
        "missing.json": {
          id: "crdm--gone",
          bean: "folio-assistant-gone",
          tokens: ["End_Merged"],
          history: [{ at: "2026-10-11T00:00:00Z", node: "End_Merged" }],
        },
        "active.json": {
          id: "ccr--open",
          status: "running",
          bean: "folio-assistant-open",
          tokens: ["Task_Work"],
          startedAt: "2026-10-12T00:00:00Z",
        },
      },
      {
        "folio-assistant-done": { status: "completed" },
        "folio-assistant-open": { status: "in-progress", tags: ["process:Process_CodeChangeReview"] },
      },
    );

    const s = sweepWorkflowInstances({ root });
    expect(s).toEqual({ state: "ok", dir: "beans/workflows", closed: ["closed.json", "missing.json"] });

    // Re-running the check after sweeping finds 0 stale instances and 0 untracked process work items.
    const after = workflowInstances({ root, git: git("0") });
    expect(after).toMatchObject({
      state: "ok",
      staleInstances: [],
      untrackedProcessBeans: [],
    });
  });
});
