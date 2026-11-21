/**
 * The rendering server: declared media types, the directory-index rule, and
 * containment.
 *
 * **These are real HTTP requests against a real bound socket**, not assertions
 * about a resolver. The claim `serving-renderings.md` makes is about what a
 * client RECEIVES — "a client fetching `<stub>.jsonld` from Pages will receive
 * the wrong `Content-Type`" — and a unit test of a lookup table cannot fail
 * when the header is dropped between the table and the wire.
 *
 * Bean `folio-assistant-0hi8`.
 *
 * @module scripts/tests/serve-rendering.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RENDERING_MEDIA_TYPES, renderingMediaType } from "../../../schemas/kg/cat-harness.js";
import { resolveFile, resolveWithin, serveRendering } from "../../serve-rendering.js";

let root: string;
let secret: string;
let server: ReturnType<typeof serveRendering>;
const url = (p: string): string => `http://127.0.0.1:${server.port}${p}`;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "serve-rendering-"));
  writeFileSync(join(root, "folio-assistant.jsonld"), '{"@context":{}}');
  writeFileSync(join(root, "folio-assistant.json"), '{"@context":{}}');
  writeFileSync(join(root, "folio-assistant.schema.json"), '{"$schema":"x"}');
  writeFileSync(join(root, "notes.txt"), "plain");
  mkdirSync(join(root, "folio-assistant"));
  writeFileSync(join(root, "folio-assistant", "index.html"), "<!doctype html><title>viewer</title>");

  // Outside the served root, to prove containment rather than assume it.
  secret = mkdtempSync(join(tmpdir(), "serve-rendering-outside-"));
  writeFileSync(join(secret, "secret.txt"), "should never be served");

  server = serveRendering({ dir: root, port: 0 });
});

afterAll(() => {
  server.stop(true);
  rmSync(root, { recursive: true, force: true });
  rmSync(secret, { recursive: true, force: true });
});

describe("the media-type table", () => {
  test("`.schema.json` beats `.json` — the row that earns the table", () => {
    // The ONLY thing an ordinary static server gets wrong here. Measured
    // 2026-09-19: python mimetypes and Bun both already resolve .jsonld
    // correctly, and both resolve .schema.json to application/json.
    expect(renderingMediaType("x.schema.json")).toBe("application/schema+json");
    expect(renderingMediaType("x.json")).toBe("application/json");
  });

  test("the compound extension is listed before its own suffix", () => {
    // Order is the mechanism, so assert the order and not only its effect —
    // a reordering that happened to keep this test green is the regression.
    const exts = RENDERING_MEDIA_TYPES.map(([e]) => e);
    expect(exts.indexOf(".schema.json")).toBeLessThan(exts.indexOf(".json"));
  });

  test("an undeclared extension is undefined, not a guess", () => {
    expect(renderingMediaType("notes.txt")).toBeUndefined();
    expect(renderingMediaType("archive.tar.gz")).toBeUndefined();
  });
});

describe("what a client actually receives", () => {
  test.each([
    ["/folio-assistant.jsonld", "application/ld+json"],
    ["/folio-assistant.json", "application/json"],
    ["/folio-assistant.schema.json", "application/schema+json"],
  ])("%s is served as %s", async (path, expected) => {
    const res = await fetch(url(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(expected);
  });

  test("the bare stub resolves to the viewer, as text/html", async () => {
    // Pages resolves `<base>/<stub>` only to a directory index, which is why
    // the viewer is a directory at all. A local server that 404s here would
    // make the two hosts disagree about a URL the docs print.
    const res = await fetch(url("/folio-assistant/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
  });

  test("an undeclared file keeps the server's own inference, not octet-stream", async () => {
    const res = await fetch(url("/notes.txt"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  test("a missing path is 404", async () => {
    expect((await fetch(url("/nope.jsonld"))).status).toBe(404);
  });
});

describe("containment", () => {
  // These assert the PROPERTY — nothing outside the root reaches a client —
  // and not the mechanism. An earlier draft asserted `resolveWithin` returned
  // `undefined` for `/../../etc/passwd`; it does not, and need not. A URL
  // pathname always starts with `/`, so `normalize` absorbs the `..` against
  // the root and the result is a path INSIDE it that happens not to exist.
  // That is safe, and a test demanding rejection would have pinned an
  // implementation detail while missing the case that was actually broken.
  test.each([
    ["plain", "/../../etc/passwd"],
    ["percent-encoded", "/%2e%2e/%2e%2e/etc/passwd"],
    ["mixed separators", "/..//..//etc/passwd"],
  ])("%s traversal does not escape the root", (_label, path) => {
    const within = resolveWithin(root, path);
    if (within !== undefined) expect(within.startsWith(root)).toBe(true);
    expect(resolveFile(root, path)).toBeUndefined();
  });

  test("traversal over the wire is 404", async () => {
    expect((await fetch(url("/%2e%2e/%2e%2e/etc/passwd"))).status).toBe(404);
  });

  test("a symlink pointing outside the root is refused", async () => {
    // THE CASE THAT WAS ACTUALLY BROKEN, and the reason this suite exists.
    // The first implementation returned 200 here: the URL is clean, so the
    // lexical check passes, and `resolve()` never touches the filesystem —
    // the escape happens entirely in the link. Only comparing real paths
    // catches it.
    symlinkSync(join(secret, "secret.txt"), join(root, "escape.txt"));
    const res = await fetch(url("/escape.txt"));
    expect(res.status).toBe(404);
    expect(resolveFile(root, "/escape.txt")).toBeUndefined();
  });

  test("a symlink staying inside the root still works", async () => {
    // The other half: refusing every link would be a different bug. A link
    // is a normal way to lay out a published tree.
    symlinkSync(join(root, "folio-assistant.jsonld"), join(root, "alias.jsonld"));
    const res = await fetch(url("/alias.jsonld"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/ld+json");
  });

  test("a broken symlink is 404 rather than a crash", async () => {
    symlinkSync(join(root, "no-such-target.jsonld"), join(root, "dangling.jsonld"));
    expect((await fetch(url("/dangling.jsonld"))).status).toBe(404);
  });

  test("a directory with no index is 404, not a listing", () => {
    mkdirSync(join(root, "empty-dir"), { recursive: true });
    expect(resolveFile(root, "/empty-dir")).toBeUndefined();
  });

  test("a malformed percent-escape names no file", () => {
    expect(resolveWithin(root, "/%zz")).toBeUndefined();
  });
});
