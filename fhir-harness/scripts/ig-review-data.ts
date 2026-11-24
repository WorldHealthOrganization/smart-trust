#!/usr/bin/env bun
/**
 * An IG preview's review data: what changed in the IG between the default
 * branch and the branch being previewed, in the form the review page reads.
 *
 * @module fhir-harness/scripts/ig-review-data
 * @covers none — a build step: it writes a preview's review data and judges nothing
 *
 * ## Why (folio-assistant#215 walk, 2026-10-24)
 *
 * A review committee compares a change before and after on branches/. A folio's
 * preview carries a ChangeSet, `staging.json`, the banner and a review page;
 * an IG's preview carried none of them, so the committee had nothing that said
 * what changed (smart-immunizations-uganda#12, break 6). This writes them for
 * an IG, in the folio's file formats, so the platform's one review page
 * (`gen-review-page.ts`) serves both.
 *
 * ## What a "block" is in an IG
 *
 * | source | one block per | label | links to |
 * |---|---|---|---|
 * | `input/pagecontent/<page>.md` | heading section (the text before the first heading is `<page>/_top`) | `<page>/<heading id>` | `<page>.html#<heading id>` |
 * | every other file under `input/`, and `sushi-config.yaml` | file | its path | no page: the review page shows the text diff |
 *
 * Heading ids are kramdown's, as Jekyll writes them (`kramdownId`), so a link
 * lands on the section. A source file is compared as text; a binary one (a
 * workbook) is listed as edited with no text. The comparison is by content
 * only: a section whose text is unchanged is unchanged wherever it moved, and
 * no `moved` or `renamed` aspect is reported. That is stated in the summary
 * rather than guessed at.
 *
 * ## The outline and the rendered impact (bean 0om7)
 *
 * The same blocks give the review page its outline (`outline.json`: the IG's
 * pages, then its source directories, keyed by the ChangeSet's sections) and
 * its list of rendered pages (`rendered-impact.json`, a `cone` prediction:
 * each changed narrative page with the heading ids it alters). Sources the
 * IG Publisher renders into artefact pages are listed as undetermined, with
 * that reason, because this preview does not map them to pages.
 *
 * Nothing here is WHO-specific: any IG's pages and sources are read the same way.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

import { reviewPageHtml } from "../../cat-harness-tools/scripts/gen-review-page.ts";
import { igReadScope } from "./ig-read-scope.ts";
import { run as injectStagingBanner, type StagingFacts } from "../../cat-harness-tools/scripts/staging-banner.ts";
// The preview directories (cat-harness-tools `schemas/sdlc/preview-prefix.ts`):
// `branches/` since 2026-11-05, and the legacy `STAGING/` still read. Named
// here, not imported, so this layer does not wait on that module's release.
const isPreviewPath = (rel: string): boolean => ["branches", "STAGING"].some((p) => rel === p || rel.startsWith(`${p}/`));

export const CHANGESET_SCHEMA = "folio-changeset/v1";
export const CHANGESET_TEXT_SCHEMA = "folio-changeset-text/v1";
/** Where an IG's narrative pages are, relative to the IG root. */
export const PAGES_DIR = "input/pagecontent";

export interface IgBlockAt {
  file: string;
  kind: string;
  section: string;
  index: number;
  /** The page the block is on, relative to the site root; "" when it is on none. */
  page: string;
  /** The element id on that page, when it is not the label. */
  anchor?: string;
}
export type IgChange =
  | { change: "added"; label: string; head: IgBlockAt }
  | { change: "removed"; label: string; base: IgBlockAt }
  | { change: "changed"; label: string; aspects: ["prose"] | ["manifest"]; base: IgBlockAt; head: IgBlockAt };

interface Side { at: IgBlockAt; text?: string; hash: string }

/** kramdown's auto id: lowercase, keep letters, digits, spaces and dashes, spaces to dashes, no leading non-letter. */
export function kramdownId(heading: string): string {
  const id = heading
    .replace(/\{:[^}]*\}\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/^[^a-z]+/, "")
    .trim()
    .replace(/ /g, "-");
  return id || "section";
}

/** A Markdown page cut at its headings (levels 1 to 6), outside fenced code. */
export function splitPage(md: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const seen = new Map<string, number>();
  let cur = { id: "_top", lines: [] as string[] };
  let fence: string | undefined;
  const flush = () => {
    const text = cur.lines.join("\n").trim();
    if (text || cur.id !== "_top") out.push({ id: cur.id, text });
  };
  for (const line of md.split("\n")) {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) fence = fence === undefined ? f[1]![0] : line.trim().startsWith(fence) ? undefined : fence;
    const h = fence === undefined ? /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (h) {
      flush();
      const base = kramdownId(h[1]!);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      cur = { id: n ? `${base}-${n}` : base, lines: [line] };
    } else cur.lines.push(line);
  }
  flush();
  return out;
}

const sha = (b: Buffer | string): string => new Bun.CryptoHasher("sha256").update(b).digest("hex");
const isBinary = (b: Buffer): boolean => b.subarray(0, 8000).includes(0);
const extKind = (p: string): string => posix.extname(p).slice(1).toLowerCase() || "file";

/** The blocks of one side, from a reader of the paths it holds. */
export function blocksOf(paths: string[], read: (p: string) => Buffer): Map<string, Side> {
  const out = new Map<string, Side>();
  // The narrative first, as a reader meets it, then the sources behind it.
  const page = (p: string) => (p.startsWith(`${PAGES_DIR}/`) ? 0 : 1);
  const sorted = [...paths].sort((a, b) => page(a) - page(b) || (a < b ? -1 : a > b ? 1 : 0));
  const perDir = new Map<string, number>();
  for (const p of sorted) {
    const buf = read(p);
    if (p.startsWith(`${PAGES_DIR}/`) && p.endsWith(".md") && !p.slice(PAGES_DIR.length + 1).includes("/") && !isBinary(buf)) {
      const page = posix.basename(p, ".md");
      splitPage(buf.toString("utf-8")).forEach((s, index) => {
        out.set(`${page}/${s.id}`, {
          at: { file: p, kind: "page-section", section: `pages::${page}`, index, page: `${page}.html`, ...(s.id === "_top" ? {} : { anchor: s.id }) },
          text: s.text,
          hash: sha(s.text),
        });
      });
      continue;
    }
    const dir = posix.dirname(p);
    const index = perDir.get(dir) ?? 0;
    perDir.set(dir, index + 1);
    const binary = isBinary(buf);
    out.set(p, { at: { file: p, kind: extKind(p), section: `sources::${dir}`, index, page: "" }, ...(binary ? {} : { text: buf.toString("utf-8") }), hash: sha(buf) });
  }
  return out;
}

/** The review page's outline (`outline.json`, cat-harness-tools `review-nav.ts` `NavOutline`). */
export interface IgOutline {
  documents: Array<{
    slug: string;
    title: string;
    page: string;
    chapters: Array<{ title: string; sections: Array<{ key: string; title: string; blocks: string[] }> }>;
  }>;
}

/** A `rendered-impact/v1` (cat-harness `schemas/rendered-impact.ts`), as far as an IG preview can say it. */
export interface IgRenderedImpact {
  $schema: "rendered-impact/v1";
  renderer: string;
  method: "cone";
  base?: string;
  head?: string;
  inputs: string[];
  files: Array<{ path: string; change: "changed" | "added" | "removed"; role: "content"; via: string[]; anchors?: string[] }>;
  undetermined: Array<{ input: string; reason: string; scope: "unknown" | "all" }>;
}

export interface IgChangeSetResult {
  changeset: { $schema: string; folio: string; base: { ref: string; commit: string | null }; head: { ref: string; commit: string | null }; summary: Record<string, number>; changes: IgChange[] };
  text: { $schema: string; blocks: Record<string, { base?: { prose: string; html: string }; head?: { prose: string; html: string } }> };
  outline: IgOutline;
  impact: IgRenderedImpact;
}

/**
 * The outline of the IG as the review page shows it (bean 0om7): one document,
 * its narrative pages first and then its sources, one section per page or
 * source directory. A section's key is the ChangeSet's `section`, so the
 * page's badges and jumps find it. The document's slug is `input`, the first
 * segment of every block's file, which is how the review page names a
 * block's document.
 */
export function igOutline(head: Map<string, Side>, title = "Implementation Guide"): IgOutline {
  const pages = new Map<string, { title: string; blocks: string[] }>();
  const sources = new Map<string, string[]>();
  for (const [label, s] of head) {
    if (s.at.kind === "page-section") {
      const name = s.at.section.slice("pages::".length);
      const p = pages.get(name) ?? { title: "", blocks: [] };
      if (!p.title && s.at.anchor) p.title = /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(s.text ?? "")?.[1]?.replace(/\{:[^}]*\}\s*$/, "").trim() ?? "";
      p.blocks.push(label);
      pages.set(name, p);
    } else {
      const dir = s.at.section.slice("sources::".length);
      sources.set(dir, [...(sources.get(dir) ?? []), label]);
    }
  }
  const sorted = <T>(m: Map<string, T>) => [...m.entries()].sort(([a], [b]) => (a === "index" ? -1 : b === "index" ? 1 : a < b ? -1 : a > b ? 1 : 0));
  const chapters: IgOutline["documents"][number]["chapters"] = [];
  if (pages.size) chapters.push({ title: "Pages", sections: sorted(pages).map(([name, p]) => ({ key: `pages::${name}`, title: p.title || name, blocks: p.blocks })) });
  if (sources.size) chapters.push({ title: "Sources", sections: sorted(sources).map(([dir, blocks]) => ({ key: `sources::${dir}`, title: dir, blocks })) });
  return { documents: [{ slug: "input", title, page: "index.html", chapters }] };
}

/** The renderer an IG preview's impact is predicted for: Jekyll over the IG's narrative pages. */
export const IG_IMPACT_RENDERER = "fhir-ig-pages";

/**
 * Which rendered pages the change alters, predicted from the ChangeSet (bean
 * 0om7). A narrative page's sections render to `<page>.html`, each at its
 * heading's id, so those are listed with their anchors. Every other source
 * (FSH, CQL, a workbook, an example) is rendered by the IG Publisher into
 * artefact pages that this preview does not map, so it goes in `undetermined`
 * rather than being left out: "not known" is never "no page changed".
 * `sushi-config.yaml` can re-render any page, so its scope is `all`.
 */
export function igRenderedImpact(base: Map<string, Side>, head: Map<string, Side>, changes: IgChange[], refs?: { base?: string; head?: string }): IgRenderedImpact {
  const pagesOf = (m: Map<string, Side>) => new Set([...m.values()].filter((s) => s.at.kind === "page-section").map((s) => s.at.page));
  const before = pagesOf(base);
  const after = pagesOf(head);
  const files = new Map<string, { anchors: Set<string>; via: Set<string> }>();
  const undetermined: IgRenderedImpact["undetermined"] = [];
  const inputs = new Set<string>();
  for (const c of changes) {
    const at = c.change === "removed" ? c.base : c.head;
    inputs.add(at.file);
    if (at.kind !== "page-section") {
      if (!undetermined.some((u) => u.input === at.file))
        undetermined.push(
          at.file === "sushi-config.yaml"
            ? { input: at.file, reason: "the IG's configuration: it can change any rendered page", scope: "all" }
            : { input: at.file, reason: "rendered by the IG Publisher into artefact pages, which this preview does not map", scope: "unknown" },
        );
      continue;
    }
    const f = files.get(at.page) ?? { anchors: new Set<string>(), via: new Set<string>() };
    f.via.add(at.file);
    // A removed section's id is gone from the page, so it is no place to link.
    if (c.change !== "removed" && at.anchor) f.anchors.add(at.anchor);
    files.set(at.page, f);
  }
  return {
    $schema: "rendered-impact/v1",
    renderer: IG_IMPACT_RENDERER,
    method: "cone",
    ...(refs?.base ? { base: refs.base } : {}),
    ...(refs?.head ? { head: refs.head } : {}),
    inputs: [...inputs].sort(),
    files: [...files.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, f]) => ({
        path,
        change: !before.has(path) ? "added" : !after.has(path) ? "removed" : "changed",
        role: "content" as const,
        via: [...f.via].sort(),
        ...(f.anchors.size ? { anchors: [...f.anchors] } : {}),
      })),
    undetermined,
  };
}

/** Compare two sides' blocks: head reading order first, then what was removed. */
export function compareBlocks(
  base: Map<string, Side>,
  head: Map<string, Side>,
  refs: { base: { ref: string; commit: string | null }; head: { ref: string; commit: string | null } },
  html: (s: Side) => string,
): IgChangeSetResult {
  const changes: IgChange[] = [];
  const blocks: IgChangeSetResult["text"]["blocks"] = {};
  let unchanged = 0;
  const side = (s: Side) => (s.text === undefined ? undefined : { prose: s.text, html: html(s) });
  for (const [label, h] of head) {
    const b = base.get(label);
    if (!b) {
      changes.push({ change: "added", label, head: h.at });
      const t = side(h);
      blocks[label] = t ? { head: t } : {};
    } else if (b.hash === h.hash) unchanged += 1;
    else {
      changes.push({ change: "changed", label, aspects: h.text === undefined || b.text === undefined ? ["manifest"] : ["prose"], base: b.at, head: h.at });
      const bt = side(b);
      const ht = side(h);
      blocks[label] = { ...(bt ? { base: bt } : {}), ...(ht ? { head: ht } : {}) };
    }
  }
  for (const [label, b] of base) {
    if (head.has(label)) continue;
    changes.push({ change: "removed", label, base: b.at });
    const t = side(b);
    blocks[label] = t ? { base: t } : {};
  }
  const count = (k: IgChange["change"]) => changes.filter((c) => c.change === k).length;
  const aspect = (a: string) => changes.filter((c) => c.change === "changed" && (c.aspects as string[]).includes(a)).length;
  return {
    outline: igOutline(head),
    impact: igRenderedImpact(base, head, changes, { base: refs.base.ref, head: refs.head.ref }),
    changeset: {
      $schema: CHANGESET_SCHEMA,
      folio: PAGES_DIR,
      base: refs.base,
      head: refs.head,
      summary: { added: count("added"), removed: count("removed"), changed: count("changed"), unchanged, renamed: 0, prose: aspect("prose"), manifest: aspect("manifest"), moved: 0 },
      changes,
    },
    text: { $schema: CHANGESET_TEXT_SCHEMA, blocks },
  };
}

const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Markdown to HTML with the platform's renderer (remark, as the folio
 * ChangeSet renders its prose), resolved from the content core this layer
 * needs; escaped text when it cannot be loaded, which the review page still
 * diffs word by word.
 */
export async function proseRenderer(root: string): Promise<(md: string) => string> {
  try {
    const from = join(root, "folio-assistant-core");
    const { remark } = (await import(Bun.resolveSync("remark", from))) as { remark: unknown };
    const html = ((await import(Bun.resolveSync("remark-html", from))) as { default: unknown }).default;
    // Tables and the rest of GitHub's Markdown, as kramdown's GFM input renders the page.
    let gfm: unknown;
    try {
      gfm = ((await import(Bun.resolveSync("remark-gfm", from))) as { default: unknown }).default;
    } catch {
      gfm = undefined;
    }
    type Proc = { use: (p: unknown, o?: unknown) => Proc; processSync: (s: string) => unknown };
    return (md: string) => {
      let p = (remark as unknown as () => Proc)();
      if (gfm) p = p.use(gfm);
      return String(p.use(html, { sanitize: false }).processSync(md));
    };
  } catch {
    return (md: string) => `<pre>${escapeHtml(md)}</pre>`;
  }
}

function git(ig: string, args: string[], encoding: "utf-8" | "buffer" = "utf-8"): { ok: boolean; out: string; buf: Buffer } {
  const r = spawnSync("git", ["-C", ig, ...args], { encoding: encoding === "buffer" ? "buffer" : "utf-8", maxBuffer: 256 * 1024 * 1024 });
  const buf = Buffer.isBuffer(r.stdout) ? r.stdout : Buffer.from(String(r.stdout ?? ""));
  return { ok: r.status === 0, out: buf.toString("utf-8"), buf };
}

const IG_INPUTS = (p: string): boolean => p === "sushi-config.yaml" || p.startsWith("input/");

/** The IG's ChangeSet from `base` (a ref) to the working tree, read with git; the base is read as data, never run. */
export function igChangeSet(o: { ig: string; base: string; render: (md: string) => string }): IgChangeSetResult {
  const baseCommit = git(o.ig, ["rev-parse", "--verify", `${o.base}^{commit}`]);
  if (!baseCommit.ok) throw new Error(`${o.base} is not a commit in ${o.ig}: fetch it first`);
  // The IG's inputs, narrowed to what contentTypes.ig.include declares.
  const scope = igReadScope(o.ig);
  const inScope = (p: string): boolean => IG_INPUTS(p) && scope.declares(p);
  const basePaths = git(o.ig, ["ls-tree", "-r", "--name-only", o.base, "--", "input", "sushi-config.yaml"]).out.split("\n").filter((p) => p && inScope(p));
  const headPaths = git(o.ig, ["ls-files", "-co", "--exclude-standard", "--", "input", "sushi-config.yaml"]).out.split("\n").filter((p) => p && inScope(p) && existsSync(join(o.ig, p)));
  const base = blocksOf(basePaths, (p) => git(o.ig, ["show", `${o.base}:${p}`], "buffer").buf);
  const head = blocksOf(headPaths, (p) => readFileSync(join(o.ig, p)));
  const headCommit = git(o.ig, ["rev-parse", "HEAD"]);
  const r = compareBlocks(
    base,
    head,
    { base: { ref: o.base, commit: baseCommit.out.trim() }, head: { ref: "worktree", commit: headCommit.ok ? headCommit.out.trim() : null } },
    // A kramdown attribute line (`{:.grid}`) is Jekyll's, not text: remark would print it.
    (s) => (s.at.kind === "page-section" ? o.render((s.text ?? "").replace(/^\{:[^}\n]*\}\s*$/gm, "")) : `<pre>${escapeHtml(s.text ?? "")}</pre>`),
  );
  // The outline is headed by the IG's own title, read from its configuration.
  const title = head.get("sushi-config.yaml")?.text?.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  if (title) r.outline.documents[0]!.title = title;
  return r;
}

/** Write `changeset.json`, `changeset-text.json`, `outline.json` and `rendered-impact.json` at the site root. */
export function writeReviewData(site: string, r: IgChangeSetResult): void {
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, "changeset.json"), `${JSON.stringify(r.changeset)}\n`);
  writeFileSync(join(site, "changeset-text.json"), `${JSON.stringify(r.text)}\n`);
  writeFileSync(join(site, "outline.json"), `${JSON.stringify(r.outline)}\n`);
  writeFileSync(join(site, "rendered-impact.json"), `${JSON.stringify(r.impact)}\n`);
}

/** The open pull request a preview's branch belongs to. */
export interface OpenPr {
  number: string;
  url: string;
}

/**
 * The open PR for `branch`, or `null` when there is none or it cannot be
 * found (bean zvl0). A `pull_request` run names its PR in the event payload,
 * so that is read first and needs no network. A run started by hand
 * (`workflow_dispatch`) carries no PR, so the REST API is asked for the
 * branch's open PRs (`pulls?head=owner:branch`). A token is used when the
 * environment has one; without it the call is anonymous, which a public
 * repository allows. Any failure reads as "no PR found", never as a guess.
 */
export async function openPrFor(
  ownerRepo: string,
  branch: string,
  o: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {},
): Promise<OpenPr | null> {
  const env = o.env ?? process.env;
  const eventPath = env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    try {
      const pr = (JSON.parse(readFileSync(eventPath, "utf-8")) as { pull_request?: { number?: number; html_url?: string } }).pull_request;
      if (pr?.number) return { number: String(pr.number), url: pr.html_url ?? `https://github.com/${ownerRepo}/pull/${pr.number}` };
    } catch {
      // An unreadable payload is not a PR; fall through to the lookup.
    }
  }
  const [owner] = ownerRepo.split("/");
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  const api = `https://api.github.com/repos/${ownerRepo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`;
  try {
    const res = await (o.fetch ?? fetch)(api, {
      headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return null;
    const list = (await res.json()) as { number?: number; html_url?: string }[];
    const pr = Array.isArray(list) ? list[0] : undefined;
    return pr?.number ? { number: String(pr.number), url: pr.html_url ?? `https://github.com/${ownerRepo}/pull/${pr.number}` } : null;
  } catch {
    return null;
  }
}

/**
 * Everything a preview's review needs, written into the finished site before
 * it is published: the ChangeSet and its text, the review page at
 * `review/index.html`, and the staging banner with its `staging.json` (the
 * preview's stamp file, owner's option A on bean lx2s). Each is the file the
 * folio route writes, so the platform's review page and banner read them
 * unchanged.
 */
export function igPreviewData(
  site: string,
  f: { ig: string; render: (md: string) => string; branch: string; sha: string; base: string; ownerRepo: string; runUrl: string; pr?: OpenPr | null },
  log: (s: string) => void,
): void {
  const fetched = git(f.ig, ["fetch", "-q", "origin", f.base]).ok;
  const base = fetched ? "FETCH_HEAD" : `origin/${f.base}`;
  try {
    const r = igChangeSet({ ig: f.ig, base, render: f.render });
    r.changeset.base.ref = f.base;
    writeReviewData(site, r);
    const s = r.changeset.summary;
    log(`· review data: ${f.base} → ${f.branch}: ${s.added} added, ${s.removed} removed, ${s.changed} changed, ${s.unchanged} unchanged (changeset.json, changeset-text.json, outline.json, rendered-impact.json: ${r.impact.files.length} page(s), ${r.impact.undetermined.length} source(s) not mapped)`);
  } catch (e) {
    log(`· no ChangeSet on this preview: ${(e as Error).message}`);
  }
  mkdirSync(join(site, "review"), { recursive: true });
  writeFileSync(join(site, "review", "index.html"), reviewPageHtml("../"));
  const [owner, name] = f.ownerRepo.split("/");
  const gh = `https://github.com/${f.ownerRepo}`;
  // The published root's pages, so the banner can say which pages are new; unknown when gh-pages cannot be read.
  let newPages: string[] = [];
  let mainPagesKnown = false;
  if (git(f.ig, ["fetch", "-q", "--depth", "1", "origin", "gh-pages"]).ok) {
    const listed = new Set(git(f.ig, ["ls-tree", "-r", "--name-only", "FETCH_HEAD"]).out.split("\n").filter((p) => p.endsWith(".html") && !isPreviewPath(p)));
    if (listed.size) {
      mainPagesKnown = true;
      const here: string[] = [];
      const walk = (d: string, rel: string) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const r = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) walk(join(d, e.name), r);
          else if (e.name.endsWith(".html")) here.push(r);
        }
      };
      walk(site, "");
      newPages = here.filter((p) => !listed.has(p)).sort();
    }
  }
  const facts: StagingFacts = {
    branch: f.branch,
    sha: f.sha.slice(0, 7),
    built: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    // `"n/a"` is the banner's "no open PR found"; its link still searches the branch's PRs.
    pr: f.pr?.number ?? "n/a",
    prUrl: f.pr?.url ?? `${gh}/pulls?q=head%3A${encodeURIComponent(f.branch)}`,
    branchUrl: `${gh}/tree/${f.branch}`,
    issue: null,
    issueUrl: null,
    runUrl: f.runUrl,
    mainSite: `https://${owner}.github.io/${name}/`,
    beforeRef: f.base,
    mainPagesKnown,
    newPages,
  };
  const b = injectStagingBanner(site, facts);
  log(`· staging banner on ${b.injected} page(s)${b.skipped ? ` (${b.skipped} already carried it)` : ""}, staging.json written; the review page at review/`);
  if (b.noBody.length) throw new Error(`${b.noBody.length} page(s) have no <body>, so they would carry no staging banner: ${b.noBody.slice(0, 10).join(", ")}`);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ig = opt("ig") ?? ".";
  const site = opt("site");
  const base = opt("base") ?? "origin/main";
  if (!site) {
    console.error("usage: ig-review-data.ts --site <built site> [--ig <checkout>] [--base origin/main] [--root <platform root>]");
    process.exit(2);
  }
  const r = igChangeSet({ ig, base, render: await proseRenderer(opt("root") ?? ig) });
  writeReviewData(site, r);
  const s = r.changeset.summary;
  console.log(`ig-review-data: ${base} → worktree: ${s.added} added, ${s.removed} removed, ${s.changed} changed, ${s.unchanged} unchanged`);
}
