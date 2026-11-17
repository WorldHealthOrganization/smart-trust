/**
 * `index.config.json` (`folio-index-config/v1`) — the schema, the resolvers
 * behind it, the one read/write path for remote mounts, the converter, the
 * reserved `index` stem, `index.lock.json` and the generated `.gitignore`
 * block. Skill `index-config`; proposal `docs/proposals/index-config.md`.
 *
 * Every fixture is a plain temporary directory: nothing here needs git or the
 * network (the mount itself is covered over bare repositories in
 * `remote-mount.test.ts`). Nothing here imports above cat-harness either, so
 * it runs in a standalone cat-harness checkout: the GATES' formatting, the
 * folded scanners in cat-harness-tools and this monorepo's own index are
 * tested in `cat-harness-tools/scripts/tests/sdlc/index-config-gates.test.ts`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  effectiveLayerConfig,
  indexAgreement,
  instantiatedHarnessNames,
  readHarnessConfig,
  resolveLandingInstance,
} from "../../schemas/kg/harness-config.ts";
import {
  IGNORE_BLOCK_BEGIN,
  IGNORE_BLOCK_END,
  INDEX_CONFIG_SCHEMA,
  IndexConfigSchema,
  addIndexLayer,
  checkIgnoreBlock,
  ignoreBlockLines,
  readDeclaredMounts,
  readIndexConfig,
  readMountFields,
  syncIgnoreBlock,
  writeDeclaredMounts,
  formatIndexConfig,
  withDeclaredHarnesses,
  type IndexConfig,
} from "../../schemas/kg/index-config.ts";
import { readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { findDeclarationFile, layerRootsIn, isReservedIndexFile, lockFilesIn, rootConfigStems } from "../../schemas/kg/instance-roots.ts";
import { mountLockPathFor, mountedInstanceRoots } from "../../schemas/kg/remote-mount.ts";
import { applyMigration, planMigration } from "../index-config-migrate.ts";
import { lockNames, readLocks } from "../mount-from-lock.ts";
import { newFolioIndex } from "../init-folio.ts";

const base = mkdtempSync(join(tmpdir(), "index-config-test-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
/** A fresh root holding `files` (objects are written as two-space JSON). */
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
const consent = { trust: { consent: { by: "test", on: "2026-10-07", ref: SHA, evidence: "index-config.test.ts" } } };
const remote = (repository: string, extra: object = {}) => ({ repository, ref: SHA, ...consent, ...extra });
const index = (instances: object[], site?: object): object => ({ $schema: INDEX_CONFIG_SCHEMA, instances, ...(site ? { site } : {}) });
const decl = (name: string, extra: object = {}): object => ({ name, directories: [], ...extra });

describe("the schema", () => {
  test("accepts local, remote and inline-override entries, and a landing it lists", () => {
    const p = IndexConfigSchema.safeParse(
      index(
        [
          { name: "root", source: { local: { at: "." } } },
          { name: "cat-harness", site: { landing: true } },
          { name: "who-iris", source: { remote: remote("o/who-iris", { overrides: { "who-iris": { whole: true } }, note: "n" }) } },
          { name: "smart-base", import: "smart-base.config.json" },
        ],
        { landing: "cat-harness" },
      ),
    );
    expect(p.success).toBe(true);
  });

  test("the remote source IS RemoteMountSchema minus `harness`: strict, and a pin is a full SHA", () => {
    expect(IndexConfigSchema.safeParse(index([{ name: "a", source: { remote: { repository: "o/a", ref: "main" } } }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "a", source: { remote: { ...remote("o/a"), harness: "a" } } }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "a", source: { local: { at: "." }, remote: remote("o/a") } }])).success).toBe(false);
  });

  test("`index` is reserved, `hub` is the landing keyword, and a name appears once", () => {
    expect(IndexConfigSchema.safeParse(index([{ name: "index" }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "hub" }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "a" }, { name: "a" }])).success).toBe(false);
  });

  test("`site.agentRun` is a boolean the repository declares beside `landing` (owner, 2026-10-14, Q7)", () => {
    expect(IndexConfigSchema.safeParse(index([{ name: "a" }], { agentRun: true })).success).toBe(true);
    expect(IndexConfigSchema.safeParse(index([{ name: "a" }], { landing: "a", agentRun: false })).success).toBe(true);
    expect(IndexConfigSchema.safeParse(index([{ name: "a" }], { agentRun: "yes" })).success).toBe(false);
    // Still strict: a misspelt flag is refused rather than silently ignored.
    expect(IndexConfigSchema.safeParse(index([{ name: "a" }], { agentrun: true })).success).toBe(false);
  });

  test("a landing that names an instance the index does not list is refused", () => {
    const p = IndexConfigSchema.safeParse(index([{ name: "a" }, { name: "b" }], { landing: "c" }));
    expect(p.success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "a" }, { name: "b" }], { landing: "hub" })).success).toBe(true);
  });

  test("an import is a root `<name>.config.json`, never the index itself or a path", () => {
    expect(IndexConfigSchema.safeParse(index([{ name: "a", import: "index.config.json" }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "a", import: "x/a.config.json" }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(index([{ name: "a", import: "a.json" }])).success).toBe(false);
  });

  test("init-folio's starting index validates", () => {
    expect(IndexConfigSchema.safeParse(newFolioIndex("my-folio")).success).toBe(true);
  });
});

describe("the instantiated set, with and without an index", () => {
  test("without an index: every root `<name>.config.json`, the legacy and reserved names excluded (unchanged)", () => {
    const r = root({ "a.config.json": {}, "b.config.json": {}, "harness.config.json": {} });
    expect(instantiatedHarnessNames(r)).toEqual(["a", "b"]);
  });

  test("with an index: its instances, and nothing else", () => {
    const r = root({ "a.config.json": {}, "stray.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "m", source: { remote: remote("o/m") } }]) });
    expect(instantiatedHarnessNames(r)).toEqual(["a", "m"]);
  });

  test("an unreadable index throws rather than falling back to the file scan", () => {
    const r = root({ "a.config.json": {}, "index.config.json": "{ not json" });
    expect(() => instantiatedHarnessNames(r)).toThrow(/index.config.json/);
    expect(readIndexConfig(r).state).toBe("unreadable");
  });

  test("agreement: a root config the index does not list, and a missing import, are reported", () => {
    const r = root({ "a.config.json": {}, "stray.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "b", import: "gone.config.json" }, { name: "c" }]) });
    const a = indexAgreement(r)!;
    expect(a.unlisted).toEqual(["stray"]);
    expect(a.missingImport).toEqual([{ name: "b", file: "gone.config.json" }]);
    expect(a.withoutConfig).toEqual(["c"]);
    expect(indexAgreement(root({ "a.config.json": {} }))).toBeUndefined();
    const fine = indexAgreement(root({ "a.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "c" }]) }))!;
    expect([fine.unlisted, fine.missingImport]).toEqual([[], []]);
  });
});

describe("import, then override", () => {
  test("inline fields override the imported config; objects merge, the rest is replaced", () => {
    const r = root({
      "a.config.json": { contentType: "paper", site: { landing: true }, translation: { defaultLocale: "en", supportedLocales: ["en", "fr"] } },
      "index.config.json": index([{ name: "a", contentType: "document", site: { landing: false }, translation: { supportedLocales: ["es"] } }]),
    });
    const c = effectiveLayerConfig(r, "a")!;
    expect(c.contentType).toBe("document");
    expect(c.site).toEqual({ landing: false });
    expect(c.translation?.defaultLocale).toBe("en");
    expect(c.translation?.supportedLocales).toEqual(["es"]);
  });

  test("`import` names another file; an entry with nothing to import is its inline fields alone", () => {
    const r = root({ "legacy-a.config.json": { contentType: "paper" }, "index.config.json": index([{ name: "a", import: "legacy-a.config.json" }, { name: "b", contentType: "document" }]) });
    expect(effectiveLayerConfig(r, "a")?.contentType).toBe("paper");
    expect(effectiveLayerConfig(r, "b")?.contentType).toBe("document");
    expect(effectiveLayerConfig(r, "zzz")).toBeNull();
  });

  test("readHarnessConfig returns the effective config for an indexed instance, and the file otherwise", () => {
    const r = root({
      "a/a.json": decl("a"),
      "a.config.json": { contentType: "paper" },
      "b/b.json": decl("b"),
      "b.config.json": { contentType: "paper" },
      "index.config.json": index([{ name: "a", contentType: "document" }]),
    });
    expect(readHarnessConfig(join(r, "a"))?.contentType).toBe("document");
    // `b` is not listed: read exactly as before
    expect(readHarnessConfig(join(r, "b"))?.contentType).toBe("paper");
  });
});

describe("which harness `/` is", () => {
  test("the index's `site.landing` decides, ahead of any flag", () => {
    const r = root({ "a.config.json": { site: { landing: true } }, "b.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "b" }], { landing: "b" }) });
    expect(resolveLandingInstance(r)).toMatchObject({ kind: "instance", name: "b", by: "index" });
  });

  test("`hub` is the neutral hub", () => {
    const r = root({ "index.config.json": index([{ name: "a" }, { name: "b" }], { landing: "hub" }) });
    expect(resolveLandingInstance(r)).toMatchObject({ kind: "hub", names: ["a", "b"] });
  });

  test("a landing naming an instance that is not instantiated is an ERROR, never a fallback to the flags", () => {
    // Written raw: the schema refuses it, which is what makes the file unreadable.
    const r = root({ "a.config.json": { site: { landing: true } }, "b.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "b" }], { landing: "c" }) });
    expect(resolveLandingInstance(r).kind).toBe("invalid");
  });

  test("no `site.landing`: the flags decide, over the EFFECTIVE configs (an inline flag counts)", () => {
    const r = root({ "a.config.json": {}, "b.config.json": {}, "index.config.json": index([{ name: "a" }, { name: "b", site: { landing: true } }]) });
    expect(resolveLandingInstance(r)).toMatchObject({ kind: "instance", name: "b", by: "flag" });
    const none = root({ "index.config.json": index([{ name: "a" }, { name: "b" }]) });
    expect(resolveLandingInstance(none).kind).toBe("ambiguous");
    const sole = root({ "index.config.json": index([{ name: "a" }]) });
    expect(resolveLandingInstance(sole)).toMatchObject({ kind: "instance", name: "a", by: "sole" });
  });

  test("without an index, behaviour is unchanged", () => {
    const r = root({ "a.config.json": { site: { landing: true } }, "b.config.json": {} });
    expect(resolveLandingInstance(r)).toMatchObject({ kind: "instance", name: "a", by: "flag" });
  });
});

describe("the reserved `index` stem", () => {
  test("no root scan reads `index.config.json` or `index.lock.json` as a harness or a declaration", () => {
    const r = root({
      "real.json": decl("real"),
      "real.config.json": {},
      // Worst case: an index file that even CARRIES a matching `name`.
      "index.json": { name: "index", directories: [] },
      "index.config.json": "{ not json",
      "index.lock.json": "{ not json",
    });
    expect(rootConfigStems(r)).toEqual(["real"]);
    expect(findDeclarationFile(r)).toBe("real.json");
    for (const f of ["index.config.json", "index.lock.json", "index.json"]) expect(isReservedIndexFile(f)).toBe(true);
    expect(isReservedIndexFile("indexer.config.json")).toBe(false);
  });

});

describe("remote mounts: one read path, one write path", () => {
  test("index only: read from the index", () => {
    const r = root({ "down.json": decl("down"), "index.config.json": index([{ name: "m", source: { remote: remote("o/m", { overrides: { m: { whole: true } } }) } }]) });
    const d = readDeclaredMounts(r);
    expect(d.from).toBe("index");
    expect(d.mounts).toEqual([{ harness: "m", ...remote("o/m", { overrides: { m: { whole: true } } }) }]);
  });

  test("declaration only (today): read from `remoteMounts`, unchanged", () => {
    const r = root({ "down.json": decl("down", { remoteMounts: [{ harness: "m", ...remote("o/m") }] }) });
    const d = readDeclaredMounts(r);
    expect(d.from).toBe("declaration");
    expect(d.mounts.map((m) => m.harness)).toEqual(["m"]);
    expect(readDeclaredMounts(root({ "down.json": decl("down") })).from).toBe("none");
  });

  test("a declaration naming a kind only its mounts supply still yields its mounts (bean qump)", () => {
    // who-iris names core's `catalogue`, and core is one of its mounts: in an
    // empty checkout the kind is not registered until the mount has run.
    const unknown = { id: "lib", path: "lib/", description: "x", graphTypologies: ["qump-not-yet-mounted"] };
    const r = root({ "down.json": decl("down", { directories: [unknown], remoteMounts: [{ harness: "m", ...remote("o/m") }] }) });
    expect(() => readDeclaration(r)).toThrow(/unknown graph typology "qump-not-yet-mounted"/);
    expect(readDeclaredMounts(r).mounts.map((m) => m.harness)).toEqual(["m"]);
    expect(readMountFields(r)?.name).toBe("down");
    expect(readMountFields(r)?.directories.map((d) => d.path)).toEqual(["lib/"]);
  });

  test("a mount field that does not parse still throws, naming the file", () => {
    const r = root({ "down.json": decl("down", { remoteMounts: [{ harness: "m" }] }) });
    expect(() => readDeclaredMounts(r)).toThrow(/down\.json: remoteMounts/);
  });

  test("both carrying mounts is an error naming both files", () => {
    const r = root({
      "down.json": decl("down", { remoteMounts: [{ harness: "m", ...remote("o/m") }] }),
      "index.config.json": index([{ name: "m", source: { remote: remote("o/m") } }]),
    });
    expect(() => readDeclaredMounts(r)).toThrow(/index\.config\.json.*down\.json|BOTH/);
    try {
      readDeclaredMounts(r);
    } catch (e) {
      expect((e as Error).message).toContain("index.config.json");
      expect((e as Error).message).toContain("down.json");
    }
  });

  test("the writer targets the index, writes the ignore block, and drops a mount's source", () => {
    const r = root({ "down.json": decl("down"), "down.config.json": {}, "index.config.json": index([{ name: "down", source: { local: { at: "." } } }]) });
    writeDeclaredMounts(r, [{ harness: "m", ...remote("o/m") }, { harness: "p", ...remote("o/p", { overrides: { p: { path: "deep/p" } } }) }]);
    expect(readDeclaredMounts(r).mounts.map((m) => m.harness)).toEqual(["m", "p"]);
    expect(readFileSync(join(r, ".gitignore"), "utf-8")).toContain(`${IGNORE_BLOCK_BEGIN}\n/m/\n/deep/p/\n${IGNORE_BLOCK_END}`);
    writeDeclaredMounts(r, [{ harness: "m", ...remote("o/m") }]);
    const after = readIndexConfig(r);
    expect(after.state === "ok" && after.config.instances.map((e) => e.name)).toEqual(["down", "m"]);
    expect(checkIgnoreBlock(r, (after as { config: IndexConfig }).config).state).toBe("current");
  });

  test("the writer refuses while the declaration still carries `remoteMounts`, and seeds an index when there is none", () => {
    const busy = root({ "down.json": decl("down", { remoteMounts: [{ harness: "m", ...remote("o/m") }] }) });
    expect(() => writeDeclaredMounts(busy, [])).toThrow(/index-config:migrate/);
    const fresh = root({ "down.json": decl("down"), "down.config.json": {} });
    writeDeclaredMounts(fresh, [{ harness: "m", ...remote("o/m") }]);
    expect(instantiatedHarnessNames(fresh)).toEqual(["down", "m"]);
  });

  test("addIndexLayer records a newly instantiated harness (kg:instantiate)", () => {
    const r = root({ "index.config.json": index([{ name: "a" }]) });
    expect(addIndexLayer(r, { name: "b" })).toBe(true);
    expect(addIndexLayer(r, { name: "b" })).toBe(false);
    expect(instantiatedHarnessNames(r)).toEqual(["a", "b"]);
    expect(addIndexLayer(root(), { name: "b" })).toBe(false);
  });
});

describe("index-config:migrate", () => {
  test("moves `remoteMounts` losslessly, keeps the root first, imports matching configs, renames the lock", () => {
    const mounts = [
      { harness: "bootstrap", ...remote("litlfred/bootstrap", { overrides: { bootstrap: { whole: true } }, note: "n" }) },
      { harness: "tools", ...remote("litlfred/tools", { overrides: { tools: { whole: true }, bootstrap: { skip: true } } }) },
    ];
    const lock = { $schema: "cat-harness-mount-lock/v1", mounts: [], instances: [{ instance: "bootstrap", path: "bootstrap" }], unmounted: [] };
    const r = root({
      "down.json": decl("down", { remoteMounts: mounts }),
      "down.config.json": {},
      "cat/cat.json": decl("cat"),
      "cat.config.json": { site: { landing: true } },
      "bootstrap.config.json": {},
      "down.mount-lock.json": lock,
      ".gitignore": "node_modules/\n",
    });
    const plan = planMigration(r);
    // root first, then the local instances, then the mounts
    expect(plan.migration.config.instances.map((e) => e.name)).toEqual(["down", "cat", "bootstrap", "tools"]);
    expect(plan.migration.config.site).toEqual({ landing: "cat" });
    expect(plan.migration.findings).toEqual([]);
    applyMigration(r, plan);
    expect(readDeclaredMounts(r)).toMatchObject({ from: "index", mounts });
    expect(JSON.parse(readFileSync(join(r, "down.json"), "utf-8")).remoteMounts).toBeUndefined();
    expect(existsSync(join(r, "index.lock.json"))).toBe(true);
    expect(existsSync(join(r, "down.mount-lock.json"))).toBe(false);
    expect(readFileSync(join(r, ".gitignore"), "utf-8")).toBe(`node_modules/\n\n${IGNORE_BLOCK_BEGIN}\n/bootstrap/\n/tools/\n${IGNORE_BLOCK_END}\n`);
    // idempotent
    expect(planMigration(r).changes).toBe(false);
  });

  test("a re-run merges what the declaration gained, and refuses a conflicting duplicate", () => {
    const r = root({ "down.json": decl("down", { remoteMounts: [{ harness: "a", ...remote("o/a") }] }), "down.config.json": {} });
    applyMigration(r, planMigration(r));
    // a cutover appends to the declaration by hand
    writeFileSync(join(r, "down.json"), JSON.stringify(decl("down", { remoteMounts: [{ harness: "b", ...remote("o/b") }] })));
    applyMigration(r, planMigration(r));
    expect(readDeclaredMounts(r).mounts.map((m) => m.harness)).toEqual(["a", "b"]);
    // identical again: dropped from the declaration
    writeFileSync(join(r, "down.json"), JSON.stringify(decl("down", { remoteMounts: [{ harness: "b", ...remote("o/b") }] })));
    applyMigration(r, planMigration(r));
    expect(readDeclaredMounts(r).mounts.map((m) => m.harness)).toEqual(["a", "b"]);
    // different: refused
    writeFileSync(join(r, "down.json"), JSON.stringify(decl("down", { remoteMounts: [{ harness: "b", ...remote("o/other") }] })));
    expect(() => planMigration(r)).toThrow(/BOTH/);
    // ...unless a person says the declaration is the newer pin
    applyMigration(r, planMigration(r, { preferDeclaration: true }));
    expect(readDeclaredMounts(r).mounts.find((m) => m.harness === "b")?.repository).toBe("o/other");
  });

  test("a standalone separated repository: its own instance, and an inherited fork config is a FINDING, not an import", () => {
    // smart-trust, cut from the smart-base fork, still carrying its root config
    const r = root({ "smart-trust.json": decl("smart-trust"), "smart-trust.config.json": {}, "smart-base.config.json": { contentType: "dak" } });
    const plan = planMigration(r);
    expect(plan.migration.config.instances).toEqual([{ name: "smart-trust", source: { local: { at: "." } } }]);
    expect(plan.migration.findings).toHaveLength(1);
    expect(plan.migration.findings[0]).toMatchObject({ kind: "unmatched-config" });
    expect(plan.migration.findings[0]!.detail).toContain("smart-base.config.json");
    applyMigration(r, plan);
    expect(IndexConfigSchema.safeParse(JSON.parse(readFileSync(join(r, "index.config.json"), "utf-8"))).success).toBe(true);
    // the empty block is written too, so the gate holds
    expect(readFileSync(join(r, ".gitignore"), "utf-8")).toBe(`${IGNORE_BLOCK_BEGIN}\n${IGNORE_BLOCK_END}\n`);
  });
});

describe("index.lock.json, and the legacy name", () => {
  const lock = (instances: object[]) => ({ $schema: "cat-harness-mount-lock/v1", mounts: [], instances, unmounted: [] });
  const inst = (name: string) => ({ instance: name, repository: "o/r", sha: SHA, upstreamRoot: "", path: name, via: name, pinnedBy: "declared", declaration: { file: `${name}.json`, sha256: "0".repeat(64) }, directories: [] });

  test("readers take index.lock.json, else the legacy name — the schema-side and node-only rules agree", () => {
    const fresh = root({ "index.lock.json": lock([inst("a")]), "a/a.json": decl("a") });
    const legacy = root({ "down.mount-lock.json": lock([inst("a")]), "a/a.json": decl("a") });
    for (const r of [fresh, legacy]) {
      expect(lockFilesIn(r).files).toEqual(lockNames(r).names);
      expect([...mountedInstanceRoots(r).keys()]).toEqual(["a"]);
      expect(readLocks(r).map((l) => l.error)).toEqual([undefined]);
    }
    expect(mountLockPathFor(fresh, "down")).toBe(join(fresh, "index.lock.json"));
    expect(mountLockPathFor(legacy, "down")).toBe(join(legacy, "down.mount-lock.json"));
    // a checkout with neither is told the NEW name
    expect(mountLockPathFor(root(), "down").endsWith("index.lock.json")).toBe(true);
  });

  test("both present is an error naming both, never a merge", () => {
    const r = root({ "index.lock.json": lock([inst("a")]), "down.mount-lock.json": lock([inst("b")]), "a/a.json": decl("a"), "b/b.json": decl("b") });
    const s = lockFilesIn(r);
    expect(s.files).toEqual([]);
    expect(s.conflict).toContain("index.lock.json");
    expect(s.conflict).toContain("down.mount-lock.json");
    expect(lockNames(r).conflict).toBe(s.conflict);
    expect(() => mountLockPathFor(r, "down")).toThrow(/both exist/);
    expect(readLocks(r)[0]!.error).toContain("both exist");
    expect(mountedInstanceRoots(r).size).toBe(0);
  });

  test("the lock is never read as a declaration", () => {
    const r = root({ "index.lock.json": lock([inst("a")]) });
    expect(layerRootsIn(r)).toEqual([]);
  });
});

describe("the generated .gitignore block", () => {
  const cfg = IndexConfigSchema.parse(
    index([{ name: "root", source: { local: { at: "." } } }, { name: "m", source: { remote: remote("o/m") } }, { name: "p", source: { remote: remote("o/p", { overrides: { p: { path: "x/p/" } } }) } }]),
  );

  test("one line per remote instance, then the locked closure", () => {
    expect(ignoreBlockLines(cfg)).toEqual([IGNORE_BLOCK_BEGIN, "/m/", "/x/p/", IGNORE_BLOCK_END]);
    expect(ignoreBlockLines(cfg, ["m", "z", "dep"])).toEqual([IGNORE_BLOCK_BEGIN, "/m/", "/x/p/", "/dep/", "/z/", IGNORE_BLOCK_END]);
  });

  test("written in place between its markers, and the gate reports missing and drift", () => {
    const r = root({ ".gitignore": "a\n# keep me\n" });
    expect(checkIgnoreBlock(r, cfg, []).state).toBe("missing");
    expect(syncIgnoreBlock(r, cfg, [])).toBe(true);
    expect(checkIgnoreBlock(r, cfg, []).state).toBe("current");
    expect(syncIgnoreBlock(r, cfg, [])).toBe(false);
    // a hand edit inside the block is drift
    writeFileSync(join(r, ".gitignore"), readFileSync(join(r, ".gitignore"), "utf-8").replace("/m/\n", ""));
    expect(checkIgnoreBlock(r, cfg, []).state).toBe("drift");
    syncIgnoreBlock(r, cfg, []);
    const text = readFileSync(join(r, ".gitignore"), "utf-8");
    expect(text.startsWith("a\n# keep me\n")).toBe(true);
    expect(text.split(IGNORE_BLOCK_BEGIN)).toHaveLength(2);
  });

});

describe("the new form: layers + harnesses (cat-harness#1138)", () => {
  const layers = [{ name: "base" }, { name: "dep", source: { remote: remote("o/dep") } }, { name: "me" }];
  const newForm = (harnesses: object[], site?: object): object => ({ $schema: INDEX_CONFIG_SCHEMA, layers, harnesses, ...(site ? { site } : {}) });

  test("only the declared harnesses are instantiated; every layer is still mounted", () => {
    const r = root({ "index.config.json": newForm([{ name: "base" }], { landing: "base" }) });
    expect(instantiatedHarnessNames(r)).toEqual(["base"]);
    const idx = readIndexConfig(r);
    expect(idx.state).toBe("ok");
    if (idx.state === "ok") expect(idx.config.instances.map((e) => e.name)).toEqual(["base", "dep", "me"]);
    expect(resolveLandingInstance(r)).toMatchObject({ kind: "instance", name: "base", by: "index", names: ["base"] });
  });

  test("the landing must be a harness, not a layer only mounted", () => {
    expect(IndexConfigSchema.safeParse(newForm([{ name: "base" }], { landing: "dep" })).success).toBe(false);
  });

  test("a harness must be a listed layer, and so must its definedBy", () => {
    expect(IndexConfigSchema.safeParse(newForm([{ name: "nowhere" }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(newForm([{ name: "me", definedBy: "nowhere" }])).success).toBe(false);
    expect(IndexConfigSchema.safeParse(newForm([{ name: "me", definedBy: "base" }])).success).toBe(true);
  });

  test("`layers` needs `harnesses`, and `layers` with `instances` is refused", () => {
    expect(IndexConfigSchema.safeParse({ $schema: INDEX_CONFIG_SCHEMA, layers }).success).toBe(false);
    expect(IndexConfigSchema.safeParse({ $schema: INDEX_CONFIG_SCHEMA, layers, instances: layers, harnesses: [] }).success).toBe(false);
  });

  test("a file keeps its form: the new one is written back as layers + harnesses, the old one as instances", () => {
    const fresh = IndexConfigSchema.parse(newForm([{ name: "base" }]));
    const text = formatIndexConfig(fresh);
    expect(JSON.parse(text)).toMatchObject({ layers: [{ name: "base" }, { name: "dep" }, { name: "me" }], harnesses: [{ name: "base" }] });
    expect(JSON.parse(text).instances).toBeUndefined();
    expect(formatIndexConfig(IndexConfigSchema.parse(JSON.parse(text)))).toBe(text);
    const old = formatIndexConfig(IndexConfigSchema.parse(index(layers)));
    expect(JSON.parse(old).layers).toBeUndefined();
    expect(JSON.parse(old).instances).toHaveLength(3);
  });

  test("migration lists only what is instantiated: the landing, entries with config, nothing only mounted", () => {
    const r = root({ "me.config.json": {} });
    const cfg = IndexConfigSchema.parse(index([{ name: "base" }, { name: "dep", source: { remote: remote("o/dep") } }, { name: "styled", theme: "x" }, { name: "me" }], { landing: "base" }));
    expect(withDeclaredHarnesses(r, cfg).harnesses).toEqual([{ name: "base" }, { name: "styled" }, { name: "me" }]);
    const sole = IndexConfigSchema.parse(index([{ name: "only" }]));
    expect(withDeclaredHarnesses(r, sole).harnesses).toEqual([{ name: "only" }]);
    const done = IndexConfigSchema.parse(newForm([{ name: "me" }]));
    expect(withDeclaredHarnesses(r, done)).toBe(done);
  });

  test("addIndexLayer records a new harness in both lists in the new form", () => {
    const r = root({ "index.config.json": newForm([{ name: "base" }]) });
    expect(addIndexLayer(r, { name: "fresh" })).toBe(true);
    expect(instantiatedHarnessNames(r)).toEqual(["base", "fresh"]);
  });
});
