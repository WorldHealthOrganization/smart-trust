/**
 * A check of a layer's own committed files judges only the caller's own
 * layers in a layer's PR checks (owner ruling 2026-11-05, "Move the
 * checks"; `scripts/lib/gate-own.ts`).
 *
 * `check:schema-nodes` walked every declared `schemas/` in the root, the
 * mounted layers' included, so cat-harness-tools#1478 (two untagged modules
 * on its main) was a NEW failure in every root that mounts it (smart-ra#228).
 * These pin the three halves: the runner names the own layers, the
 * reader parses them, and the audit keeps only those layers' directories.
 *
 * @module test/gate-own-files.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  GATE_FOREIGN_PATHS_ENV,
  GATE_OWN_ENV,
  GATE_OWN_PATHS_ENV,
  gateDirectoriesForGraph,
  gateOwnInstances,
  gateOwnsFile,
} from "../scripts/lib/gate-own.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { auditSchemaNodes } from "../scripts/schema-nodes.ts";
import { scopeReport, type ReferenceReport } from "../scripts/check-reference-direction.ts";

const RUN_GATES = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "run-gates.py");
// Where this layer can sit: this file's own layer root (the standalone
// rehearsal, where the layer IS the checkout root, and a mounted index), or
// the harness's sibling as a composing checkout resolves it. Real paths, so a
// symlinked mount compares as itself.
const real = (p: string) => (existsSync(p) ? realpathSync(p) : p);
const TOOLS_ROOTS = [...new Set([resolve(import.meta.dir, ".."), resolve(HARNESS_ROOT, "..", "cat-harness-tools")].map(real))];
const underTools = (d: string) => TOOLS_ROOTS.some((t) => !relative(t, real(d)).startsWith(".."));

describe("gateOwnInstances", () => {
  test("unset or blank is undefined: the whole checkout is judged, as before", () => {
    expect(gateOwnInstances({})).toBeUndefined();
    expect(gateOwnInstances({ [GATE_OWN_ENV]: " , " })).toBeUndefined();
  });

  test("a comma list is the set of own instances", () => {
    expect([...gateOwnInstances({ [GATE_OWN_ENV]: "smart-base, smart-ra" })!].sort()).toEqual(["smart-base", "smart-ra"]);
  });
});

describe("run-gates.py hands every gate the caller's own instances", () => {
  test("it names the same variable and sets it from the own instances", () => {
    const src = readFileSync(RUN_GATES, "utf-8");
    expect(src).toContain(`GATE_OWN_ENV = "${GATE_OWN_ENV}"`);
    expect(src).toMatch(/os\.environ\.setdefault\(GATE_OWN_ENV, ","\.join\(own\)\)/);
    expect(src).toContain(`GATE_OWN_PATHS_ENV = "${GATE_OWN_PATHS_ENV}"`);
    expect(src).toContain(`GATE_FOREIGN_PATHS_ENV = "${GATE_FOREIGN_PATHS_ENV}"`);
    expect(src).toMatch(/os\.environ\.setdefault\(GATE_OWN_PATHS_ENV,/);
    expect(src).toMatch(/os\.environ\.setdefault\(GATE_FOREIGN_PATHS_ENV,/);
  });
});

describe("auditSchemaNodes with own instances", () => {
  const all = auditSchemaNodes(HARNESS_ROOT, "checkout");
  const modules = (a: ReturnType<typeof auditSchemaNodes>) =>
    [...a.nodes, ...a.exempt, ...a.undeclared, ...a.undeclaredTests, ...a.reasonless].map((m) => m.module).sort();

  test("an instance that declares no schemas/ reads nothing, and is not the schemas/ fallback", () => {
    const a = auditSchemaNodes(HARNESS_ROOT, "checkout", new Set(["no-such-instance"]));
    expect(a.directories).toEqual([]);
    expect(modules(a)).toEqual([]);
  });

  test("this layer's own run reads only this layer's directories, a subset of the whole", () => {
    const a = auditSchemaNodes(HARNESS_ROOT, "checkout", new Set(["cat-harness-tools"]));
    for (const d of a.directories) expect(underTools(d)).toBe(true);
    const whole = new Set(modules(all));
    for (const m of modules(a)) expect(whole.has(m)).toBe(true);
    // Whether this layer is in the harness's corpus at all depends on the
    // composition: a composing index stacks it on the harness, while the
    // standalone rehearsal lays the layers out as siblings with no root
    // above them, so from the harness this layer is not there. The scoped
    // audit must find it exactly when the whole corpus holds it.
    const wholeHasTools = auditSchemaNodes(HARNESS_ROOT, "checkout").directories.some(underTools);
    expect(a.directories.length > 0).toBe(wholeHasTools);
    expect(modules(a).length > 0).toBe(wholeHasTools);
  });
});

describe("gateDirectoriesForGraph: the subjects a scoped check judges", () => {
  test("unset is the whole corpus, unscoped", () => {
    const g = gateDirectoriesForGraph(HARNESS_ROOT, "methodology", {});
    expect(g.scoped).toBeUndefined();
    expect(g.dirs).toEqual(corpusDirectoriesForGraph(HARNESS_ROOT, "methodology"));
  });

  test("scoped to an instance that commits none is empty, and says it was scoped", () => {
    const g = gateDirectoriesForGraph(HARNESS_ROOT, "methodology", { [GATE_OWN_ENV]: "no-such-instance" });
    expect([...g.scoped!]).toEqual(["no-such-instance"]);
    expect(g.dirs).toEqual([]);
  });
});

describe("a scoped check whose caller commits none of its subjects passes, never exits 2 or 78", () => {
  // Exit 2 or 78 against a base that passed is a NEW failure in compare-gates.py.
  const env = { ...process.env, [GATE_OWN_ENV]: "no-such-instance" };
  test.each([
    ["check-methodology-evidence.ts", "methodology directory"],
    ["check-tabular-stubs.ts", "library directory"],
    ["check-translation-officiality.ts", "translations directory"],
    ["check-schema-nodes.ts", "schemas/*.ts"],
    ["check-concern-groups.ts", "grouping directory"],
    ["check-subgraphs.ts", "markdown in a declared directory"],
  ] as const)("%s says its caller commits no %s, and passes", (script, what) => {
    const r = spawnSync("bun", [resolve(import.meta.dir, "..", "scripts", script)], { encoding: "utf-8", env });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`commits no ${what}`);
  });
});

describe("gateOwnsFile: a file is the caller's when its deepest instance directory is", () => {
  const env = (own: string, foreign: string) => ({ [GATE_OWN_PATHS_ENV]: own, [GATE_FOREIGN_PATHS_ENV]: foreign });

  test("unset is undefined: judge everything", () => {
    expect(gateOwnsFile("cat-harness/AGENTS.md", {})).toBeUndefined();
  });

  test("a layer root: its own directory is its own, a mounted layer's and the index's root files are not", () => {
    const e = env("smart-base", "cat-harness,cat-harness-tools");
    expect(gateOwnsFile("smart-base/AGENTS.md", e)).toBe(true);
    expect(gateOwnsFile("./smart-base/scripts/x.ts", e)).toBe(true);
    expect(gateOwnsFile("cat-harness/docs/guides/agent-onboarding.md", e)).toBe(false);
    expect(gateOwnsFile("README.md", e)).toBe(false);
    // A prefix of a name is not containment.
    expect(gateOwnsFile("smart-base-extra/AGENTS.md", e)).toBe(false);
  });

  test("an instance at the root owns the root's files but not a mounted layer under it", () => {
    const e = env(".", "cat-harness");
    expect(gateOwnsFile("README.md", e)).toBe(true);
    expect(gateOwnsFile("cat-harness/AGENTS.md", e)).toBe(false);
  });
});

describe("check:command-paths judges only the caller's own files", () => {
  test("a caller that commits none of them passes, never exit 1 for reading nothing", () => {
    const r = spawnSync("bun", [resolve(import.meta.dir, "..", "scripts", "check-command-paths.ts")], {
      encoding: "utf-8",
      env: { ...process.env, [GATE_OWN_ENV]: "no-such-instance", [GATE_OWN_PATHS_ENV]: "no-such-instance", [GATE_FOREIGN_PATHS_ENV]: "" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("commits none of the files it reads");
  });
});

describe("check:reference-direction judges only the caller's own files and instances", () => {
  const occ = (file: string) => ({ occurrence: { file }, verdict: { verdict: "wrong-direction" } }) as unknown as ReferenceReport["classified"][number];
  const report = {
    instances: 3,
    classified: [occ("folio-assistant-core/skills/x.md"), occ("smart-base/input/y.md")],
    skippedMachineWritten: 0,
    skippedGeneratorWritten: 0,
    undeclared: ["folio-assistant-core", "smart-base"],
  } as ReferenceReport;

  test("a lower layer's file naming an instance above it is not charged to the caller (smart-base#298)", () => {
    const e = { [GATE_OWN_PATHS_ENV]: "smart-base", [GATE_FOREIGN_PATHS_ENV]: "folio-assistant-core" };
    const r = scopeReport(report, (f) => gateOwnsFile(f, e) !== false, new Set(["smart-base"]));
    expect(r.classified.map((c) => c.occurrence.file)).toEqual(["smart-base/input/y.md"]);
    expect(r.undeclared).toEqual(["smart-base"]);
    expect(r.instances).toBe(3);
  });

  test("unscoped, nothing is dropped", () => {
    expect(scopeReport(report, () => true, undefined)).toEqual(report);
  });
});

describe("a generator check judges only the output the caller commits", () => {
  // A layer that commits none of a generator's output is not judged on it,
  // stale or not (owner ruling 2026-11-05, generator checks included).
  const env = { ...process.env, [GATE_OWN_ENV]: "no-such-instance", [GATE_OWN_PATHS_ENV]: "no-such-instance", [GATE_FOREIGN_PATHS_ENV]: "" };
  test.each(["bpmn-checklist.ts", "branch-readme.ts", "../pipeline/obsolete-stale-po.ts", "../pipeline/pot-for-pages.ts"])("%s --check passes for a caller that commits none of its output", (script) => {
    const r = spawnSync("bun", [resolve(import.meta.dir, "..", "scripts", script), "--check"], { encoding: "utf-8", env });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toContain("✗");
  });
});
