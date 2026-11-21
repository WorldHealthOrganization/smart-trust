/**
 * The sweep exists for ONE case, so the tests prove that case rather than
 * exercising the happy path.
 *
 * `no-orphan-sidecar` reaches a mirror directory only by loading the block
 * directory it mirrors. Delete that directory and the mirror is unreachable
 * forever. Bean `pb2b`.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { blockQaPath } from "../../../pipeline/qa-paths";
import { notApplicableReason, orphanVerdicts, rootHasBlocks, sweepOrphanVerdicts } from "../../../pipeline/orphan-verdict-sweep";

function inTmp(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "orphan-sweep-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Write a verdict for `folio/<chapter>/<stem>`, with or without its manifest. */
function place(root: string, chapter: string, stem: string, opts: { manifest: boolean }): void {
  const blockRoot = join(root, "folio", chapter, stem);
  if (opts.manifest) {
    mkdirSync(dirname(blockRoot), { recursive: true });
    writeFileSync(blockRoot + ".ts", "export default {};\n");
  }
  const v = blockQaPath(root, blockRoot);
  mkdirSync(dirname(v), { recursive: true });
  writeFileSync(v, '{"$schema":"block-qa/v1"}\n');
}

describe("orphanVerdicts", () => {
  it("reports an ABANDONED verdict — the case no per-directory check can reach", () => {
    // No manifest and no chapter directory at all: `validate` never loads that
    // directory, so it never derives the mirror, so it never looks here.
    inTmp((root) => {
      place(root, "gone", "b", { manifest: false });
      const found = orphanVerdicts(root);
      expect(found).toHaveLength(1);
      expect(found[0]!.kind).toBe("abandoned");
      expect(found[0]!.expects).toContain(join("folio", "gone", "b.ts"));
    });
  });

  it("distinguishes MOVED, where the directory survives and validate sees it too", () => {
    inTmp((root) => {
      // The chapter exists (another block keeps it alive); this block's
      // manifest does not.
      place(root, "ch", "kept", { manifest: true });
      place(root, "ch", "left-behind", { manifest: false });
      const found = orphanVerdicts(root);
      expect(found).toHaveLength(1);
      expect(found[0]!.kind).toBe("moved");
    });
  });

  it("says nothing about a verdict whose block is present", () => {
    inTmp((root) => {
      place(root, "ch", "b", { manifest: true });
      expect(orphanVerdicts(root)).toEqual([]);
    });
  });

  it("an ABSENT results tree finds nothing — and says it EXAMINED nothing", () => {
    // Bean `c8uq`, defect C6: the CLI used to print `✓ no orphaned block
    // verdicts` here and exit 0. Once derived QA lives on `qa-reports`, every
    // unfetched checkout looks like this, so the empty list must travel with
    // the population that produced it.
    inTmp((root) => {
      mkdirSync(join(root, "folio"), { recursive: true });
      expect(orphanVerdicts(root)).toEqual([]);
      const sweep = sweepOrphanVerdicts(root);
      expect(sweep).toMatchObject({ orphans: [], examined: 0, present: false });
    });
  });

  it("counts every verdict it examined, orphaned or not", () => {
    inTmp((root) => {
      place(root, "ch", "kept", { manifest: true });
      place(root, "ch", "gone", { manifest: false });
      const sweep = sweepOrphanVerdicts(root);
      expect(sweep.examined).toBe(2);
      expect(sweep.present).toBe(true);
      expect(sweep.orphans).toHaveLength(1);
    });
  });

  it("finds orphans nested at any depth, and reports them sorted", () => {
    inTmp((root) => {
      place(root, join("a", "deep"), "z", { manifest: false });
      place(root, "a", "b", { manifest: false });
      const found = orphanVerdicts(root);
      expect(found).toHaveLength(2);
      expect(found.map((f) => f.verdict)).toEqual([...found.map((f) => f.verdict)].sort());
    });
  });
});

describe("check:orphan-verdicts, the CLI", () => {
  const CLI = join(import.meta.dir, "..", "..", "..", "pipeline", "orphan-verdict-sweep.ts");
  const run = (cwd: string) => Bun.spawnSync(["bun", "run", CLI], { cwd, stdout: "pipe", stderr: "pipe" });

  it("refuses with exit 2 over an absent results tree in a root that HAS blocks, and prints no pass", () => {
    inTmp((root) => {
      // `findContentRepoRoot` walks up from the cwd to a layer root.
      writeFileSync(join(root, "demo.json"), JSON.stringify({ name: "demo" }));
      mkdirSync(join(root, "folio"), { recursive: true });
      writeFileSync(join(root, "folio", "r.ts"), `export default remark({ label: "rem:r", title: "T" });\n`);
      const r = run(root);
      const out = r.stdout.toString() + r.stderr.toString();
      expect(r.exitCode).toBe(2);
      expect(out).not.toContain("✓");
      expect(out).toContain("examined 0 members");
      expect(out).toContain("qa:fetch");
    });
  });

  it("exits 78, not applicable, in a root that holds no block (a FHIR IG judged with no base)", () => {
    inTmp((root) => {
      // A folio directory, so the sweep anchors HERE rather than falling back
      // to the harness layer, and nothing in it is a block.
      writeFileSync(join(root, "demo.json"), JSON.stringify({ name: "demo" }));
      mkdirSync(join(root, "folio"), { recursive: true });
      writeFileSync(join(root, "folio", "README.md"), "# nothing to judge\n");
      mkdirSync(join(root, "input", "fsh"), { recursive: true });
      writeFileSync(join(root, "input", "fsh", "a.fsh"), "Profile: A\n");
      const r = run(root);
      const out = r.stdout.toString() + r.stderr.toString();
      expect(r.exitCode).toBe(78);
      expect(out).toContain("NOT APPLICABLE");
      expect(out).not.toContain("✓");
    });
  });
});

/**
 * A FHIR IG judged with no base (2026-11-19): a FHIR IG site has no block at all, so no
 * block-QA producer, and the sweep exited 2 ("examined 0") even after
 * `qa:fetch`. Not applicable (78) there; the vacuity refusal stays for a root
 * that has blocks.
 */
describe("a root with no block-QA population", () => {
  it("holds no block: not applicable, with the reason", () => {
    inTmp((root) => {
      mkdirSync(join(root, "input", "fsh"), { recursive: true });
      writeFileSync(join(root, "input", "fsh", "a.fsh"), "Profile: A\n");
      writeFileSync(join(root, "tool.ts"), "export const x = 1;\n");
      expect(rootHasBlocks(root)).toBe(false);
      const sweep = sweepOrphanVerdicts(root);
      expect(notApplicableReason(sweep, { hasBlocks: rootHasBlocks(root), harnessFallbackInContentRoot: false }, root)).toContain("no block-QA producer");
    });
  });

  it("holds a block but no verdict was read: NOT excused, the vacuity refusal stays", () => {
    inTmp((root) => {
      mkdirSync(join(root, "folio", "ch"), { recursive: true });
      writeFileSync(join(root, "folio", "ch", "r.ts"), `export default remark({ label: "rem:r", title: "T" });\n`);
      expect(rootHasBlocks(root)).toBe(true);
      expect(notApplicableReason(sweepOrphanVerdicts(root), { hasBlocks: true, harnessFallbackInContentRoot: false }, root)).toBeUndefined();
    });
  });

  it("holds verdicts and no block: swept, never excused (they are abandoned orphans)", () => {
    inTmp((root) => {
      place(root, "gone", "b", { manifest: false });
      const sweep = sweepOrphanVerdicts(root);
      expect(sweep.examined).toBe(1);
      expect(notApplicableReason(sweep, { hasBlocks: false, harnessFallbackInContentRoot: true }, root)).toBeUndefined();
    });
  });

  it("a content root with no folio, swept at the harness layer: not applicable even though the harness has blocks", () => {
    expect(notApplicableReason({ examined: 0 }, { hasBlocks: true, harnessFallbackInContentRoot: true }, "/x/cat-harness")).toContain("qa-sweep:docs");
  });
});
