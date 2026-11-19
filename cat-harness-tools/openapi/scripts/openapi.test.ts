import { describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { OpenApiConfigSchema, fallbackOperationId, operationsOf, type OpenApiDocument } from "../schemas/openapi.ts";
import { checkCommitted, configPath, provenanceFor } from "./ingest-openapi.ts";
import { igOpenapiGraph, igSiteOpenapi } from "./ig-site-openapi.ts";
import { pagesFor } from "./gen-openapi-pages.ts";
import { pageNodeOf, pageNodeProblems } from "../../scripts/thin-page.ts";
import { BASE_GRAPH_TYPOLOGIES, GraphTypologyRegistry } from "../../schemas/kg/graph-typology-registry.ts";
import { isZodSchema, resolveNodeSchemas } from "../../schemas/kg/kind-validator.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../scripts/lib/roots.ts";
import { dirname } from "node:path";

function findRoot(): string {
  for (let up = "../../.."; resolve(join(TOOLS_ROOT, "openapi", "scripts", up)) !== "/"; up += "/..") {
    const candidate = resolve(join(TOOLS_ROOT, "openapi", "scripts", up));
    if (existsSync(join(candidate, "smart-trust", "openapi", "cat-openapi.config.json"))) {
      return candidate;
    }
  }
  return resolve(join(dirname(HARNESS_ROOT)));
}
const ROOT = findRoot();
const hasSmartTrust = existsSync(join(ROOT, "smart-trust"));
const doc = (paths: OpenApiDocument["paths"]): OpenApiDocument => ({ openapi: "3.0.1", info: { title: "T", version: "1" }, paths });

describe("operationsOf", () => {
  it("uses the document's operationId, in path order then OpenAPI's method order", () => {
    const ops = operationsOf(doc({ "/a": { post: { operationId: "makeA" }, get: { operationId: "getA" } }, "/b": { delete: {} } }));
    expect(ops.map((o) => [o.id, o.method])).toEqual([["getA", "get"], ["makeA", "post"], ["delete-b", "delete"]]);
    expect(ops[2]!.declaredId).toBe(false);
  });

  it("derives a filename-safe id when there is no operationId", () => {
    expect(fallbackOperationId("get", "/trustList/{type}/{country}")).toBe("get-trustList-type-country");
    expect(fallbackOperationId("get", "/")).toBe("get-root");
  });

  it("refuses two operations that would share an id rather than suffixing one", () => {
    expect(() => operationsOf(doc({ "/a": { get: { operationId: "x" } }, "/b": { get: { operationId: "x" } } }))).toThrow(/share the id "x"/);
  });

  it("ignores path-item keys that are not operations (parameters, summary)", () => {
    expect(operationsOf(doc({ "/a": { parameters: [], summary: "s", get: {} } })).map((o) => o.id)).toEqual(["get-a"]);
  });
});

describe("cat-openapi.config.json", () => {
  it("smart-trust's config is found, and parses", () => {
    // Inside its declared `openapi/` directory since the cutover (bean hupw):
    // the layer is a remote mount, which brings declared directories only.
    const p = configPath(join(ROOT, "smart-trust"));
    expect(p).toBe(join(ROOT, "smart-trust", "openapi", "cat-openapi.config.json"));
    expect(OpenApiConfigSchema.safeParse(JSON.parse(readFileSync(p!, "utf8"))).success).toBe(true);
  });

  it("refuses a document id declared twice", () => {
    const d = { id: "x", source: { repository: "o/r", path: "p.json" } };
    expect(OpenApiConfigSchema.safeParse({ $schema: "cat-openapi-config/v1", directory: "d", documents: [d, d] }).success).toBe(false);
  });
});

describe("the committed gateway API", () => {
  it("is held and matches its provenance", () => {
    expect(checkCommitted(join(ROOT, "smart-trust"))).toEqual([]);
  });

  it("a hand edit to the document is caught", () => {
    const dir = mkdtempSync(join(tmpdir(), "openapi-"));
    try {
      const inst = join(dir, "smart-trust");
      cpSync(join(ROOT, "smart-trust", "smart-trust.json"), join(inst, "smart-trust.json"));
      // The config travels inside `openapi/`, where the layer keeps it.
      cpSync(join(ROOT, "smart-trust", "openapi"), join(inst, "openapi"), { recursive: true });
      const f = join(inst, "openapi", "gateway.openapi.json");
      writeFileSync(f, readFileSync(f, "utf8").replace("Uploads Trusted Certificate", "Uploads A Certificate"));
      expect(checkCommitted(inst).join("\n")).toMatch(/does not match its provenance/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a config kept INSIDE the declared openapi directory is found, and one at the root wins", () => {
    // A fork keeps `cat-openapi.config.json` beside the documents it names
    // (`configPath`); the root still wins where both exist.
    const dir = mkdtempSync(join(tmpdir(), "openapi-"));
    try {
      const inst = join(dir, "smart-trust");
      // Wherever smart-trust keeps its config today: since its cutover the
      // mount carries declared directories only, so the copy lives inside
      // `openapi/` and there is no root file to read.
      const config = configPath(join(ROOT, "smart-trust"))!;
      expect(config).toBeDefined();
      cpSync(join(ROOT, "smart-trust", "smart-trust.json"), join(inst, "smart-trust.json"));
      cpSync(join(ROOT, "smart-trust", "openapi"), join(inst, "openapi"), { recursive: true });
      cpSync(config, join(inst, "openapi", "cat-openapi.config.json"));
      expect(configPath(inst)).toBe(join(inst, "openapi", "cat-openapi.config.json"));
      expect(checkCommitted(inst)).toEqual([]);
      cpSync(config, join(inst, "cat-openapi.config.json"));
      expect(configPath(inst)).toBe(join(inst, "cat-openapi.config.json"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!hasSmartTrust)("pages", () => {
  const files = hasSmartTrust ? pagesFor(join(ROOT, "smart-trust")) : [];
  const pages = files.filter((f) => f.path.endsWith("/index.html"));

  it("one page per operation, plus the document's", () => {
    const ops = JSON.parse(files.find((f) => f.path === "gateway.jsonld")!.content)["hydra:supportedOperation"];
    expect(ops.length).toBe(22);
    expect(pages.length).toBe(ops.length + 1);
  });

  it("every operation's @id is its JSON-LD's address less `.jsonld`, under the singular kind `operation/`", () => {
    const nodes = files.filter((x) => /^gateway\/operation\/[^/]+\.jsonld$/.test(x.path));
    expect(nodes.length).toBe(22);
    for (const f of nodes) {
      expect(JSON.parse(f.content)["@id"]).toBe(`https://litlfred.github.io/folio-assistant/smart-trust/openapi/${f.path.replace(/\.jsonld$/, "")}`);
    }
  });

  it("a page copies nothing of the API: it declares its node, at its IRI, and names the document relative to itself", () => {
    for (const p of pages) {
      const depth = p.path.split("/").length - 1;
      expect(/\sdata-kg-openapi="([^"]*)"/.exec(p.content)![1]).toBe(`${"../".repeat(depth)}gateway.openapi.json`);
      expect(pageNodeProblems(p.content)).toEqual([]);
      // The page sits in the directory its node's IRI names, so the host serves it at the IRI.
      expect(pageNodeOf(p.content)!.rdfa[0]!.iri).toBe(`https://litlfred.github.io/folio-assistant/smart-trust/openapi/${p.path.replace(/\/index\.html$/, "")}`);
      expect(p.content).not.toContain("Base64 encoded CMS");
    }
  });
});

describe("openapi typology validators", () => {
  it("every declared family in openapi/typologies/openapi.json resolves to a validator and valid schema", async () => {
    const typologyPath = join(HARNESS_ROOT, "openapi", "typologies", "openapi.json");
    const typology = JSON.parse(readFileSync(typologyPath, "utf-8"));
    const declaredFamilies = Object.keys(typology.nodeSchemas ?? {});
    expect(declaredFamilies.length).toBeGreaterThan(0);

    const harnessDir = resolve(join(HARNESS_ROOT));
    const registry = new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, harnessDir);
    const resolutions = await resolveNodeSchemas("openapi", harnessDir, registry);

    const byTag = new Map(resolutions.map((r) => [r.tag, r]));

    for (const family of declaredFamilies) {
      const validatorNode = registry.validatorNodeFor("openapi", family);
      expect(validatorNode).toBeDefined();
      expect(validatorNode!.node.validates.kind).toBe("openapi");
      expect(validatorNode!.node.validates.family).toBe(family);

      const res = byTag.get(family);
      expect(res).toBeDefined();
      expect(res!.state).toBe("resolved");
      if (res && res.state === "resolved") {
        expect(isZodSchema(res.schema)).toBe(true);
      }
    }
  });
});


describe("ig-site:openapi — an IG repository's OpenAPI pages, with no declaration (owner, 2026-10-14)", () => {
  const sample = { openapi: "3.0.1", info: { title: "Gateway", version: "1" }, paths: { "/x": { get: { operationId: "getX" } } } };
  const ig = (): string => {
    const root = mkdtempSync(join(tmpdir(), "ig-openapi-"));
    mkdirSync(join(root, "openapi"), { recursive: true });
    writeFileSync(join(root, "openapi", "cat-openapi.config.json"), JSON.stringify({ $schema: "cat-openapi-config/v1", directory: "any-id", documents: [{ id: "gateway", source: { repository: "o/r", path: "api.json", ref: "main" } }] }));
    const bytes = Buffer.from(JSON.stringify(sample));
    writeFileSync(join(root, "openapi", "gateway.openapi.json"), bytes);
    writeFileSync(join(root, "openapi", "gateway.source.json"), JSON.stringify(provenanceFor("gateway", bytes, { repository: "o/r", path: "api.json", ref: "main", commit: "a".repeat(40) }, "openapi")));
    return root;
  };

  it("finds the graph by what the checkout holds, and none where it holds none", () => {
    const root = ig();
    expect(igOpenapiGraph(root)).toEqual({ config: join(root, "openapi", "cat-openapi.config.json"), dir: join(root, "openapi") });
    expect(igOpenapiGraph(mkdtempSync(join(tmpdir(), "ig-none-")))).toBeUndefined();
  });

  it("writes the documents and a page per document and operation at openapi/, the graph's index included", () => {
    const root = ig();
    const site = mkdtempSync(join(tmpdir(), "ig-site-"));
    const paths = igSiteOpenapi({ site, ig: root, log: () => {} });
    for (const p of ["openapi/gateway.openapi.json", "openapi/gateway.source.json", "openapi/index.html", "openapi/gateway/index.html", "openapi/gateway/operation/getX/index.html", "openapi/gateway/operation/getX.jsonld"]) {
      expect(paths).toContain(p);
      expect(existsSync(join(site, p))).toBe(true);
    }
    expect(readFileSync(join(site, "openapi", "gateway", "operation", "getX.jsonld"), "utf8")).toContain("/openapi/gateway/operation/getX\"");
  });

  it("refuses to write over a path the site already holds", () => {
    const root = ig();
    const site = mkdtempSync(join(tmpdir(), "ig-site-"));
    mkdirSync(join(site, "openapi"), { recursive: true });
    writeFileSync(join(site, "openapi", "index.html"), "<p>already</p>");
    expect(() => igSiteOpenapi({ site, ig: root, log: () => {} })).toThrow(/already holds[\s\S]*openapi\/index\.html/);
  });

  it("a checkout with no OpenAPI graph writes nothing", () => {
    expect(igSiteOpenapi({ site: mkdtempSync(join(tmpdir(), "ig-site-")), ig: mkdtempSync(join(tmpdir(), "ig-none-")), log: () => {} })).toEqual([]);
  });
});
