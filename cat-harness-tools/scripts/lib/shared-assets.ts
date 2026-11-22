/**
 * Assets every IG site carries, loaded once from a shared host instead
 * (owner, 2026-11-09, Q-SZ-7 "A"): the LHC-Forms build, the ✍ editor bundle
 * (Crepe) and the harness's landing images, about 15 MB per site, and the
 * NLM Form Builder's bundle, about 10 MB more (owner, 2026-11-10), and the
 * vendored SQLite and Graphviz WebAssembly builds, about 2.2 MB more (owner,
 * 2026-11-10, "Low-risk trio").
 *
 * The host is a site on the SAME github.io origin as the IG sites (the
 * owner: "shared assets ... as part of smart-html"), so a frame or a service
 * worker that loads them stays same-origin. It is opt-in: the IG's
 * `index.config.json` names it as `site.sharedAssets`.
 *
 * Each directory is served at `<host>shared/<dir>/<digest>/`, the digest
 * taken over its files' names and contents, so a site loads exactly the
 * bytes it was built with, and a new build of the assets is a new address.
 * The host publishes what {@link stageShared} writes; a build whose copy the
 * host does not (yet) serve keeps it local and says so.
 *
 * References are rewritten where they are addresses, never in prose:
 * a CSS `url(…)`, an HTML `src`/`href`/`data-*` attribute, the rail's
 * `@fa-rail-root@/` prefix, and a percent-encoded `../…/` query value (the
 * Form Builder's worker), and, in a script, a quoted `./`/`../` literal
 * that resolves into the directory from the script's own place (the
 * `new URL("./vendor/…", import.meta.url)` the SQLite and Graphviz loaders
 * pass to `import()`). The ✍ editor finds its bundle at run time, so it
 * reads the `fa-shared-asset` meta this pass adds to each page instead.
 *
 * Cross-origin: a module a page or a Worker `import()`s, and the `.wasm` it
 * fetches beside itself, may come from another origin when the host answers
 * with CORS, which GitHub Pages does (`Access-Control-Allow-Origin: *`). A
 * Worker's own script may not, so a shared directory never holds a Worker
 * entry point: the SQLite Worker (`slice-sqlite-worker.js`) stays on the
 * site and only imports the shared module.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

/**
 * The parents whose every version directory a site may share: the LHC-Forms
 * build, and the NLM Form Builder's bundle (fhir-harness writes it beside the
 * builder's own pages, which stay on the site; owner, 2026-11-10).
 */
export const VERSIONED_SHARED: readonly string[] = ["assets/lhc-forms/", "assets/formbuilder-bundle/"];

/**
 * The fixed directories a site may share: the harness images, the ✍ editor
 * bundle, and the vendored SQLite (`vendor-sqlite-wasm.ts`) and Graphviz
 * (`vendor-graphviz-wasm.ts`) WebAssembly builds, which their loaders reach
 * by a script-relative `import()`.
 */
export const FIXED_SHARED: readonly string[] = [
  "assets/img/harness/",
  "assets/vendor/crepe/",
  "assets/js/vendor/sqlite-wasm/",
  "assets/js/vendor/wasm-graphviz/",
];

/** The directories a site may share: {@link FIXED_SHARED}, and every version under {@link VERSIONED_SHARED}. */
export function sharedDirsIn(site: string): string[] {
  const out = FIXED_SHARED.filter((d) => existsSync(join(site, d)));
  for (const parent of VERSIONED_SHARED) {
    const abs = join(site, parent);
    if (existsSync(abs)) for (const v of readdirSync(abs).sort()) if (statSync(join(abs, v)).isDirectory()) out.push(`${parent}${v}/`);
  }
  return out;
}

/** The meta a page carries for each shared directory a script finds at run time. */
export const SHARED_META = "fa-shared-asset";
/** The directories a script finds at run time rather than by a written address: the ✍ editor bundle (`edit-links.ts`). */
export const FOUND_AT_RUN_TIME: readonly string[] = ["assets/vendor/crepe/"];

const TEXT = /\.(html?|css|js|mjs|json|svg|webmanifest)$/i;

function files(dir: string, root = dir, out: string[] = []): string[] {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, root, out);
    else out.push(relative(root, p).split(sep).join("/"));
  }
  return out;
}

/** A directory's digest: its files' paths and contents, 16 hex digits. */
export function dirDigest(dir: string): string {
  const h = createHash("sha256");
  for (const f of files(dir)) h.update(`${f}\0${createHash("sha256").update(readFileSync(join(dir, f))).digest("hex")}\n`);
  return h.digest("hex").slice(0, 16);
}

/**
 * A directory's key on the host: its digest, or, when it carries a build
 * record (`.build.json`: the versions a bundle was built from), a digest of
 * that record. A bundler that names chunks by a hash of its build path makes
 * two builds of the same versions differ in bytes but not in behaviour.
 */
export function dirKey(dir: string): string {
  const rec = join(dir, ".build.json");
  return existsSync(rec) ? `b${createHash("sha256").update(readFileSync(rec)).digest("hex").slice(0, 15)}` : dirDigest(dir);
}

/** Where the host serves `dir` at `digest`. */
export function sharedUrl(host: string, dir: string, digest: string): string {
  return `${host}shared/${dir}${digest}/`;
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SCRIPT = /\.(js|mjs)$/i;

/**
 * Rewrite the addresses of `dir` in one file's text to `url`. Returns the
 * text and how many changed. `from`, the file's own path in the site, lets a
 * script's relative literals be resolved: without it they are left alone.
 */
export function rewriteRefs(text: string, dir: string, url: string, from?: string): { text: string; n: number } {
  const d = esc(dir);
  // A path prefix before the directory: nothing, ./ or ../ steps, or a root-absolute path.
  const pre = String.raw`(?:(?:\.{1,2}\/)*|\/[^'"()\s]*?\/)`;
  let n = 0;
  const count = (s: string): string => {
    n++;
    return s;
  };
  let t = text.replace(new RegExp(String.raw`(url\(\s*['"]?)${pre}${d}`, "g"), (_m, a: string) => count(`${a}${url}`));
  t = t.replace(new RegExp(String.raw`@fa-rail-root@\/${d}`, "g"), () => count(url));
  t = t.replace(new RegExp(String.raw`(\s(?:src|href|data-[\w-]+)=["'])${pre}${d}`, "g"), (_m, a: string) => count(`${a}${url}`));
  // A query value relative to the file that names it, percent-encoded: `..%2F..%2Flhc-forms%2F44.1.0%2F`.
  const tail = dir.replace(/^assets\//, "");
  t = t.replace(new RegExp(String.raw`(?:\.\.%2F)+${esc(encodeURIComponent(tail))}`, "g"), () => count(encodeURIComponent(url)));
  // A quoted literal in a script, relative to the script: `"./vendor/sqlite-wasm/index.mjs"` in
  // `assets/js/slice-sqlite.js`. Only `./` and `../` forms, so a bare path in a comment stays.
  if (from && SCRIPT.test(from)) {
    const rel = posix.relative(posix.dirname(from), dir.replace(/\/$/, ""));
    if (rel && !rel.startsWith("/")) {
      const lit = rel.startsWith("..") ? `${rel}/` : `./${rel}/`;
      t = t.replace(new RegExp(String.raw`(['"\x60])${esc(lit)}`, "g"), (_m, q: string) => count(`${q}${url}`));
    }
  }
  return { text: t, n };
}

/** Add one `fa-shared-asset` meta per shared directory to a page's head. */
export function withMeta(html: string, shared: readonly { dir: string; url: string }[]): string {
  if (!shared.length || !/<head[^>]*>/i.test(html)) return html;
  const metas = shared.map((s) => `<meta name="${SHARED_META}" data-dir="${s.dir}" content="${s.url}">`).join("");
  return html.replace(/<head[^>]*>/i, (h) => `${h}${metas}`);
}

export interface ShareResult {
  shared: { dir: string; url: string; bytes: number; refs: number }[];
  kept: { dir: string; why: string }[];
}

/**
 * Point the site at the host's copies of its shared directories and delete
 * the local ones. `served(url)` says whether the host serves a directory
 * (its `.shared.json`); one it does not serve stays local.
 */
export async function shareAssets(site: string, host: string, served: (url: string) => Promise<boolean>): Promise<ShareResult> {
  const r: ShareResult = { shared: [], kept: [] };
  const plan: { dir: string; url: string; bytes: number }[] = [];
  for (const dir of sharedDirsIn(site)) {
    const abs = join(site, dir);
    const url = sharedUrl(host, dir, dirKey(abs));
    if (!(await served(`${url}.shared.json`))) {
      r.kept.push({ dir, why: `${url} is not served (yet): kept local` });
      continue;
    }
    plan.push({ dir, url, bytes: files(abs).reduce((s, f) => s + statSync(join(abs, f)).size, 0) });
  }
  if (!plan.length) return r;
  const refs = new Map(plan.map((p) => [p.dir, 0]));
  for (const f of files(site)) {
    if (!TEXT.test(f) || plan.some((p) => f.startsWith(p.dir))) continue;
    const abs = join(site, f);
    const before = readFileSync(abs, "utf-8");
    let text = before;
    for (const p of plan) {
      const w = rewriteRefs(text, p.dir, p.url, f);
      text = w.text;
      refs.set(p.dir, refs.get(p.dir)! + w.n);
    }
    if (/\.html?$/i.test(f)) text = withMeta(text, plan.filter((p) => FOUND_AT_RUN_TIME.includes(p.dir)));
    if (text !== before) writeFileSync(abs, text);
  }
  for (const p of plan) {
    rmSync(join(site, p.dir), { recursive: true, force: true });
    r.shared.push({ ...p, refs: refs.get(p.dir)! });
  }
  return r;
}

/**
 * Where a GitHub Pages address is committed: a project site
 * `https://<owner>.github.io/<repo>/<path>` is the `<path>` of `<repo>`'s
 * gh-pages branch, the branch every site of this platform publishes from
 * (`publish-gh-pages.sh`). Undefined for any other host.
 */
export function pagesBranchUrl(url: string, branch = "gh-pages"): string | undefined {
  const m = /^https:\/\/([A-Za-z0-9-]+)\.github\.io\/([^/]+)\/(.+)$/.exec(url);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${branch}/${m[3]}` : undefined;
}

async function headOk(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { method: "HEAD", redirect: "follow" })).ok;
  } catch {
    return false;
  }
}

/**
 * A served check: the host answers 200 for the directory's `.shared.json`,
 * or, when the host is a GitHub Pages site that cannot be reached from here
 * (a sandbox whose proxy refuses github.io, 2026-11-10), its gh-pages branch
 * holds the file. Pages serves that branch as committed, so the branch is the
 * same answer read through GitHub (owner, 2026-11-10: "C").
 */
export async function servedOverHttp(url: string): Promise<boolean> {
  if (await headOk(url)) return true;
  const raw = pagesBranchUrl(url);
  return raw ? headOk(raw) : false;
}

/**
 * Write a built site's shared directories as the host serves them:
 * `<out>/shared/<dir>/<digest>/`, each with a `.shared.json` listing its
 * files. A directory already there is left as it is: the address is its
 * content.
 */
export function stageShared(site: string, out: string): { dir: string; digest: string; written: boolean }[] {
  return sharedDirsIn(site).map((dir) => {
    const abs = join(site, dir);
    const digest = dirKey(abs);
    const to = join(out, "shared", dir, digest);
    if (existsSync(join(to, ".shared.json"))) return { dir, digest, written: false };
    mkdirSync(to, { recursive: true });
    cpSync(abs, to, { recursive: true });
    writeFileSync(join(to, ".shared.json"), `${JSON.stringify({ dir, digest, files: files(abs) }, null, 2)}\n`);
    return { dir, digest, written: true };
  });
}
