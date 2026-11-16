/**
 * A link to a file names the branch the file is ON.
 *
 * The owner, 2026-10-13: "links in beans are broken" — every bean on the
 * Beans page linked `<repo>/blob/main/beans/defs/…`, and since the state
 * cutover `beans/` exists only on `cat/cat-harness/beans`. The rendered
 * `cat/cat-harness/beans/beans/defs/folio-assistant-npuo--…md` answers 200;
 * the `main` one answers 404.
 */
import { describe, expect, test } from "bun:test";
import { branchKeptHref, branchKeptLocation } from "../../branch-kept-href.js";
import type { TipLocation } from "../../branch-store.js";

const WEB = "https://github.com/litlfred/folio-assistant";
const LOCS: TipLocation[] = [
  { id: "beans", path: "beans", branch: "cat/cat-harness/beans", keyedBy: "tip" },
  { id: "todos", path: "todos", branch: "cat/cat-harness/todos", keyedBy: "tip" },
  { id: "inner", path: "beans/workflows", branch: "cat/cat-harness/state", keyedBy: "tip" },
  { id: "far", path: "who-iris/health", branch: "cat/who-iris/health", keyedBy: "tip", repository: "litlfred/who-iris", branchPath: "health" },
];
// declared-path-literal: test input — a fixed path the test passes in, not one read from a declaration
const NPUO = "beans/defs/folio-assistant-npuo--goal-5-content-the-content-model-and-the-ingest-pi.md";

describe("branchKeptLocation", () => {
  test("a bean links to the beans branch, not main — the reported 404", () => {
    expect(branchKeptHref(branchKeptLocation("/r", NPUO, WEB, LOCS))).toBe(
      `${WEB}/blob/cat/cat-harness/beans/${NPUO}`,
    );
  });

  test("a todo links to the todos branch, and edit uses the same branch", () => {
    const at = branchKeptLocation("/r", "todos/items/x.md", WEB, LOCS);
    expect(branchKeptHref(at, "edit")).toBe(`${WEB}/edit/cat/cat-harness/todos/todos/items/x.md`);
  });

  test("a file in no branch-kept directory stays on main", () => {
    expect(branchKeptLocation("/r", "index.config.json", WEB, LOCS)).toEqual({ web: WEB, ref: "main", path: "index.config.json" });
  });

  test("a prefix that is not a directory boundary does not match", () => {
    expect(branchKeptLocation("/r", "beansprout/x.md", WEB, LOCS).ref).toBe("main");
  });

  test("the longest declared directory wins", () => {
    expect(branchKeptLocation("/r", "beans/workflows/w.json", WEB, LOCS).ref).toBe("cat/cat-harness/state");
  });

  test("a remote instance's graph links to its own repository at its branch path", () => {
    expect(branchKeptLocation("/r", "who-iris/health/a.json", WEB, LOCS)).toEqual({
      web: "https://github.com/litlfred/who-iris",
      ref: "cat/who-iris/health",
      path: "health/a.json",
    });
  });
});
