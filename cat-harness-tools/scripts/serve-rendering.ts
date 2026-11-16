/**
 * Serve a layer's renderings over local HTTP, with their DECLARED media
 * types.
 *
 * `skills/ui/ui-core/serving-renderings.md` settles the contract — four
 * endpoints under the layer's stub, the media type each declares, and the
 * three enforcement states per host — and names no server; this is one. It
 * is the publication host for every topology in
 * `docs/proposals/deployment-topologies.md` whose `publication host` axis is
 * not `github-pages` — local git only, private repo, developer and
 * self-sovereign.
 *
 * ## What this adds over `python3 -m http.server`
 *
 * One row. Plain static servers already resolve `.jsonld` to
 * `application/ld+json`, but **`.schema.json` infers as `application/json`**
 * from every OS table. `RENDERING_MEDIA_TYPES` is ordered longest-first so
 * the compound extension wins, and this server reads that table rather than
 * the filesystem's.
 *
 * ## Two behaviours that are contract, not convenience
 *
 * - **`<stub>/` resolves to its directory index**, as on GitHub Pages, so
 *   both hosts agree about a URL the documentation prints.
 * - **An unknown path falls back to Bun's own inference**, never to
 *   `application/octet-stream`. The table's `undefined` means "the
 *   declaration says nothing about this file", not "this file has no type".
 *
 * ```sh
 * bun run cat-harness-tools/scripts/serve-rendering.ts --dir <site> --port 4007
 * ```
 *
 * ## Several sites at once
 *
 * `--mount /<repo>=<dir>` (repeatable) serves each built site under its own
 * prefix on one origin, as GitHub Pages does, so root-relative links and IRI
 * paths line up. The request logic lives in `lib/rendering-handler.ts`,
 * written against web-standard `Request`/`Response` only so a Node launcher
 * can reuse it; this file is the Bun launcher.
 *
 * Default port **4007** (not 4000, which `jekyll serve` uses). Default host
 * 127.0.0.1; with the CLI, `localhost` and `[::1]` requests are redirected
 * there so browser state is never split across two origins.
 *
 * ```sh
 * bun run cat-harness-tools/scripts/serve-rendering.ts --mount /folio-assistant=../gh-pages/folio-assistant --mount /dth-pc=../dth-pc-pages
 * ```
 *
 * @module scripts/serve-rendering
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { declarationPathIn, siteDirFor } from "../schemas/kg/cat-harness.js";
import { createRenderingHandler, type IriBase, type Mount } from "./lib/rendering-handler";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The default port: a prime near 4000 that leaves 4000 to `jekyll serve`. */
export const DEFAULT_PORT = 4007;

export interface ServeOptions {
  /** Directory to serve at `/`. Optional when `mounts` are given. */
  dir?: string;
  /** More sites, each under its own prefix (`/<repo>`). */
  mounts?: readonly Mount[];
  /** Port; 0 asks the OS for a free one, which is what the tests use. */
  port?: number;
  /** Host interface. Loopback by default — see `serveRendering`. */
  hostname?: string;
  /** Redirect `localhost` / `[::1]` requests to the bound loopback IP. */
  canonicalHost?: string;
  /** Published bases to rewrite to the local origin (Phase 2). */
  iriBases?: readonly IriBase[];
  /** `false` serves bytes as published. Default true. */
  rewrite?: boolean;
}

// `resolveWithin` now lives in `src/core/safe-path.ts` and is re-exported here
// so this module's existing importers and tests keep working. It moved because
// three HTTP handlers in the MCP server hand-rolled `join(base, external)`
// while the correct helper sat in this one script — bean `6bhf`.
// `resolveFile` moved to `lib/rendering-handler.ts` with the rest of the
// portable request logic, and is re-exported for the same reason.
export { resolveWithin } from "../src/core/safe-path";
export { resolveFile } from "./lib/rendering-handler";

/** Every mount the options name: `dir` at `/`, then the prefixed ones. */
export function mountsOf(opts: ServeOptions): Mount[] {
  const mounts: Mount[] = [];
  if (opts.dir !== undefined) mounts.push({ prefix: "/", dir: opts.dir });
  mounts.push(...(opts.mounts ?? []));
  if (mounts.length === 0) throw new Error("serve-rendering: nothing to serve (give --dir or --mount)");
  return mounts;
}

/**
 * Start the server. Returns the Bun server, whose `.port` is the bound port —
 * read it rather than assuming, since `port: 0` is the tested path.
 *
 * **Binds loopback by default.** This serves whatever directory it is pointed
 * at, and the topologies that need it most are the ones with the strongest
 * reason not to be reachable from the network: `self-sovereign` is
 * `outward facing: no` by definition. Exposing it is opt-in via `hostname`.
 */
export function serveRendering(opts: ServeOptions): ReturnType<typeof Bun.serve> {
  const fetch = createRenderingHandler({
    mounts: mountsOf(opts),
    canonicalHost: opts.canonicalHost,
    iriBases: opts.iriBases,
    rewrite: opts.rewrite,
    // `undefined` from the declaration is the third state: defer to Bun's
    // inference for an ordinary asset rather than asserting a type the
    // declaration never made. Only a DECLARED type overrides.
    inferType: (file) => Bun.file(file).type || undefined,
    openBody: (file) => Bun.file(file),
  });
  return Bun.serve({ port: opts.port ?? DEFAULT_PORT, hostname: opts.hostname ?? "127.0.0.1", fetch });
}

/**
 * The next prime above `port`, to suggest when it is taken. Ports stay prime
 * by the same choice that picked 4007; 65535 is the ceiling.
 */
export function nextPrimePort(port: number): number | undefined {
  const prime = (n: number): boolean => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  for (let n = port + 1; n <= 65535; n++) if (prime(n)) return n;
  return undefined;
}

/**
 * The published bases for a set of mounts: `<origin><prefix>` for every
 * prefixed mount, then any given explicitly. A root mount gets no automatic
 * base, since `<origin>/` would claim every repo on the host.
 */
export function iriBasesFor(mounts: readonly Mount[], origin: string | undefined, extra: readonly IriBase[] = []): IriBase[] {
  const o = origin?.replace(/\/+$/, "");
  const auto = o ? mounts.filter((m) => m.prefix.replace(/\/+$/, "") !== "").map((m) => ({ from: `${o}${m.prefix.replace(/\/+$/, "")}`, prefix: m.prefix.replace(/\/+$/, "") })) : [];
  return [...auto, ...extra];
}

/**
 * The origin IRIs are published under, read from a declaration's
 * `canonicalUrl` (the working layer first, then the harness). Undefined
 * when neither declares one, and then nothing is rewritten unless asked.
 */
export function declaredIriOrigin(dirs: readonly string[] = [process.cwd(), HARNESS_ROOT]): string | undefined {
  for (const dir of dirs) {
    try {
      const p = declarationPathIn(dir);
      if (!p || !existsSync(p)) continue;
      const url = (JSON.parse(readFileSync(p, "utf-8")) as { canonicalUrl?: string }).canonicalUrl;
      if (url) return new URL(url).origin;
    } catch {
      // Unreadable or not a URL: try the next.
    }
  }
  return undefined;
}

/**
 * Parse `--mount /<prefix>=<dir>`. The prefix is checked again, segment by
 * segment, when the handler is built.
 */
export function parseMount(arg: string): Mount {
  const eq = arg.indexOf("=");
  if (eq <= 0 || eq === arg.length - 1) throw new Error(`serve-rendering: --mount wants /<prefix>=<dir>, got: ${arg}`);
  return { prefix: arg.slice(0, eq), dir: arg.slice(eq + 1) };
}

/**
 * The directory to serve when neither `--dir` nor `--mount` is given.
 *
 * **The site root is `siteDirFor`'s answer, never a literal.** The first draft
 * of this file wrote `docs/_site`, which was wrong twice over: hardcoded, and
 * naming a directory that had already stopped being the site root when the
 * build moved to `docs/<stub>` for the repo split. `site-dir-single-answer`
 * (bean `x4a6`) landed on `main` while this was in review and caught it.
 *
 * `siteDirFor` **throws** when the declaration cannot be read. Here nothing is
 * written, and the caller sees the resolved path printed, so an unreadable
 * declaration falls back to the working directory rather than refusing to
 * start.
 */
function defaultDir(): string {
  try {
    const site = siteDirFor(process.cwd());
    if (existsSync(site)) return site;
  } catch {
    // No declaration, or a nameless one. Fall through.
  }
  return ".";
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const flags = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));

  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      `Serve an instance's renderings with their declared media types.\n\n` +
        `  bun run cat-harness-tools/scripts/serve-rendering.ts [--dir <path>] [--mount /<repo>=<dir>]... [--port <n>] [--host <iface>]\n\n` +
        `  --dir    directory to serve at / (default: the declared site root, else .)\n` +
        `  --mount  serve <dir> under /<repo>, as GitHub Pages lays sites out; repeatable\n` +
        `  --port   port to bind (default ${DEFAULT_PORT})\n` +
        `  --iri-origin <url>       where IRIs are published (default: the declared canonicalUrl's origin)\n` +
        `  --iri /<prefix>=<base>   also rewrite <base> to the local /<prefix>; repeatable\n` +
        `  --no-rewrite             serve bytes as published (for signature and digest checks)\n` +
        `  --host   interface (default 127.0.0.1 — loopback, deliberately)\n`,
    );
    process.exit(0);
  }

  const mounts = flags("--mount").map(parseMount);
  const dir = flag("--dir") ?? (mounts.length ? undefined : defaultDir());
  const hostname = flag("--host") ?? "127.0.0.1";
  const port = Number(flag("--port") ?? DEFAULT_PORT);
  const rewrite = !argv.includes("--no-rewrite");
  const iriOrigin = flag("--iri-origin") ?? declaredIriOrigin();
  const extra = flags("--iri").map((a) => {
    const m = parseMount(a);
    return { prefix: m.prefix, from: m.dir };
  });
  const iriBases = iriBasesFor(mounts, iriOrigin, extra);
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = serveRendering({
      dir,
      mounts,
      port,
      hostname,
      canonicalHost: hostname === "127.0.0.1" ? "127.0.0.1" : undefined,
      iriBases,
      rewrite,
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "EADDRINUSE") {
      const next = nextPrimePort(port);
      console.error(`serve-rendering: port ${port} is in use.${next ? ` Try --port ${next}.` : ""}`);
      process.exit(1);
    }
    throw e;
  }

  // `localhost` may resolve to ::1 first. A listener there that only
  // redirects to 127.0.0.1 keeps those browsers on the one origin. Best
  // effort: a machine with no IPv6 loopback simply skips it.
  if (hostname === "127.0.0.1") {
    try {
      Bun.serve({
        port: server.port,
        hostname: "::1",
        fetch: (req) => {
          const u = new URL(req.url);
          return Response.redirect(`http://127.0.0.1:${server.port}${u.pathname}${u.search}`, 308);
        },
      });
    } catch {
      // No IPv6 loopback, or the port is taken there. Nothing to redirect.
    }
  }

  // Always print the RESOLVED directories, so a default is never a silent guess.
  const base = `http://${server.hostname}:${server.port}`;
  if (dir !== undefined) console.log(`serving ${resolve(dir)} at ${base}/`);
  for (const m of mounts) console.log(`serving ${resolve(m.dir)} at ${base}${m.prefix.replace(/\/$/, "")}/`);
  if (!rewrite) console.log("IRIs: not rewritten (--no-rewrite); links to published IRIs open the live site");
  else if (iriBases.length === 0) console.log("IRIs: not rewritten (no --iri-origin and no declared canonicalUrl)");
  else for (const b of iriBases) console.log(`IRIs: ${b.from}/… → ${base}${b.prefix}/…`);
}
