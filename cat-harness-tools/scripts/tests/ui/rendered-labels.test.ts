/**
 * The ratchet over rendered diagram labels — all four directions it must answer.
 *
 * Bean `li5y`. Each case below was falsified BY HAND against the real corpus
 * before being written here (re-break a label, add one to a baselined file, fix
 * one, point it at an empty directory), and these pin the same four so the next
 * change cannot quietly lose one. A gate that has only ever been green has not
 * been shown to fire.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnSync } from "node:child_process";

import { describe, expect, test } from "bun:test";

import { checkRenderedLabels, offendingLabels, tspans } from "../../check-rendered-labels.js";

/** An SVG whose labels are exactly `labels`, serialised as a renderer would. */
function svg(labels: readonly string[]): string {
  const spans = labels.map((t) => `<tspan x="0" y="0">${t}</tspan>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${spans}</text></svg>`;
}

describe("what counts as an offending label", () => {
  test("the decimal form a double-escaped `name` produces", () => {
    // `&amp;#10;` in the SVG is a tspan whose TEXT is the five characters
    // `&#10;` — the escape of an escape, which is the whole defect.
    expect(offendingLabels(svg(["Dependency advisories&amp;#10;(WARN-ONLY)"]))).toHaveLength(1);
  });

  test("the hex form too, because the defect is not one spelling", () => {
    // The reason this reads the SVG rather than grepping `.bpmn` for
    // `&amp;#10;`: `&amp;#8212;` and `&amp;#x2014;` are the same defect and a
    // grep for the known form would pass over them.
    expect(offendingLabels(svg(["Four jobs&amp;#x2014;two warn"]))).toHaveLength(1);
    expect(offendingLabels(svg(["Four jobs&amp;#8212;two warn"]))).toHaveLength(1);
  });

  test("a label that merely CONTAINS an ampersand is not a finding", () => {
    // A real `&` in a label serialises as `&amp;amp;`, which must not match —
    // otherwise the check would demand a "fix" to correct text.
    expect(offendingLabels(svg(["tests &amp;amp; lint"]))).toHaveLength(0);
  });

  test("a correctly broken label is not a finding", () => {
    // What a single-escaped `&#10;` actually produces: two tspans, no escape.
    expect(offendingLabels(svg(["Skill-registration chain", "(UNMASKED)"]))).toHaveLength(0);
  });

  test("tspans are read across newlines", () => {
    // The renderer emits attributes and can wrap; a non-dotall regex would
    // silently read zero labels and report a clean corpus.
    expect(tspans('<tspan\n  x="1">a</tspan>')).toEqual(["a"]);
  });
});

describe("the ratchet", () => {
  /**
   * A fixture repository. `git init` is REQUIRED, not incidental: the check
   * asks git for its corpus rather than walking the disk (the fix that stopped
   * a gitignored `node_modules/` inflating a pinned measurement), so a bare
   * temp directory is correctly `undetermined`. Initialising git here exercises
   * the real path instead of bypassing it — the files are untracked, and
   * `--others --exclude-standard` is exactly what must still see them.
   */
  function fixture(perFile: Record<string, string[]>): { root: string; baseline: string } {
    const root = mkdtempSync(join(tmpdir(), "rendered-labels-"));
    spawnSync("git", ["init", "-q"], { cwd: root });
    // No site-root literal: the check keys on a `workflows/` segment anywhere in
    // the path, so the fixture must not assert where the site lives.
    const dir = join(root, "img", "workflows");
    mkdirSync(dir, { recursive: true });
    for (const [name, labels] of Object.entries(perFile)) {
      writeFileSync(join(dir, name), svg(labels));
    }
    return { root, baseline: join(root, "baseline.json") };
  }
  const BAD = "x&amp;#10;y";
  const OK = "plain";

  // TWO undetermined states, asserted separately. The first version of this was
  // one test named "an EMPTY corpus is undetermined" over a bare temp directory
  // — which is not a git work tree, so it passed on `gitCorpus` returning
  // undefined and never exercised the empty-corpus branch at all. A test that
  // passes for a different reason than its name claims is worse than no test,
  // because it reads as covering the case it does not.
  test("NOT A GIT WORK TREE is undetermined — git could not answer", () => {
    const root = mkdtempSync(join(tmpdir(), "rendered-labels-nogit-"));
    try {
      const r = checkRenderedLabels(root, join(root, "none.json"));
      expect(r.undetermined).toBe(true);
      expect(r.scanned).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a git repo with NO workflow SVG is undetermined, never clean", () => {
    // The vacuity guard proper: git answered, and there was nothing to read. A
    // filter over nothing reports zero findings, and this repository has paid
    // for reading that as a pass more than once (`dh4f`).
    const { root, baseline } = fixture({});
    try {
      const r = checkRenderedLabels(root, baseline);
      expect(r.undetermined).toBe(true);
      expect(r.scanned).toBe(0);
      expect(Object.keys(r.found)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a file NOT in the baseline fails", () => {
    const { root, baseline } = fixture({ "a.svg": [BAD] });
    try {
      writeFileSync(baseline, JSON.stringify({ counts: {} }));
      const r = checkRenderedLabels(root, baseline);
      expect(r.undetermined).toBe(false);
      expect(r.unexpected).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a file AT its baseline count passes — the outstanding sweep does not fail the gate", () => {
    const { root, baseline } = fixture({ "a.svg": [BAD, BAD] });
    try {
      writeFileSync(baseline, JSON.stringify({ counts: { "img/workflows/a.svg": 2 } }));
      const r = checkRenderedLabels(root, baseline);
      expect(r.unexpected).toEqual([]);
      expect(r.fixed).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a baselined file GAINING a label fails — the case a presence-only baseline misses", () => {
    // The whole reason the baseline is keyed on file AND count. Measured on the
    // real corpus: `ci-health-watch.svg` at 10 known, given an eleventh, must
    // fail. A set of filenames would have said nothing.
    const { root, baseline } = fixture({ "a.svg": [BAD, BAD, BAD] });
    try {
      writeFileSync(baseline, JSON.stringify({ counts: { "img/workflows/a.svg": 2 } }));
      const r = checkRenderedLabels(root, baseline);
      expect(r.unexpected).toEqual(["img/workflows/a.svg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("progress is FIXED and never a failure", () => {
    const { root, baseline } = fixture({ "a.svg": [BAD, OK] });
    try {
      writeFileSync(baseline, JSON.stringify({ counts: { "img/workflows/a.svg": 2 } }));
      const r = checkRenderedLabels(root, baseline);
      expect(r.unexpected).toEqual([]);
      expect(r.fixed).toEqual(["img/workflows/a.svg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an SVG outside a `workflows/` directory is not in the subject", () => {
    // The subject is rendered PROCESS diagrams. A themed icon or a viewer's
    // inline SVG is somebody else's question, and widening the scan would make
    // the baseline a record of unrelated files.
    const root = mkdtempSync(join(tmpdir(), "rendered-labels-scope-"));
    spawnSync("git", ["init", "-q"], { cwd: root });
    try {
      mkdirSync(join(root, "img", "icons"), { recursive: true });
      writeFileSync(join(root, "img", "icons", "i.svg"), svg([BAD]));
      const r = checkRenderedLabels(root, join(root, "none.json"));
      // No workflow SVG at all — so undetermined, and NOT a finding about the icon.
      expect(r.undetermined).toBe(true);
      expect(Object.keys(r.found)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
