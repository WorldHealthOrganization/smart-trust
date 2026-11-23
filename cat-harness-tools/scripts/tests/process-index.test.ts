/**
 * The workflow page's process table — the view logic and the JSON-LD it reads.
 *
 * Bean `ax6r`: the "Every workflow in the repo" table was hand-written and
 * drifted from the diagrams. It is drawn by `assets/js/process-index.js` from
 * the published named-subgraph JSON-LD (owner, 2026-10-03: "Move to
 * JSON-LD"; there is no plain-JSON projection). These pin the parts that are
 * not a browser's to judge: the grouping, row and link rules (evaluated from
 * the SHIPPED bytes, not a copy), that the committed subgraph files cover
 * every diagram this graph frames, and that a row carries no work-plan chatter.
 *
 * @module scripts/tests/process-index
 */
import { HARNESS_ROOT } from "../lib/roots.ts";
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "../../test/support/site-fs.ts";
import { join, relative } from "node:path";

import { declaredDiagrams, diagramPath, framedInstances, publishedProcesses, unframedProcesses } from "../check-process-index.ts";
import { firstSentence } from "../kg-export.ts";
import { subgraphOutDir } from "../gen-subgraph-jsonld.ts";
import { repoRootFor, resolveDirectories, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { inAggregate, siteNotBuilt } from "../../test/support/checkout.ts";

const HARNESS = HARNESS_ROOT;
const REPO = repoRootFor(HARNESS);
const SITE = join(HARNESS, siteDirFor(HARNESS));
const OUT = join(HARNESS, subgraphOutDir(HARNESS));
const VIEWER = readFileSync(join(SITE, "assets", "js", "process-index.js"), "utf-8");

interface Row { id: string; localId?: string; name: string; path: string; group: string; instance: string; svg?: string; source?: string; summary?: string; calls?: string[] }
type Api = {
  groupRows: (rows: Row[], key: string) => Array<{ label: string; rows: Row[] }>;
  rowLinks: (row: Partial<Row>, from?: string, to?: string) => { svg: string; source: string };
  rowsFromHydrated: (doc: unknown, instance: string) => Row[];
  localUrl: (iri: string, repoIri: string, srcDir: string, file?: string) => string;
  holdsProcesses: (node: unknown) => boolean;
  GROUP_NONE: string;
};

/** The shipped script, evaluated with no document — so it exposes its pure half and mounts nothing. */
function viewerApi(): Api {
  const win: { faProcessIndex?: Api } = {};
  // input-site: inert #1c70f39d — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  new Function("window", "document", VIEWER)(win, undefined);
  return win.faProcessIndex!;
}

const row = (over: Partial<Row>): Row => ({ id: "P", name: "n", path: "p.bpmn", group: "", instance: "i", ...over });

describe("grouping", () => {
  const api = viewerApi();
  const rows = [
    row({ id: "B", name: "beta", group: "sdlc", instance: "cat-harness", path: "b" }),
    row({ id: "A", name: "alpha", group: "content", instance: "smart-base", path: "a" }),
    row({ id: "C", name: "gamma", group: "content", instance: "cat-harness", path: "c" }),
    row({ id: "D", name: "delta", group: "", instance: "folio-assistant-core", path: "d" }),
  ];
  test("by concern group: groups in order, the ungrouped remainder last, rows by instance then name", () => {
    const g = api.groupRows(rows, "group");
    expect(g.map((x) => x.label)).toEqual(["content", "sdlc", api.GROUP_NONE]);
    expect(g[0]!.rows.map((r) => r.id)).toEqual(["C", "A"]);
  });
  test("by instance: rows ordered by concern group inside each instance", () => {
    const g = api.groupRows(rows, "instance");
    expect(g.map((x) => x.label)).toEqual(["cat-harness", "folio-assistant-core", "smart-base"]);
    expect(g[0]!.rows.map((r) => r.id)).toEqual(["C", "B"]);
  });
  test("every row lands in exactly one group", () => {
    for (const key of ["group", "instance"]) {
      expect(api.groupRows(rows, key).flatMap((x) => x.rows).length).toBe(rows.length);
    }
  });
  test("an empty or absent list is no groups, not an error", () => {
    expect(api.groupRows([], "group")).toEqual([]);
    expect(api.groupRows(undefined as unknown as Row[], "group")).toEqual([]);
  });
});

describe("links", () => {
  const api = viewerApi();
  const canon = "https://litlfred.github.io/folio-assistant/";
  test("an SVG under the canonical site is re-rooted at this one", () => {
    expect(api.rowLinks({ svg: `${canon}assets/img/workflows/x.svg` }, canon, "http://localhost:8000/").svg)
      .toBe("http://localhost:8000/assets/img/workflows/x.svg");
    expect(api.rowLinks({ svg: `${canon}assets/img/workflows/x.svg` }).svg).toBe(`${canon}assets/img/workflows/x.svg`);
  });
  test("a relative, protocol-relative or scripted URL is dropped rather than linked", () => {
    expect(api.rowLinks({ svg: "//evil.example/x.svg" }).svg).toBe("");
    expect(api.rowLinks({ svg: "/assets/img/workflows/x.svg" }).svg).toBe("");
    expect(api.rowLinks({ source: "javascript:alert(1)" }).source).toBe("");
    expect(api.rowLinks({ source: "https://github.com/x/y/blob/main/a.bpmn" }).source).toBe("https://github.com/x/y/blob/main/a.bpmn");
  });
  test("a subgraph IRI is fetched only under the repository's own subgraph IRI", () => {
    const repo = `${canon}subgraph/`;
    expect(api.localUrl(`${repo}cat-harness/processes/`, repo, "http://localhost:8000/subgraph/", "index.hydrated.jsonld"))
      .toBe("http://localhost:8000/subgraph/cat-harness/processes/index.hydrated.jsonld");
    expect(api.localUrl("https://evil.example/subgraph/x/", repo, "http://localhost:8000/subgraph/")).toBe("");
    expect(api.localUrl(`${repo}../../x/`, repo, "http://localhost:8000/subgraph/")).toBe("");
  });
});

describe("rows from a hydrated processes subgraph", () => {
  const api = viewerApi();
  const P = "https://x.test/doc.jsonld#process/";
  const doc = {
    "@id": "https://x.test/subgraph/h/processes/",
    path: "processes/",
    holdsGraph: ["bootstrap:graphTypology/processes"],
    hasMember: [{ "@id": `${P}Top`, "@type": "bootstrap:Process", name: "Top", summary: "Does the top thing.", sourcePath: "processes/top.bpmn" }],
    hasSubgraph: [{
      "@id": "https://x.test/subgraph/h/processes/sdlc/",
      path: "processes/sdlc/",
      hasMember: [
        { "@id": `${P}Child`, "@type": "bootstrap:Process", name: "Child", sourcePath: "processes/sdlc/child.bpmn", depiction: "https://x.test/assets/img/workflows/child.svg" },
        { "@id": `${P}Child/node/Call`, "@type": "bootstrap:ProcessNode", partOf: `${P}Child`, calledElement: `${P}Top` },
      ],
    }],
  };
  test("the concern group is the nesting below the top processes subgraph; calls come from ProcessNodes", () => {
    const rows = api.rowsFromHydrated(doc, "h");
    expect(rows.map((r) => [r.localId, r.group, r.instance])).toEqual([["Top", "", "h"], ["Child", "sdlc", "h"]]);
    expect(rows[1]!.calls).toEqual([`${P}Top`]);
    expect(rows[0]!.summary).toBe("Does the top thing.");
    expect(rows[1]!.summary).toBe("");
    expect(api.holdsProcesses(doc)).toBe(true);
    expect(api.holdsProcesses({ holdsGraph: ["bootstrap:graphTypology/skills"] })).toBe(false);
  });
});

describe("a dependency's subgraph carries `source`, not `sourcePath` (t8c4)", () => {
  test("the row's path and BPMN link come from the absolute `source` IRI", () => {
    const api = viewerApi();
    const src = "https://dep.test/processes/log-message.bpmn";
    const rows = api.rowsFromHydrated({
      "@id": "https://dep.test/subgraph/dep/processes/",
      path: "processes/",
      hasMember: [{ "@id": "https://dep.test/dep.jsonld#process/Log", "@type": "bootstrap:Process", name: "Log", summary: "Logs.", source: src }],
    }, "dep");
    expect(rows.map((r) => [r.path, r.source])).toEqual([[src, src]]);
  });
});

describe("first sentence", () => {
  test("a summary is the documentation's first sentence", () => {
    expect(firstSentence("Own. More.")).toBe("Own.");
    expect(firstSentence("No stop")).toBe("No stop");
  });
});

describe("the committed subgraph JSON-LD", () => {
  const { processes, problems } = publishedProcesses(OUT);
  const declared = declaredDiagrams(REPO);
  const framed = framedInstances(HARNESS);
  // Standing alone the subgraph tree is not built: `subgraph:jsonld` writes it
  // at publish and `docs/subgraph/` is gitignored, so the walk starts at a
  // root that is not there (bean w1gy F18).
  const SUBGRAPH_NOT_BUILT = (): boolean =>
    siteNotBuilt("the subgraph JSON-LD `subgraph:jsonld` writes at publish (gitignored)", join(OUT, "index.jsonld"));

  test.skipIf(SUBGRAPH_NOT_BUILT())("every file the walk reaches exists and validates", () => {
    expect(problems).toEqual([]);
  });
  // The committed JSON-LD is generated in the AGGREGATE and frames the higher
  // layers' diagrams too; cat-harness run as its own clone declares none of
  // them, so the comparison has one side only there. Skipped, not passed, until
  // the outputs are self-contained (bean `vj2p`; `ho66`).
  test.skipIf(!inAggregate())("every diagram an instance in this graph declares is a Process node, and nothing else is", () => {
    const want = [...declared].filter(([, inst]) => framed.has(inst)).map(([p]) => p).sort();
    // Each `sourcePath` against the layer whose tree it is in (bean `4ak5` item 2).
    expect(processes.map((p) => diagramPath(p, REPO)).sort()).toEqual(want);
  });
  test("bootstrap's diagrams are not re-carried into this graph (pve3, #432)", () => {
    const boot = [...declared].filter(([p]) => p.startsWith("bootstrap/") || p.startsWith("bootstrap-tools/"));
    expect(boot.length).toBeGreaterThan(0);
    for (const [p, inst] of boot) {
      expect({ p, framed: framed.has(inst) }).toEqual({ p, framed: false });
    }
  });
  test.skipIf(SUBGRAPH_NOT_BUILT())("bootstrap's diagrams are covered through its OWN subgraphs, linked by `seeAlso` (t8c4)", () => {
    const { seeAlso } = publishedProcesses(OUT);
    const boot = [...declared].filter(([, inst]) => !framed.has(inst)).map(([p]) => p).sort();
    const { byPath, problems: why } = unframedProcesses(seeAlso, framed, REPO);
    expect(why).toEqual([]);
    expect(boot.length).toBeGreaterThan(0);
    expect([...byPath.keys()].sort()).toEqual(boot);
    // A link, never membership: nothing of theirs is re-carried as ours.
    for (const iri of seeAlso) expect(iri).toMatch(/^https:\/\/[^/]+\/[^/]+\/subgraph\/$/);
  });
  test("with no `seeAlso`, an unframed instance's diagrams are NOT counted", () => {
    expect(unframedProcesses([], framed, REPO).byPath.size).toBe(0);
  });
  // The viewer reads each root's top `processes` subgraphs, and those one
  // level inside a named sub-graph: `sdlc/processes/` since cat-harness#1014
  // (cat-harness#991 step 23.2), and `library/processes/` since
  // cat-harness#1032 moved the library diagrams into the `library` sub-graph.
  //
  // Read from each layer's declaration rather than listed here: every
  // `processes` directory it declares, top level or from within a sub-graph,
  // opt-in ones included where this checkout switches them on. A list went
  // stale when `kg-ops/processes/` and core's `dsa/processes/` became
  // sub-graphs, and the count below came up three short with nothing naming
  // why. Switched on, not merely on disk: `subgraph:jsonld` publishes no
  // subgraph for a group the root leaves off, so the viewer has none to read
  // (core's `collab/processes/`, core#776, until an index switches it on).
  const processDirs = (layer: string, root: string): string[] =>
    !existsSync(root)
      ? []
      : resolveDirectories([{ name: layer, root, own: true }])
          .filter((d) => d.own && (d.graphTypologies ?? []).includes("processes") && existsSync(d.absPath))
          .map((d) => relative(root, d.absPath).replace(/[\\/]+$/, ""))
          .filter((p) => p !== "" && !p.startsWith("..") && !/(^|\/)processes\/./.test(p))
          .map((p) => `${layer}/${p}`);
  const VIEWED = [...new Set([...processDirs("cat-harness", HARNESS), ...processDirs("folio-assistant-core", join(REPO, "folio-assistant-core"))])].sort();
  // Standing alone the hydrated subgraphs are not built: `subgraph:jsonld`
  // writes them at publish and the subgraph tree is gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt(
      "the hydrated processes subgraphs `subgraph:jsonld` writes at publish (gitignored)",
      ...VIEWED.map((sub) => join(OUT, sub, "index.hydrated.jsonld")),
    ),
  )("the shipped viewer reads the same rows from the same files", () => {
    const api = viewerApi();
    let n = 0;
    for (const sub of VIEWED) {
      const doc = JSON.parse(readFileSync(join(OUT, sub, "index.hydrated.jsonld"), "utf-8"));
      n += api.rowsFromHydrated(doc, sub.split("/")[0]!).length;
    }
    expect(n).toBe(processes.filter((p) => p.harness === "cat-harness" || p.harness === "folio-assistant-core").length);
  });
  test("every node has documentation, and no summary carries work-plan or issue chatter", () => {
    // The page's rule, enforced where it can drift: a row is what the diagram
    // IS, not who asked for it or where the work got to.
    const chatter = /#\d{2,}|\b[Bb]eans? `[a-z0-9]{4}`|\b[Bb]ean [a-z0-9]{4}[,.;:)]|\b[Oo]wner,? 20\d\d|\b20\d\d-\d\d-\d\d\b/;
    for (const p of processes) {
      expect({ id: p.id, summary: typeof p.summary }).toEqual({ id: p.id, summary: "string" });
      expect({ id: p.id, chatter: chatter.test(p.summary!) }).toEqual({ id: p.id, chatter: false });
    }
  });
});
