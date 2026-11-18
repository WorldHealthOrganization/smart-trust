/**
 * The gate `fx5r` asked for, tested against the corpus it was written for.
 *
 * Two of these are the SABOTAGES run by hand before the gate was committed,
 * pinned so they stay run. The `yx9p` lesson is four days old and cost a
 * guard that passed 7/7 while letting its own defect through: the only
 * evidence a guard works is that it fails when the defect is present.
 */
import { describe, expect, test } from "bun:test";

import {
  check,
  ROOT,
  scanText,
  skipPath,
  STALE_FIELDS,
  WINDOW,
} from "../check-stale-field-advice.js";

const FIELD = STALE_FIELDS[0]!;

test("the field table is not empty", () => {
  // A checker over an empty table exits 0 and reads as a clean sweep — `1xhc`
  // in one line. The script guards this at runtime; this catches it in CI
  // rather than on somebody's next edit.
  expect(STALE_FIELDS.length).toBeGreaterThan(0);
});

test("every field declares the bean that measured it and at least one qualifier", () => {
  // A field with no qualifier is unsatisfiable: every mention of it fails and
  // no edit can fix one, which is how a gate gets deleted rather than obeyed.
  for (const f of STALE_FIELDS) {
    expect(f.bean, `\`${f.token}\` names no bean`).toMatch(/^[a-z0-9]{4}$/);
    expect(f.why.length, `\`${f.token}\` records no measurement`).toBeGreaterThan(20);
    expect(f.qualifiers.length, `\`${f.token}\` is unsatisfiable — no qualifier can clear it`).toBeGreaterThan(0);
    for (const q of f.qualifiers) {
      expect(q.because.length, `qualifier \`${q.marker}\` has no reason recorded`).toBeGreaterThan(10);
    }
  }
});

describe("SABOTAGE — the gate fails when the defect is present", () => {
  test("a fourth copy of the advice string is caught", () => {
    // Verbatim the shape `fx5r` found in `pr-checks-present.yml`, four days
    // after the same string was fixed two files away.
    const wf = `      - run: echo "No run for this head. Check mergeable_state by hand first."`;
    const m = scanText("zz-sabotage.yml", wf, FIELD);
    expect(m.length).toBe(1);
    expect(
      m[0]!.qualifier,
      `A bare "check \`${FIELD.token}\` by hand" passed. That IS the defect — it ` +
        `was posted to live PRs for four days. If this test is green with a ` +
        `qualifier attached, a marker is matching something it should not.`,
    ).toBeUndefined();
  });

  test("stripping the qualifier from a real, currently-passing site is caught", () => {
    // `github-state-inspection.md` as it stands, and with its caution removed.
    const real = [
      '- **`mergeable_state: "unknown"`** means GitHub has not finished computing it,',
      '  not that the PR is fine. `"dirty"` is a real merge conflict and is work now.',
    ].join("\n");
    const stripped = [
      '- **`mergeable_state: "unknown"`** is worth reading here. `"dirty"` is a real',
      "  merge conflict and is work now.",
    ].join("\n");
    expect(scanText("x.md", real, FIELD)[0]!.qualifier).toBeDefined();
    expect(
      scanText("x.md", stripped, FIELD)[0]!.qualifier,
      "Removing the caution left the mention passing, so the caution is not what " +
        "the gate is reading and any of these sites can silently regress.",
    ).toBeUndefined();
  });
});

test("the anti-vacuity pair — one function, both directions", () => {
  // Neither an always-fire nor an always-quiet implementation passes both, and
  // neither `describe` block above can assert this on its own.
  const bare = "read `mergeable_state` and act on it";
  const qualified = "read `mergeable_state` — bean `fx5r` measured it serving a pre-merge view";
  expect(scanText("a.md", bare, FIELD)[0]!.qualifier).toBeUndefined();
  expect(scanText("a.md", qualified, FIELD)[0]!.qualifier).toBeDefined();
});

test("a qualifier outside the window does NOT count", () => {
  // The window is the claim. If a marker anywhere in a 600-line skill cleared
  // every mention in it, the gate would pass on a file that names the field
  // once in a caution and five times bare — which is `pr-checks-present.yml`
  // exactly: correct code at line 163, stale prose at line 192.
  const far = ["mention: `mergeable_state`", ...Array(WINDOW + 2).fill("filler"), "bean `fx5r` measured it"].join("\n");
  expect(scanText("a.md", far, FIELD)[0]!.qualifier).toBeUndefined();
});

test("the real corpus is clean, and the sweep is not vacuous", () => {
  // Both halves. "0 bare" over 0 files scanned is the failure this repo has
  // paid for repeatedly — a sweep that examined nothing has cleared nothing.
  const r = check(ROOT);
  expect(r.filesScanned, "scanned nothing — this verdict is `could not check`").toBeGreaterThan(100);
  expect(
    r.qualified.length,
    "no mention found at all. The token has been renamed, or the walk no longer " +
      "reaches the skills — either way the gate is now vacuous, not satisfied.",
  ).toBeGreaterThan(0);
  expect(
    r.bare.map((m) => `${m.path}:${m.line}  ${m.text}`),
    "An unqualified mention. Say what the value can be trusted to mean within " +
      `${WINDOW} lines of it; naming the bean counts.`,
  ).toEqual([]);
});

test("declining is by PATH and every declension carries a reason", () => {
  // A line-number exemption is invalidated by the next paragraph inserted
  // above it, and then protects the wrong text. Whole paths only.
  const r = check(ROOT);
  for (const d of r.declined) {
    expect(skipPath(d.path), `\`${d.path}\` is reported declined but \`skipPath\` does not decline it`).toBe(d.because);
    expect(d.because.length).toBeGreaterThan(10);
  }
  // Small enough to read. A growing decline list is how default-deny becomes
  // default-allow one honest exception at a time.
  expect(r.declined.length, `${r.declined.length} paths declined — the list should stay readable`).toBeLessThan(10);
});
