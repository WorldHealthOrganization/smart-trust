/**
 * `state:push` judges the text it splices (bean `asq1`): a push that would
 * INTRODUCE a dangling link or a retired word is refused for that graph, a
 * finding already at the tip does not block, and a stated bypass pushes and
 * is logged. Real git throughout, through the same fixture as state-push.
 *
 * @module scripts/tests/state-push-checks
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { danglingLinksIn, type LinkContext } from "../check-subgraphs.ts";
import { mountState } from "../state-mount.js";
import { pushState, report } from "../state-push.js";
import { newFindings, type TextChecks } from "../state-push-checks.ts";
import { cleanup, git, MANIFEST, stateFixture } from "./state-fixture.js";

afterEach(cleanup);

const RETIRED = new Map([
  ["bean", "work item"],
  ["beans", "work items"],
]);

/** A link context of one undeclared-kind directory: every unresolved link in it is dangling. */
function ctxFor(root: string): LinkContext {
  const dirs = [{ id: "todos", path: "todos", absPath: join(root, "todos"), graphTypologies: [] as string[] }];
  return { root, own: dirs, dirs, label: (d: { id: string }) => d.id, absentOffMain: [], archiveViews: [] } as unknown as LinkContext;
}

function checksFor(root: string): TextChecks {
  const ctx = ctxFor(root);
  return { dangling: (file, text) => danglingLinksIn(ctx, file, text), retired: RETIRED };
}

function mounted() {
  const f = stateFixture("state-push-checks-t-", {
    "manifest.json": MANIFEST,
    "todos/a.md": "A, see [b](b.md) and [old](gone.md).\n\nThe bean was filed.\n",
    "todos/b.md": "B\n",
  });
  const co = f.checkout("a");
  const m = mountState({ repoRoot: co.root, store: co.store });
  if (m.state !== "mounted") throw new Error(`mount failed: ${m.reason}`);
  const checks = checksFor(co.root);
  return { f, ...co, push: (extra = {}) => pushState({ repoRoot: co.root, store: co.store, retag: false, checks, ...extra }) };
}

describe("the dangling-link rule is check-subgraphs' own", () => {
  test("a link to nothing is dangling; a link that resolves, a URL and code are not", () => {
    const { root } = mounted();
    const text = "[b](b.md) [x](nope.md) [u](https://example.org) `[c](code.md)`";
    expect(danglingLinksIn(ctxFor(root), join(root, "todos/a.md"), text)).toEqual(["nope.md"]);
  });

  test("a file no declared directory owns is not judged", () => {
    const { root } = mounted();
    expect(danglingLinksIn(ctxFor(root), join(root, "elsewhere/x.md"), "[x](nope.md)")).toBeUndefined();
  });
});

describe("only what this push introduces is a finding", () => {
  test("a new dangling link is refused, nothing is sent, and the edit is kept", () => {
    const { f, root, push } = mounted();
    const before = f.tip();
    writeFileSync(join(root, "todos/a.md"), "A, see [b](b.md) and [old](gone.md).\n\nMoved: [sdlc](../skills/sdlc/x.md).\n\nThe bean was filed.\n");
    const r = push();
    expect(r.state).toBe("failed");
    expect(r.graphs[0]?.state).toBe("refused");
    expect(r.graphs[0]?.reason).toContain("../skills/sdlc/x.md");
    expect(r.graphs[0]?.reason).not.toContain("gone.md");
    expect(report(r)).toContain("CAT_GATES_BYPASS");
    expect(f.tip()).toBe(before);
    expect(readFileSync(join(root, "todos/a.md"), "utf-8")).toContain("skills/sdlc");
  });

  test("a finding already at the tip does not block an edit to the same file", () => {
    const { f, root, push } = mounted();
    writeFileSync(join(root, "todos/a.md"), "A2, see [b](b.md) and [old](gone.md).\n\nThe bean was filed, and closed.\n");
    expect(push().state).toBe("pushed");
    expect(f.remoteFile("todos/a.md")?.toString()).toContain("A2");
  });

  test("a new use of a retired word is refused; the old one is not counted", () => {
    const { root, push } = mounted();
    writeFileSync(join(root, "todos/a.md"), "A, see [b](b.md) and [old](gone.md).\n\nThe bean was filed. Another bean followed.\n");
    const r = push();
    expect(r.graphs[0]?.state).toBe("refused");
    expect(r.graphs[0]?.reason).toContain('"bean"');
    expect(r.graphs[0]?.reason).toContain("work item");
  });

  test("a name in code is not a retired word", () => {
    const { push, root } = mounted();
    writeFileSync(join(root, "todos/a.md"), "A, see [b](b.md) and [old](gone.md).\n\nThe bean was filed with `beans create`.\n");
    expect(push().state).toBe("pushed");
  });

  test("a file this push creates is judged whole", () => {
    const { push, root } = mounted();
    writeFileSync(join(root, "todos/new.md"), "N [x](nowhere.md)\n");
    const r = push();
    expect(r.graphs[0]?.state).toBe("refused");
    expect(r.graphs[0]?.reason).toContain("todos/new.md");
  });

  test("a dry run reports the refusal and sends nothing", () => {
    const { f, root, push } = mounted();
    const before = f.tip();
    writeFileSync(join(root, "todos/new.md"), "N [x](nowhere.md)\n");
    const r = push({ dryRun: true });
    expect(r.graphs[0]?.state).toBe("refused");
    expect(f.tip()).toBe(before);
  });

  test("a library caller that passes no checks runs none", () => {
    const { root, store } = mounted();
    writeFileSync(join(root, "todos/new.md"), "N [x](nowhere.md)\n");
    expect(pushState({ repoRoot: root, store, retag: false }).state).toBe("pushed");
  });
});

describe("a bypass says why, and is logged", () => {
  test("a stated reason pushes the finding and logs it with the reason", () => {
    const { f, root, push } = mounted();
    writeFileSync(join(root, "todos/new.md"), "N [x](nowhere.md)\n");
    const r = push({ bypass: "target lands in the next PR" });
    expect(r.state).toBe("pushed");
    expect(f.remoteFile("todos/new.md")?.toString()).toContain("nowhere.md");
    expect(r.graphs[0]?.bypassed?.map((x) => x.path)).toEqual(["todos/new.md"]);
    expect(report(r)).toContain("bypass");
    const log = join(root, git(root, "rev-parse", "--git-common-dir").trim(), "cat-gates", "push.log");
    expect(existsSync(log)).toBe(true);
    const entry = JSON.parse(readFileSync(log, "utf-8").trim().split("\n").at(-1)!);
    expect(entry).toMatchObject({ event: "bypass", via: "state-push", reason: "target lands in the next PR", graph: "todos" });
  });

  test("an empty reason is no bypass", () => {
    const { root, push } = mounted();
    writeFileSync(join(root, "todos/new.md"), "N [x](nowhere.md)\n");
    expect(push({ bypass: "  " }).graphs[0]?.state).toBe("refused");
  });
});

describe("a tip it cannot read is not compared, and not called new", () => {
  test("an unreadable baseline is listed, not refused", () => {
    const r = newFindings({ retired: RETIRED }, [{ path: "todos/a.md", abs: "/x/todos/a.md", now: "a bean", before: undefined }]);
    expect(r).toEqual({ findings: [], notCompared: ["todos/a.md"], notJudged: [] });
  });

  test("a file no declared directory owns is said, not read as clean", () => {
    const r = newFindings({ dangling: () => undefined }, [{ path: "x/a.md", abs: "/x/a.md", now: "[x](no.md)", before: null }]);
    expect(r.notJudged).toEqual(["x/a.md"]);
    expect(report({ state: "pushed", reason: "r", graphs: [{ id: "g", branch: "b", path: "x", state: "pushed", reason: "ok", notJudged: r.notJudged }] })).toContain("no declared directory owns x/a.md");
  });
});
