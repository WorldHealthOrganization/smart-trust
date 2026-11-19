/**
 * Every declared `qa` directory, in every layer, parses: bean `de9k`
 * (defect C1, merge `48aab0bd`).
 *
 * The falsifier is a PLANTED conflict marker of the width that merge actually
 * wrote (eight characters, not seven). It sits in a hosted-home-shaped path,
 * because the hosted homes are exactly what the older `kg-qa.test.ts` walk
 * missed.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { CONFLICT_MARKER, checkQaDirs, checkQaFile, declaredQaDirs } from "./qa-graph-integrity";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

function tree(files: Record<string, string | Uint8Array>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "qa-integrity-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, body);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The exact shape `48aab0bd` committed: a rename/rename conflict, 8-wide markers. */
const CONFLICTED = [
  "{",
  '  "$schema": "kg-qa/v1",',
  '  "totals": {',
  "<<<<<<<< HEAD:cat-harness/test/results/kg-qa/skills/a.kg-qa.json",
  '    "pass": 5,',
  "========",
  '    "pass": 4,',
  ">>>>>>>> pr1-content-up:cat-harness/test/results/bootstrap/kg-qa/skills/b.kg-qa.json",
  '    "unknown": 0',
  "  }",
  "}",
  "",
].join("\n");

describe("checkQaFile", () => {
  it("finds an 8-wide conflict marker in a hosted home, and names the line", () => {
    const t = tree({ "bootstrap/kg-qa/skills/x.kg-qa.json": CONFLICTED });
    try {
      const f = checkQaFile(join(t.dir, "bootstrap/kg-qa/skills/x.kg-qa.json"));
      expect(f?.problem).toBe("conflict-marker");
      expect(f?.detail).toContain("line 4");
    } finally {
      t.cleanup();
    }
  });

  it("finds a marker in a non-JSON document too, where no parser would trip", () => {
    const t = tree({ "notes.md": "# Title\n\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n" });
    try {
      expect(checkQaFile(join(t.dir, "notes.md"))?.problem).toBe("conflict-marker");
    } finally {
      t.cleanup();
    }
  });

  it("reports unparseable JSON that carries no marker", () => {
    const t = tree({ "a.qa.json": '{ "x": 1, }' });
    try {
      expect(checkQaFile(join(t.dir, "a.qa.json"))?.problem).toBe("unparseable-json");
    } finally {
      t.cleanup();
    }
  });

  it("does not mistake a setext underline, or a marker inside a string, for a conflict", () => {
    const t = tree({
      "a.md": "Heading\n=======\n\ntext\n",
      "b.json": JSON.stringify({ detail: "<<<<<<< HEAD is a conflict marker" }),
    });
    try {
      expect(checkQaFile(join(t.dir, "a.md"))).toBeUndefined();
      expect(checkQaFile(join(t.dir, "b.json"))).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });

  it("skips binary files", () => {
    const t = tree({ "img.png": new Uint8Array([0x89, 0x50, 0, 0x3c, 0x3c]) });
    try {
      expect(checkQaFile(join(t.dir, "img.png"))).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });

  it("the marker pattern matches widths 7 and 8, and not 6", () => {
    expect(CONFLICT_MARKER.test("<<<<<<< HEAD")).toBe(true);
    expect(CONFLICT_MARKER.test("<<<<<<<< HEAD:x")).toBe(true);
    expect(CONFLICT_MARKER.test(">>>>>>>")).toBe(true);
    expect(CONFLICT_MARKER.test("<<<<<< HEAD")).toBe(false);
  });
});

describe("checkQaDirs", () => {
  it("walks nested hosted homes and counts what it examined", () => {
    const t = tree({
      "kg-qa/skills/ok.kg-qa.json": "{}",
      "bootstrap/kg-qa/skills/bad.kg-qa.json": CONFLICTED,
    });
    try {
      const r = checkQaDirs([t.dir, join(t.dir, "bootstrap")]);
      // Overlapping roots are deduped, so the bad file is reported ONCE.
      expect(r.examined).toBe(2);
      expect(r.findings.map((f) => relative(t.dir, f.path))).toEqual(["bootstrap/kg-qa/skills/bad.kg-qa.json"]);
    } finally {
      t.cleanup();
    }
  });
});

describe("the qa directories declared in this checkout", () => {
  const REPO = repoRootFor(resolve(HARNESS_ROOT));
  const dirs = declaredQaDirs(REPO);
  // Only the judgement half is swept HERE: it is authored content on `main`.
  // The derived `qa` half is the committed corpus that is leaving `main`, and
  // a test must not assert on it (bean `cxcn`, reader audit F7) —
  // `bun run cat check:qa-corpus` judges it over the fetched tree instead.
  const attestations = declaredQaDirs(REPO, ["attestations"]);
  const report = checkQaDirs(attestations);

  it("includes cat-harness's, whose walk covers the hosted bootstrap homes", () => {
    expect(dirs).toContain(resolve(REPO, "cat-harness", "test", "results"));
    // The judgement half, split out by bean `2gst`, is swept as well.
    expect(dirs).toContain(resolve(REPO, "cat-harness", "test", "attestations"));
    expect(attestations).toEqual(dirs.filter((d) => d.endsWith("attestations")));
    expect(report.examined).toBeGreaterThan(0);
  });

  it("the attestation store holds no conflict marker and no unparseable JSON", () => {
    const lines = report.findings.map((f) => `${relative(REPO, f.path)} — ${f.problem}: ${f.detail}`);
    expect(lines).toEqual([]);
  });
});
