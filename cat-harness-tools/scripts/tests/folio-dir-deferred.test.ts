/**
 * The failure moves; the resolution does not. Bean `folio-assistant-1hkj`.
 *
 * Twenty modules opened with `const FOLIO_DIR = folioDir(REPO_ROOT)`. That
 * throws on a malformed declaration, and a throw at module scope ABORTS
 * EVALUATION — every export below the failing line is left unbound, and
 * `await import()` can hand back the half-built namespace instead of
 * re-throwing. `95s1` spent an afternoon on the result: an error 3,186 lines
 * from its cause, resembling a circular import closely enough to be filed as
 * one.
 *
 * @module scripts/tests/folio-dir-deferred.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { folioDir, folioDirDeferred } from "../../schemas/kg/cat-harness.ts";

// Every root is removed after its test. A leaked `<dir>/<dir>.json` holding
// "{ not json" is a broken DECLARATION to anything that scans the temp
// directory for instances: it turned seven `check-draft-beans` tests red
// whenever the two files shared a run.
const roots: string[] = [];
afterEach(() => {
  for (const d of roots.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A root whose declaration will not parse, so `folioDir` throws on it. */
function unreadableRoot(): string {
  const d = mkdtempSync(join(tmpdir(), "folio-dir-deferred-"));
  roots.push(d);
  // Named after the DIRECTORY, and `<name>.json` rather than
  // `<name>.config.json`. Declarations became `<name>.json` on 2026-09-21, and
  // an unparseable file has no `name` to agree with — so it counts as this
  // layer's broken declaration only when its stem matches the directory or
  // a paired `<stem>.config.json` sits beside it. `probe.config.json` matched
  // neither, so this root stopped being unreadable and the precondition below
  // stopped holding, which is exactly the vacuous green it guards against.
  writeFileSync(join(d, `${basename(d)}.json`), "{ not json", "utf-8");
  return d;
}

describe("folioDirDeferred", () => {
  test("the precondition: `folioDir` really does throw on this root", () => {
    // Asserted rather than assumed. Without it the two tests below could pass
    // over a root that never fails, proving nothing — the vacuous-green shape
    // this repository keeps paying for.
    expect(() => folioDir(unreadableRoot())).toThrow();
  });

  test("constructing it does NOT throw, which is the whole point", () => {
    // This is what runs at module scope. If it threw, every export below the
    // call would go unbound and the error would surface somewhere else
    // entirely.
    expect(() => folioDirDeferred(unreadableRoot(), import.meta.url)).not.toThrow();
  });

  test("the first USE throws, and names the module that could not resolve", () => {
    const get = folioDirDeferred(unreadableRoot(), "file:///probe-module.ts");
    expect(get).toThrow(/probe-module\.ts/);
  });

  test("the original failure is carried as `cause`, not flattened into a string", () => {
    // A reader needs the declaration's own error. Re-wrapping without a cause
    // would replace one confusing message with another.
    const root = unreadableRoot();
    const get = folioDirDeferred(root, import.meta.url);
    try {
      get();
      throw new Error("expected it to throw");
    } catch (e) {
      expect((e as Error).message).toContain("is not valid JSON");
      expect((e as { cause?: unknown }).cause).toBeInstanceOf(Error);
    }
  });

  test("a readable root resolves, and resolves AT CONSTRUCTION", () => {
    // The half that must NOT change. `findContentRepoRoot` reads
    // `process.cwd()`, and `checker-missing-evidence.test.ts` depends on the
    // value being fixed when the module loads — it uses absolute fixture paths
    // precisely because a test's `chdir` cannot move it. Resolving lazily
    // would break that; memoising on first use would make it depend on which
    // caller ran first.
    const root = mkdtempSync(join(tmpdir(), "folio-dir-ok-"));
    roots.push(root);
    const get = folioDirDeferred(root, import.meta.url);
    expect(get()).toBe(folioDir(root));
    expect(get()).toBe(get());
  });
});
