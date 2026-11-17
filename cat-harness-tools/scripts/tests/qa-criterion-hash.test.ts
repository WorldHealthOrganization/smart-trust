import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  criterionSourceHash,
  _resetCriterionHashCache,
} from "../../pipeline/qa-criterion-hash";
import { TOOLS_ROOT } from "../lib/roots.ts";

const VOICE_CHECKERS = join(TOOLS_ROOT, "pipeline", "qa-checkers-voice.ts");

// Each case writes a throwaway checker module. Hashes are memoized by absolute
// path, so every fixture gets a fresh temp dir as well as a cache reset.
function writeModule(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "crithash-"));
  const path = join(dir, "checkers.ts");
  writeFileSync(path, source);
  return path;
}

/**
 * `critA` reaches `helperA` -> `SHARED`; `critB` reaches only `helperB`.
 * `body` lets a case perturb one declaration while holding the rest fixed.
 */
function fixture(
  parts: { shared?: string; helperA?: string; helperB?: string } = {},
): string {
  const shared = parts.shared ?? "/alpha/";
  const helperA = parts.helperA ?? "return SHARED.test(s);";
  const helperB = parts.helperB ?? "return s.length > 0;";
  return `
const SHARED = ${shared};

function helperA(s: string) { ${helperA} }

function helperB(s: string) { ${helperB} }

export const FIXTURE_AUTOMATED_CHECKERS: Record<string, (p: any) => unknown> = {
  "crit-a": (p) => helperA(p.md),
  "crit-b": (p) => helperB(p.md),
};
`;
}

describe("criterionSourceHash", () => {
  beforeEach(() => _resetCriterionHashCache());

  test("criteria sharing a module hash independently", () => {
    const p = writeModule(fixture());
    const a = criterionSourceHash(p, "crit-a");
    const b = criterionSourceHash(p, "crit-b");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    rmSync(p, { force: true });
  });

  test("hashing is deterministic", () => {
    const p = writeModule(fixture());
    const first = criterionSourceHash(p, "crit-a");
    _resetCriterionHashCache();
    expect(criterionSourceHash(p, "crit-a")).toBe(first);
  });

  test("editing one checker leaves its siblings' hashes alone", () => {
    // This is the whole point: under the previous whole-file hash BOTH moved,
    // which invalidated every criterion in the module across every block.
    const before = writeModule(fixture());
    const aBefore = criterionSourceHash(before, "crit-a");
    const bBefore = criterionSourceHash(before, "crit-b");

    _resetCriterionHashCache();
    const after = writeModule(fixture({ helperA: "return !SHARED.test(s);" }));
    expect(criterionSourceHash(after, "crit-a")).not.toBe(aBefore);
    expect(criterionSourceHash(after, "crit-b")).toBe(bBefore);
  });

  test("a shared declaration invalidates exactly its dependents", () => {
    // The safety direction. Under-invalidating here would silently keep a
    // stale verdict after the checker's behaviour changed.
    const before = writeModule(fixture());
    const aBefore = criterionSourceHash(before, "crit-a");
    const bBefore = criterionSourceHash(before, "crit-b");

    _resetCriterionHashCache();
    const after = writeModule(fixture({ shared: "/beta/" }));
    expect(criterionSourceHash(after, "crit-a")).not.toBe(aBefore);
    // `crit-b` never reaches SHARED, so it must not be invalidated.
    expect(criterionSourceHash(after, "crit-b")).toBe(bBefore);
  });

  test("unrelated edits elsewhere in the module change nothing", () => {
    const before = writeModule(fixture());
    const aBefore = criterionSourceHash(before, "crit-a");

    _resetCriterionHashCache();
    const after = writeModule(
      fixture() + "\nexport function unrelated() { return 42; }\n",
    );
    expect(criterionSourceHash(after, "crit-a")).toBe(aBefore);
  });

  test("returns null for a criterion the module does not dispatch", () => {
    // null is the caller's signal to fall back to the whole-file hash.
    const p = writeModule(fixture());
    expect(criterionSourceHash(p, "crit-missing")).toBeNull();
  });

  test("returns null for an unreadable file", () => {
    expect(criterionSourceHash("/nonexistent/checkers.ts", "crit-a")).toBeNull();
  });

  test("resolves criteria in the real voice checker module", () => {
    // Guards the fixture shape against drifting from how checkers are really
    // written (an exported record of arrow dispatchers). What the record is
    // NAMED is not part of that: `findCriterionEntry` matches the property key
    // inside any object literal in the module, so the real export being a bare
    // `AUTOMATED_CHECKERS` rather than the `*_AUTOMATED_CHECKERS` the module
    // docstring describes makes no difference, and neither do the six
    // `...*_AUTOMATED_CHECKERS` spreads that close it — the entry that gets
    // hashed is one property assignment, not the record.
    //
    // Assert the file is THERE first. Every way of getting the path wrong —
    // wrong anchor, a moved or renamed checker — otherwise surfaces as a bare
    // `null` from the ENOENT path inside `parseFile`, which reads exactly like
    // the shape drift this test is supposed to detect.
    expect(existsSync(VOICE_CHECKERS)).toBe(true);
    const scholarly = criterionSourceHash(
      VOICE_CHECKERS,
      "voice-scholarly-default",
    );
    // `voice-ai-slop`, not `wall-side-correct`: that checker moved to the
    // science layer (bean saqd, row 9) and is no longer in this module.
    const slop = criterionSourceHash(VOICE_CHECKERS, "voice-ai-slop");
    expect(scholarly).toBeTruthy();
    expect(slop).toBeTruthy();
    expect(scholarly).not.toBe(slop);
  });
});
