/**
 * Loading this layer's QA-checker contribution registers its content types.
 *
 * In a fresh process, because inside `bun test` another file may already
 * have loaded `dak-content-type.ts`. Calibrated: removing the import from
 * `qa-checkers-dak.ts` makes the child print `false false`.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("qa-checkers-dak.ts", () => {
  it("registersDakAndSushiContentTypes", () => {
    const here = import.meta.dir;
    const script = [
      `require(${JSON.stringify(join(here, "qa-checkers-dak.ts"))});`,
      `const { defaultContentTypes } = require(${JSON.stringify(join(here, "..", "platform", "index.ts"))});`,
      `console.log(defaultContentTypes.get("dak") !== undefined, defaultContentTypes.get("sushi") !== undefined);`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", script], { encoding: "utf-8", cwd: join(here, "..") });
    expect(r.stdout.trim().split("\n").pop()).toBe("true true");
  });
});
