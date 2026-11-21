/**
 * A checker module that will not load is reported once per criterion that
 * names it — and is never imported a second time.
 *
 * This is not a style preference. On Bun 1.3.11 a second dynamic import of a
 * module whose evaluation threw **does not throw again**: it resolves with the
 * namespace of a module whose body aborted partway, and `Object.keys` over
 * that namespace throws `Cannot access X before initialization` for every
 * binding below the throw. Several criteria share one checker file, so
 * discovery imported the same path once per criterion and hit exactly that —
 * the first criterion got an honest "module did not load" and the second took
 * down the whole sweep.
 *
 * The corpus is green, so it cannot pin this. The fixture can.
 *
 * @module scripts/tests/checker-module-load-failure.test
 */
import { describe, test, expect } from "bun:test";
import { join } from "path";

import {
  loadCheckerModule,
  readModule,
  type LoadedModule,
} from "../../pipeline/qa-checker-discovery.ts";

/** Poisoned by the first describe below; never reaches `loadCheckerModule` first. */
const FIXTURE = join(import.meta.dir, "fixtures/throws-at-top-level.ts");
/** Untouched until the cache test imports it — see that fixture's own note. */
const UNCACHED = join(import.meta.dir, "fixtures/throws-at-top-level-uncached.ts");
const evaluations = (): number =>
  (globalThis as { __throwsAtTopLevelEvaluations?: number }).__throwsAtTopLevelEvaluations ?? 0;
const evaluations2 = (): number =>
  (globalThis as { __throwsAtTopLevelEvaluations2?: number }).__throwsAtTopLevelEvaluations2 ?? 0;

describe("what a failed import does, and what it does NOT do", () => {
  test("the module is evaluated ONCE, whatever the second import reports", async () => {
    const before = evaluations();
    await expect(import(FIXTURE)).rejects.toThrow("this checker module cannot load");
    expect(evaluations()).toBe(before + 1);

    // THE SECOND IMPORT IS WHERE RUNTIMES DIFFER, and the first version of
    // this test asserted one answer: on Bun 1.3.11 it RESOLVES, handing back
    // the namespace of a module whose body aborted partway, over which
    // `Object.keys` throws. CI runs `bun-version: latest` and it does not, so
    // the test went red there while passing locally — a platform quirk pinned
    // as if it were a contract.
    //
    // So the quirk is OBSERVED and the contract is asserted. Both are real
    // facts; only one of them is ours.
    let resolved: Record<string, unknown> | undefined;
    try {
      resolved = (await import(FIXTURE)) as Record<string, unknown>;
    } catch {
      // Re-rejected. The kinder behaviour, and the one the cache makes moot.
    }

    // TRUE EITHER WAY, and it is the whole reason `loadCheckerModule` caches:
    // a module that threw is never re-run, so the second caller cannot get a
    // better answer by asking again — only a worse one, or the same error.
    expect(evaluations()).toBe(before + 1);

    if (resolved !== undefined) {
      // This runtime hands back the half-built namespace. `readModule` is what
      // keeps that a third state rather than a false "exports neither".
      expect(() => Object.keys(resolved)).toThrow(/before initialization/);
      expect(readModule(resolved)).toBeUndefined();
    }
  });
});

describe("loadCheckerModule", () => {
  test("a failure is remembered as a failure, not retried", async () => {
    const cache = new Map<string, LoadedModule>();
    const before = evaluations2();

    const first = await loadCheckerModule(UNCACHED, cache);
    const second = await loadCheckerModule(UNCACHED, cache);

    for (const got of [first, second]) {
      expect("loadError" in got).toBe(true);
      expect((got as { loadError: string }).loadError).toContain("this checker module cannot load");
    }
    // Same object: served from the cache, not imported again.
    expect(second).toBe(first);
    expect(evaluations2()).toBe(before + 1);
  });

  test("a module that loads is cached as its namespace", async () => {
    const cache = new Map<string, LoadedModule>();
    const self = join(import.meta.dir, "../../pipeline/qa-checker-discovery.ts");
    const mod = await loadCheckerModule(self, cache);
    expect("loadError" in mod).toBe(false);
    expect(await loadCheckerModule(self, cache)).toBe(mod);
  });
});

// The poisoned-namespace case lived here and has been removed rather than
// made conditional: it needed the runtime to PRODUCE such a namespace, which
// not every Bun does. `qa-checker-discovery.test.ts` covers `readModule`
// against one built by hand — same property, no platform dependency — and the
// branch above still exercises the real thing wherever the runtime offers it.
