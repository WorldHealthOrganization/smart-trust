import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `backoff-sleep.ts` is imported for its constants by `qa-store.ts`, which the
 * qa-checkers reach through `qa-utils` -> `qa-results`. An `await` in its
 * `import.meta.main` block is a TOP-LEVEL await, which makes the module async;
 * in an index checkout `harness-config`'s synchronous `require()` of a
 * layer's plugin table then failed while the checkers were loading
 * ("require() async module ... is unsupported"), and every script importing
 * `qa-checkers-extended` crashed at load. Read statically: the failure needs
 * the index's layers, which a standalone checkout of this layer has not got.
 */
describe("backoff-sleep stays a synchronous module", () => {
  it("its CLI block does not await", () => {
    const text = readFileSync(resolve(import.meta.dir, "../backoff-sleep.ts"), "utf8");
    const start = text.indexOf("if (import.meta.main) {");
    expect(start).toBeGreaterThan(-1);
    const code = text.slice(start).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(code).not.toMatch(/\bawait\b/);
  });
});
