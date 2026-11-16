/**
 * The gates over `index.config.json` and the root scans folded into its
 * shared helpers. Skill `index-config`, issue #2483.
 *
 * These live in cat-harness-tools, not beside `cat-harness/scripts/tests/
 * index-config.test.ts`, because they import the gate scripts in this layer,
 * and because the last test reads THIS monorepo's own index — neither of
 * which a standalone cat-harness checkout has.
 *
 * @module scripts/tests/index-config-gates.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { indexAgreement, resolveLandingInstance } from "../../../schemas/kg/harness-config.ts";
import { INDEX_CONFIG_SCHEMA, IndexConfigSchema, checkIgnoreBlock, readIndexConfig, syncIgnoreBlock } from "../../../schemas/kg/index-config.ts";
import { instantiatedNames } from "../../check-avatar-instances.ts";
import { instanceNames } from "../../check-folio-mount.ts";
import { formatIgnoreBlock } from "../../check-index-ignores.ts";
import { sweep as instanceConfigSweep } from "../../check-instance-config.ts";
import { formatAgreement, formatLanding } from "../../check-landing-instance.ts";

const base = mkdtempSync(join(tmpdir(), "index-config-gates-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
function root(files: Record<string, string | object> = {}): string {
  const r = join(base, `r-${++n}`);
  mkdirSync(r, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(r, rel)), { recursive: true });
    writeFileSync(join(r, rel), typeof body === "string" ? body : `${JSON.stringify(body, null, 2)}\n`);
  }
  return r;
}
const SHA = "a".repeat(40);
const remote = (repository: string) => ({ repository, ref: SHA });
const index = (instances: object[], site?: object): object => ({ $schema: INDEX_CONFIG_SCHEMA, instances, ...(site ? { site } : {}) });

describe("the folded root scans", () => {
  test("check-avatar-instances and check-folio-mount read the instantiated set, index first", () => {
    const r = root({ "a.config.json": {}, "harness.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "m", source: { remote: remote("o/m") } }]) });
    expect(instantiatedNames(r)).toEqual(["a", "m"]);
    expect(instanceNames(r)).toEqual(["a", "m"]);
    const bare = root({ "a.config.json": {}, "harness.config.json": {} });
    expect(instantiatedNames(bare)).toEqual(["a"]);
    // check-folio-mount's own scan kept the retired `harness`: no longer
    expect(instanceNames(bare)).toEqual(["a"]);
  });

  test("check-instance-config never reports the reserved index as an orphan config", () => {
    const r = root({ "x.json": { name: "x", directories: [] }, "x.config.json": {}, "index.config.json": index([{ name: "x", source: { local: { at: "." } } }]) });
    expect(instanceConfigSweep(r).findings.filter((f) => f.kind === "orphan")).toEqual([]);
  });
});

describe("check:landing-instance over an index", () => {
  test("an index landing on an unlisted instance FAILS the gate, and never falls back to a flag", () => {
    const r = root({ "a.config.json": { site: { landing: true } }, "index.config.json": index([{ name: "a" }, { name: "b" }], { landing: "c" }) });
    expect(formatLanding(resolveLandingInstance(r)).ok).toBe(false);
  });

  test("an index landing passes, and says it came from the index", () => {
    const r = root({ "index.config.json": index([{ name: "a" }, { name: "b" }], { landing: "a" }) });
    const f = formatLanding(resolveLandingInstance(r));
    expect(f.ok).toBe(true);
    expect(f.text).toContain("index.config.json");
  });

  test("agreement with the root configs: an unlisted config fails, a config-less entry does not", () => {
    expect(formatAgreement(indexAgreement(root({ "a.config.json": {}, "stray.config.json": {}, "index.config.json": index([{ name: "a" }]) }))).ok).toBe(false);
    expect(formatAgreement(indexAgreement(root({ "a.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "c" }]) }))).ok).toBe(true);
    expect(formatAgreement(undefined).ok).toBe(true);
  });
});

describe("check:index-ignores", () => {
  test("missing and drifted blocks fail; a synced block passes", () => {
    const cfg = IndexConfigSchema.parse(index([{ name: "m", source: { remote: remote("o/m") } }]));
    const r = root({ ".gitignore": "x\n" });
    expect(formatIgnoreBlock(checkIgnoreBlock(r, cfg, [])).ok).toBe(false);
    syncIgnoreBlock(r, cfg, []);
    expect(formatIgnoreBlock(checkIgnoreBlock(r, cfg, [])).ok).toBe(true);
    expect(formatIgnoreBlock(checkIgnoreBlock(r, cfg, ["extra"])).ok).toBe(false);
  });

  test("this repository's own block agrees with its index, and its landing is cat-harness", () => {
    const repo = join(import.meta.dir, "..", "..", "..", "..");
    const idx = readIndexConfig(repo);
    expect(idx.state).toBe("ok");
    if (idx.state === "ok") expect(checkIgnoreBlock(repo, idx.config).state).toBe("current");
    expect(formatAgreement(indexAgreement(repo)).ok).toBe(true);
  });
});
