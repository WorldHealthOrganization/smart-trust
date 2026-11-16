/**
 * The URL Jekyll serves a PAGE at, read the way Jekyll reads it.
 *
 * @module scripts/lib/jekyll-permalink
 *
 * A page's address is decided by three things, in order: its own front-matter
 * `permalink`; else the `defaults` entry in `_config.yml` whose `scope.path`
 * matches it (the LONGEST matching path wins — Jekyll's `has_precedence?`);
 * else the default style `/:path/:basename.html`.
 *
 * Every generator that composes a link to a page from the page's SOURCE path
 * has to agree with that, or it links where nothing was published. Since
 * 2026-10-05 (issue #2188, bean `kc7k`) cat-harness's docs-folder pages publish
 * under `/docs/cat-harness/` through exactly such a `defaults` entry, so the
 * old shortcut — "the URL is the source path with `.md` swapped for `.html`" —
 * is wrong for them and right for everything else. This is the one place that
 * knows the difference, so no generator restates it.
 *
 * Only what `_config.yml` here uses is modelled: `path` scopes (a directory or
 * file prefix, or a glob with `*`), and the `:path`, `:basename` and
 * `:output_ext` placeholders. A scope with a `type` other than `pages`, or a
 * placeholder this does not know, is REFUSED rather than ignored: a silently
 * mismodelled rule is a link that 404s and reads as fine.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { overlayPath } from "./layer-output.ts";

import { parse as parseYaml } from "yaml";

export interface PermalinkDefault {
  /** Site-relative scope path: a prefix (`guides`), a file (`fr/index.md`) or a glob (`*.md`). */
  path: string;
  permalink: string;
}

/** The `permalink` entries of a `_config.yml`'s `defaults`, in file order. */
export function permalinkDefaults(config: unknown): PermalinkDefault[] {
  const defaults = (config as { defaults?: unknown } | null)?.defaults;
  if (!Array.isArray(defaults)) return [];
  const out: PermalinkDefault[] = [];
  for (const d of defaults as Array<{ scope?: { path?: unknown; type?: unknown }; values?: { permalink?: unknown } }>) {
    const pm = d?.values?.permalink;
    if (typeof pm !== "string") continue;
    const type = d.scope?.type;
    if (type !== undefined && type !== "pages") {
      throw new Error(`jekyll-permalink: a permalink default scoped to type ${String(type)} is not modelled`);
    }
    out.push({ path: typeof d.scope?.path === "string" ? d.scope.path : "", permalink: pm });
  }
  return out;
}

/** The permalink defaults declared by the `_config.yml` in `siteDir`, or none. */
export function permalinkDefaultsIn(siteDir: string): PermalinkDefault[] {
  const cfg = join(siteDir, "_config.yml");
  if (!existsSync(cfg)) return [];
  return permalinkDefaults(parseYaml(readFileSync(cfg, "utf-8")));
}

function globToRegExp(glob: string): RegExp {
  const body = glob
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${body}$`);
}

/** Does a scope path cover this site-relative source path? (Jekyll's `applies_path?`.) */
export function scopeApplies(scope: string, rel: string): boolean {
  const s = scope.replace(/^\/+|\/+$/g, "");
  if (s === "") return true;
  if (s.includes("*")) {
    // A glob names files; a file under a matched DIRECTORY is covered too.
    const re = globToRegExp(s);
    const parts = rel.split("/");
    for (let i = 1; i <= parts.length; i++) if (re.test(parts.slice(0, i).join("/"))) return true;
    return false;
  }
  return rel === s || rel.startsWith(`${s}/`);
}

function expand(template: string, rel: string): string {
  const slash = rel.lastIndexOf("/");
  const dir = slash < 0 ? "" : rel.slice(0, slash);
  const file = slash < 0 ? rel : rel.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  const basename = dot < 0 ? file : file.slice(0, dot);
  const ext = dot < 0 ? "" : file.slice(dot);
  const outputExt = /^\.(md|markdown|html?)$/i.test(ext) ? ".html" : ext;
  const url = template.replace(/:(path|basename|output_ext)\b/g, (_, k: string) =>
    k === "path" ? `/${dir}/` : k === "basename" ? basename : outputExt,
  );
  const unknown = /:[a-z_]+/.exec(url);
  if (unknown) throw new Error(`jekyll-permalink: placeholder ${unknown[0]} in ${template} is not modelled`);
  return url.replace(/\/{2,}/g, "/");
}

/**
 * The URL a page at `rel` (site-relative, `/`-separated) is served at.
 * Site-absolute, with no `baseurl`.
 */
export function pagePermalink(
  rel: string,
  frontMatter: Record<string, unknown>,
  defaults: readonly PermalinkDefault[],
): string {
  const own = frontMatter.permalink;
  if (typeof own === "string" && own.length > 0) return own.startsWith("/") ? own : `/${own}`;
  let best: PermalinkDefault | undefined;
  for (const d of defaults) {
    if (!scopeApplies(d.path, rel)) continue;
    if (best === undefined || d.path.length >= best.path.length) best = d;
  }
  if (best !== undefined) return expand(best.permalink, rel);
  return "/" + rel.replace(/\.(md|markdown)$/i, ".html");
}

const defaultsCache = new Map<string, PermalinkDefault[]>();

/**
 * Where the page `<page>.md` in `siteDir` is published — site-relative, NO
 * leading slash (`docs/cat-harness/content-types.html`), so a generator
 * composes it as `../${…}` or `{{ '/${…}' | relative_url }}`. The page's own
 * front-matter `permalink` is honoured when the file is there to read.
 */
export function publishedPagePath(siteDir: string, page: string): string {
  let defaults = defaultsCache.get(siteDir);
  if (defaults === undefined) {
    defaults = permalinkDefaultsIn(siteDir);
    defaultsCache.set(siteDir, defaults);
  }
  const rel = `${page.replace(/^\/+/, "").replace(/\.(md|html)$/i, "")}.md`;
  let fm: Record<string, unknown> = {};
  const file = join(siteDir, rel);
  if (existsSync(file)) {
    const text = readFileSync(file, "utf-8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (m) {
      try {
        const parsed = parseYaml(m[1]!) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) fm = parsed as Record<string, unknown>;
      } catch {
        // Unparseable front matter: the defaults still say where Jekyll puts it.
      }
    }
  }
  return pagePermalink(rel, fm, defaults).replace(/^\/+/, "");
}

/**
 * A site-absolute href AUTHORED as a page's source location (`/content-types.html`,
 * `/guides/index.html#x`), rewritten to where that page is published.
 *
 * Declarations name a page the way a reader of the source tree would — the
 * `.md` beside it — and every test that checks such a link resolves it that
 * way (`landing-sticky.test.ts`). Where the page is PUBLISHED is a separate
 * fact, Jekyll's, and since bean `kc7k` the two differ for the docs-folder
 * pages. Anything that is not a page in `siteDir` — a viewer directory, an
 * external URL, a path with no `.md` behind it — comes back unchanged.
 */
export function publishedHref(siteDir: string, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const m = /^([^#?]*)(.*)$/.exec(href)!;
  const path = m[1]!.replace(/^\/+/, "");
  const rest = m[2] ?? "";
  const stem = path.endsWith("/") ? `${path}index` : path.replace(/\.html$/i, "");
  if (stem === "" || !existsSync(join(siteDir, `${stem}.md`))) return href;
  const published = publishedPagePath(siteDir, stem);
  // Published where its source says → the href as authored, spelling and all.
  if (published === `${stem}.html` || `/${published}` === `/${stem.replace(/index$/, "")}`) return href;
  return `/${published}${rest}`;
}

function frontMatterOf(file: string): Record<string, unknown> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, "utf-8"));
  if (!m) return {};
  try {
    const parsed = parseYaml(m[1]!) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * The inverse: the source page (site-relative, `/`-separated, `.md`) that is
 * published at a site-absolute `url`, or `undefined` when no page in `siteDir`
 * is. Tries the path as written first, then each permalink default's fixed
 * prefix stripped (`/docs/cat-harness/x.html` → `x.md`), and accepts a
 * candidate only when the FORWARD rule maps it back to `url` — so a mapping
 * is never guessed from a shape.
 */
export function sourceForPermalink(siteDir: string, url: string): string | undefined {
  const defaults = permalinkDefaultsIn(siteDir);
  const norm = (u: string): string => u.replace(/[?#].*$/, "").replace(/\/index\.html$/, "/");
  const want = norm(url);
  const asFile = (u: string): string => {
    const rel = u.replace(/^\//, "").replace(/\.html$/, ".md");
    return rel === "" || rel.endsWith("/") ? `${rel}index.md` : rel;
  };
  const candidates = [asFile(want)];
  for (const d of defaults) {
    const prefix = d.permalink.split(":")[0]!;
    if (prefix.length > 1 && want.startsWith(prefix)) candidates.push(asFile(`/${want.slice(prefix.length)}`));
  }
  for (const rel of candidates) {
    // Over the layer overlay: a mounted layer's generated pages are at its
    // output root (bean `cat-tools-sm8r`, item 4).
    const file = overlayPath(join(siteDir, rel));
    if (!existsSync(file)) continue;
    if (norm(pagePermalink(rel, frontMatterOf(file), defaults)) === want) return rel;
  }
  return undefined;
}
