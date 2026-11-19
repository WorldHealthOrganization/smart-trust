/**
 * publish:check's two judgements that are not "the writer exited 0": which
 * files MOVED, and which of those git ignores (B1, owner 2026-10-14).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ignoredBy, moved, snapshot } from "../../publish-check.ts";

describe("moved", () => {
  test("a changed, an added and a removed file all moved; an unchanged one did not", () => {
    const before = new Map([["a", "1"], ["b", "2"], ["c", "3"]]);
    const after = new Map([["a", "1"], ["b", "X"], ["d", "4"]]);
    expect(moved(before, after)).toEqual(["b", "c", "d"]);
  });
});

describe("snapshot + ignoredBy, over a real tree", () => {
  const root = mkdtempSync(join(tmpdir(), "publish-check-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  mkdirSync(join(root, "inst/docs/gen"), { recursive: true });
  writeFileSync(join(root, "inst/.gitignore"), "/docs/gen/\n");
  writeFileSync(join(root, "inst/docs/own.svg"), "<svg/>");
  writeFileSync(join(root, "inst/docs/gen/page.html"), "x");

  test("node_modules is never content", () => {
    mkdirSync(join(root, "inst/node_modules/p"), { recursive: true });
    writeFileSync(join(root, "inst/node_modules/p/i.js"), "");
    expect([...snapshot([join(root, "inst")], root).keys()].sort()).toEqual(["inst/.gitignore", "inst/docs/gen/page.html", "inst/docs/own.svg"]);
  });

  test("the INSTANCE's own .gitignore decides, nested ones included", () => {
    mkdirSync(join(root, "inst/test"), { recursive: true });
    writeFileSync(join(root, "inst/test/.gitignore"), "/results/\n");
    const ig = ignoredBy(["inst/docs/gen/page.html", "inst/docs/own.svg", "inst/test/results/x.json"], [join(root, "inst")], root);
    expect(ig.has("inst/docs/gen/page.html")).toBe(true);
    expect(ig.has("inst/test/results/x.json")).toBe(true);
    expect(ig.has("inst/docs/own.svg")).toBe(false);
  });

  test("an index that ignores the whole mount does NOT make the mount's committed files ignored", () => {
    // folio-assistant's `.gitignore` carries `/cat-harness/`: asking the checkout would call every mounted file ignored.
    writeFileSync(join(root, ".gitignore"), "/inst/\n");
    expect(ignoredBy(["inst/docs/own.svg"], [join(root, "inst")], root).has("inst/docs/own.svg")).toBe(false);
  });

  test("no paths asks git nothing", () => {
    expect(ignoredBy([], [join(root, "inst")], root).size).toBe(0);
  });

  test("top-level build output directories (_kg, build, _site, dist) are skipped when the root itself is an instance, while sub-instance _kg is kept", () => {
    const cr = mkdtempSync(join(tmpdir(), "publish-check-content-root-"));
    mkdirSync(join(cr, "_kg/cat-harness"), { recursive: true });
    mkdirSync(join(cr, "build/plantuml"), { recursive: true });
    mkdirSync(join(cr, "bootstrap/_kg"), { recursive: true });
    writeFileSync(join(cr, "dpi-h-ra.json"), "{}");
    writeFileSync(join(cr, "_kg/cat-harness/cat-harness.jsonld"), "{}");
    writeFileSync(join(cr, "build/plantuml/plantuml.jar"), "");
    writeFileSync(join(cr, "bootstrap/_kg/bootstrap.jsonld"), "{}");
    expect([...snapshot([cr, join(cr, "bootstrap")], cr).keys()].sort()).toEqual(["bootstrap/_kg/bootstrap.jsonld", "dpi-h-ra.json"]);
  });
});
