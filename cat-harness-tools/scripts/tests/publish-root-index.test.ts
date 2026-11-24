/**
 * The root index on a LAYER's site (litlfred/who-iris, 2026-11-13: "where is
 * index.json(ld) for who-iris? why not published?"): the opt-in recipe flag,
 * the export plan `publish-root-index.ts` runs, and `root-index.ts` reading
 * the repository subgraph index from outside the site.
 *
 * The plan is read from this checkout's real declarations; nothing is
 * exported here (a full export is minutes, and `root-index.test.ts` pins the
 * map over a real site layout).
 *
 * @module scripts/tests/publish-root-index
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { recipeRead } from "../build-instance-site.ts";
import { exportSteps } from "../publish-root-index.ts";
import { buildRootIndex } from "../root-index.ts";
import { artefactStub, readDeclaration, repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { HarnessSiteSchema } from "../../schemas/kg/harness-config.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
};

/** A checkout declaring `demo`, whose index entry carries `build` as its `site.build`. */
function checkout(build: Record<string, unknown>): string {
  const d = tmp("root-index-recipe-");
  writeFileSync(join(d, "demo.json"), JSON.stringify({ name: "demo", title: "Demo", directories: [] }));
  writeFileSync(
    join(d, "index.config.json"),
    JSON.stringify({ $schema: "folio-index-config/v1", instances: [{ name: "demo", source: { local: { at: "." } }, site: { build } }] }),
  );
  return d;
}

describe("site.build.rootIndex: opt-in", () => {
  test("absent is off, and the recipe does not carry it", () => {
    expect(recipeRead(checkout({ siteSteps: ["site:x"] }), "demo").recipe?.rootIndex).toBeUndefined();
  });

  test("true is carried to the build", () => {
    expect(recipeRead(checkout({ rootIndex: true }), "demo").recipe?.rootIndex).toBe(true);
  });

  test("anything but a boolean is refused, naming the key", () => {
    expect(() => recipeRead(checkout({ rootIndex: "yes" }), "demo")).toThrow(/site\.build\.rootIndex must be true or false/);
  });

  test("the declaration schema keeps it", () => {
    expect(HarnessSiteSchema.parse({ build: { rootIndex: true } }).build?.rootIndex).toBe(true);
  });
});

describe("the export plan", () => {
  const harnessRoot = resolve(HARNESS_ROOT);
  const repo = repoRootFor(harnessRoot);
  const site = "/site";
  const steps = exportSteps({ repo, harnessRoot, toolsRoot: resolve(TOOLS_ROOT), site, qaRoot: "/qa", baseUrl: "https://example.org/layer/" });

  test("the host first, at <name>/<stub>.jsonld, with its QA sidecar kept out of the mount", () => {
    const host = readDeclaration(harnessRoot)!;
    const first = steps[0]!;
    expect(first.argv.join(" ")).toContain("kg-export.ts");
    expect(first.argv).toContain("--qa-root");
    expect(first.argv[first.argv.indexOf("--qa-root") + 1]).toBe("/qa");
    expect(first.writes).toBe(join(site, host.name, `${artefactStub(host)}.jsonld`));
  });

  test("every other layer last, by instance-exports, at this site's base without a trailing slash", () => {
    const last = steps.at(-1)!;
    expect(last.argv.join(" ")).toContain("instance-exports.ts --out-dir /site --base-url https://example.org/layer");
    expect(last.writes).toBeUndefined();
  });

  test("every step is a bun script with argv, never a shell string", () => {
    for (const s of steps) expect(s.argv.slice(0, 2)).toEqual(["bun", "run"]);
  });
});

describe("root-index: the repository subgraph index may live outside the site", () => {
  test("a missing index is named by the path it was looked for at", () => {
    const site = tmp("root-index-site-");
    const missing = join(tmp("root-index-sg-"), "index.jsonld");
    const { problems } = buildRootIndex(site, { subgraphIndex: missing });
    expect(problems.some((p) => p.startsWith(`${missing} is missing`))).toBe(true);
  });

  test("a given index is read in place of the site's own", () => {
    const site = tmp("root-index-site-");
    const index = join(tmp("root-index-sg-"), "index.jsonld");
    writeFileSync(index, JSON.stringify({ hasSubgraph: [] }));
    const { problems } = buildRootIndex(site, { subgraphIndex: index });
    expect(problems.some((p) => p.includes("is missing — the subgraph roots cannot be named"))).toBe(false);
    // The site holds no export, so the map still refuses: a shorter map is never written.
    expect(problems.some((p) => p.includes("the deploy did not publish it"))).toBe(true);
  });
});
