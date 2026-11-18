#!/usr/bin/env node
/**
 * Static file server for Playwright end-to-end tests.
 *
 * `playwright.config.ts` has always declared a `webServer` command pointing at
 * a `test-server` module, and that file was never committed — not deleted,
 * never written. So `bunx playwright test`, a documented command in
 * AGENTS.md, died with MODULE_NOT_FOUND before collecting a single test, and
 * no end-to-end test in this repository has ever been runnable. Bean `dzl3`.
 *
 * ## What it serves, and why the repo root
 *
 * The root, so a spec can reach `/ui/index.html`, `/viewer/index.html` or a
 * built `/​_site/...` without this file having to guess which one matters.
 * Picking a single subtree would have made exactly one kind of spec possible
 * and quietly ruled out the rest. Override with `TEST_SERVER_ROOT`.
 *
 * The file itself lives in `cat-harness/test/` beside the specs it serves
 * (moved off the repository root 2026-10-06, bean `ar1s`, phase 3), so the
 * default root is TWO levels up from here, not this directory. Serving
 * `cat-harness/test/` would have made every spec's `/cat-harness/...` fetch a
 * 404 that reads as a broken page rather than a misplaced server.
 *
 * Port 8080 matches `playwright.config.ts`'s `baseURL` and the viewer port in
 * `folio.config.example.json`. Override with `PORT`.
 *
 * ## It is a server, so it refuses to serve outside its root
 *
 * A request path is resolved and then checked to still sit under the root
 * before anything is read. Without that, `GET /../../etc/passwd` reads
 * whatever the test runner can read. It is only ever bound to loopback and
 * only started by the test runner, but a traversal bug in a test fixture is
 * still a traversal bug, and this costs three lines.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM, not CommonJS, and the extension is `.mjs` for the same reason: the
// repo's eslint forbids `require()` (@typescript-eslint/no-require-imports),
// and a `.cjs` file cannot avoid it. Weakening that rule for a whole extension
// to admit one file is a worse trade than writing the file in the module
// system everything else here already uses.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.TEST_SERVER_ROOT || path.join(HERE, "..", ".."));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonld": "application/ld+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-store" }, headers || {}));
  res.end(body);
}

/**
 * THE ONE DEPLOY-TIME MOUNT A COMMITTED PAGE REACHES INTO (bean `2vpn`).
 *
 * This serves the repository as it is committed, and `mount-instance-docs`
 * runs only in the site build: it publishes a layer's `docs/` site
 * directory at the `docs` kind's route, `<site>/docs/<instance>/`. A committed
 * page that links an asset there — who-iris's WHO emblem in every navbar
 * header and harness row, since its mark is resolved through that route —
 * therefore 404s here while the deployed page serves it. So a request under
 * the platform site's `docs/<instance>/` that names no committed file falls
 * back to `<instance>/docs/`, which is what the build mounts there. A
 * committed file always wins, the fallback is checked to stay under ROOT, and
 * only that one route is emulated: anything else still 404s, as it should.
 */
/**
 * THE LAYER OUTPUT OVERLAY (bean `cat-tools-sm8r`, item 4). A mounted layer
 * is read-only: the pages and data the build COMPUTES for it are written to
 * `build/layers/<instance>/<the same instance-relative path>`, and a reader
 * reads that twin first, else the pinned bytes. `scripts/lib/layer-output.ts`
 * is the one answer; this file runs under plain `node` and cannot import
 * TypeScript, so the rule is restated here: the instances `index.lock.json`
 * lists with a mount path, and the twin under `LAYER_OUTPUT_ROOT`.
 */
const LAYER_OUTPUT_ROOT = "build/layers";
const MOUNTED = (() => {
  const out = [];
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "index.lock.json"), "utf8"));
    for (const i of lock?.instances ?? []) {
      if (typeof i?.instance === "string" && typeof i?.path === "string" && i.path !== "") {
        out.push({ instance: i.instance, dir: path.resolve(ROOT, i.path) });
      }
    }
  } catch {
    // No lock, or an unreadable one: nothing is mounted, so nothing is overlaid.
  }
  return out;
})();

/** The output-root twin of `abs` when it is a FILE there, else undefined. */
function overlayFile(abs) {
  for (const m of MOUNTED) {
    if (!abs.startsWith(m.dir + path.sep)) continue;
    const twin = path.join(ROOT, LAYER_OUTPUT_ROOT, m.instance, path.relative(m.dir, abs));
    try {
      if (fs.statSync(twin).isFile()) return twin;
    } catch {
      // not computed for this layer
    }
  }
  return undefined;
}

/** `abs` read through the overlay: its twin when that is a file, else `abs`. */
const overlaid = (abs) => overlayFile(abs) ?? abs;

/** Whether `abs` is a file, asked through the overlay. */
function isFileOverlaid(abs) {
  try {
    return fs.statSync(overlaid(abs)).isFile();
  } catch {
    return false;
  }
}

const SITE_ROOT = "/cat-harness/docs";
// A layer's site directory, relative to the layer root. The one answer is
// `siteDir()` in cat-harness/schemas/cat-harness.ts; this file runs under plain
// `node` (playwright's webServer) and cannot import TypeScript, so it names the
// value once here rather than inline at each use.
const INSTANCE_SITE_DIR = "docs";
function mountedPath(pathname) {
  const m = new RegExp(`^${SITE_ROOT}/docs/([a-z0-9][a-z0-9-]*)/(.*)$`).exec(pathname);
  if (!m) return undefined;
  const candidate = path.resolve(ROOT, m[1], INSTANCE_SITE_DIR, m[2]);
  if (!candidate.startsWith(path.join(ROOT, m[1], INSTANCE_SITE_DIR) + path.sep)) return undefined;
  return isFileOverlaid(candidate) ? overlaid(candidate) : undefined;
}

/**
 * THE COMPOSED ROUTE, emulated the same way. `compose-docs.ts` lays a
 * layer's directory declared `composed: true` into the site's Jekyll source
 * under the layer's name, so `<site>/<instance>/<rest>` is
 * `<instance>/<that directory>/<rest>` — where a page of a docs source above
 * the base, and its site JSON-LD (`gen-site-jsonld.ts`, the `@id` a todo's
 * `target` names), are published. The build composes; this server serves the
 * checkout, so a request there that names no committed file falls back to the
 * declared directory. Read from the layer's own declaration, plain JSON,
 * and checked to stay under that directory; nothing else is emulated.
 */
function composedPath(pathname) {
  const m = new RegExp(`^${SITE_ROOT}/([a-z0-9][a-z0-9-]*)/(.+)$`).exec(pathname);
  if (!m) return undefined;
  let decl;
  try {
    decl = JSON.parse(fs.readFileSync(path.join(ROOT, m[1], `${m[1]}.json`), "utf8"));
  } catch {
    return undefined;
  }
  if (decl?.name !== m[1]) return undefined;
  for (const d of decl.directories ?? []) {
    if (d?.composed !== true || typeof d.path !== "string") continue;
    const dir = path.resolve(ROOT, m[1], d.path);
    const candidate = path.resolve(dir, m[2]);
    if (!candidate.startsWith(dir + path.sep)) continue;
    if (isFileOverlaid(candidate)) return overlaid(candidate);
  }
  return undefined;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname);
  } catch {
    // A malformed percent-escape is a bad request, not a crash.
    return send(res, 400, "Bad Request", { "Content-Type": "text/plain" });
  }

  // Resolve first, then confirm it is still inside ROOT. Checking the raw
  // string for ".." is not enough — encodings and symlinks get past that.
  let filePath = path.resolve(ROOT, "." + pathname);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, "Forbidden", { "Content-Type": "text/plain" });
  }

  // A computed file the build wrote at the layer output root wins over the
  // pinned bytes, as it does for every reader (see overlayFile).
  filePath = overlaid(filePath);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    // A directory the build wrote only at the output root: its index there.
    const builtIndex = overlayFile(path.join(filePath, "index.html"));
    const mounted = builtIndex ?? mountedPath(pathname) ?? composedPath(pathname);
    if (mounted === undefined) {
      return send(res, 404, `Not found: ${pathname}`, { "Content-Type": "text/plain" });
    }
    filePath = mounted;
    stat = fs.statSync(filePath);
  }

  if (stat.isDirectory()) {
    const index = overlaid(path.join(filePath, "index.html"));
    if (!fs.existsSync(index)) {
      return send(res, 404, `No index.html in ${pathname}`, { "Content-Type": "text/plain" });
    }
    filePath = index;
    stat = fs.statSync(filePath);
  }

  const type = TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`test-server: serving ${ROOT} at http://${HOST}:${PORT}`);
});

// Playwright sends SIGTERM when the run ends; exit promptly so a test run does
// not hang on a lingering handle.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
