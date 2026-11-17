/**
 * Local server Phase 2 (#1166): published IRIs open the local copy.
 *
 * The claim is about what a browser receives, so most cases go over a real
 * socket: a page whose links name `https://litlfred.github.io/<repo>/...`
 * must arrive with every link to a MOUNTED repo on 127.0.0.1, and every link
 * to an unmounted one untouched. The files on disk must not change.
 *
 * @module scripts/tests/ui/serve-rendering-iri.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { iriRewriter } from "../../lib/rendering-handler.js";
import { declaredIriOrigin, iriBasesFor, serveRendering } from "../../serve-rendering.js";

const PAGES = "https://litlfred.github.io";
let fa: string;
let dth: string;
let server: ReturnType<typeof serveRendering>;
let raw: ReturnType<typeof serveRendering>;
const local = (): string => `http://127.0.0.1:${server.port}`;
const url = (p: string): string => `${local()}${p}`;

const PAGE = `<!doctype html><title>p</title>
<a href="${PAGES}/folio-assistant/v0/ns#Thing">mounted</a>
<a href="${PAGES}/folio-assistant">mounted bare</a>
<a href="${PAGES}/dth/glossary.html">mounted dth</a>
<a href="${PAGES}/dth-pc/index.html">NOT mounted, prefix shares letters</a>
<a href="${PAGES}/smart-ra/">NOT mounted</a>
<a href="${PAGES}/folio-assistantx/">NOT a segment match</a>`;

function write(path: string, body: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

beforeAll(() => {
  fa = mkdtempSync(join(tmpdir(), "iri-fa-"));
  dth = mkdtempSync(join(tmpdir(), "iri-dth-"));
  write(join(fa, "index.html"), PAGE);
  write(join(fa, "v0", "ns.html"), "<title>ns page</title>");
  write(join(fa, "v0", "ns.jsonld"), JSON.stringify({ "@id": `${PAGES}/folio-assistant/v0/ns`, seeAlso: `${PAGES}/smart-ra/x` }));
  write(join(fa, "v0", "proc", "index.html"), "<title>proc page</title>");
  write(join(fa, "v0", "proc", "index.jsonld"), "{}");
  write(join(fa, "logo.png"), `${PAGES}/folio-assistant/ in a binary file`);
  write(join(dth, "glossary.html"), "<title>g</title>");

  const mounts = [
    { prefix: "/folio-assistant", dir: fa },
    { prefix: "/dth", dir: dth },
  ];
  const iriBases = iriBasesFor(mounts, PAGES);
  server = serveRendering({ mounts, port: 0, iriBases });
  raw = serveRendering({ mounts, port: 0, iriBases, rewrite: false });
});

afterAll(() => {
  server.stop(true);
  raw.stop(true);
  rmSync(fa, { recursive: true, force: true });
  rmSync(dth, { recursive: true, force: true });
});

describe("links in a served page", () => {
  test("every link to a mounted repo stays on 127.0.0.1", async () => {
    const res = await fetch(url("/folio-assistant/"));
    expect(res.headers.get("x-rendering-rewritten")).toBe("iri");
    const hrefs = [...(await res.text()).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([
      `${local()}/folio-assistant/v0/ns#Thing`,
      `${local()}/folio-assistant`,
      `${local()}/dth/glossary.html`,
      `${PAGES}/dth-pc/index.html`,
      `${PAGES}/smart-ra/`,
      `${PAGES}/folio-assistantx/`,
    ]);
  });

  test("the file on disk is unchanged", () => {
    expect(readFileSync(join(fa, "index.html"), "utf-8")).toBe(PAGE);
  });

  test("JSON-LD @id values are rewritten too", async () => {
    const body = await (await fetch(url("/folio-assistant/v0/ns.jsonld"))).json();
    expect(body["@id"]).toBe(`${local()}/folio-assistant/v0/ns`);
    expect(body.seeAlso).toBe(`${PAGES}/smart-ra/x`);
  });

  test("a binary file is sent as published", async () => {
    const res = await fetch(url("/folio-assistant/logo.png"));
    expect(res.headers.get("x-rendering-rewritten")).toBeNull();
    expect(await res.text()).toContain(PAGES);
  });

  test("--no-rewrite serves the published bytes", async () => {
    const res = await fetch(`http://127.0.0.1:${raw.port}/folio-assistant/`);
    expect(res.headers.get("x-rendering-rewritten")).toBeNull();
    expect(await res.text()).toBe(PAGE);
  });
});

describe("an IRI asked for as JSON-LD", () => {
  test("an extensionless IRI with Accept: application/ld+json serves its .jsonld", async () => {
    const res = await fetch(url("/folio-assistant/v0/ns"), { headers: { Accept: "application/ld+json" } });
    expect(res.headers.get("content-type")).toBe("application/ld+json");
    expect(res.headers.get("vary")).toBe("Accept");
  });

  test("a directory IRI serves index.jsonld", async () => {
    const res = await fetch(url("/folio-assistant/v0/proc/"), { headers: { Accept: "application/ld+json" } });
    expect(res.headers.get("content-type")).toBe("application/ld+json");
  });

  test("a browser's Accept still gets the page, as on Pages", async () => {
    const res = await fetch(url("/folio-assistant/v0/ns"), {
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(await res.text()).toContain("ns page");
  });

  test("HTML preferred over JSON-LD by q-value gets the page", async () => {
    const res = await fetch(url("/folio-assistant/v0/ns"), { headers: { Accept: "application/ld+json;q=0.5, text/html" } });
    expect(await res.text()).toContain("ns page");
  });
});

describe("the rewriter", () => {
  const r = iriRewriter([{ from: `${PAGES}/a`, prefix: "/a" }, { from: `${PAGES}/a/b`, prefix: "/b" }], "http://127.0.0.1:4007");

  test("the longest base wins", () => {
    expect(r(`${PAGES}/a/b/x`)).toBe("http://127.0.0.1:4007/b/x");
    expect(r(`${PAGES}/a/c`)).toBe("http://127.0.0.1:4007/a/c");
  });

  test.each(["?q=1", "#frag", '"', "'", ")", " ", "<", ",", "&amp;"])("a base followed by %p is rewritten", (tail) => {
    expect(r(`${PAGES}/a${tail}`)).toBe(`http://127.0.0.1:4007/a${tail}`);
  });

  test("a base that is only the start of a longer segment is not", () => {
    expect(r(`${PAGES}/ab/x`)).toBe(`${PAGES}/ab/x`);
  });

  test("no bases is the identity", () => {
    expect(iriRewriter([], "http://x")("anything")).toBe("anything");
  });
});

describe("where the bases come from", () => {
  test("one base per prefixed mount, none for a root mount", () => {
    const bases = iriBasesFor(
      [
        { prefix: "/", dir: "." },
        { prefix: "/fa", dir: "." },
      ],
      `${PAGES}/`,
    );
    expect(bases).toEqual([{ from: `${PAGES}/fa`, prefix: "/fa" }]);
  });

  test("no origin means no automatic bases, explicit ones still apply", () => {
    expect(iriBasesFor([{ prefix: "/fa", dir: "." }], undefined, [{ from: "https://w3id.org/x", prefix: "/fa" }])).toEqual([
      { from: "https://w3id.org/x", prefix: "/fa" },
    ]);
  });

  test("the declared canonicalUrl gives the origin", () => {
    const dir = mkdtempSync(join(tmpdir(), "iri-decl-"));
    writeFileSync(join(dir, "cat-harness.json"), JSON.stringify({ name: "cat-harness", canonicalUrl: `${PAGES}/folio-assistant` }));
    try {
      expect(declaredIriOrigin([dir])).toBe(PAGES);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no declaration gives no origin", () => {
    const dir = mkdtempSync(join(tmpdir(), "iri-none-"));
    try {
      expect(declaredIriOrigin([dir])).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
