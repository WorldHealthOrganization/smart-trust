/**
 * Loading this layer's contributions registers its content type.
 *
 * Run in a fresh process: inside `bun test` another file may already have
 * loaded `ig-content-type.ts`, and the default registry would answer yes for
 * the wrong reason. `plugin-slots.ts` now loads the publisher's registration
 * (`ig-publisher.ts`), not the IG readers behind `stage-local-ig.ts`, so its
 * own import of the schema is the one this test sees.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("plugin-slots.ts", () => {
  it("registersIgContentType", () => {
    const here = import.meta.dir;
    const script = [
      `require(${JSON.stringify(join(here, "plugin-slots.ts"))});`,
      `const { defaultContentTypes } = require(${JSON.stringify(join(here, "..", "..", "cat-harness-tools", "schemas", "content", "content-type.ts"))});`,
      `console.log(defaultContentTypes.get("ig") !== undefined);`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", script], { encoding: "utf-8", cwd: join(here, "..") });
    expect(r.stderr.trim().split("\n").filter((l) => /error/i.test(l))).toEqual([]);
    expect(r.stdout.trim().split("\n").pop()).toBe("true");
  });
});
