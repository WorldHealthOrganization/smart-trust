#!/usr/bin/env bun
/**
 * Every README in a repository as ONE page, with a table of contents: the
 * root README first, then each directory's README in path order.
 *
 * @module bootstrap-tools/scripts/readme-book
 * @covers code
 *
 * It is the `README.html` of the site `site.ts` stages (the root's
 * `index.html` redirects to it), so a person landing at the site address
 * reads the whole of the repository's prose in one place.
 *
 * What changes on the way in, and why each is needed for the page to work:
 *
 * - **Each README becomes a section.** Its first heading, when that is a
 *   level-1 heading at the top, becomes the section heading (level 2); every
 *   other heading is demoted one level (never above level 3), so no README's
 *   own title competes with the page's.
 * - **Anchors are prefixed by section** — `<section>--<slug>` — because two
 *   READMEs can share a heading ("Every file here"), and one page cannot hold
 *   two targets with one name. Explicit `<a id>` anchors are prefixed too.
 *   Every anchor is written as an explicit `<a id>` inside its heading, so
 *   the page does not depend on how a Markdown renderer spells heading ids.
 * - **Links are rewritten so they still resolve** from the page's own
 *   directory: a link to another README included here becomes a link to its
 *   section (and a fragment to the matching anchor); any other relative link
 *   is resolved from its README's directory to a path from the root.
 *
 * `--check` builds the page without writing it and fails on any link in it
 * that does not resolve — a fragment with no anchor on the page, or a
 * relative path to nothing in the repository. The page is built when a site
 * is published and is not committed (the same reason as the graph file, in
 * bootstrap's `bootstrap-graph-publication` skill), so "is it stale" has no
 * committed copy to compare against; "does every link on it land" does.
 *
 * Which READMEs: every `README.md` git accounts for (`git-files.ts`). When git
 * cannot answer, the command says so and fails rather than walking the tree.
 *
 * Usage: bun run bootstrap-tools/scripts/readme-book.ts [--root ../bootstrap] [--out <file>] [--check] [--jekyll] [--title <title>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";

import { readKnowledgeGraphDeclaration } from "../schemas/declaration.ts";
import { generatedBanner, leadingFrontMatter } from "./generated-by.ts";
import { gitFiles } from "./git-files.ts";

/** One README, as it will appear on the page. */
export interface BookSection {
  /** Its path from the root, `/`-separated: `README.md`, `schemas/README.md`. */
  path: string;
  /** The section's anchor: `readme` for the root, else its directory with `/` as `-`. */
  id: string;
  title: string;
  /** Its level-2 headings (after demotion, level 3), for the table of contents. */
  headings: { text: string; anchor: string }[];
  body: string;
}

export interface Book {
  markdown: string;
  sections: BookSection[];
  /** Links that will not land: each names the README and the target. */
  problems: string[];
}

/** The README paths among `files` (root-relative), root first, then by path. */
export function readmeOrder(files: readonly string[]): string[] {
  const readmes = files.filter((f) => f === "README.md" || f.endsWith("/README.md"));
  return readmes.sort((a, b) => (a === "README.md" ? -1 : b === "README.md" ? 1 : a < b ? -1 : a > b ? 1 : 0));
}

/** The section anchor for a README path. */
export function sectionId(path: string): string {
  if (path === "README.md") return "readme";
  return posix.dirname(path).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "readme";
}

/** A heading's text as a reader sees it: link targets, inline HTML and emphasis marks dropped. */
export function plainHeading(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`]/g, "")
    .trim();
}

/** GitHub's heading slug: lower case, punctuation dropped, each space a hyphen. */
export function githubSlug(text: string): string {
  return plainHeading(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const EXPLICIT_ANCHOR = /<a\s+(?:id|name)="([^"]+)"/g;

/** Call `f` on each line outside fenced code, with its index. */
function eachProseLine(lines: string[], f: (line: string, i: number) => void): void {
  let fence: string | undefined;
  lines.forEach((line, i) => {
    const m = FENCE.exec(line);
    if (fence !== undefined) {
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length) fence = undefined;
      return;
    }
    if (m) {
      fence = m[1]!;
      return;
    }
    f(line, i);
  });
}

/** Every anchor a README offers, by the name a link would use: heading slugs (deduplicated as GitHub does) and explicit ids. */
export function anchorsOf(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Map<string, number>();
  eachProseLine(md.split("\n"), (line) => {
    const h = HEADING.exec(line);
    if (h) {
      const base = githubSlug(h[2]!);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const slug = n === 0 ? base : `${base}-${n}`;
      out.set(slug, slug);
    }
    for (const m of line.matchAll(EXPLICIT_ANCHOR)) out.set(m[1]!, m[1]!);
  });
  return out;
}

/**
 * Apply `f` to `line` with its inline code spans held out: each span is
 * swapped for a placeholder first and put back after, so a link whose TEXT is
 * code (`` [`a.md`](a.md) ``) is still seen whole, and a link written INSIDE
 * code is never rewritten.
 */
function outsideCode(line: string, f: (text: string) => string): string {
  const spans: string[] = [];
  const masked = line.replace(/(`+)[^`]*?\1/g, (s) => `\u0000${spans.push(s) - 1}\u0000`);
  return f(masked).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => spans[Number(i)]!);
}

interface Ctx {
  root: string;
  byPath: Map<string, { id: string; anchors: Map<string, string> }>;
  problems: string[];
}

/** Where `target`, written in the README at `from`, points on the page. */
export function rewriteTarget(target: string, from: string, ctx: Ctx): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) return target;
  const self = ctx.byPath.get(from)!;
  const hash = target.indexOf("#");
  const pathPart = hash >= 0 ? target.slice(0, hash) : target;
  const frag = hash >= 0 ? target.slice(hash + 1) : undefined;
  const anchorIn = (sec: { id: string; anchors: Map<string, string> }, f: string | undefined, where: string): string | undefined => {
    if (f === undefined || f === "") return `#${sec.id}`;
    const a = sec.anchors.get(f) ?? sec.anchors.get(decodeURIComponent(f));
    if (a !== undefined) return `#${sec.id}--${a}`;
    ctx.problems.push(`${from}: "${target}" — no anchor "${f}" in ${where}`);
    return undefined;
  };
  if (pathPart === "") return anchorIn(self, frag, from) ?? `#${self.id}`;
  const query = pathPart.indexOf("?");
  const bare = query >= 0 ? pathPart.slice(0, query) : pathPart;
  let decoded = bare;
  try {
    decoded = decodeURI(bare);
  } catch {
    /* keep it as written */
  }
  const joined = posix.normalize(posix.join(posix.dirname(from), decoded));
  if (joined === ".." || joined.startsWith("../")) {
    ctx.problems.push(`${from}: "${target}" — leaves the repository, so it cannot land on this site`);
    return target;
  }
  const rel = joined === "." ? "" : joined.replace(/\/$/, "");
  const asReadme = ctx.byPath.has(rel) ? rel : ctx.byPath.has(rel ? `${rel}/README.md` : "README.md") ? (rel ? `${rel}/README.md` : "README.md") : undefined;
  if (asReadme !== undefined) {
    const a = anchorIn(ctx.byPath.get(asReadme)!, frag, asReadme);
    if (a !== undefined) return a;
    return `${asReadme}${frag !== undefined ? `#${frag}` : ""}`;
  }
  if (!existsSync(join(ctx.root, decoded === bare ? rel : rel))) {
    ctx.problems.push(`${from}: "${target}" — ${rel} does not exist`);
  }
  const out = (rel === "" ? "./" : rel) + (bare.endsWith("/") && rel !== "" ? "/" : "");
  const encoded = out === decoded ? out : encodeURI(out);
  return `${encoded}${query >= 0 ? pathPart.slice(query) : ""}${frag !== undefined ? `#${frag}` : ""}`;
}

/** The README's text, rewritten for its place on the page; its title and TOC headings. */
function sectionOf(path: string, md: string, ctx: Ctx): BookSection {
  const { id } = ctx.byPath.get(path)!;
  // A README's front matter (a wholly generated one opens with `generated:`)
  // describes that file, not the book; left in, `---` and the key would print
  // as a rule and a heading.
  const fm = leadingFrontMatter(md);
  const lines = (fm ? md.slice(fm.block.length) : md).split("\n");
  const seen = new Map<string, number>();
  const headings: { text: string; anchor: string }[] = [];
  let title: string | undefined;
  let firstHeadingSeen = false;
  const drop = new Set<number>();
  const link = (t: string) => rewriteTarget(t, path, ctx);
  const rewriteLine = (text: string) =>
    outsideCode(text, (s) =>
      s
        .replace(/(!?\[(?:[^\]\\]|\\.)*\])\((<[^>]*>|[^)\s]+)(\s+"[^"]*")?\)/g, (_m, label: string, t: string, ttl = "") => {
          const bracketed = t.startsWith("<") && t.endsWith(">");
          const inner = bracketed ? t.slice(1, -1) : t;
          const r = link(inner);
          return `${label}(${bracketed ? `<${r}>` : r}${ttl})`;
        })
        .replace(/\b(href|src)="([^"]+)"/g, (_m, attr: string, t: string) => `${attr}="${link(t)}"`)
        .replace(/(<a\s+(?:id|name)=")([^"]+)(")/g, (_m, a: string, name: string, b: string) => `${a}${id}--${name}${b}`),
    );
  eachProseLine(lines, (line, i) => {
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1]!.length;
      const base = githubSlug(h[2]!);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const slug = n === 0 ? base : `${base}-${n}`;
      if (!firstHeadingSeen && level === 1) {
        title = plainHeading(h[2]!);
        drop.add(i);
        firstHeadingSeen = true;
        return;
      }
      firstHeadingSeen = true;
      const newLevel = Math.min(6, Math.max(level + 1, 3));
      if (level <= 2) headings.push({ text: plainHeading(h[2]!), anchor: `${id}--${slug}` });
      lines[i] = `${"#".repeat(newLevel)} <a id="${id}--${slug}"></a>${rewriteLine(h[2]!)}`;
      return;
    }
    const def = /^(\s{0,3}\[[^\]]+\]:\s*)(\S+)(.*)$/.exec(line);
    if (def) {
      lines[i] = `${def[1]}${link(def[2]!)}${def[3]}`;
      return;
    }
    lines[i] = rewriteLine(line);
  });
  const body = lines.filter((_l, i) => !drop.has(i)).join("\n").trim();
  return { path, id, title: title ?? path, headings, body };
}

/** The whole page, from READMEs already read: `readmes` maps each root-relative path to its text. */
export function buildBook(
  root: string,
  readmes: ReadonlyMap<string, string>,
  opts: {
    title: string;
    description?: string;
    jekyll?: boolean;
    /** A last section that is not a README — the site's list of published documents — listed in the contents like the rest. */
    appendix?: { id: string; title: string; body: string };
  } = { title: "README" },
): Book {
  const order = readmeOrder([...readmes.keys()]);
  const byPath = new Map<string, { id: string; anchors: Map<string, string> }>();
  const used = new Set<string>();
  for (const p of order) {
    let id = sectionId(p);
    while (used.has(id)) id = `${id}-`;
    used.add(id);
    byPath.set(p, { id, anchors: anchorsOf(readmes.get(p)!) });
  }
  const ctx: Ctx = { root, byPath, problems: [] };
  const sections = order.map((p) => sectionOf(p, readmes.get(p)!, ctx));

  const out: string[] = [];
  if (opts.jekyll) out.push("---", `title: ${JSON.stringify(opts.title)}`, "---", "", "{% raw %}");
  // The generated-by notice FIRST, above the title (owner, 2026-10-01:
  // "README.mds and html need to have at top (this page was autogenerated
  // and link to bootstrap-tools)").
  out.push(generatedBanner("scripts/readme-book.ts", "every README in this repository", "edit a README instead"), "");
  out.push(`# ${opts.title}`, "");
  if (opts.description) out.push(opts.description, "");
  out.push(
    "*Every README in this repository on one page: the root's first, then each directory's, in path order.*",
    "",
    "## Contents",
    "",
  );
  sections.forEach((s, i) => {
    out.push(`${i + 1}. [${s.title}](#${s.id}) — \`${s.path}\``);
    for (const h of s.headings) out.push(`   - [${h.text}](#${h.anchor})`);
  });
  if (opts.appendix) out.push(`${sections.length + 1}. [${opts.appendix.title}](#${opts.appendix.id})`);
  for (const s of sections) {
    out.push("", "---", "", `## <a id="${s.id}"></a>${s.title}`, "", `*From [\`${s.path}\`](${s.path}).*`, "", s.body);
  }
  if (opts.appendix) out.push("", "---", "", `## <a id="${opts.appendix.id}"></a>${opts.appendix.title}`, "", opts.appendix.body.trim());
  if (opts.jekyll) out.push("", "{% endraw %}");
  return { markdown: `${out.join("\n")}\n`, sections, problems: ctx.problems };
}

/** Every fragment link on the page that names no anchor on it. */
export function danglingFragments(markdown: string): string[] {
  const ids = new Set([...markdown.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)].map((m) => m[1]!));
  const out: string[] = [];
  for (const m of markdown.matchAll(/\]\(#([^)\s]+)\)|href="#([^"]+)"/g)) {
    const f = m[1] ?? m[2]!;
    if (!ids.has(f)) out.push(`#${f}`);
  }
  return [...new Set(out)];
}

/** Read the READMEs git accounts for under `root`; `undefined` when git cannot answer. */
export function readReadmes(root: string): Map<string, string> | undefined {
  const files = gitFiles(root);
  if (!files) return undefined;
  const rels = readmeOrder(files.map((f) => relative(root, f).split("\\").join("/")));
  return new Map(rels.map((r) => [r, readFileSync(join(root, r), "utf-8")]));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = arg("--root") ?? join(import.meta.dir, "..", "..", "bootstrap");
  const readmes = readReadmes(root);
  if (!readmes) {
    console.error(`✗ git could not say which files ${root} holds — could not determine the READMEs, which is not a pass.`);
    process.exit(2);
  }
  if (readmes.size === 0) {
    console.error(`✗ ${root} has no README.md — there is nothing to put on the page.`);
    process.exit(2);
  }
  let decl: Record<string, unknown> | undefined;
  try {
    decl = readKnowledgeGraphDeclaration(root) as Record<string, unknown> | undefined;
  } catch (e) {
    console.error(`  · the declaration does not parse, so the title falls back to the directory name: ${(e as Error).message}`);
  }
  const title = arg("--title") ?? (decl?.["title"] as string | undefined) ?? (decl?.["name"] as string | undefined) ?? posix.basename(root);
  const book = buildBook(root, readmes, { title, description: decl?.["description"] as string | undefined, jekyll: args.includes("--jekyll") });
  const dangling = danglingFragments(book.markdown);
  const problems = [...book.problems, ...dangling.map((f) => `the page links to ${f}, which no anchor on it carries`)];
  for (const p of problems) console.error(`  · ${p}`);
  if (args.includes("--check")) {
    if (problems.length) {
      console.error(`✗ ${problems.length} link(s) on the README page would not land (${book.sections.length} READMEs)`);
      process.exit(1);
    }
    console.log(`✓ README page: ${book.sections.length} READMEs, every link lands`);
  } else {
    const out = arg("--out");
    if (!out) process.stdout.write(book.markdown);
    else {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, book.markdown);
      console.log(`✓ ${out}: ${book.sections.length} READMEs${problems.length ? `, ${problems.length} link(s) that will not land` : ""}`);
    }
    if (problems.length) process.exit(1);
  }
}
