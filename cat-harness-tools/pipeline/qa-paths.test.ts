/**
 * The block-QA path contract — and in particular the one behaviour the move
 * INTRODUCED, which nothing else tests.
 *
 * Every pre-existing block fixture in this repo writes only the legacy sibling,
 * so the suite exercises the FALLBACK and passes. That is necessary and not
 * sufficient: it would pass identically if the preference order were reversed,
 * or if the results tree were never consulted at all. Flagged during the
 * `2634` migration by the agent that moved `qa-witness`'s reader, and closed
 * here rather than left as a known gap, because "results tree wins" is the
 * whole compatibility story and an untested preference is a coin toss.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { initFolio } from "../scripts/init-folio";
import {
  BLOCK_QA_RESULTS_DIR,
  findContentRepoRoot,
  blockOfQaPath,
  blockQaPath,
  blockQaReadPaths,
  existingBlockQaPath,
  legacyBlockQaPath,
} from "./qa-paths";

function inTmp(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "qa-paths-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A block at `<root>/content/ch/b`, with whichever verdicts are asked for. */
function fixture(root: string, opts: { legacy?: boolean; results?: boolean }): string {
  const blockRoot = join(root, "folio", "ch", "b");
  mkdirSync(dirname(blockRoot), { recursive: true });
  writeFileSync(blockRoot + ".ts", "export default {};\n");
  if (opts.legacy) writeFileSync(legacyBlockQaPath(blockRoot), '{"which":"legacy"}\n');
  if (opts.results) {
    const p = blockQaPath(root, blockRoot);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, '{"which":"results"}\n');
  }
  return blockRoot;
}

describe("where a verdict is READ from", () => {
  it("prefers the results tree when BOTH exist — the case nothing else covers", () => {
    inTmp((root) => {
      const blockRoot = fixture(root, { legacy: true, results: true });
      const found = existingBlockQaPath(root, blockRoot);
      expect(found).toBe(blockQaPath(root, blockRoot));
      // Asserted on CONTENT too, not just the path: a preference that returns
      // the right name while something else reads the other file is the defect
      // this is written to exclude.
      expect(readFileSync(found!, "utf-8")).toContain("results");
    });
  });

  it("falls back to the legacy sibling when only that exists", () => {
    // The migration guarantee for a downstream folio: its verdicts sit beside
    // its blocks and must keep being found, or every block reads as unaudited
    // the day it upgrades — a false pass at corpus scale.
    inTmp((root) => {
      const blockRoot = fixture(root, { legacy: true });
      expect(existingBlockQaPath(root, blockRoot)).toBe(legacyBlockQaPath(blockRoot));
    });
  });

  it("finds the results-tree verdict when only that exists", () => {
    inTmp((root) => {
      const blockRoot = fixture(root, { results: true });
      expect(existingBlockQaPath(root, blockRoot)).toBe(blockQaPath(root, blockRoot));
    });
  });

  it("returns undefined when there is none — genuinely unaudited, not 'looked in the wrong place'", () => {
    inTmp((root) => {
      expect(existingBlockQaPath(root, fixture(root, {}))).toBeUndefined();
    });
  });

  it("lists both candidates, newest convention first", () => {
    inTmp((root) => {
      const blockRoot = fixture(root, {});
      expect(blockQaReadPaths(root, blockRoot)).toEqual([
        blockQaPath(root, blockRoot),
        legacyBlockQaPath(blockRoot),
      ]);
    });
  });
});

describe("where a verdict is WRITTEN", () => {
  it("is always the results tree, never the legacy sibling", () => {
    // Writing both would create two verdicts for one block that can disagree,
    // with nothing to say which is current.
    inTmp((root) => {
      const blockRoot = fixture(root, { legacy: true });
      expect(blockQaPath(root, blockRoot)).toContain(BLOCK_QA_RESULTS_DIR);
      expect(blockQaPath(root, blockRoot)).not.toBe(legacyBlockQaPath(blockRoot));
    });
  });

  it("mirrors the block's directory rather than flattening it", () => {
    // Flat collides: block stems repeat freely across chapters.
    inTmp((root) => {
      const a = blockQaPath(root, join(root, "folio", "ch-a", "intro"));
      const b = blockQaPath(root, join(root, "folio", "ch-b", "intro"));
      expect(a).not.toBe(b);
      expect(a).toContain(join("folio", "ch-a"));
    });
  });
});

describe("the inverse, which no-orphan-sidecar depends on", () => {
  it("round-trips a results-tree verdict back to its manifest", () => {
    inTmp((root) => {
      const blockRoot = join(root, "folio", "ch", "b");
      expect(blockOfQaPath(root, blockQaPath(root, blockRoot))).toBe(blockRoot + ".ts");
    });
  });

  it("refuses a path outside the results tree, so a legacy sibling cannot map onto itself", () => {
    inTmp((root) => {
      const blockRoot = join(root, "folio", "ch", "b");
      expect(blockOfQaPath(root, legacyBlockQaPath(blockRoot))).toBeUndefined();
    });
  });
});

// ── The sweep's anchor (bean s3p2) ───────────────────────────────

describe("findContentRepoRoot: where a sweep anchors (s3p2)", () => {
  it("a sweep of a scaffolded folio's content graph anchors at the folio's ROOT, not at the swept directory", () => {
    const root = mkdtempSync(join(tmpdir(), "s3p2-"));
    try {
      initFolio({ targetDir: root, contentType: "document", slug: "anchor-test", title: "Anchor Test", authors: ["A"], link: "sibling", assistantPath: "folio-assistant", skipVcs: true });
      // The regression: `folio/` anchored at itself, and verdicts landed at
      // `folio/test/results/block-qa/…`, where nothing reads them.
      expect(findContentRepoRoot(join(root, "folio"), "/fallback")).toBe(root);
      // A block-path PREFIX deep inside still finds the same root.
      const deep = join(root, "folio", "doc", "chapter");
      mkdirSync(deep, { recursive: true });
      expect(findContentRepoRoot(join(deep, "a-block"), "/fallback")).toBe(root);
      expect(blockQaPath(findContentRepoRoot(deep, "/fallback"), join(deep, "a-block"))).toBe(
        join(root, "test", "results", "block-qa", "folio", "doc", "chapter", "a-block.qa.json"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a directory holding `.git` still anchors, as a legacy folio like qou does", () => {
    const root = mkdtempSync(join(tmpdir(), "s3p2-git-"));
    try {
      mkdirSync(join(root, ".git"));
      mkdirSync(join(root, "content", "ch"), { recursive: true });
      expect(findContentRepoRoot(join(root, "content", "ch"), "/fallback")).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
