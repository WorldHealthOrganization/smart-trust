/**
 * Bean `ymvt` (owner, 2026-10-07; restated 2026-10-14: "i thought ONLY
 * index.config.json"): a layer's config is its `index.config.json` entry;
 * a root `<name>.config.json` is a legacy import, read only as a REPORTED
 * fallback and retired by `index-config:migrate --inline`.
 *
 * Measured before this: `recipeFromConfig` read `${instance}.config.json`
 * directly, so a repository had to keep the legacy file to publish
 * (smart-trust#33 created one for exactly that). Every fixture below is a
 * checkout on disk.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readHarnessConfig } from "../../../schemas/kg/harness-config.ts";

import { recipeFromConfig, recipeRead } from "../../build-instance-site.ts";
import { dependencyRefs } from "../../check-published-refs.ts";
import { formatLegacy, legacyImports, shadowedPaths } from "../../check-landing-instance.ts";
import { applyMigration, inlineEntries, planMigration } from "../../index-config-migrate.ts";
import { readInstanceConfig } from "../../instance-config.ts";
import { declaredRecipe } from "../../stage-local.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const BUILD = { home: "README.md", pre: ["check:archimate"], sourceSteps: ["site:document"], siteSteps: ["site:node-kinds"] };

/** A checkout declaring `demo` at its root, with an optional index entry (inline fields) and legacy file. */
function checkout(o: { entry?: Record<string, unknown> | false; legacy?: Record<string, unknown> }): string {
  const d = mkdtempSync(join(tmpdir(), "ymvt-"));
  made.push(d);
  writeFileSync(join(d, "demo.json"), JSON.stringify({ name: "demo", title: "Demo", directories: [] }, null, 2));
  if (o.entry !== false && o.entry !== undefined) {
    writeFileSync(
      join(d, "index.config.json"),
      `${JSON.stringify({ $schema: "folio-index-config/v1", instances: [{ name: "demo", source: { local: { at: "." } }, ...o.entry }] }, null, 2)}\n`,
    );
  }
  if (o.legacy !== undefined) writeFileSync(join(d, "demo.config.json"), `${JSON.stringify(o.legacy, null, 2)}\n`);
  return d;
}

describe("readInstanceConfig: the index entry first, the legacy file only as a reported fallback", () => {
  test("inline only: no file is needed, and none is reported", () => {
    const r = readInstanceConfig(checkout({ entry: { contentType: "document", site: { build: BUILD } } }), "demo");
    expect(r.via).toBe("index");
    expect(r.legacy).toBeUndefined();
    expect(r.config).toEqual({ contentType: "document", site: { build: BUILD } });
  });

  test("an entry over an imported legacy file: inline wins key by key, and the file is reported", () => {
    const r = readInstanceConfig(checkout({ entry: { contentType: "document" }, legacy: { contentType: "paper", site: { build: BUILD } } }), "demo");
    expect(r.via).toBe("index+legacy");
    expect(r.legacy).toBe("demo.config.json");
    expect(r.config).toEqual({ contentType: "document", site: { build: BUILD } });
  });

  test("no index: the file alone, reported as legacy", () => {
    const r = readInstanceConfig(checkout({ legacy: { site: { build: BUILD } } }), "demo");
    expect(r.via).toBe("legacy");
    expect(r.legacy).toBe("demo.config.json");
  });

  test("an unreadable index throws, rather than falling back to the file it overrides", () => {
    const d = checkout({ legacy: { site: { build: BUILD } } });
    writeFileSync(join(d, "index.config.json"), "{ not json");
    expect(() => readInstanceConfig(d, "demo")).toThrow(/index.config.json/);
  });
});

describe("recipeFromConfig reads the index entry (the publish path no longer needs <name>.config.json)", () => {
  test("site.build inline in the entry, with no legacy file at all", () => {
    const d = checkout({ entry: { site: { build: BUILD } } });
    expect(existsSync(join(d, "demo.config.json"))).toBe(false);
    expect(recipeFromConfig(d, "demo")).toEqual(BUILD);
    expect(declaredRecipe(d)).toEqual({ instance: "demo", recipe: BUILD });
  });

  test("a legacy file is still read, and SAID on stderr", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(recipeFromConfig(checkout({ legacy: { site: { build: BUILD } } }), "demo")).toEqual(BUILD);
      expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toContain("legacy config: demo.config.json");
    } finally {
      warn.mockRestore();
    }
  });

  test("the refusal names where the bad step came from", () => {
    expect(() => recipeRead(checkout({ entry: { site: { build: { pre: ["rm -rf /"] } } } }), "demo")).toThrow(/index.config.json entry "demo".*package script names/);
  });
});

describe("check-published-refs reads instance dependencies index-first", () => {
  test("an inline dependency is examined; the legacy file is named as legacy", () => {
    const dep = { dependencies: { folioAssistant: [{ name: "cat-harness", ref: "main" }] } };
    const inline = dependencyRefs(checkout({ entry: dep }));
    expect(inline.examined).toBe(1);
    const legacy = dependencyRefs(checkout({ legacy: dep }));
    expect(legacy.examined).toBe(1);
  });
});

describe("index-config:migrate --inline retires <name>.config.json with the effective config unchanged", () => {
  test("content moves into the entry, inline values still win, the file is deleted, and a re-run is a no-op", () => {
    const d = checkout({
      entry: { contentType: "document", site: { landing: true } },
      legacy: { _comment: "why this exists", contentType: "paper", site: { build: BUILD }, readme: { linkStyle: "blob" } },
    });
    const before = readInstanceConfig(d, "demo").config;
    const beforeHarness = readHarnessConfig(d);
    const plan = planMigration(d, { inline: true });
    expect(plan.retire).toEqual(["demo.config.json"]);
    expect(plan.changes).toBe(true);
    applyMigration(d, plan);
    expect(existsSync(join(d, "demo.config.json"))).toBe(false);
    const after = readInstanceConfig(d, "demo");
    expect(after.via).toBe("index");
    expect(after.config).toEqual(before);
    expect(readHarnessConfig(d)).toEqual(beforeHarness);
    const entry = JSON.parse(readFileSync(join(d, "index.config.json"), "utf-8")).instances[0];
    expect(entry._comment).toBe("why this exists");
    expect(entry.import).toBeUndefined();
    // Idempotent: `--inline --check` is green now.
    expect(planMigration(d, { inline: true }).changes).toBe(false);
  });

  test("without --inline nothing is retired, so --inline --check stays red while the file remains", () => {
    const d = checkout({ entry: {}, legacy: { contentType: "document" } });
    expect(planMigration(d).retire).toBeUndefined();
    expect(planMigration(d, { inline: true }).changes).toBe(true);
  });

  test("an entry with an explicit `import` of another file has that file folded in", () => {
    const d = checkout({ entry: { import: "other.config.json" } });
    writeFileSync(join(d, "other.config.json"), JSON.stringify({ contentType: "document" }));
    const { config, retire } = inlineEntries(d, JSON.parse(readFileSync(join(d, "index.config.json"), "utf-8")));
    expect(retire).toEqual(["other.config.json"]);
    expect(config.instances[0]).toMatchObject({ name: "demo", contentType: "document" });
    expect((config.instances[0] as Record<string, unknown>).import).toBeUndefined();
  });
});

describe("check:landing-instance reports every legacy import; one that disagrees with its entry fails", () => {
  test("a pending migration is said, and passes", () => {
    const l = legacyImports(checkout({ entry: { contentType: "document" }, legacy: { contentType: "document", site: { build: BUILD } } }));
    expect(l).toEqual([{ name: "demo", file: "demo.config.json", shadowed: [] }]);
    const f = formatLegacy(l);
    expect(f.ok).toBe(true);
    expect(f.text).toContain("pending migration");
  });

  test("a file whose value the entry overrides differently is NOT merely pending, and fails", () => {
    const l = legacyImports(checkout({ entry: { site: { build: { pre: [] } } }, legacy: { site: { build: { pre: ["check:archimate"] } } } }));
    expect(l?.[0]?.shadowed).toEqual(["site.build.pre"]);
    expect(formatLegacy(l).ok).toBe(false);
  });

  test("no legacy file: says so; no index: says nothing", () => {
    expect(formatLegacy(legacyImports(checkout({ entry: { contentType: "document" } }))).text).toContain("none");
    expect(legacyImports(checkout({ legacy: { contentType: "document" } }))).toBeUndefined();
  });

  test("shadowedPaths compares leaves, recursing through objects", () => {
    expect(shadowedPaths({ a: { b: 1, c: 2 }, d: [1] }, { a: { b: 1, c: 3 }, d: [2], e: 1 })).toEqual(["a.c", "d"]);
  });
});
