/**
 * Local server Phase 1: several sites on one origin, laid out the way GitHub
 * Pages lays them out, with the Pages behaviours links depend on.
 *
 * Real HTTP against a bound socket for what a browser receives, plus direct
 * calls of the portable handler for the host-name cases a socket on 127.0.0.1
 * cannot produce.
 *
 * @module scripts/tests/ui/serve-rendering-mounts.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRenderingHandler, matchMount, normalizeMounts } from "../../lib/rendering-handler.js";
import { DEFAULT_PORT, nextPrimePort, parseMount, serveRendering } from "../../serve-rendering.js";

let a: string;
let b: string;
let sub: string;
let outside: string;
let server: ReturnType<typeof serveRendering>;
const url = (p: string): string => `http://127.0.0.1:${server.port}${p}`;

function write(path: string, body: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

beforeAll(() => {
  a = mkdtempSync(join(tmpdir(), "mount-a-"));
  b = mkdtempSync(join(tmpdir(), "mount-b-"));
  sub = mkdtempSync(join(tmpdir(), "mount-sub-"));
  outside = mkdtempSync(join(tmpdir(), "mount-outside-"));
  write(join(a, "index.html"), "<title>site a</title>");
  write(join(a, "about.html"), "<title>about a</title>");
  write(join(a, "404.html"), "<title>a missing</title>");
  write(join(a, "doc.jsonld"), '{"@context":{}}');
  write(join(a, "STAGING", "claude-x", "index.html"), "<title>preview x</title>");
  write(join(a, "guide", "index.html"), "<title>guide</title>");
  write(join(b, "index.html"), "<title>site b</title>");
  write(join(sub, "index.html"), "<title>nested</title>");
  write(join(outside, "secret.txt"), "never served");
  symlinkSync(join(outside, "secret.txt"), join(a, "escape.txt"));

  server = serveRendering({
    mounts: [
      { prefix: "/a", dir: a },
      { prefix: "/b/", dir: b },
      { prefix: "/a/nested", dir: sub },
    ],
    port: 0,
  });
});

afterAll(() => {
  server.stop(true);
  for (const d of [a, b, sub, outside]) rmSync(d, { recursive: true, force: true });
});

describe("several sites under /<repo>/", () => {
  test.each([
    ["/a/", "site a"],
    ["/b/", "site b"],
    ["/a/nested/", "nested"],
    ["/a/STAGING/claude-x/", "preview x"],
  ])("%s serves its own site", async (path, title) => {
    const res = await fetch(url(path));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(title);
  });

  test("declared media types still win inside a mount", async () => {
    const res = await fetch(url("/a/doc.jsonld"));
    expect(res.headers.get("content-type")).toBe("application/ld+json");
  });

  test("the root lists the mounts when nothing is mounted at /", async () => {
    const res = await fetch(url("/"));
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const p of ["/a/", "/b/", "/a/nested/"]) expect(html).toContain(`href="${p}"`);
  });

  test("an unmounted prefix is 404", async () => {
    expect((await fetch(url("/c/"))).status).toBe(404);
  });

  test("a symlink out of a mount is still refused", async () => {
    expect((await fetch(url("/a/escape.txt"))).status).toBe(404);
  });
});

describe("the Pages behaviours links depend on", () => {
  test.each([
    ["/a", "/a/"],
    ["/a/guide", "/a/guide/"],
  ])("%s redirects to %s", async (path, to) => {
    const res = await fetch(url(path), { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(new URL(res.headers.get("location")!).pathname).toBe(to);
  });

  test("an extensionless page serves its .html", async () => {
    const res = await fetch(url("/a/about"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("about a");
  });

  test("a miss serves the site's own 404.html with status 404", async () => {
    const res = await fetch(url("/a/no-such-page"));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("a missing");
  });

  test("a site with no 404.html gets a plain 404", async () => {
    const res = await fetch(url("/b/no-such-page"));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found\n");
  });

  test("HEAD answers without a body", async () => {
    const res = await fetch(url("/a/"), { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  test("other methods are 405", async () => {
    expect((await fetch(url("/a/"), { method: "POST" })).status).toBe(405);
  });
});

describe("one origin, not two", () => {
  const handler = (): ((r: Request) => Response) =>
    createRenderingHandler({ mounts: [{ prefix: "/a", dir: a }], canonicalHost: "127.0.0.1" });

  test.each(["localhost", "[::1]"])("a request naming %s is sent to 127.0.0.1 on the same port", (host) => {
    const res = handler()(new Request(`http://${host}:${DEFAULT_PORT}/a/about?x=1`));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(`http://127.0.0.1:${DEFAULT_PORT}/a/about?x=1`);
  });

  test("a request already on 127.0.0.1 is served, not redirected", () => {
    expect(handler()(new Request(`http://127.0.0.1:${DEFAULT_PORT}/a/`)).status).toBe(200);
  });

  test("without canonicalHost nothing is redirected", () => {
    const h = createRenderingHandler({ mounts: [{ prefix: "/a", dir: a }] });
    expect(h(new Request("http://localhost:1/a/")).status).toBe(200);
  });
});

describe("mount table", () => {
  test("longest prefix first, root last", () => {
    const m = normalizeMounts([
      { prefix: "/", dir: "." },
      { prefix: "/x", dir: "." },
      { prefix: "/x/y/", dir: "." },
    ]);
    expect(m.map((x) => x.prefix)).toEqual(["/x/y", "/x", "/"]);
  });

  test("a prefix matches whole segments only", () => {
    const m = normalizeMounts([{ prefix: "/dth", dir: "." }]);
    expect(matchMount(m, "/dth-pc/")).toBeUndefined();
    expect(matchMount(m, "/dth/x")?.rest).toBe("/x");
  });

  test.each(["/..", "/a/../b", "/a/./b"])("a bad prefix %s is refused", (prefix) => {
    expect(() => normalizeMounts([{ prefix, dir: "." }])).toThrow();
  });

  test("the same prefix twice is refused", () => {
    expect(() => normalizeMounts([{ prefix: "/a", dir: "." }, { prefix: "/a/", dir: "." }])).toThrow();
  });

  test("--mount parses /<prefix>=<dir>, keeping = inside the dir", () => {
    expect(parseMount("/dth-pc=../site=x")).toEqual({ prefix: "/dth-pc", dir: "../site=x" });
    expect(() => parseMount("no-equals")).toThrow();
    expect(() => parseMount("/a=")).toThrow();
  });
});

describe("ports", () => {
  test("the default is the prime 4007, clear of jekyll serve's 4000", () => {
    expect(DEFAULT_PORT).toBe(4007);
  });

  test("a taken port suggests the next prime", () => {
    expect(nextPrimePort(4000)).toBe(4001);
    expect(nextPrimePort(4007)).toBe(4013);
    expect(nextPrimePort(65535)).toBeUndefined();
  });
});

describe("portability", () => {
  test("the handler names no Bun API, so a Node launcher can reuse it", () => {
    // The owner's runtime choice (2026-10-31, "B. Bun + Node-portable core")
    // is a property of the source, so assert it on the source.
    const src = readFileSync(join(import.meta.dirname, "..", "..", "lib", "rendering-handler.ts"), "utf-8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bBun\./);
    expect(code).not.toMatch(/from\s+["']bun(:\w+)?["']/);
  });
});
