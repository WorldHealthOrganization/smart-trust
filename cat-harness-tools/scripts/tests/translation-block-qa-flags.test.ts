/**
 * Every package.json script (`scripts` or `checkoutScripts`) that runs translation-block-qa.ts with `--check`
 * passes only flags the judge accepts. `translation:page-qa:check` passed
 * `--catalogues`, which the judge's flag list lacked, so the gate exited with
 * "unknown flag(s): --catalogues" before judging anything.
 *
 * @module scripts/tests/translation-block-qa-flags.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unknownFlags } from "../qa-results.ts";
import { JUDGE_FLAGS } from "../../pipeline/translation-block-qa.ts";

const pkg = JSON.parse(readFileSync(resolve(import.meta.dir, "..", "..", "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
  checkoutScripts?: Record<string, string>;
};
// The `cat` scripts live under `checkoutScripts`; plain ones under `scripts`.
const all: Record<string, string> = { ...pkg.scripts, ...pkg.checkoutScripts };

describe("translation-block-qa --check flags", () => {
  const judged = Object.entries(all).filter(([, cmd]) => cmd.includes("translation-block-qa.ts") && /(^|\s)--check(\s|$)/.test(cmd));

  test("both gates are found", () => {
    expect(judged.map(([name]) => name).sort()).toEqual(["translation:block-qa:check", "translation:page-qa:check"]);
  });

  test.each(judged)("%s passes no flag the judge refuses", (_name, cmd) => {
    const argv = cmd.slice(cmd.indexOf("translation-block-qa.ts") + "translation-block-qa.ts".length).trim().split(/\s+/);
    expect(unknownFlags(argv, JUDGE_FLAGS)).toEqual([]);
  });
});
