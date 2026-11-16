/**
 * The node-view coverage report (owner, 2026-11-13, card A): the census, the
 * folder-page reader (HTML and data files), the per-node verdicts, and that
 * unknown is never read as zero.
 *
 * @module scripts/tests/node-view-coverage
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  attachIris,
  censusFiles,
  censusRuleFor,
  coverRow,
  dataFileRefs,
  dataLinks,
  dirFetcher,
  exportNodesOf,
  findingsOf,
  htmlLinks,
  inlineData,
  httpFetcher,
  iriHasExtension,
  isRawRepoLink,
  nodePageUrl,
  type ExportNode,
  type Fetcher,
  type RowInput,
} from "../lib/node-view-coverage.ts";
import { folderRoutes, visualiserFor } from "../node-view-coverage.ts";
import { NodeViewCoverageSchema, CoverageRowSchema } from "../../schemas/sdlc/node-view-coverage.ts";
import type { DeclaredVisualiser } from "../viewer-declarations.ts";

const tmp = mkdtempSync(join(tmpdir(), "nvc-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function write(rel: string, text = "{}"): void {
  const p = join(tmp, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, text);
}

describe("census", () => {
  write("layer/library/a/library.json");
  write("layer/library/b/x.md", "x");
  mkdirSync(join(tmp, "layer/library/empty"), { recursive: true });
  write("layer/library/README.md", "r");
  write("layer/test/attestations/qa/x.attestations.json");
  write("layer/test/attestations/qa/notes.json");
  write("layer/processes/p.bpmn", "<x/>");
  write("layer/processes/sub/q.dmn", "<x/>");
  write("layer/processes/claimed/r.bpmn", "<x/>");
  write("layer/data/n.json");
  write("layer/data/n.prov.jsonld");

  test("entries: each non-empty sub-folder is a node", () => {
    const n = censusFiles(join(tmp, "layer/library"), join(tmp, "layer"), censusRuleFor("library"));
    expect(n.map((x) => x.id)).toEqual(["a", "b"]);
    expect(n[0]!.path).toBe("library/a/");
  });
  test("files: the kind's suffix, dropped from the id", () => {
    const n = censusFiles(join(tmp, "layer/test/attestations"), join(tmp, "layer"), censusRuleFor("attestations"));
    expect(n.map((x) => x.id)).toEqual(["qa/x"]);
  });
  test("a directory another declaration claims is left to it", () => {
    const n = censusFiles(join(tmp, "layer/processes"), join(tmp, "layer"), censusRuleFor("processes"), [join(tmp, "layer/processes/claimed")]);
    expect(n.map((x) => x.id)).toEqual(["p", "sub/q"]);
  });
  test("an unlisted kind counts JSON files, not provenance", () => {
    const n = censusFiles(join(tmp, "layer/data"), join(tmp, "layer"), censusRuleFor("whatever"));
    expect(n).toEqual([{ id: "n", path: "data/n.json", json: true }]);
  });
  test("a directory that is not there holds no files (the report says unknown, not this)", () => {
    expect(censusFiles(join(tmp, "nope"), tmp, censusRuleFor("code"))).toEqual([]);
  });
});

describe("export", () => {
  const G: ExportNode[] = [
    { "@id": "https://x/l/directory/l-processes", "@type": "https://ns/Subgraph", path: "processes/" },
    { "@id": "https://x/l/process/P1", "@type": "https://ns/Process", sourcePath: "processes/p.bpmn", inSubgraph: "https://x/l/directory/l-processes" },
    { "@id": "https://x/l/process/P1/n1", "@type": "https://ns/ProcessNode", partOf: "https://x/l/process/P1", inSubgraph: "https://x/l/directory/l-processes" },
    { "@id": "https://x/l/tools/t1.jsonld", "@type": "https://ns/Tool", name: "t1" },
    { "@id": "https://x/l/schema/s1", "@type": "https://ns/Schema", name: "s1", inSubgraph: "https://x/l/directory/l-schemas" },
  ];
  test("ties nodes by inSubgraph or path, never their parts or the structure", () => {
    expect(exportNodesOf(G, { id: "l-processes", path: "processes/" }, "processes").map((n) => n["@id"])).toEqual(["https://x/l/process/P1"]);
    expect(exportNodesOf(G, { id: "l-schemas", path: "schemas/" }, "schemas").map((n) => n.name)).toEqual(["s1"]);
  });
  test("a kind with no directory link is found by its IRI segment", () => {
    expect(exportNodesOf(G, { id: "l-tools", path: "tools/" }, "tools").map((n) => n.name)).toEqual(["t1"]);
  });
  test("attaches IRIs by path, then by id", () => {
    const n = attachIris(
      [{ id: "p", path: "processes/p.bpmn" }, { id: "t1", path: "tools/t1/" }, { id: "zz" }],
      [G[1]!, G[3]!],
    );
    expect(n.map((x) => x.iri)).toEqual(["https://x/l/process/P1", "https://x/l/tools/t1.jsonld", undefined]);
  });
  test("an IRI with a file extension is not extensionless", () => {
    expect(iriHasExtension("https://x/l/tools/t1.jsonld")).toBe(true);
    expect(iriHasExtension("https://x/l/schema/s1")).toBe(false);
  });
});

describe("reading a folder page", () => {
  const page = "https://s/en/h/schemas/l/";
  const html =
    `<html><body><nav class="fa-nav"><a href="../../other/">rail</a></nav><main>` +
    `<a href="a/">A</a><a href="#top">top</a><a href="https://github.com/o/r/blob/main/x.ts">raw</a>` +
    `<script>x='<a href="' + r.page + '">'</script>` +
    `<script type="application/json" id="rows">{"rows":[{"page":"en/h/schemas/l/b/"}]}</script>` +
    `<script type="application/json" id="fa-site-links">{"page":"en/nav/"}</script>` +
    `<script>fetch("../../../../assets/schemas/index.json")</script><script src="../../../../assets/beans/index.json"></script>` +
    `</main></body></html>`;
  test("the rows' links: not the rail, not fragments, not JS string pieces", async () => {
    expect((await htmlLinks(html, page)).sort()).toEqual(["https://github.com/o/r/blob/main/x.ts", "https://s/en/h/schemas/l/a/"]);
    expect(isRawRepoLink("https://github.com/o/r/blob/main/x.ts")).toBe(true);
    expect(isRawRepoLink("https://github.com/o/r/issues/1")).toBe(false);
  });
  test("read by a parser: a script closed as `</script >` hides no row, and its strings are not rows", async () => {
    const odd = `<main><script>var s = '<a href="fake/">';</script ><a href="real/">r</a><style>a{}</style ></main>`;
    expect(await htmlLinks(odd, page)).toEqual(["https://s/en/h/schemas/l/real/"]);
  });
  test("inline JSON rows, not the site's own fa-* blocks", async () => {
    expect(await inlineData(html)).toEqual([{ rows: [{ page: "en/h/schemas/l/b/" }] }]);
  });
  test("the folder's data files: its visualiser's assets, not the site's", () => {
    expect(dataFileRefs(html, page, "https://s/", "schemas")).toEqual(["https://s/assets/schemas/index.json"]);
  });
  test("data links: each reading of a relative one, and another layer's rows are skipped", () => {
    const d = { nodeKinds: [{ page: "en/h/bean/" }, { instance: "other", page: "en/h/x/" }, { instance: "l", href: "https://e/x" }], roots: ["a/b"] };
    expect(dataLinks(d, ["https://s/", page], "l")).toEqual([["https://s/en/h/bean/", "https://s/en/h/schemas/l/en/h/bean/"], ["https://e/x"]]);
  });
});

describe("one row", () => {
  const site = join(tmp, "site");
  const siteUrl = "https://s/";
  const folder = "en/h/things/l/";
  mkdirSync(join(site, folder, "a"), { recursive: true });
  mkdirSync(join(site, "assets/things"), { recursive: true });
  mkdirSync(join(site, "other"), { recursive: true });
  writeFileSync(join(site, folder, "index.html"), `<main><a href="a/">a</a><a href="../../../../gone/">gone</a><script>fetch("../../../../assets/things/index.json")</script></main>`);
  writeFileSync(join(site, "assets/things/index.json"), JSON.stringify({ rows: [{ page: "other/c.html" }] }));
  writeFileSync(join(site, folder, "a/index.html"), "<p>a</p>");
  writeFileSync(join(site, "other/c.html"), "<p>c</p>");
  writeFileSync(join(site, "a.jsonld"), "{}");

  const iris: Fetcher = { status: async (u) => (u === "https://i/a.jsonld" || u === "https://i/a.json" ? 200 : 404), text: async () => undefined };
  const base = (over: Partial<RowInput> = {}): RowInput => ({
    layer: "l",
    directory: { id: "things", path: "things/" },
    kind: "things",
    nodes: [
      { id: "a", iri: "https://i/a", json: true },
      { id: "b", iri: "https://i/b.jsonld" },
      { id: "c" },
    ],
    census: "files .json",
    viewer: { state: "declared", id: "h/things" },
    folderUrls: [siteUrl + folder],
    siteUrl,
    vis: "things",
    fetcher: dirFetcher(site, siteUrl),
    iriFetcher: iris,
    probeLimit: 100,
    ...over,
  });

  test("counts each of the four, per node", async () => {
    const r = CoverageRowSchema.parse(await coverRow(base()));
    expect(r.declared).toBe(3);
    expect(r.withIri).toBe(2);
    expect(r.withJsonld).toBe(1);
    expect(r.withJson).toBe(1);
    expect(r.withPage).toBe(2);
    expect(r.listed).toBe(2);
    expect(r.deadLinks).toEqual(["gone/"]);
    expect(r.rawRepoLinks).toBe(0);
    const by = Object.fromEntries(r.nodes.map((n) => [n.id, n]));
    expect(by.a!.verdict).toBe("ok");
    expect(by.b!.missing).toEqual(["page", "listed", "iri-extension", "jsonld"]);
    // A page the data links, at the wrong address: a page, not the canonical one.
    expect(by.c!.page).toBe("other/c.html");
    expect(by.c!.missing).toEqual(["canonical-page", "iri", "jsonld"]);
  });

  test("a node the export does not mint takes its IRI from its page's rel=alternate", async () => {
    mkdirSync(join(site, folder, "d"), { recursive: true });
    writeFileSync(join(site, folder, "d/index.html"), `<link rel="alternate" type="application/ld+json" href="../../../../../ld/d.jsonld">`);
    mkdirSync(join(site, "ld"), { recursive: true });
    writeFileSync(join(site, "ld/d.jsonld"), "{}");
    const r = await coverRow(base({ nodes: [{ id: "d" }], iriUnknown: "the export did not build" }));
    expect(r.nodes[0]!.iri).toBe("https://s/ld/d");
    expect(r.withIri).toBe(1);
    expect(r.withJsonld).toBe(1);
    expect(r.nodes[0]!.missing).toEqual(["listed"]);
  });

  test("no folder page: every node misses its row", async () => {
    const r = await coverRow(base({ folderUrls: [siteUrl + "en/h/none/l/"] }));
    expect(r.folderPageFound).toBe(false);
    expect(r.listed).toBe(0);
    expect(r.nodes.every((n) => n.missing?.includes("listed"))).toBe(true);
  });

  test("no viewer: no page and no row are owed nowhere, so both are missing", async () => {
    const r = await coverRow(base({ folderUrls: [], viewer: { state: "none", reason: "none" } }));
    expect(r.withPage).toBe(0);
    expect(r.nodes.every((n) => n.missing?.includes("page"))).toBe(true);
  });

  test("a directory not in the checkout is unknown, never 0", async () => {
    const r = await coverRow(base({ nodes: { unknown: "kept on a branch" } }));
    expect(r.declared).toBe("unknown");
    expect(r.withPage).toBe("unknown");
    expect(r.reason).toBe("kept on a branch");
  });

  test("no site: pages and rows are unknown, IRIs still counted", async () => {
    const r = await coverRow(base({ fetcher: undefined }));
    expect(r.withIri).toBe(2);
    expect(r.withPage).toBe("unknown");
    expect(r.listed).toBe("unknown");
  });

  test("over the probe limit is unknown, not missing", async () => {
    const r = await coverRow(base({ probeLimit: 1 }));
    expect(r.withPage).toBe("unknown");
    expect(r.nodes[1]!.reason).toContain("--probe-limit");
  });

  test("findings: a node that misses something and a dead link; unknown is none", async () => {
    const r = await coverRow(base());
    const f = findingsOf([r]);
    expect(f).toContainEqual({ directory: "things", kind: "things", deadLink: "gone/" });
    expect(f.filter((x) => "node" in x).map((x) => (x as { node: string }).node)).toEqual(["b", "c"]);
    expect(findingsOf([await coverRow(base({ nodes: { unknown: "x" } }))])).toEqual([]);
  });

  test("the canonical page is <folder><id>/", () => {
    expect(nodePageUrl("https://s/en/h/v/l/", "sub/x y")).toBe("https://s/en/h/v/l/sub/x%20y/");
  });
});

describe("routes", () => {
  const V = (o: Partial<DeclaredVisualiser>): DeclaredVisualiser =>
    ({ id: "v", renderedBy: "t", harness: "cat-harness", harnessRoot: "/x", ...o }) as DeclaredVisualiser;
  test("instance, nested and kind-wide folder pages", () => {
    expect(folderRoutes(V({ subgraphs: "instance" }), "who-iris", "d", "k", "en")[0]).toBe("en/cat-harness/v/who-iris/");
    expect(folderRoutes(V({ subgraphs: "directory", subgraphUnder: { skills: "index/skills" } } as never), "l", "core-skills", "skills", "en")[0]).toBe(
      "en/cat-harness/v/index/skills/core-skills/",
    );
    expect(folderRoutes(V({}), "l", "d", "k", "en")).toEqual(["en/cat-harness/v/", "cat-harness/v/"]);
  });
  test("a kind covered by kind wins over a directory covered by id", () => {
    const vs = [V({ id: "a", covers: ["d"] } as never), V({ id: "b", coversKinds: ["k"] } as never)];
    expect(visualiserFor(vs, "d", "k")!.id).toBe("b");
    expect(visualiserFor(vs, "d", "other")!.id).toBe("a");
    expect(visualiserFor(vs, "x", "y")).toBeUndefined();
  });
});

describe("httpFetcher", () => {
  test("caches, retries a reset once, and reads a refused request as 0", async () => {
    let calls = 0;
    const impl = (async (u: string) => {
      calls++;
      if (String(u).endsWith("/reset") && calls === 1) throw new Error("reset");
      if (String(u).endsWith("/down")) throw new Error("down");
      return new Response("ok", { status: String(u).endsWith("/404") ? 404 : 200 });
    }) as unknown as typeof fetch;
    const f = httpFetcher(2, impl);
    expect(await f.status("https://s/reset")).toBe(200);
    expect(await f.status("https://s/404")).toBe(404);
    expect(await f.status("https://s/404")).toBe(404);
    expect(await f.status("https://s/down")).toBe(0);
    expect(calls).toBe(5);
  });
});

describe("schema", () => {
  test("a document with an unknown count parses; a negative count does not", () => {
    const doc = {
      $schema: "node-view-coverage/v1",
      layer: "l",
      site: { kind: "none" },
      generatedAt: "2026-11-13T00:00:00Z",
      totals: { rows: 0, nodes: "unknown", ok: 0, missing: 0, unknown: 0, deadLinks: 0 },
      rows: [],
    };
    expect(NodeViewCoverageSchema.safeParse(doc).success).toBe(true);
    expect(NodeViewCoverageSchema.safeParse({ ...doc, totals: { ...doc.totals, ok: -1 } }).success).toBe(false);
  });
});
