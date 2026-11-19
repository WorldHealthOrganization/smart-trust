/**
 * `gen-openapi-viewer.ts`: the `openapi` viewer's pages, written into a site.
 *
 * A scratch checkout of three layers. `harness` declares the visualiser
 * (`renderedBy: openapi-pages`, `subgraphs: "instance"`). `api` declares a
 * served `openapi` graph holding one ingested document. `broken` declares an
 * `openapi` directory with no config, which the hub must call unknown rather
 * than empty.
 *
 * Calibrated: dropping the copy of the document makes the "fetches from
 * beside it" test fail, and skipping a subject whose graph does not read makes
 * the "unknown" test fail.
 *
 * @module cat-harness-tools/openapi/scripts/gen-openapi-viewer.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { provenanceFor } from "./ingest-openapi.ts";
import { TOOL_ID } from "./gen-openapi-viewer.ts";

const SCRIPT = join(import.meta.dir, "gen-openapi-viewer.ts");

const write = (p: string, v: unknown): void => {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof v === "string" || Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2));
};

function scratchCheckout(): string {
  const root = mkdtempSync(join(tmpdir(), "openapi-viewer-"));
  write(join(root, "harness", "harness.json"), {
    name: "harness",
    version: "0.0.0",
    description: "Scratch harness declaring the openapi viewer.",
    directories: [],
    visualisers: [{ id: "openapi", renderedBy: TOOL_ID, coversKinds: ["openapi"], subgraphs: "instance", title: "OpenAPI documents" }],
  });
  write(join(root, "api", "api.json"), {
    name: "api",
    version: "0.0.0",
    description: "Scratch instance holding one OpenAPI document.",
    directories: [{ id: "api-openapi", path: "openapi/", graphTypologies: ["openapi"], served: true }],
  });
  const doc = { openapi: "3.0.1", info: { title: "Gateway", version: "1.2.3" }, paths: { "/x": { get: { operationId: "getX", summary: "Read <x>" } } } };
  const bytes = Buffer.from(JSON.stringify(doc));
  write(join(root, "api", "openapi", "cat-openapi.config.json"), {
    $schema: "cat-openapi-config/v1",
    directory: "api-openapi",
    documents: [{ id: "gateway", source: { repository: "o/r", path: "api.json", ref: "main" } }],
  });
  write(join(root, "api", "openapi", "gateway.openapi.json"), bytes);
  write(join(root, "api", "openapi", "gateway.source.json"), provenanceFor("gateway", bytes, { repository: "o/r", path: "api.json", ref: "main", commit: "a".repeat(40) }, "openapi"));
  write(join(root, "broken", "broken.json"), {
    name: "broken",
    version: "0.0.0",
    description: "Scratch instance declaring an openapi directory it holds no config for.",
    directories: [{ id: "broken-openapi", path: "openapi/", graphTypologies: ["openapi"], served: true }],
  });
  mkdirSync(join(root, "broken", "openapi"), { recursive: true });
  return root;
}

describe("gen-openapi-viewer --site", () => {
  const checkout = scratchCheckout();
  const site = mkdtempSync(join(tmpdir(), "openapi-viewer-site-"));
  afterAll(() => [checkout, site].forEach((d) => rmSync(d, { recursive: true, force: true })));
  const run = (...args: string[]) => Bun.spawnSync(["bun", "run", SCRIPT, "--root", checkout, "--site", site, ...args], { cwd: checkout });
  const first = run();
  const files = (): string[] => (readdirSync(site, { recursive: true }) as string[]).filter((f) => statSync(join(site, f)).isFile()).sort();
  const route = join("en", "harness", "openapi");
  const read = (f: string): string => readFileSync(join(site, route, f), "utf8");

  it("the Tool declares the kind it renders and takes no required input", async () => {
    const { tools } = await import("../../schemas/tools/harness-tools.ts");
    const t = tools().find((x) => x.id === TOOL_ID)!;
    expect(t.renders).toContain("openapi");
    expect(t.io?.inputs?.filter((i) => i.required) ?? []).toEqual([]);
  });

  it("writes everything under the declared route: the hub, and per instance its pages", () => {
    expect(first.exitCode).toBe(0);
    expect(files().every((f) => f.startsWith(route))).toBe(true);
    for (const f of ["index.html", "api/index.html", "api/gateway/index.html", "api/gateway/operation/getX/index.html", "api/gateway/operation/getX.jsonld", "broken/index.html"]) {
      expect(files()).toContain(join(route, f));
    }
    for (const f of files().filter((x) => x.endsWith(".html"))) expect(readFileSync(join(site, f), "utf8")).toMatch(/rendered-by: openapi-pages|<meta name="rendered-by" content="openapi-pages">/);
  });

  it("copies each document beside the pages that fetch it", () => {
    expect(read("api/gateway.openapi.json")).toBe(readFileSync(join(checkout, "api", "openapi", "gateway.openapi.json"), "utf8"));
    expect(read("api/gateway/index.html")).toContain("../gateway.openapi.json");
    // Not the provenance node: a materialization record in the site's docs is one no declaration answers for.
    expect(files()).not.toContain(join(route, "api", "gateway.source.json"));
  });

  it("a graph that does not read is unknown, with why, on the hub and its own page", () => {
    expect(read("index.html")).toContain("<strong>unknown</strong>");
    expect(read("broken/index.html")).toContain("<strong>unknown</strong>, not none");
    expect(read("broken/index.html")).toContain("cat-openapi.config.json");
  });

  it("authored text is escaped, and never reaches Liquid", () => {
    expect(read("api/gateway/operation/getX/index.html")).toContain("Read &lt;x&gt;");
    expect(read("index.html")).toMatch(/^---\n[\s\S]*?render_with_liquid: false[\s\S]*?\n---\n/);
  });

  it("--check passes on what it wrote and fails on a changed or orphaned file", () => {
    expect(run("--check").exitCode).toBe(0);
    writeFileSync(join(site, route, "api", "gateway.openapi.json"), "{}");
    expect(run("--check").exitCode).toBe(1);
    run();
    write(join(site, route, "gone", "index.html"), "x");
    expect(run("--check").exitCode).toBe(1);
    run();
    expect(run("--check").exitCode).toBe(0);
  });
});
