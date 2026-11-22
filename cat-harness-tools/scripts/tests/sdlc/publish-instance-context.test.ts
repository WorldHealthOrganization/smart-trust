/**
 * `scripts/publish-instance-context.ts` — build one layer's context, judged
 * on its own findings only, and put it on `gh-pages` through a REST API that is
 * faked here, so no test reaches the network (bean folio-assistant-63q4).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildOne, contextUrl, publishFile, termPages, vocabularyHtml, vocabularyPaths, writeVocabularyFiles, NAMESPACE_WRITER_SCRIPT, namespaceWriterFiles, runNamespaceWriter, vocabularyFiles, writeSiteFiles, type ApiRequest } from "../../publish-instance-context.ts";
import { PLACEHOLDER_HTML } from "../../pages-bootstrap.ts";

const root = mkdtempSync(join(tmpdir(), "publish-instance-context-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const put = (rel: string, value: unknown): void => {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof value === "string" ? value : JSON.stringify(value));
};

put("base/base.json", { name: "base", needs: [], iriBase: "https://example.github.io/base/", jsonldPrefixes: { skos: "http://www.w3.org/2004/02/skos/core#" } });
put("top/top.json", { name: "top", needs: ["base"], iriBase: "https://example.github.io/top" });
put("bare/bare.json", { name: "bare", needs: ["base"] });
put("quiet/quiet.json", { name: "quiet", needs: ["base"], iriBase: "https://example.github.io/quiet/" });
put("base/nodes/a.jsonld", { "@id": "a", "@type": ["skos:Concept"] });
// top speaks a prefix nobody binds: ITS finding, and only its.
put("top/nodes/t.jsonld", { "@type": "nope:Thing" });
put("bare/nodes/b.jsonld", { "@type": "skos:Concept" });

const opts = { ownNamespaceOf: () => undefined, remoteContexts: new Map(), bindingContexts: new Map() };

describe("build", () => {
  test("an instance is judged on its own findings, not another instance's", () => {
    const base = buildOne(root, "base", opts);
    expect(base.kind).toBe("built");
    if (base.kind !== "built") return;
    expect(base.url).toBe("https://example.github.io/base/ns/context/v1.jsonld");
    expect(base.bound).toEqual(["skos"]);
    expect(JSON.parse(base.context)["@context"].skos).toBe("http://www.w3.org/2004/02/skos/core#");
  });

  test("an unresolved prefix fails the instance that uses it, naming file and prefix", () => {
    const top = buildOne(root, "top", opts);
    expect(top.kind).toBe("failed");
    if (top.kind === "failed") expect(top.problems.join("\n")).toContain("`nope`");
  });

  test("no iriBase, or no documents, is a skip with a reason, not a failure", () => {
    const bare = buildOne(root, "bare", opts);
    expect(bare).toEqual({ kind: "skipped", instance: "bare", reason: expect.stringContaining("no iriBase") });
    const quiet = buildOne(root, "quiet", opts);
    expect(quiet).toEqual({ kind: "skipped", instance: "quiet", reason: expect.stringContaining("no .jsonld documents") });
  });

  test("an unknown instance fails", () => {
    expect(buildOne(root, "absent", opts).kind).toBe("failed");
  });

  test("contextUrl puts exactly one slash after the base", () => {
    expect(contextUrl("https://x.github.io/y")).toBe("https://x.github.io/y/ns/context/v1.jsonld");
    expect(contextUrl("https://x.github.io/y/")).toBe("https://x.github.io/y/ns/context/v1.jsonld");
  });
});

describe("vocabulary paths", () => {
  test("served where its @id points, under the iriBase, in three spellings", () => {
    expect(vocabularyPaths("https://x.github.io/y/v0/ns", "https://x.github.io/y/")).toEqual({
      paths: ["v0/ns", "v0/ns.jsonld", "v0/ns.json"],
    });
    // A trailing `#` on the @id, and no trailing slash on the base, change nothing.
    expect(vocabularyPaths("https://x.github.io/y/v0/ns#", "https://x.github.io/y")).toEqual({
      paths: ["v0/ns", "v0/ns.jsonld", "v0/ns.json"],
    });
  });

  test("a slash namespace is a directory: served as its index, so each term can be a page below it", () => {
    // cat-harness-tools#1378 (owner, Q-SLASH-1 A): `…/v0/ns/` holds `…/v0/ns/<Term>`,
    // so nothing may be written at the bare `v0/ns` path. Clean break: no copy there.
    expect(vocabularyPaths("https://x.github.io/y/v0/ns/", "https://x.github.io/y/")).toEqual({
      paths: ["v0/ns/index.html", "v0/ns/index.jsonld", "v0/ns/index.json"],
    });
  });

  test("an @id outside the iriBase is refused: that Pages site cannot serve it", () => {
    const r = vocabularyPaths("https://litlfred.github.io/folio-assistant/y/ns", "https://x.github.io/y/");
    expect("problem" in r && r.problem).toContain("not under the iriBase");
  });

  test("`ns` itself is refused: it is the directory holding ns/context/v1.jsonld", () => {
    for (const id of ["https://x.github.io/y/ns", "https://x.github.io/y/ns/vocab"]) {
      const r = vocabularyPaths(id, "https://x.github.io/y/");
      expect("problem" in r && r.problem).toContain("collides with the context directory");
    }
  });
});

describe("term pages (owner report, 2026-11-18: …/v0/ns/graphTypology/skills answered 404)", () => {
  const ns = "https://x.github.io/y/v0/ns/";
  const doc = (ids: string[]) => ({
    "@context": { y: ns, other: "https://x.github.io/z/v0/ns/" },
    "@id": ns,
    "@graph": ids.map((id) => ({ "@id": id, label: id, definition: `def of ${id}` })),
  });
  test("a slash namespace gets one page per own term, at the path its IRI names", () => {
    const r = termPages("y", ns, "https://x.github.io/y/", doc(["y:Subgraph", "y:graphTypology/skills", `${ns}Abs`, "other:Foreign"]));
    if (!("pages" in r)) throw new Error(r.problems.join("; "));
    expect(Object.keys(r.pages).sort()).toEqual(["v0/ns/Abs/index.html", "v0/ns/Subgraph/index.html", "v0/ns/graphTypology/skills/index.html"]);
    const page = r.pages["v0/ns/graphTypology/skills/index.html"]!;
    expect(page).toContain(`<link rel="canonical" href="${ns}graphTypology/skills">`);
    expect(page).toContain("def of y:graphTypology/skills");
    expect(page).toContain(`href="../../"`);
  });
  test("a hash namespace needs no pages: its terms are anchors on the one document", () => {
    expect(termPages("y", "https://x.github.io/y/v0/ns", "https://x.github.io/y/", doc(["y:A"]))).toEqual({ pages: {} });
  });
  test("a local name that cannot be a page is refused, never left dangling", () => {
    const r = termPages("y", ns, "https://x.github.io/y/", doc(["y:a/../b", "y:index.html", "y:x?y"]));
    expect("problems" in r && r.problems.length).toBe(3);
  });
  test("the index anchors each own term and links its page; a foreign term is neither", () => {
    const html = vocabularyHtml("y", ns, doc(["y:graphTypology/skills", "other:Foreign"]));
    expect(html).toContain(`<li id="graphTypology/skills"><a href="graphTypology/skills/">`);
    expect(html).toContain(`<li><code>other:Foreign</code>`);
  });
});

describe("a language-tagged label or definition shows its source text, never [object Object]", () => {
  const ns = "https://x.github.io/y/v0/ns/";
  const doc = {
    "@context": { y: ns },
    "@id": ns,
    "@graph": [
      { "@id": "y:Policy", prefLabel: { fr: "Politique", en: "Policy" }, definition: [{ "@value": "Une règle.", "@language": "fr" }, { "@value": "A rule.", "@language": "en" }] },
    ],
  };
  test("the term page and the index", () => {
    const r = termPages("y", ns, "https://x.github.io/y/", doc);
    if (!("pages" in r)) throw new Error(r.problems.join("; "));
    const page = r.pages["v0/ns/Policy/index.html"]!;
    expect(page).toContain("<h1>Policy</h1>");
    expect(page).toContain("<p>A rule.</p>");
    const html = vocabularyHtml("y", ns, doc);
    expect(html).toContain("Policy — A rule.");
    expect(html).not.toContain("[object Object]");
  });
});

describe("an instance whose `ns` is a document (D1)", () => {
  test("its context is built for, and served at, the path beside the vocabulary", () => {
    put("doc/doc.json", { name: "doc", needs: [], iriBase: "https://example.github.io/doc/", jsonldPrefixes: { skos: "http://www.w3.org/2004/02/skos/core#" } });
    put("doc/ns.jsonld", { "@context": { skos: "http://www.w3.org/2004/02/skos/core#" }, "@id": "https://example.github.io/doc/v0/ns", "@type": "skos:ConceptScheme" });
    const doc = buildOne(root, "doc", opts);
    expect(doc.kind).toBe("built");
    if (doc.kind !== "built") return;
    expect(doc.path).toBe("ns.context.v1.jsonld");
    expect(doc.url).toBe("https://example.github.io/doc/ns.context.v1.jsonld");
  });

  test("contextUrl takes the path", () => {
    expect(contextUrl("https://x.github.io/y/", "ns.context.v1.jsonld")).toBe("https://x.github.io/y/ns.context.v1.jsonld");
  });

  test("with the context beside it, a vocabulary at `ns` collides with nothing; at the context's own path it does", () => {
    expect(vocabularyPaths("https://x.github.io/y/ns", "https://x.github.io/y/", "ns.context.v1.jsonld")).toEqual({ paths: ["ns", "ns.jsonld", "ns.json"] });
    const r = vocabularyPaths("https://x.github.io/y/ns.context.v1", "https://x.github.io/y/", "ns.context.v1.jsonld");
    expect("problem" in r && r.problem).toContain("where the context is published");
  });
});

/** A fake API: answers from `routes` in order, and records every call. */
function fakeApi(routes: Array<[string, { status: number; json?: unknown }]>) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const api: ApiRequest = async (method, path, body) => {
    calls.push({ method, path, body });
    const i = routes.findIndex(([k]) => k === `${method} ${path}`);
    if (i === -1) throw new Error(`unexpected call ${method} ${path}`);
    const [, r] = routes.splice(i, 1)[0]!;
    return { status: r.status, json: r.json };
  };
  return { api, calls };
}

const CTX = '{\n  "@context": {}\n}\n';
// declared-path-literal: the test's subject is this published context path itself, written as consumers see it.
const CTX_PATH = "ns/context/v1.jsonld";
const PATH = `/repos/o/r/contents/${CTX_PATH}`;
const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("publish", () => {
  test("identical content on gh-pages is unchanged, and nothing is written", async () => {
    const { api, calls } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 200 }],
      [`GET ${PATH}?ref=gh-pages`, { status: 200, json: { sha: "s1", encoding: "base64", content: b64(CTX) } }],
    ]);
    expect((await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX })).kind).toBe("unchanged");
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  test("different content is PUT with the file's sha, on gh-pages, and only that path", async () => {
    const { api, calls } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 200 }],
      [`GET ${PATH}?ref=gh-pages`, { status: 200, json: { sha: "s1", encoding: "base64", content: b64("old") } }],
      [`PUT ${PATH}`, { status: 200 }],
    ]);
    const out = await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX, sha: "abcdef0123456789" });
    expect(out.kind).toBe("updated");
    const body = calls.at(-1)!.body as Record<string, string>;
    expect(body).toMatchObject({ branch: "gh-pages", sha: "s1", content: b64(CTX) });
    expect(body.message).toContain("abcdef012345");
  });

  test("an absent file is added without a sha", async () => {
    const { api, calls } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 200 }],
      [`GET ${PATH}?ref=gh-pages`, { status: 404 }],
      [`PUT ${PATH}`, { status: 201 }],
    ]);
    expect((await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX })).kind).toBe("updated");
    expect((calls.at(-1)!.body as Record<string, unknown>).sha).toBeUndefined();
  });

  test("a 409 re-reads and retries once", async () => {
    const { api } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 200 }],
      [`GET ${PATH}?ref=gh-pages`, { status: 200, json: { sha: "s1", encoding: "base64", content: b64("old") } }],
      [`PUT ${PATH}`, { status: 409 }],
      [`GET ${PATH}?ref=gh-pages`, { status: 200, json: { sha: "s2", encoding: "base64", content: b64("older") } }],
      [`PUT ${PATH}`, { status: 200 }],
    ]);
    expect((await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX })).kind).toBe("updated");
  });

  test("an absent gh-pages becomes an orphan branch with .nojekyll, the context and the placeholder index", async () => {
    const { api, calls } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 404 }],
      ["POST /repos/o/r/git/trees", { status: 201, json: { sha: "t1" } }],
      ["POST /repos/o/r/git/commits", { status: 201, json: { sha: "c1c1c1c1" } }],
      ["POST /repos/o/r/git/refs", { status: 201 }],
    ]);
    const out = await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX });
    expect(out.kind).toBe("created-branch");
    const tree = (calls[1]!.body as { tree: Array<{ path: string; content: string }> }).tree;
    expect(Object.fromEntries(tree.map((e) => [e.path, e.content]))).toEqual({ ".nojekyll": "", "index.html": PLACEHOLDER_HTML, [CTX_PATH]: CTX });
    expect((calls[2]!.body as { parents: unknown[] }).parents).toEqual([]);
    expect(calls[3]!.body).toEqual({ ref: "refs/heads/gh-pages", sha: "c1c1c1c1" });
  });

  test("a gh-pages created meanwhile (422) is not overwritten: the file is written onto it", async () => {
    const { api } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 404 }],
      ["POST /repos/o/r/git/trees", { status: 201, json: { sha: "t1" } }],
      ["POST /repos/o/r/git/commits", { status: 201, json: { sha: "c1" } }],
      ["POST /repos/o/r/git/refs", { status: 422 }],
      [`GET ${PATH}?ref=gh-pages`, { status: 404 }],
      [`PUT ${PATH}`, { status: 201 }],
    ]);
    expect((await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX })).kind).toBe("updated");
  });

  test("a hash-IRI vocabulary file where the slash namespace needs a directory is removed, then the page written", async () => {
    const VOC = "v0/ns/index.html";
    const BLOCKED = { status: 409, json: { message: "Sorry, a file exists where you’re trying to create a subdirectory. Choose a new path and try again." } };
    const { api, calls } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 200 }],
      [`GET /repos/o/r/contents/${VOC}?ref=gh-pages`, { status: 404 }],
      [`PUT /repos/o/r/contents/${VOC}`, BLOCKED],
      ["GET /repos/o/r/contents/v0?ref=gh-pages", { status: 200, json: [{ path: "v0/ns" }] }],
      ["GET /repos/o/r/contents/v0/ns?ref=gh-pages", { status: 200, json: { sha: "old", encoding: "base64", content: b64('{"@id":"x#"}') } }],
      ["DELETE /repos/o/r/contents/v0/ns", { status: 200 }],
      [`GET /repos/o/r/contents/${VOC}?ref=gh-pages`, { status: 404 }],
      [`PUT /repos/o/r/contents/${VOC}`, { status: 201 }],
    ]);
    const out = await publishFile(api, { repo: "o/r", path: VOC, content: "<html></html>" });
    expect(out.kind).toBe("updated");
    expect(out.detail).toContain("removed the file v0/ns");
    expect(calls.find((c) => c.method === "DELETE")!.body).toMatchObject({ sha: "old", branch: "gh-pages" });
  });

  test("a blocking file that is not JSON is left for a person, and the write fails", async () => {
    const VOC = "v0/ns/index.html";
    const { api, calls } = fakeApi([
      ["GET /repos/o/r/branches/gh-pages", { status: 200 }],
      [`GET /repos/o/r/contents/${VOC}?ref=gh-pages`, { status: 404 }],
      [`PUT /repos/o/r/contents/${VOC}`, { status: 409, json: { message: "Sorry, a file exists where you're trying to create a subdirectory." } }],
      ["GET /repos/o/r/contents/v0?ref=gh-pages", { status: 200, json: [] }],
      ["GET /repos/o/r/contents/v0/ns?ref=gh-pages", { status: 200, json: { sha: "old", encoding: "base64", content: b64("<html>not json</html>") } }],
    ]);
    const out = await publishFile(api, { repo: "o/r", path: VOC, content: "<html></html>" });
    expect(out.kind).toBe("failed");
    expect(out.detail).toContain("left for a person");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  test("a failed read of the branch is a failure, never a guess", async () => {
    const { api } = fakeApi([["GET /repos/o/r/branches/gh-pages", { status: 403, json: { message: "Resource not accessible" } }]]);
    const out = await publishFile(api, { repo: "o/r", path: CTX_PATH, content: CTX });
    expect(out).toEqual({ kind: "failed", detail: expect.stringContaining("HTTP 403") });
  });
});

describe("build --site", () => {
  test("writes the context into a site being built, at the path it is served at", () => {
    const site = join(root, "_site-src");
    const r = Bun.spawnSync(["bun", "run", join(import.meta.dir, "../../publish-instance-context.ts"), "build", "--root", root, "--instance", "base", "--site", site]);
    expect(r.exitCode).toBe(0);
    const ctx = JSON.parse(readFileSync(join(site, CTX_PATH), "utf-8")) as { "@context": Record<string, unknown> };
    expect(ctx["@context"].skos).toBe("http://www.w3.org/2004/02/skos/core#");
  });
});

describe("writeVocabularyFiles — into a site being built (IRI fix 1A, d)", () => {
  const outcome = { paths: ["v0/ns", "v0/ns.html", "v0/ns/term/a.html"], termPages: { "v0/ns/term/a.html": "<a>" }, html: "<html>", content: "{}" };

  test("by default every path is written, with the workflow's .paths list", () => {
    const d = mkdtempSync(join(tmpdir(), "vocab-all-"));
    const r = writeVocabularyFiles(d, { ...outcome, paths: ["v0/ns.jsonld", "v0/ns.html"] });
    expect(r).toEqual({ written: ["v0/ns.jsonld", "v0/ns.html"], kept: [] });
    expect(readFileSync(join(d, ".paths"), "utf-8")).toBe("v0/ns.jsonld\nv0/ns.html\n");
    rmSync(d, { recursive: true, force: true });
  });

  test("--keep-existing leaves a richer document, and a directory where a file would go, alone", () => {
    const d = mkdtempSync(join(tmpdir(), "vocab-keep-"));
    // Core's glossary namespace document: the directory form, `v0/ns/index.html`.
    mkdirSync(join(d, "v0", "ns"), { recursive: true });
    writeFileSync(join(d, "v0", "ns", "index.html"), "core");
    writeFileSync(join(d, "v0", "ns.html"), "core page");
    const r = writeVocabularyFiles(d, outcome, true);
    expect(r).toEqual({ written: ["v0/ns/term/a.html"], kept: ["v0/ns", "v0/ns.html"] });
    expect(readFileSync(join(d, "v0", "ns.html"), "utf-8")).toBe("core page");
    expect(readFileSync(join(d, "v0", "ns", "term", "a.html"), "utf-8")).toBe("<a>");
    expect(() => readFileSync(join(d, ".paths"))).toThrow();
    rmSync(d, { recursive: true, force: true });
  });
});

describe("the declared namespace writer — one writer for v<major>/ns (IRI fix 1A, b/d)", () => {
  const built = { paths: ["v0/ns", "v0/ns.html", "v0/ns/term/a.html"], termPages: { "v0/ns/term/a.html": "<a>" }, html: "<html>", content: "{}" };
  const full = { "v0/ns/index.html": "<li id=\"glossary/s/t\">", "v0/ns/index.jsonld": "{\"@graph\":[]}", "v0/ns/index.json": "{\"@graph\":[]}" };

  test("the writer's document replaces the vocabulary's own ns files, which would collide with its directory; term pages stay", () => {
    expect(vocabularyFiles(built, full)).toEqual({ "v0/ns/term/a.html": "<a>", ...full });
  });

  test("no writer, or a writer that wrote nothing for this layer, leaves the vocabulary as it was", () => {
    const own = { "v0/ns": "{}", "v0/ns.html": "<html>", "v0/ns/term/a.html": "<a>" };
    expect(vocabularyFiles(built, undefined)).toEqual(own);
    expect(vocabularyFiles(built, {})).toEqual(own);
  });

  test("a layer that mints no terms of its own still gets the writer's document", () => {
    expect(vocabularyFiles(undefined, full)).toEqual(full);
    expect(vocabularyFiles(undefined, undefined)).toEqual({});
  });

  test("namespaceWriterFiles picks out v<major>/ns/index.* and nothing else the writer wrote", () => {
    const d = mkdtempSync(join(tmpdir(), "ns-files-"));
    for (const [p, c] of Object.entries({ ...full, "v1/ns/index.html": "v1", "glossary/index.html": "x", "v0/ns/other.html": "y", "assets/a.jsonld": "z" })) {
      mkdirSync(join(d, p, ".."), { recursive: true });
      writeFileSync(join(d, p), c);
    }
    expect(Object.keys(namespaceWriterFiles(d)).sort()).toEqual(["v0/ns/index.html", "v0/ns/index.json", "v0/ns/index.jsonld", "v1/ns/index.html"]);
    rmSync(d, { recursive: true, force: true });
  });

  test("runNamespaceWriter: undefined when no layer declares the script; runs it with --site and --instance; throws on failure", () => {
    expect(runNamespaceWriter(".", "x", undefined, () => false)).toBeUndefined();
    const calls: string[][] = [];
    const fake = ((cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      const site = args[args.indexOf("--site") + 1]!;
      mkdirSync(join(site, "v0", "ns"), { recursive: true });
      writeFileSync(join(site, "v0", "ns", "index.html"), "<doc>");
      return { status: 0 };
    }) as unknown as typeof import("node:child_process").spawnSync;
    expect(runNamespaceWriter(".", "dth-pc", fake, () => true)).toEqual({ "v0/ns/index.html": "<doc>" });
    expect(calls[0]![0]).toBe("bun");
    expect(calls[0]!.slice(3, 4)).toEqual([NAMESPACE_WRITER_SCRIPT]);
    expect(calls[0]!.slice(-2)).toEqual(["--instance", "dth-pc"]);
    const failing = (() => ({ status: 3 })) as unknown as typeof import("node:child_process").spawnSync;
    expect(() => runNamespaceWriter(".", "dth-pc", failing, () => true)).toThrow(/ns:document --instance dth-pc failed \(exit 3\)/);
  });

  test("writeSiteFiles lists what it wrote for the workflow, and keeps what a site already holds", () => {
    const d = mkdtempSync(join(tmpdir(), "site-files-"));
    expect(writeSiteFiles(d, full)).toEqual({ written: Object.keys(full), kept: [] });
    expect(readFileSync(join(d, ".paths"), "utf-8")).toBe(`${Object.keys(full).join("\n")}\n`);
    const e = mkdtempSync(join(tmpdir(), "site-keep-"));
    mkdirSync(join(e, "v0", "ns"), { recursive: true });
    writeFileSync(join(e, "v0", "ns", "index.html"), "site");
    expect(writeSiteFiles(e, full, true).kept).toEqual(["v0/ns/index.html"]);
    expect(readFileSync(join(e, "v0", "ns", "index.html"), "utf-8")).toBe("site");
    rmSync(d, { recursive: true, force: true });
    rmSync(e, { recursive: true, force: true });
  });
});
