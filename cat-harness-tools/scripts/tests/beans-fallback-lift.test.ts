/**
 * Closing a bean lifts the blocks it holds.
 *
 * @module scripts/tests/beans-fallback-lift
 *
 * Before this, `update <id> --status completed` changed one line and left
 * every `blocked_by:` naming the bean in place, so the blocked bean read as
 * waiting on finished work (34 such edges on `cat/cat-harness/beans`,
 * 2026-10-15, cleared by hand).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { liftBlockInText, listBeans, updateBean } from "../beans-fallback.ts";

function store(beans: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "beans-lift-"));
  mkdirSync(join(root, "beans"), { recursive: true });
  writeFileSync(join(root, ".beans.yml"), "beans:\n  path: beans\n  prefix: t-\n  id_length: 1\n");
  for (const [id, fm] of Object.entries(beans)) {
    writeFileSync(join(root, "beans", `${id}--x.md`), `---\n# ${id}\ntitle: ${id}\n${fm}\n---\n\nBody.\n`);
  }
  return root;
}
const read = (root: string, id: string) => readFileSync(join(root, "beans", `${id}--x.md`), "utf-8");

describe("closing a blocker lifts its blocks", () => {
  test("completed: its id leaves every blocked_by, and the key goes when empty", () => {
    const root = store({
      "t-a": "status: in-progress\ntype: task",
      "t-b": "status: todo\ntype: task\nblocked_by:\n    - t-a",
      "t-c": "status: draft\ntype: task\nblocked_by:\n    - t-z\n    - t-a\nparent: t-p",
      "t-d": "status: todo\ntype: task\nblocked_by:\n    - t-z",
    });
    const b = updateBean(root, "t-a", { status: "completed" });
    expect(b.lifted).toEqual(["t-b", "t-c"]);
    expect(read(root, "t-b")).not.toContain("blocked_by:");
    expect(read(root, "t-b")).toContain("Block lifted: `t-a` is completed.");
    const c = read(root, "t-c");
    expect(c).toContain("blocked_by:\n    - t-z\nparent: t-p\n");
    expect(c).not.toContain("- t-a");
    // A bean that never named the blocker is not touched.
    expect(read(root, "t-d")).toBe("---\n# t-d\ntitle: t-d\nstatus: todo\ntype: task\nblocked_by:\n    - t-z\n---\n\nBody.\n");
  });

  test("scrapped lifts too, and the closed bean's own blocking: is cleared", () => {
    const root = store({
      "t-a": "status: todo\ntype: task\nblocking:\n    - t-b",
      "t-b": "status: todo\ntype: task",
    });
    updateBean(root, "t-a", { status: "scrapped" });
    const a = read(root, "t-a");
    expect(a).toContain("status: scrapped");
    expect(a).not.toContain("blocking:");
    expect(a).toContain("Block on `t-b` lifted: this bean is scrapped.");
  });

  test("a status that does not close lifts nothing", () => {
    const root = store({
      "t-a": "status: todo\ntype: task",
      "t-b": "status: todo\ntype: task\nblocked_by:\n    - t-a",
    });
    const b = updateBean(root, "t-a", { status: "in-progress" });
    expect(b.lifted).toBeUndefined();
    expect(read(root, "t-b")).toContain("blocked_by:\n    - t-a");
  });

  test("the text transform says when there was nothing to lift", () => {
    const raw = "---\n# t-b\ntitle: b\nstatus: todo\n---\n\nBody.\n";
    expect(liftBlockInText(raw, "blocked_by", "t-a", "x")).toBeUndefined();
  });
});


describe("listBeans skips README.md", () => {
  test("README.md with generated front matter is not listed as an open bean", () => {
    const root = store({
      "t-a": "status: todo\ntype: task",
    });
    writeFileSync(
      join(root, "beans", "README.md"),
      '---\ngenerated: "cat-harness-tools/scripts/subgraph-readmes.ts"\n---\n\n# `beans/defs/`\n',
    );
    expect(listBeans(root).map((b) => b.id)).toEqual(["t-a"]);
  });
});
