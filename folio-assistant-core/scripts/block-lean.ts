/**
 * block-lean — the Lean facts a block's ∀ icon shows: its declaration, the
 * status the PDF's ∀ mark colours, its line on the forge, and its page in the
 * rendered Lean docs.
 *
 * Owner, 2026-11-19 ("1 y"): a folio's web view carries, beside the 📣 in the
 * right gutter, a ∀ that opens a panel with "the Lean declaration, its status,
 * a link to the rendered Lean docs page and a link to the Lean source on
 * GitHub", and glossary entries link to the definition, the Lean source and
 * the rendered Lean page. The panel is the shared runtime's
 * (`cat-harness-tools/src/core/edit-links.ts`, `BlockLean`); this module only
 * resolves the facts, and a fact it cannot resolve is left out, never guessed.
 *
 * Nothing here names a repository, a branch or a route:
 * - the status is the `block-status-overlay` slot the formalisation layer
 *   fills (whichever layer registers into it), collapsed by `leanStatusBucket`; with the slot
 *   empty, the manifest's own value;
 * - the `.lean` file is the `lean-coverage` slot's `resolveLeanFile`, under
 *   the paper's Lake root; the link is `leanSourceUrl`, at the checkout's
 *   commit on its own origin (only github.com resolves, per that ruling);
 * - the rendered docs are the folio's declared graph of typology `lean`: the
 *   doc-gen4 render, kept on its own branch and MOUNTED at the declared path
 *   (`source: { kind: "branch", keyedBy: "tip" }`, `state:mount`; owner,
 *   2026-11-19, "lean repo branch", "needs to be mounted"). Its
 *   `coverage.visualiser` ref (`_site/<route>/index.html`) names the site route
 *   it is published at. The render is the KG viewer (`lean-kg-publish`: one
 *   page, JSON shards loaded on demand; owner, 2026-11-19, "use thin html and
 *   dynamic loading"), whose `data/names.json` says which declarations it has
 *   and in which module, so a declaration links to the viewer opened at it
 *   (`<route>/#/m/<Module>/<name>`). A folio with several Lake packages declares
 *   one `lean` directory per package, each its own sub-KG at its own route
 *   (owner, 2026-11-24: "separate qou, UGB and Fred2005 into own lean
 *   sub-KGs"); a block links into the one belonging to its own paper, the
 *   directory whose path is the paper's `lean/` ({@link leanDocs}). The ref is
 *   read as a site path, as `landingLinks` reads it (`lean/qou/index.html`),
 *   and the older `_site/<route>/index.html` form is still accepted. doc-gen4's
 *   static HTML is read only as a
 *   fallback, through its `declarations/declaration-data.bmp`. Read from the
 *   mount, else the built site, else the published site. A declaration the
 *   index does not list gets no rendered link, the rule `build-paper-pdf.sh`
 *   follows for the PDF.
 *
 * @module folio-assistant-core/scripts/block-lean
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, posix, relative } from "node:path";

import { readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { optionalPipelinePlugin } from "@litlfred/cat-harness-tools/pipeline/pipeline-plugins.js";
import { leanStatusBucket, type Block } from "@litlfred/cat-harness-tools/schemas/types.js";
import { detectRepoUrl } from "@litlfred/cat-harness-tools/src/core/git-refs.js";
import { declarationLine, leanSourceUrl } from "@litlfred/cat-harness-tools/src/core/lean-source-link.js";

/**
 * The ∀ icon's facts. Restated from cat-harness-tools' `BlockLean` so this
 * layer typechecks against a platform pin from before it; the shapes are the
 * same, and a `BlockContext` carrying this is what `compactActionsHtml` reads.
 */
export interface BlockLeanFacts {
  decl: string;
  status?: "compiled" | "drafted" | "stubbed";
  source?: string;
  docs?: string;
}

/** What every block of one checkout shares: where its sources link, and which declarations have a rendered page. */
export interface LeanLinkContext {
  /** `https://github.com/<owner>/<repo>`: `GITHUB_REPOSITORY` in CI, else the checkout's origin. */
  repoUrl?: string;
  /** The commit the source links are pinned to. */
  commit?: string;
  /**
   * A declaration's rendered page, as the block's page links it; undefined when
   * the docs do not list it. `paperDir` is the block's document directory, for
   * a context that serves several papers' sub-KGs (the glossary's).
   */
  docs?: (decl: string, paperDir?: string) => string | undefined;
}

/** The declaration a `lean.ref` names: `qou:QOU.Foo.bar` → `QOU.Foo.bar`. */
export function declOf(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const m = /^([a-z][a-z0-9-]*):(.+)$/.exec(ref.trim());
  const decl = (m ? m[2]! : ref).trim();
  return /^[^\s:/]+$/.test(decl) ? decl : undefined;
}

/** The checkout's origin and commit, read once. */
export function leanSourceContext(repoRoot: string): Pick<LeanLinkContext, "repoUrl" | "commit"> {
  const fromEnv = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : undefined;
  const repoUrl = fromEnv ?? detectRepoUrl(repoRoot);
  let commit: string | undefined;
  try {
    commit = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    commit = undefined;
  }
  return { ...(repoUrl ? { repoUrl } : {}), ...(commit ? { commit } : {}) };
}

/**
 * The site route a `lean` directory's visualiser ref names: the site path
 * `<route>/index.html` or `<route>/` (as `landingLinks` reads a ref), or the
 * older `_site/<route>/index.html`. Undefined for an absolute path, a URL, a
 * `..` segment, or a ref that names no directory page.
 */
export function visualiserRoute(ref: unknown): string | undefined {
  if (typeof ref !== "string" || ref.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(ref)) return undefined;
  const m = /^(?:_site\/)?(.+?)\/(?:index\.html)?$/.exec(ref);
  if (!m || m[1]!.split("/").some((x) => x === ".." || x === "." || x === "")) return undefined;
  return m[1]!;
}

/** One declared Lean render: its site route, the repository path it is mounted at, and its directory path. */
export interface LeanDocsEntry {
  route: string;
  mount?: string;
  /** The declared directory's path, repo-relative, no trailing slash. */
  path?: string;
}

/** Every `lean` directory the folio declares with a visualiser page, in declaration order. */
export function leanDocsAll(repoRoot: string): LeanDocsEntry[] {
  let dirs: Array<{ path?: string; graphTypologies?: string[]; graphs?: string[]; coverage?: { visualiser?: unknown } }> = [];
  try {
    dirs = ((readDeclaration(repoRoot) as unknown as { directories?: typeof dirs } | undefined)?.directories ?? []);
  } catch {
    return [];
  }
  const out: LeanDocsEntry[] = [];
  for (const d of dirs) {
    if (!(d.graphTypologies ?? d.graphs ?? []).includes("lean")) continue;
    const v = d.coverage?.visualiser;
    const refs = typeof v === "string" ? [v] : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as { ref?: string })?.ref)) : [];
    for (const r of refs) {
      const route = visualiserRoute(r);
      if (route === undefined) continue;
      const path = d.path?.split("/").filter(Boolean).join("/");
      out.push({ route, ...(path ? { mount: join(repoRoot, ...path.split("/")), path } : {}) });
      break;
    }
  }
  return out;
}

/**
 * The site route the folio publishes its Lean render under, from its declared
 * `lean` directory: the `coverage.visualiser` ref (`<route>/index.html`, or
 * `_site/<route>/index.html`) gives `<route>`. Undefined when the folio
 * declares no such directory, or its visualiser is not a page under the built
 * site.
 */
export function leanDocsRoute(repoRoot: string, paperDir?: string): string | undefined {
  return leanDocs(repoRoot, paperDir)?.route;
}

/**
 * The declared Lean render a block of the paper at `paperDir` links into: the
 * `lean` directory whose path is that paper's `lean/` or holds it (the longest
 * such path, so a package's own directory beats a common parent). With no
 * `paperDir`, or no directory belonging to that paper, the first declared one,
 * as before sub-KGs existed.
 */
export function leanDocs(repoRoot: string, paperDir?: string): LeanDocsEntry | undefined {
  const all = leanDocsAll(repoRoot);
  if (paperDir !== undefined) {
    const own = relative(repoRoot, join(paperDir, "lean")).split("\\").join("/");
    const hit = all
      .filter((e) => e.path !== undefined && (own === e.path || own.startsWith(`${e.path}/`)))
      .sort((a, b) => b.path!.length - a.path!.length)[0];
    if (hit) return hit;
  }
  return all[0];
}

/**
 * What the published Lean render says about its declarations, read once:
 *
 * - `kg` — THE visualiser (owner, 2026-11-19: "use thin html and dynamic
 *   loading"): `lean-kg-publish`'s one viewer page and its JSON shards.
 *   `data/index.json` lists the modules and `data/names.json` every
 *   declaration as `[name, moduleIndex, kindIndex]`; the viewer opens a
 *   declaration at `<route>/#/m/<Module>/<name>` (lean-kg-viewer/viewer.js).
 * - `static` — doc-gen4's own HTML, a non-default fallback: its
 *   `declarations/declaration-data.bmp` gives each name a `docLink`.
 */
export type LeanIndex = { kind: "kg"; moduleOf: ReadonlyMap<string, string> } | { kind: "static"; docLink: ReadonlyMap<string, string> };

/** A {@link LeanIndex} from the KG's `index.json` and `names.json`, or undefined when they do not have that shape. */
export function kgIndex(index: unknown, names: unknown): LeanIndex | undefined {
  const mods = (index as { modules?: Array<{ name?: unknown }> } | undefined)?.modules;
  if (!Array.isArray(mods) || !Array.isArray(names)) return undefined;
  const moduleOf = new Map<string, string>();
  for (const row of names) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || typeof row[1] !== "number") continue;
    const m = mods[row[1]]?.name;
    if (typeof m === "string" && /^[^\s/#?]+$/.test(m)) moduleOf.set(row[0], m);
  }
  return { kind: "kg", moduleOf };
}

/** A {@link LeanIndex} from doc-gen4's `declaration-data.bmp` (`{ declarations: { <name>: { docLink } } }`). */
export function staticIndex(data: unknown): LeanIndex | undefined {
  const decls = (data as { declarations?: Record<string, { docLink?: unknown }> } | undefined)?.declarations;
  if (!decls || typeof decls !== "object") return undefined;
  const docLink = new Map<string, string>();
  for (const [name, d] of Object.entries(decls)) {
    const link = d?.docLink;
    if (typeof link !== "string" || !link || /^[a-z]+:/i.test(link) || link.split(/[/#]/).includes("..")) continue;
    docLink.set(name, link.replace(/^\.\//, ""));
  }
  return { kind: "static", docLink };
}

/**
 * Each wanted declaration's page under `route`, as a SITE-ROOT link: the KG
 * viewer at the declaration (`<route>/#/m/<Module>/<name>`), or doc-gen4's page.
 * A name the index does not list gets none.
 */
export function docsFromIndex(index: LeanIndex | undefined, route: string, wanted: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>();
  if (!index) return out;
  for (const name of wanted) {
    if (index.kind === "kg") {
      const m = index.moduleOf.get(name);
      if (m) out.set(name, `${route}/#/m/${m}/${encodeURIComponent(name)}`);
    } else {
      const l = index.docLink.get(name);
      if (l) out.set(name, `${route}/${l}`);
    }
  }
  return out;
}

/** A site-root link (`lean/#/m/…`, `lean/QOU/A.html#x`) relative to the page directory `pageDir`. */
export function linkFromPage(pageDir: string, at: string): string {
  const k = at.indexOf("#");
  const path = k < 0 ? at : at.slice(0, k);
  const frag = k < 0 ? "" : at.slice(k);
  const rel = posix.relative(pageDir, path.replace(/\/$/, "")) || ".";
  return `${rel}${path.endsWith("/") ? "/" : ""}${frag}`;
}

const readJson = (p: string): unknown => {
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return undefined;
  }
};

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    return r.ok ? await r.json() : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Read the render's declaration index: from `source` when given (a directory,
 * file or URL of either form), else the MOUNTED render (`<mount>/…`), else the
 * built site (`<site>/<route>/…`), else the published site
 * (`<siteUrl>/<route>/…`). The KG form is preferred wherever both are found.
 * Undefined when none can be read: every block then shows its source link and
 * no rendered link.
 */
export async function readDocsIndex(o: { route: string; source?: string; mount?: string; site?: string; siteUrl?: string }): Promise<LeanIndex | undefined> {
  const bases: Array<{ local?: string; url?: string }> = [];
  if (o.source) bases.push(/^https?:\/\//.test(o.source) ? { url: o.source.replace(/\/$/, "") } : { local: o.source });
  else {
    if (o.mount) bases.push({ local: o.mount });
    if (o.site) bases.push({ local: join(o.site, ...o.route.split("/")) });
    if (o.siteUrl) bases.push({ url: `${o.siteUrl.replace(/\/$/, "")}/${o.route}` });
  }
  for (const b of bases) {
    if (b.local !== undefined) {
      if (!existsSync(b.local)) continue;
      if (b.local.endsWith(".bmp") || b.local.endsWith(".json")) {
        const s = staticIndex(readJson(b.local));
        if (s) return s;
        continue;
      }
      const idx = join(b.local, "data", "index.json");
      if (existsSync(idx)) {
        const kg = kgIndex(readJson(idx), readJson(join(b.local, "data", "names.json")));
        if (kg) return kg;
      }
      const decl = join(b.local, "declarations", "declaration-data.bmp");
      if (existsSync(decl)) {
        const s = staticIndex(readJson(decl));
        if (s) return s;
      }
    } else if (b.url !== undefined) {
      if (/\.(bmp|json)$/.test(b.url)) {
        const s = staticIndex(await fetchJson(b.url));
        if (s) return s;
        continue;
      }
      const index = await fetchJson(`${b.url}/data/index.json`);
      if (index !== undefined) {
        const kg = kgIndex(index, await fetchJson(`${b.url}/data/names.json`));
        if (kg) return kg;
      }
      const s = staticIndex(await fetchJson(`${b.url}/declarations/declaration-data.bmp`));
      if (s) return s;
    }
  }
  return undefined;
}

/** A GitHub Pages project site's address for `owner/repo`: where a folio publishes when it declares no other. */
export function pagesUrlOf(repo: string | undefined): string | undefined {
  const m = repo ? /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(repo) : null;
  return m ? `https://${m[1]!.toLowerCase()}.github.io/${m[2]}` : undefined;
}

/**
 * One block's Lean facts, or undefined when it has no Lean declaration.
 * `tsPath` is the block's manifest; `paperDir` the document's directory, whose
 * `lean/` is the Lake root the `lean.ref` resolves under.
 */
export function blockLean(block: Block, tsPath: string, paperDir: string, repoRoot: string, ctx: LeanLinkContext): BlockLeanFacts | undefined {
  const lean = "lean" in block ? (block.lean as { ref?: string; sorryFree?: boolean; validation?: string } | undefined) : undefined;
  const decl = declOf(lean?.ref);
  if (!lean || !decl) return undefined;
  // The slot overlays the live status from the .lean file; on a copy, so the
  // imported manifest (shared by every later import) is not changed.
  const live = { ...block, lean: { ...lean } } as Block;
  try {
    optionalPipelinePlugin("block-status-overlay")?.overlay(live, tsPath, paperDir);
  } catch {
    // A file the overlay cannot read keeps the manifest's value.
  }
  const status = leanStatusBucket((live as { lean?: { sorryFree?: boolean; validation?: string } }).lean);
  let source: string | undefined;
  try {
    const file = optionalPipelinePlugin("lean-coverage")?.resolveLeanFile(tsPath, readFileSync(tsPath, "utf-8"), join(paperDir, "lean"));
    if (file && existsSync(file)) {
      const line = declarationLine(readFileSync(file, "utf-8"), decl);
      source = leanSourceUrl(ctx.repoUrl, ctx.commit, relative(repoRoot, file).split("\\").join("/"), line);
    }
  } catch {
    source = undefined;
  }
  const docs = ctx.docs?.(decl, paperDir);
  return { decl, status, ...(source ? { source } : {}), ...(docs ? { docs } : {}) };
}
