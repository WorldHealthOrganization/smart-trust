/**
 * Which gates `run-gates.py` runs alone, after the pool drains.
 *
 * A gate that holds the whole tree for its run (`TREE_TOOLS`: publish-check.ts,
 * the standalone probes) must not share it with a neighbour, and neither may a
 * gate that runs one from inside its own process: `skill:register:check` runs
 * `subgraph:jsonld:check` through its STEPS' `verify` list. Pooled, those gave
 * the same pins different verdicts by shard composition
 * (smart-immunizations#65, folio-assistant-core#166). A name that only appears
 * in a comment is not a call, so it does not make a gate run alone.
 *
 * @module test/layer-pr-checks-alone.test
 */
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const RUN_GATES = resolve(import.meta.dir, "..", ".github", "scripts", "layer-pr-checks", "run-gates.py");

/** A root declaring layer `a`, whose scripts reach the tree tools in each way there is. */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "gate-alone-"));
  writeFileSync(join(root, "a.json"), JSON.stringify({ name: "a", needs: [] }));
  mkdirSync(join(root, "scripts"));
  writeFileSync(
    join(root, "scripts", "register.ts"),
    `const STEPS = [{ write: ["x"], verify: ["x:check"] }];\nspawnSync("bun", ["run", "cat", ...args]);\n`,
  );
  writeFileSync(join(root, "scripts", "mentions.ts"), `// runs after x:check, see "x:check"\nconsole.log("ok");\n`);
  writeFileSync(join(root, "scripts", "lists.ts"), `const STEPS = [{ verify: ["x:check"] }];\n`);
  const scripts: Record<string, string> = {
    cat: "true",
    "x:check": "bun run scripts/publish-check.ts x",
    "register:check": "bun run scripts/register.ts --check",
    "chained:check": "bun run cat register:check",
    "probe:check": "bun run scripts/check-standalone.ts --layer a",
    "rehearse:check": "bun run scripts/rehearse-bootstrap-standalone.ts",
    "mentions:check": "bun run scripts/mentions.ts",
    "lists:check": "bun run scripts/lists.ts",
    "plain:check": "true",
  };
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "a", scripts }));
  return root;
}

function alone(root: string): string[] {
  const py = [
    "import importlib.util, json, sys",
    "spec = importlib.util.spec_from_file_location('rg', sys.argv[1])",
    "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    "print(json.dumps(sorted(m.tree_snapshotting(sys.argv[2]))))",
  ].join("\n");
  const r = spawnSync("python3", ["-I", "-B", "-c", py, RUN_GATES, root], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`python3 exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test("a gate runs alone when it runs a tree tool, directly or through what it runs", () => {
  expect(alone(fixtureRoot())).toEqual([
    "a:chained:check",
    "a:probe:check",
    "a:register:check",
    "a:rehearse:check",
    "a:x:check",
  ]);
});

test("a name in a comment, or a verify list never spawned, is not a call", () => {
  const got = alone(fixtureRoot());
  expect(got).not.toContain("a:mentions:check");
  expect(got).not.toContain("a:lists:check");
  expect(got).not.toContain("a:plain:check");
});
