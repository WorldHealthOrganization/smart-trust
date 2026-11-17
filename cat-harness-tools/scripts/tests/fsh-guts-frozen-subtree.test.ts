/**
 * A frozen subtree is ONE item, recognised by its note's declaration (bean 61t6).
 *
 * Sub-kg-lifecycle stage 13 relocates a separated graph's copy to
 * `fsh-guts/separated/<name>/` beside a note `<name>.md`. The first one
 * (cf210f4, 2026-10-06) brought 7.7k files and turned every PR's CI red,
 * because each scanner treated them as 7.7k live nodes. Small fixtures here;
 * the real corpus is what CI mounts.
 *
 * @module scripts/tests/fsh-guts-frozen-subtree.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FROZEN_SUBTREE_KIND,
  frozenSubtreeNote,
  isFrozenSubtree,
  withoutFrozenSubtrees,
} from "../../schemas/kg/fsh-guts.ts";
import { gutsFiles, page } from "../gen-fsh-guts-viz.ts";

const DIR = mkdtempSync(join(tmpdir(), "fsh-guts-frozen-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const note = (kind: string) =>
  [
    "---",
    "$schema: folio-fsh-guts/v1",
    `title: "demo, separated"`,
    `kind: ${kind}`,
    "movedOn: 2026-10-06",
    `movedFrom: "demo/"`,
    "repository: example/demo",
    "matchesCommit: 0123456789abcdef",
    "---",
    "",
    "# demo",
    "",
  ].join("\n");

const put = (rel: string, text: string) => {
  mkdirSync(join(DIR, rel, ".."), { recursive: true });
  writeFileSync(join(DIR, rel), text);
};

// A frozen subtree: undeclared markdown and a JSON record inside, note beside.
put("separated/demo.md", note(FROZEN_SUBTREE_KIND));
put("separated/demo/README.md", "# not ours\n");
put("separated/demo/deep/index.json", '{"materialization":{"state":"materialized"}}');
// A directory beside a note of ANOTHER kind is not frozen.
put("retired/thing.md", note("staged-copies"));
put("retired/thing/loose.md", "# loose\n");

describe("frozen subtrees", () => {
  test("recognised by the note's declared kind, not by where it sits", () => {
    expect(isFrozenSubtree(join(DIR, "separated/demo"))).toBe(true);
    expect(frozenSubtreeNote(join(DIR, "separated/demo"))?.title).toBe("demo, separated");
    expect(isFrozenSubtree(join(DIR, "retired/thing"))).toBe(false);
    expect(isFrozenSubtree(join(DIR, "separated"))).toBe(false);
  });

  test("a file list keeps the note and drops the subtree's files, naming the subtree once", () => {
    const { live, frozen } = withoutFrozenSubtrees(DIR, [
      "separated/demo.md",
      "separated/demo/README.md",
      "separated/demo/deep/index.json",
      "retired/thing.md",
      "retired/thing/loose.md",
    ]);
    expect(live).toEqual(["separated/demo.md", "retired/thing.md", "retired/thing/loose.md"]);
    expect(frozen).toEqual(["separated/demo"]);
  });

  test("the fsh-guts page lists the subtree as ONE row, via its note", () => {
    const files = gutsFiles(DIR);
    const rels = files.map((f) => f.rel);
    expect(rels).toContain("separated/demo/");
    expect(rels).toContain("separated/demo.md");
    expect(rels.some((r) => r.startsWith("separated/demo/") && r !== "separated/demo/")).toBe(false);
    expect(files.find((f) => f.rel === "separated/demo/")?.state).toBe("sidecar");
    // The unfrozen directory is walked, so its undeclared file is still a finding.
    expect(files.find((f) => f.rel === "retired/thing/loose.md")?.state).toBe("undeclared");
    expect(page(files, "https://example.invalid")).toContain("demo/");
  });
});
