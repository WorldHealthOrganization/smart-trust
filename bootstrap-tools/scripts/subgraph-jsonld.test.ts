/**
 * @module bootstrap-tools/scripts/subgraph-jsonld.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SubgraphHydratedSchema, SubgraphIndexSchema } from "../schemas/subgraph-export.ts";
import { exportGraph } from "./export-graph.ts";
import { stageSite } from "./site.ts";
import {
  contextPath,
  HYDRATED_FILE,
  INDEX_FILE,
  auditSubgraphs,
  buildSubgraphs,
  frameSubgraphs,
  publicationBase,
  staleSubgraphs,
  writeSubgraphs,
} from "./subgraph-jsonld.ts";

const BOOTSTRAP = join(import.meta.dir, "..", "..", "bootstrap");
const TOOLS = join(import.meta.dir, "..");
type Doc = Record<string, unknown>;
const files = (root: string) => [...buildSubgraphs(root).files].map(([p, t]) => [p, JSON.parse(t) as Doc] as const);

describe("named subgraphs — one IRI, two files, projected from one graph", () => {
  for (const [label, root] of [["bootstrap", BOOTSTRAP], ["bootstrap-tools", TOOLS]] as const) {
    describe(label, () => {
      const b = buildSubgraphs(root);

      test(`auditIsClean[${label}]`, () => {
        expect(auditSubgraphs(root, b)).toEqual([]);
      });

      test(`buildIsPure[${label}]`, () => {
        expect(JSON.stringify([...buildSubgraphs(root).files])).toBe(JSON.stringify([...b.files]));
        expect(JSON.stringify([...b.files])).not.toContain(root);
      });

      test(`subgraphIris[${label}]`, () => {
        const base = publicationBase(JSON.parse(readFileSync(join(root, `${label}.json`), "utf-8")))!;
        expect(b.repoIri).toBe(`${base}subgraph/`);
        expect(b.rootIri).toBe(`${base}subgraph/${label}/`);
        const repo = JSON.parse(b.files.get(`subgraph/${INDEX_FILE}`)!) as Doc;
        expect(repo["hasSubgraph"]).toEqual([b.rootIri]);
        expect(b.files.has(`subgraph/${label}/${INDEX_FILE}`)).toBe(true);
        expect(b.files.has(`subgraph/${label}/${HYDRATED_FILE}`)).toBe(false);
        expect(b.files.has(`subgraph/${label}/processes/${HYDRATED_FILE}`)).toBe(true);
      });

      test(`sharedContextUrl[${label}]`, () => {
        for (const [p, d] of files(root)) {
          if (p === b.contextFile) continue;
          expect(d["@context"], p).toBe(b.contextUrl);
        }
        const ctx = (JSON.parse(b.files.get(b.contextFile)!) as Doc)["@context"] as Doc;
        for (const k of ["name", "summary", "description", "depiction", "requires", "calledElement", "holdsGraph", "hasMember", "hasSubgraph", "path"]) expect(k in ctx, k).toBe(true);
        expect("label" in ctx).toBe(false);
      });

      test(`nodeInExactlyOneSubgraph[${label}]`, () => {
        const graph = exportGraph(root, { docIri: `${publicationBase(JSON.parse(readFileSync(join(root, `${label}.json`), "utf-8")))}${label}.jsonld` });
        const seen: string[] = [];
        for (const [p, d] of files(root)) {
          if (!p.endsWith(INDEX_FILE)) continue;
          expect(SubgraphIndexSchema.safeParse(d).success, p).toBe(true);
          for (const m of (d["hasMember"] as Doc[] | undefined) ?? []) {
            seen.push(String(m["@id"]));
            for (const k of Object.keys(m)) expect(["@id", "@type", "name", "title"]).toContain(k);
          }
        }
        expect(seen.sort()).toEqual((graph["@graph"] as Doc[]).filter((n) => n["@type"] !== undefined).map((n) => String(n["@id"])).sort());
      });

      test(`hydratedHoldsMembership[${label}]`, () => {
        for (const [p, d] of files(root)) {
          if (!p.endsWith(HYDRATED_FILE)) continue;
          expect(SubgraphHydratedSchema.safeParse(d).success, p).toBe(true);
          const inline: string[] = [];
          const walk = (n: Doc) => {
            for (const m of (n["hasMember"] as Doc[] | undefined) ?? []) inline.push(String(m["@id"]));
            for (const c of (n["hasSubgraph"] as Doc[] | undefined) ?? []) walk(c);
          };
          walk(d);
          const dir = p.slice(0, -HYDRATED_FILE.length);
          const pointed = files(root)
            .filter(([q]) => q.startsWith(dir) && q.endsWith(INDEX_FILE))
            .flatMap(([, x]) => ((x["hasMember"] as Doc[] | undefined) ?? []).map((m) => String(m["@id"])));
          expect(inline.sort()).toEqual(pointed.sort());
        }
      });

      test(`processNodeFields[${label}]`, () => {
        const hyd = JSON.parse(b.files.get(`subgraph/${label}/processes/${HYDRATED_FILE}`)!) as Doc;
        const members = hyd["hasMember"] as Doc[];
        const processes = members.filter((m) => m["@type"] === "bootstrap:Process");
        expect(processes.length).toBe(b.processes);
        expect(processes.length).toBeGreaterThan(0);
        const ids = new Set(processes.map((m) => m["@id"]));
        for (const p of processes) {
          for (const k of ["name", "summary", "description"]) expect(typeof p[k], `${String(p["@id"])} ${k}`).toBe("string");
          expect(String(p["source"])).toMatch(/^https:\/\/.+\.bpmn$/);
          expect(String(p["depiction"])).toBe(String(p["source"]).replace(/\.bpmn$/, ".svg"));
          expect(existsSync(join(root, String(p["depiction"]).slice(b.repoIri.length - "subgraph/".length)))).toBe(true);
          for (const r of (p["requires"] as string[] | undefined) ?? []) expect(ids.has(r)).toBe(true);
        }
        expect(hyd["holdsGraph"]).toContain("bootstrap:graphTypology/processes");
      });
    });
  }

  test("diagramsAreProcessNodes", () => {
    expect(buildSubgraphs(BOOTSTRAP).processes).toBe(5);
    expect(buildSubgraphs(TOOLS).processes).toBe(1);
  });

  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "subgraphs-"));
    mkdirSync(join(root, "skills", "deep", "er"), { recursive: true });
    mkdirSync(join(root, "code"));
    writeFileSync(join(root, "demo.json"), JSON.stringify({ name: "demo", version: "0.1.0", repository: "Owner/demo", needs: ["bootstrap"], directories: [
      { id: "skills", path: "skills/", graphTypologies: ["skills"] },
      { id: "code", path: "code/", graphTypologies: ["code"] },
    ] }));
    writeFileSync(join(root, "skills", "top.md"), "---\nname: top\n---\n# Top\n");
    writeFileSync(join(root, "skills", "deep", "er", "low.md"), "---\nname: low\n---\n# Low\n");
    writeFileSync(join(root, "code", "x.ts"), "");
    spawnSync("git", ["init", "-q"], { cwd: root });
    return root;
  };

  test("childSubgraphNested", () => {
    const root = fixture();
    const b = buildSubgraphs(root, { bootstrapRoot: BOOTSTRAP });
    expect(b.repoIri).toBe("https://owner.github.io/demo/subgraph/");
    expect(auditSubgraphs(root, b)).toEqual([]);
    expect([...b.files.keys()]).toEqual([
      "subgraph/demo/index.jsonld",
      "subgraph/demo/skills/deep/er/index.hydrated.jsonld",
      "subgraph/demo/skills/deep/er/index.jsonld",
      "subgraph/demo/skills/deep/index.hydrated.jsonld",
      "subgraph/demo/skills/deep/index.jsonld",
      "subgraph/demo/skills/index.hydrated.jsonld",
      "subgraph/demo/skills/index.jsonld",
      "subgraph/index.jsonld",
      "subgraph/v0/context.jsonld",
    ]);
    const skills = JSON.parse(b.files.get("subgraph/demo/skills/index.jsonld")!) as Doc;
    expect((skills["hasMember"] as Doc[]).map((m) => m["name"])).toEqual(["skills", "top"]);
    expect(skills["hasSubgraph"]).toEqual(["https://owner.github.io/demo/subgraph/demo/skills/deep/"]);
    const hyd = JSON.parse(b.files.get("subgraph/demo/skills/index.hydrated.jsonld")!) as Doc;
    const deep = (hyd["hasSubgraph"] as Doc[])[0]!;
    expect(deep["hasMember"]).toBeUndefined();
    expect(((deep["hasSubgraph"] as Doc[])[0]!["hasMember"] as Doc[]).map((m) => m["name"])).toEqual(["low"]);
    // A declared directory of a kind the graph does not read is said, not framed empty.
    expect(b.omitted).toEqual(["code"]);
    const root2 = JSON.parse(b.files.get("subgraph/demo/index.jsonld")!) as Doc;
    expect((root2["hasMember"] as Doc[]).map((m) => m["@id"])).toEqual(["https://owner.github.io/demo/directory/code"]);
  });

  test("undeterminedSubgraphIsProblem", () => {
    const root = fixture();
    const base = "https://x.example/";
    const g = exportGraph(root, { docIri: `${base}demo.jsonld`, sourceBase: base, bootstrapRoot: BOOTSTRAP });
    (g["@graph"] as Doc[]).push({ "@id": `${base}demo.jsonld#stray`, "@type": "bootstrap:Node", isPartOf: `${base}demo.jsonld#nowhere` });
    const b = frameSubgraphs(root, g, base);
    expect(b.problems).toEqual([`${base}demo.jsonld#stray: no source path, and its isPartOf (${base}demo.jsonld#nowhere) is not a node of the graph — its subgraph cannot be determined`]);
  });

  test("contextUnderMajorVersion", () => {
    expect(contextPath("0.1.0")).toBe("v0/context.jsonld");
    expect(contextPath("2.3.4-rc.1")).toBe("v2/context.jsonld");
    expect(contextPath(undefined)).toBeUndefined();
    expect(contextPath("latest")).toBeUndefined();
    const root = fixture();
    const b = buildSubgraphs(root, { bootstrapRoot: BOOTSTRAP });
    expect(b.contextFile).toBe("subgraph/v0/context.jsonld");
    expect(b.contextUrl).toBe("https://owner.github.io/demo/subgraph/v0/context.jsonld");
    const decl = JSON.parse(readFileSync(join(root, "demo.json"), "utf-8")) as Doc;
    // The declaration schema already refuses a non-semver version, so the case left is an ABSENT one.
    delete decl["version"];
    writeFileSync(join(root, "demo.json"), JSON.stringify(decl));
    expect(buildSubgraphs(root, { bootstrapRoot: BOOTSTRAP }).problems.some((p) => p.includes("is not semver"))).toBe(true);
  });

  test("checkDetectsStale", () => {
    const b = buildSubgraphs(BOOTSTRAP);
    const out = mkdtempSync(join(tmpdir(), "subgraphs-out-"));
    writeSubgraphs(out, b);
    expect(staleSubgraphs(out, b)).toEqual([]);
    writeFileSync(join(out, "subgraph", INDEX_FILE), "{}\n");
    expect(staleSubgraphs(out, b)).toEqual([`subgraph/${INDEX_FILE}`]);
  });

  test("siteStagesSubgraphs", () => {
    const out = mkdtempSync(join(tmpdir(), "subgraphs-site-"));
    const r = stageSite(BOOTSTRAP, out);
    expect(r.problems).toEqual([]);
    const b = buildSubgraphs(BOOTSTRAP);
    expect(staleSubgraphs(out, b)).toEqual([]);
    const graph = JSON.parse(readFileSync(join(out, "bootstrap.jsonld"), "utf-8")) as Doc;
    const ids = new Set((graph["@graph"] as Doc[]).map((n) => n["@id"]));
    const hyd = JSON.parse(readFileSync(join(out, "subgraph", "bootstrap", "processes", HYDRATED_FILE), "utf-8")) as Doc;
    for (const m of hyd["hasMember"] as Doc[]) expect(ids.has(m["@id"])).toBe(true);
  });

  test("missingNeededBootstrapIsProblem", () => {
    const root = fixture();
    const r = stageSite(root, mkdtempSync(join(tmpdir(), "subgraphs-site2-")), { bootstrapRoot: join(root, "no-bootstrap-here") });
    expect(r.problems.length).toBe(1);
    expect(r.problems[0]).toContain("demo.jsonld and its subgraphs not written");
  });
});
