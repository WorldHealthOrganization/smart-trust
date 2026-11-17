/**
 * A layer PR is judged on the index checks that read it, with its head
 * swapped in, so a cross-layer break fails the PR rather than the re-pin.
 *
 * Five layer PRs passed their own CI on 2026-11-02/03 and broke the index at
 * re-pin: folio-assistant-core#630 (twice), cat-harness-tools#1445 and #1417,
 * who-iris#175. These drive `.github/scripts/layer-pr-checks/` through
 * python3, as the workflows do.
 *
 * @module test/layer-pr-checks-index-checks.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DIR = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks");

/** Load `<file>` from DIR as a module and print the JSON of `expr` over it (`m`). */
function py(file: string, expr: string): unknown {
  const code = [
    "import importlib.util, json, sys",
    `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(join(DIR, file))})`,
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    `print(json.dumps(${expr}))`,
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-B", "-c", code], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

const diag = (text: string, root = "/r/fa") =>
  py("gate_diagnostics.py", `m.diagnostics(${JSON.stringify(text)}, ${JSON.stringify(root)})`) as string[];

describe("gate_diagnostics.py: the harness's own finding shapes", () => {
  test("run-gates.py's findings() is this parser (one parser, #1457)", () => {
    const text = "✗ 2 finding(s):\n    a.json: stale\n✗ p.ts: 3 contract(s)";
    expect(py("run-gates.py", `m.findings(${JSON.stringify(text)})`)).toEqual(diag(text));
  });

  test("core#630: a qa-results baseline's new findings, by family", () => {
    const out = [
      "  baseline (qa-reports:main/50961d8): 2 NEW finding(s), 7 inherited, 0 resolved — over wrong-direction",
      "    new in wrong-direction:",
      '      + {"file":"cat-harness-tools/scripts/layer-qa.ts","target":"folio-assistant-core"}',
      '      + {"file":"folio-assistant-core/scripts/bibliography-page.ts","target":"smart-trust"}',
      "",
    ].join("\n");
    expect(diag(out)).toEqual([
      'new in wrong-direction: {"file":"cat-harness-tools/scripts/layer-qa.ts","target":"folio-assistant-core"}',
      'new in wrong-direction: {"file":"folio-assistant-core/scripts/bibliography-page.ts","target":"smart-trust"}',
    ]);
  });

  test("a ✗ finding is kept; the items under a counted ✗ heading are kept, the count is not", () => {
    const out = [
      "✗ who-iris/processes/a.checklist.md is stale or missing — run `bun run cat bpmn:checklist`",
      "✗ 2 finding(s):",
      "    /r/fa/core/libraries/zod.library.json: stale",
      "    x.json: stale",
      "",
      "✗ 1 kind JSON Schema finding(s) — run `bun run cat kind:json-schemas`.",
    ].join("\n");
    expect(diag(out)).toEqual([
      "who-iris/processes/a.checklist.md is stale or missing — run `bun run cat bpmn:checklist`",
      "core/libraries/zod.library.json: stale",
      "x.json: stale",
    ]);
  });

  test("who-iris#239: a re-pin that only changes the commits a finding names is not a new key", () => {
    const main = diag("✗ bootstrap: the index pins 1c36aef5ab70, cat-harness's own lock pins 823e7921d9c7 — re-pin bottom-up");
    const pr = diag("✗ bootstrap: the index pins f5c124f1a806, cat-harness's own lock pins 9f478d4d9fcd — re-pin bottom-up");
    expect(pr).toEqual(main);
    expect(main).toEqual(["bootstrap: the index pins <commit>, cat-harness's own lock pins <commit> — re-pin bottom-up"]);
    // A word made of hex letters only, or a plain number, is not a commit.
    expect(diag("✗ decade 2026 facade")).toEqual(["decade # facade"]);
  });

  test("a count that went down, a duration or a temporary directory is not a new key", () => {
    const a = diag("✗ 6 finding(s):\n    a: stale\n\n✗ b took 1.5 s in /tmp/abc123/x");
    const b = diag("✗ 5 finding(s):\n    a: stale\n\n✗ b took 12 s in /tmp/zz9/x");
    expect(a).toEqual(b);
    expect(a).toEqual(["a: stale", "b took # s in /tmp/<tmp>/x"]);
  });
});

describe("index-gates.json", () => {
  const gates = JSON.parse(readFileSync(join(DIR, "index-gates.json"), "utf-8")).gates as Record<string, string>;

  test("names the index checks the re-pin caught, each a script this layer declares, under its declared-gate name", () => {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dir, "..", "package.json"), "utf-8"));
    const declared = { ...pkg.scripts, ...pkg.checkoutScripts };
    for (const s of ["check:reference-direction:check", "check:prov-qaqc", "libraries:check", "gen:jsonld:check"])
      expect(Object.values(gates)).toContain(s);
    // The diagram SVGs are a QA report, not a merge gate (owner, 2026-11-13).
    expect(Object.values(gates)).not.toContain("render:bpmn:check");
    for (const [name, script] of Object.entries(gates)) {
      expect(declared).toHaveProperty([script]);
      expect(name).toBe(`cat-harness-tools:${script}`);
    }
  });

  test("run-gates.py runs them for a caller whose harness does not reach cat-harness-tools", () => {
    const root = mkdtempSync(join(tmpdir(), "index-gates-"));
    mkdirSync(join(root, "low"));
    writeFileSync(join(root, "low", "low.json"), JSON.stringify({ $schema: "cat-harness-declaration/v1", name: "low", needs: [] }));
    writeFileSync(join(root, "low", "package.json"), JSON.stringify({ scripts: { "check:own": "true" } }));
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { cat: "x" } }));
    const [, , , derived] = py("run-gates.py", `m.derive(${JSON.stringify(root)}, ["low"], "/tmp", {})`) as [unknown, unknown, unknown, Record<string, string>];
    for (const [name, script] of Object.entries(gates)) expect(derived[name]).toBe(`bun run cat ${script}`);
    expect(derived["low:check:own"]).toBe("bun run cat check:own");
  });

  test("an index gate whose script the MOUNTED cat-harness-tools does not declare yet is skipped as not-at-pin, never run as 'no script'", () => {
    // The gate list is the workflow's, at the caller's workflow pin; the
    // scripts are the mounted layer's, at the index lock's pin. A gate added
    // after the index's pin named a script no mount declared, and every layer
    // PR whose cone ran it failed on "no script" (jsonld:site:check, 2026-11-13).
    const root = mkdtempSync(join(tmpdir(), "index-gates-pin-"));
    mkdirSync(join(root, "low"));
    writeFileSync(join(root, "low", "low.json"), JSON.stringify({ $schema: "cat-harness-declaration/v1", name: "low", needs: [] }));
    writeFileSync(join(root, "low", "package.json"), JSON.stringify({ scripts: { "check:own": "true" } }));
    mkdirSync(join(root, "cat-harness-tools"));
    writeFileSync(
      join(root, "cat-harness-tools", "cat-harness-tools.json"),
      JSON.stringify({ $schema: "cat-harness-declaration/v1", name: "cat-harness-tools", needs: [] }),
    );
    const scripts = Object.values(gates);
    const missing = scripts[scripts.length - 1]!;
    const older = Object.fromEntries(scripts.filter((s) => s !== missing).map((s) => [s, "true"]));
    writeFileSync(join(root, "cat-harness-tools", "package.json"), JSON.stringify({ checkoutScripts: older }));
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { cat: "x" } }));
    const [, , , derived, skipped] = py("run-gates.py", `m.derive(${JSON.stringify(root)}, ["low"], "/tmp", {})`) as [
      unknown,
      unknown,
      unknown,
      Record<string, string>,
      Record<string, { command: string; skipped: string; kind: string }>,
    ];
    expect(derived[`cat-harness-tools:${missing}`]).toBeUndefined();
    expect(skipped[`cat-harness-tools:${missing}`]).toEqual(
      expect.objectContaining({ kind: "not-at-pin", command: `bun run cat ${missing}`, skipped: expect.stringContaining(missing) }),
    );
    for (const s of Object.keys(older)) expect(derived[`cat-harness-tools:${s}`]).toBe(`bun run cat ${s}`);
  });

  test("run-gates.py own_instances reads both `instances` and the migrated `layers` + `harnesses` form of index.config.json (cat-harness#1138)", () => {
    const root = mkdtempSync(join(tmpdir(), "own-layers-"));
    mkdirSync(join(root, "ig"));
    writeFileSync(join(root, "ig", "ig.json"), JSON.stringify({ $schema: "cat-harness-declaration/v1", name: "ig", needs: [] }));
    writeFileSync(
      join(root, "index.config.json"),
      JSON.stringify({
        $schema: "folio-index-config/v1",
        layers: [{ name: "ig" }, { name: "unmounted" }],
        harnesses: [{ name: "ig" }],
      }),
    );
    const known = py("run-gates.py", `m.instances_in(${JSON.stringify(root)})`) as Record<string, string>;
    expect(known).toEqual({ ig: "ig" });
    const own = py("run-gates.py", `m.own_instances(${JSON.stringify(root)}, [], ${JSON.stringify(known)})`) as string[];
    expect(own).toEqual(["ig"]);
  });
});

describe("reader-tests.py: other instances' tests that name the layer", () => {
  const root = mkdtempSync(join(tmpdir(), "readers-"));
  const decl = (n: string) => {
    mkdirSync(join(root, n, "test"), { recursive: true });
    writeFileSync(join(root, n, `${n}.json`), "{}");
  };
  decl("who-iris");
  decl("tools");
  writeFileSync(join(root, "who-iris", "test", "own.test.ts"), 'readFileSync("who-iris/x")');
  writeFileSync(join(root, "tools", "test", "navbar-checkout.test.ts"), 'declaredGraphs("who-iris", m)');
  writeFileSync(join(root, "tools", "test", "path.test.ts"), "join(ROOT, `who-iris/typologies`)");
  writeFileSync(join(root, "tools", "test", "other.test.ts"), "// who-iris-like, not who-iris itself: who-irisx");
  writeFileSync(join(root, "tools", "test", "helper.ts"), '"who-iris"');
  const run = (...a: string[]) => spawnSync("python3", ["-I", "-B", join(DIR, "reader-tests.py"), root, ...a], { encoding: "utf-8" });

  test("who-iris#175: the navbar-checkout test that lists who-iris's graphs is a reader; the layer's own tests are not", () => {
    const r = run("who-iris");
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split("\n")).toEqual(["./tools/test/navbar-checkout.test.ts", "./tools/test/path.test.ts"]);
  });

  test("more readers than the cap runs none, and says so", () => {
    const r = run("who-iris", "1");
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("more than 1");
  });
});
