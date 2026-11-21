/**
 * Every block is a knowledge-graph node from a folio's first commit: init-folio
 * writes the starter block's `.jsonld`, and it is exactly what the generator
 * would write. Without it a new folio published no graph, and the document
 * site (which now fails on a missing node) would refuse its first build.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { initFolio } from "../init-folio";
import { HARNESS_ROOT } from "../lib/roots.ts";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));
const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("a new folio's blocks are KG nodes from the first commit", () => {
  test("the starter block's .jsonld is written, and gen-block-jsonld --check finds it current", () => {
    const repo = mkdtempSync(join(tmpdir(), "init-kg-"));
    dirs.push(repo);
    const folio = join(repo, "doc");
    initFolio({ targetDir: folio, contentType: "document", slug: "kg-doc", title: "KG Doc", authors: ["A"], link: "sibling", assistantPath: "../platform", skipVcs: true });
    symlinkSync(REPO_ROOT, join(repo, "platform"));

    const node = JSON.parse(readFileSync(join(folio, "folio/kg-doc/introduction/overview.jsonld"), "utf-8")) as Record<string, unknown>;
    expect(node.label).toBe("prose:overview");
    expect(node.text).toBe("overview.md");

    const check = spawnSync("bun", ["run", join(REPO_ROOT, "cat-harness-tools/pipeline/gen-block-jsonld.ts"), "--check"], {
      cwd: folio,
      encoding: "utf-8",
      env: { ...process.env },
    });
    expect(check.stdout + check.stderr).toContain("1 sibling(s) up to date");
    expect(check.status).toBe(0);
  });
});
