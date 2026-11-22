#!/usr/bin/env bun
/**
 * Render the `methodology` graph — what each adopted method is FOR, where it
 * came from, and whether this checkout holds the source it rests on.
 *
 * @module cat-harness/scripts/gen-methodologies-viz
 * @covers methodology
 *
 * It does not walk the graph: the node list and the evidence join come from
 * `check-methodology-evidence.ts` — `methodologyNodes` for the fields a reader
 * needs, `checkMethodologyEvidence` for which citations resolve — so the page
 * cannot disagree with the gate. Nothing here opens a `methodologies/`
 * directory or parses front matter.
 *
 * ## Three evidence states, kept visibly apart
 *
 * | state | means | how it reads |
 * |---|---|---|
 * | **ingested** | `evidence:` resolves in a declared library | the source is named and openable |
 * | **cited only** | an `origin`, no `evidence:` field | an open question, reported and not gated |
 * | **dangling** | `evidence:` names a bib-slug no library holds | a citation that CLAIMS to resolve — worse than none |
 *
 * If no directory declares a `methodology` graph, this REFUSES rather than
 * writing an empty page.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-methodologies-viz.ts
 *   bun run cat-harness-tools/scripts/gen-methodologies-viz.ts --check
 */
import { inScope, scopeArg, siteScope } from "./lib/site-scope.ts";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, posix } from "node:path";

import { baseDocsDir } from "./compose-docs.js";
import {
  checkMethodologyEvidence,
  frontMatterOf,
  methodologyNodes,
  methodologyUses,
  type EvidenceReport,
  type MethodologyNode,
} from "./check-methodology-evidence.js";
import { libraryResolver, type LibraryResolver } from "./lib/library-links.ts";
import { blobUrl, forgeAt } from "./lib/library-source.ts";
import { repoOf } from "../src/core/edit-links.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { detectRepoUrl } from "../src/core/git-refs.ts";
import { readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.js";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { visualiserSitePath, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { localSiteDir } from "./lib/local-site-dir.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "methodologies-viewer";
/**
 * Every page this writes declares itself generated in its own front matter —
 * the `generated:` key `check:reference-direction` reads (bean `ws99`), as
 * `gen-processes-viz.ts` does. A page lists the methodologies and the layers that adopt them, which belong to every
 * layer in the checkout, so without the key those names read as authored
 * prose in the committing layer naming the layers above it.
 */
const GENERATED_FM = "generated: gen-methodologies-viz.ts — do not hand-edit; run `bun run cat methodologies:viz`";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const REPO = resolve(INSTANCE_ROOT, "..");

/** The graph typology this renders. A KIND, never a path. */
const KIND = "methodology";

/** One methodology, reduced to what the page shows. */
export interface MethodologyRow {
  readonly name: string;
  readonly title: string;
  readonly origin: string;
  readonly appliesWhen: string;
  /**
   * WHICH layer declared it — `cat-harness`, or a layer above it such as a DAK base layer.
   *
   * The graph spans all three, and a page that did not say which would make
   * `grade` read as this layer's own adoption when it is the WHO material's.
   * See {@link instanceOf} for why this is resolved rather than split.
   */
  readonly instance: string;
  readonly evidence: readonly string[];
  readonly state: "ingested" | "cited-only" | "dangling";
  /** The node's file, relative to the repository root — where its full method is written. */
  readonly path?: string;
}

/**
 * Which layer declared a node, from its path.
 *
 * RESOLVED, not split. `methodologyNodes` spells every path relative to the
 * LAYER root, so a sibling layer's node arrives as
 * `../<instance>/methodologies/diig.md` — and taking the first segment of that
 * gives `..`, which is what the first version of this page printed in the
 * "declared by" column for two of its nine rows, and what made its layer
 * count say 2 where the graph spans 3. Found by reading the rendered page, not
 * the code.
 *
 * So the path is resolved against the layer root and re-expressed against
 * the repository root, which is the only spelling in which the first segment
 * IS a layer. Pure path arithmetic — nothing here touches the filesystem,
 * so the join stays testable without one.
 */
export function instanceOf(node: string, instanceRoot: string, repoRoot: string): string {
  const resolved = resolve(instanceRoot, node);
  const relInstance = relative(instanceRoot, resolved);
  if (!relInstance.startsWith("..") && !isAbsolute(relInstance)) {
    const decl = readDeclaration(instanceRoot);
    if (decl?.name) return decl.name;
  }
  const rel = relative(repoRoot, resolved);
  const seg = rel.split("/")[0] ?? "";
  // Still `..` means the node sits OUTSIDE the repository, which no declared
  // graph should. Reported as itself rather than guessed at: a wrong layer
  // name on a row is worse than a visibly impossible one.
  return seg === "" ? "?" : seg;
}

/**
 * The rows, joined from the two reports.
 *
 * Exported so the JOIN is testable without a filesystem — it is the part worth
 * pinning, and a test that went through the rendered markdown would be testing
 * the markdown.
 */
export function methodologyRows(
  nodes: readonly MethodologyNode[],
  report: EvidenceReport,
  instanceRoot = INSTANCE_ROOT,
  repoRoot = REPO,
): MethodologyRow[] {
  // Indexed by NODE PATH, not by name. Two layers may adopt methods with
  // the same name — `raci` and `rasci` already differ by one letter — and a
  // name-keyed join would silently attribute one layer's evidence to
  // another's node.
  const dangling = new Set(report.unresolved.map((f) => f.node));
  const none = new Set(report.noEvidence.map((f) => f.node));

  return nodes
    .filter((n) => n.state === "ok" && n.front !== undefined)
    .map((n) => {
      const f = n.front!;
      const state: MethodologyRow["state"] = dangling.has(n.node)
        ? "dangling"
        : none.has(n.node)
          ? "cited-only"
          : "ingested";
      return {
        name: f.name,
        title: f.title,
        origin: f.origin,
        appliesWhen: f["applies-when"],
        instance: instanceOf(n.node, instanceRoot, repoRoot),
        evidence: f.evidence ?? [],
        state,
        path: relative(repoRoot, resolve(instanceRoot, n.node)).split("\\").join("/"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * Where the page goes: the declared directory's own name (#1168 B7a-2b,
 * `conventionalPage`). Never a literal — `site-dir-single-answer` refuses one.
 */
export function pageRelPath(repo = REPO): string | undefined {
  // The route cat-harness DECLARES for this Tool's visualiser (owner,
  // 2026-10-09): `<locale>/<harness>/<id>/index.md`, never chosen here.
  try {
    const cat = existsSync(join(repo, "cat-harness")) ? join(repo, "cat-harness") : repo;
    return visualiserSitePath(cat, VIEWER_TOOL).rel;
  } catch {
    return undefined;
  }
}

/** The base docs layer — the same answer `compose-docs.ts` uses. */

const CSS = `
.mv-tag{display:inline-block;padding:.05rem .4rem;border-radius:3px;font-size:.72rem;
  font-weight:600;white-space:nowrap;border:1px solid currentColor}
/* Bean rtuo: light-page inks measured 2.06-2.71:1 on the default dark page
   (#27262b). Dark inks by default; the light scheme keeps the originals. */
.mv-ingested{color:#5cd3bd}  /* 8.23:1 on #27262b */
.mv-cited{color:#e6bd52}     /* 8.41:1 */
.mv-dangling{color:#ff9486}  /* 7.03:1 */
:root[data-fa-scheme="light"] .mv-ingested{color:#0d6e5e}
:root[data-fa-scheme="light"] .mv-cited{color:#8a6100}
:root[data-fa-scheme="light"] .mv-dangling{color:#a8200f}
.mv-grid{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0}
.mv-stat{flex:1 1 8rem;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:.5rem .7rem}
.mv-stat b{display:block;font-size:1.25rem;line-height:1.2}
.mv-stat span{font-size:.75rem;opacity:.75}
.mv-scroll-hint{display:none;font-size:.78rem;color:var(--muted,#888);margin:-.5rem 0 .5rem}
@media (max-width: 799.98px) {
  .mv-scroll-hint{display:block}
  .table-wrapper {
    position: relative;
    -webkit-overflow-scrolling: touch;
  }
  @supports (animation-timeline: scroll()) {
    .table-wrapper {
      mask-image: linear-gradient(to right,
        transparent 0, #000 var(--fa-cue-l),
        #000 calc(100% - var(--fa-cue-r)), transparent 100%);
      animation: fa-scroll-cue linear both;
      animation-timeline: scroll(self inline);
    }
  }
}
@property --fa-cue-l { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --fa-cue-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
@keyframes fa-scroll-cue {
  0%   { --fa-cue-l: 0px;    --fa-cue-r: 2.5rem; }
  12%  { --fa-cue-l: 2.5rem; }
  88%  { --fa-cue-r: 2.5rem; }
  100% { --fa-cue-l: 2.5rem; --fa-cue-r: 0px; }
}
`;

/**
 * The badge for an evidence state.
 *
 * WORDS, not only colour. The three states are the whole point of the page and
 * a reader who cannot distinguish the hues would be left with one state —
 * which is the same failure as collapsing them in the data.
 */
const BADGE: Record<MethodologyRow["state"], string> = {
  ingested: '<span class="mv-tag mv-ingested">source held</span>',
  "cited-only": '<span class="mv-tag mv-cited">cited, not ingested</span>',
  dangling: '<span class="mv-tag mv-dangling">citation does not resolve</span>',
};

/** Escape a cell so a pipe in prose cannot break the table. */
function cell(v: string): string {
  return v.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * A table cell's text with every backtick paired. An unpaired one opens a code
 * span that runs into the next cell, the pipes between stop being cell
 * boundaries, and kramdown prints the whole table as a paragraph (bean
 * `7w1a`). Read left to right, the unpaired backtick is the last one; it is
 * written as the character reference, which kramdown shows as a backtick and
 * never reads as a span delimiter.
 */
export function pairTicks(v: string): string {
  const n = (v.match(/`/g) ?? []).length;
  if (n % 2 === 0) return v;
  const i = v.lastIndexOf("`");
  return `${v.slice(0, i)}&#96;${v.slice(i + 1)}`;
}

/**
 * A long prose field, trimmed for a table cell with the full text below it.
 *
 * Avoids arbitrary mid-word cuts and unclosed spans. Cuts at word boundaries,
 * closes any open backticks or bold markers, and never leaves a bare ellipsis.
 */
export function short(v: string, n = 150): string {
  const one = cell(v);
  if (one.length <= n) return one;
  const sub = one.slice(0, n);
  const lastSpace = sub.lastIndexOf(" ");
  let cut = lastSpace > 0 ? sub.slice(0, lastSpace) : sub;
  const backticks = (cut.match(/`/g) ?? []).length;
  if (backticks % 2 === 1) cut += "`";
  const bolds = (cut.match(/\*\*/g) ?? []).length;
  if (bolds % 2 === 1) cut += "**";
  cut = cut.trimEnd();
  if (cut.length === 0) return one;
  return cut + "…";
}

/**
 * One ingested-source line. A `library/<slug>` reference links to the owner's
 * three targets where each resolves (bean `qgjh`, `lib/library-links.ts`); the
 * viewer link is made relative to `fromPage`, where this page is published.
 * Anything it cannot place stays code, never a link that 404s.
 */
export function evidenceLine(e: string, links?: LibraryResolver, fromPage = ""): string {
  const m = /^library\/([^/#]+)/.exec(e);
  const l = m && links ? links.links(m[1]!) : undefined;
  if (l === undefined) return `- \`${cell(e)}\``;
  const parts: string[] = [];
  if (l.viewer !== undefined) {
    const [path, hash] = l.viewer.split("#");
    const rel = posix.relative(posix.dirname(fromPage), path!) || ".";
    parts.push(`[\`${cell(e)}\`](${rel}/#${hash})`);
  } else parts.push(`\`${cell(e)}\``);
  // The entry's own page: its document, and its held source in the view panel.
  if (l.entry !== undefined) parts.push(`[view](${posix.relative(posix.dirname(fromPage), l.entry) || "."}/)`);
  if (l.readme !== undefined) parts.push(`[item page](${l.readme})`);
  if (l.source !== undefined) parts.push(`[source](${l.source})`);
  return `- ${parts.join(" · ")}`;
}

/**
 * Code spans in a node's prose (`applies-when`, `origin`) that name something
 * the page can place become links (owner, 2026-11-10: the DIIG entry's
 * `grade`, `kepner-tregoe`, `madr` and a library entry's directory
 * read as cross-references but were plain text).
 *
 * - a methodology on this site → its section on the list page, `#<name>`
 *   (`listHref` is the list page relative to where the text sits: `""` on the
 *   list page itself, `../../` on a node page);
 * - `[<layer>/]library/<slug>[/]` → the library viewer, the same target an
 *   `evidence:` line links (`evidenceLine`), relative to `fromPage`.
 *
 * Anything it cannot place stays code, never a link that 404s.
 */
export function linkProse(
  text: string,
  names: ReadonlySet<string>,
  listHref = "",
  links?: LibraryResolver,
  fromPage = "",
): string {
  return text.replace(/(\[?)`([^`]+)`(\]\()?/g, (all, open: string, inner: string, close: string | undefined) => {
    // Already link text: leave it as written.
    if (open && close) return all;
    const span = `\`${inner}\``;
    let href: string | undefined;
    if (names.has(inner)) href = `${listHref}#${inner}`;
    else {
      const m = /^(?:([^/\s]+)\/)?library\/([^/#\s]+)\/?$/.exec(inner);
      const l = m && links ? (links.links(m[2]!, m[1]) ?? links.links(m[2]!)) : undefined;
      if (l?.viewer !== undefined) {
        const [path, hash] = l.viewer.split("#");
        href = `${posix.relative(posix.dirname(fromPage), path!) || "."}/#${hash}`;
      }
    }
    return href === undefined ? all : `${open}[${span}](${href})${close ?? ""}`;
  });
}

/**
 * Where a node's full method is read: the file on its repository host, through
 * the same mount-aware `forgeAt` the library's source links use. The page draws
 * only each node's front matter; the method an agent extracted from the source
 * is the body (owner, 2026-10-16: *"i thought the methodologies were extracted
 * into derived content"*), and it was linked from nowhere.
 */
export function nodeHrefResolver(repoRoot = REPO): (path: string) => string | undefined {
  // The checkout's origin, else the harness's declared repository — gen-library-viz's `LINK_REPO` fallback.
  const d = readDeclaration(INSTANCE_ROOT) as { livesAt?: { repository?: string }; repository?: string } | undefined;
  const checkoutRepo = repoOf(detectRepoUrl(repoRoot), "") || d?.livesAt?.repository || d?.repository;
  return (path) => {
    const at = forgeAt(repoRoot, path, checkoutRepo);
    return at ? blobUrl(at) : undefined;
  };
}

/**
 * ONE PAGE PER METHODOLOGY (owner, 2026-10-16: *"use same URL pattern as other
 * viewers"*): `<route>/<instance>/<name>/`, the library's
 * `<route>/<instance>/<id>/`. The list page is `<route>/index.md`; a node's
 * page is this directory under it.
 */
export function nodePageDir(r: Pick<MethodologyRow, "instance" | "name">): string {
  return `${encodeURIComponent(r.instance)}/${encodeURIComponent(r.name)}/`;
}

/** The node page's path, relative to the site, from the list page's. */
export function nodePageRel(listPage: string, r: Pick<MethodologyRow, "instance" | "name">): string {
  return posix.join(posix.dirname(listPage), r.instance, r.name, "index.md");
}

/** A node file's text with its front matter removed — the extracted method. */
export function bodyOf(text: string): string {
  const fm = frontMatterOf(text);
  if (fm === undefined) return text;
  const end = text.indexOf("\n---", 3);
  return text.slice(text.indexOf("\n", end + 4) + 1).replace(/^\s*\n/, "");
}

/**
 * A link in a node's body that is relative to the node FILE (`../skills/x.md`)
 * would resolve against the page's URL instead and 404. Each is rewritten to
 * the file on its repository host; absolute URLs, anchors and site-rooted
 * paths are left alone, and one `nodeHref` cannot place stays as written.
 */
export function rebaseLinks(body: string, nodePath: string, nodeHref: (path: string) => string | undefined): string {
  return body.replace(/\]\(([^)\s]+)\)/g, (all, target: string) => {
    if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) return all;
    const [path, hash] = target.split("#");
    const href = nodeHref(posix.normalize(posix.join(posix.dirname(nodePath), path!)));
    return href ? `](${href}${hash !== undefined ? `#${hash}` : ""})` : all;
  });
}

/** A skill that applies a methodology, as its page lists it. */
export interface AppliedBy {
  skill: string;
  href?: string;
}

/**
 * Which skills apply each methodology, by name: every skill in the checkout's
 * layers that declares `uses-methodology` (cat-harness `schemas/process/methodology.ts`).
 * The edge is the skill's; the methodology's page reads it back.
 */
export function appliedByIndex(repoRoot = REPO, nodeHref?: (path: string) => string | undefined): Map<string, AppliedBy[]> {
  const out = new Map<string, AppliedBy[]>();
  for (const root of layerRootsIn(repoRoot)) {
    for (const u of methodologyUses(root)) {
      const href = nodeHref?.(relative(repoRoot, join(root, u.file)).split("\\").join("/"));
      for (const n of u.names) out.set(n, [...(out.get(n) ?? []), { skill: u.skill, ...(href ? { href } : {}) }]);
    }
  }
  for (const v of out.values()) v.sort((a, b) => a.skill.localeCompare(b.skill, "en"));
  return out;
}

/** A methodology's own page: what the list says of it, its sources, the skills that apply it, then the method itself. */
export function nodePage(
  r: MethodologyRow,
  body: string,
  links?: LibraryResolver,
  fromPage = "",
  nodeHref?: (path: string) => string | undefined,
  appliedBy: readonly AppliedBy[] = [],
  names: ReadonlySet<string> = new Set(),
): string {
  const q = (v: string): string => JSON.stringify(cell(v));
  const prose = (v: string): string => linkProse(cell(v), names, "../../", links, fromPage);
  const file = r.path && nodeHref ? nodeHref(r.path) : undefined;
  const b: string[] = [
    "---",
    `title: ${q(r.title)}`,
    `description: ${q(short(r.appliesWhen, 200))}`,
    "nav_exclude: true",
    GENERATED_FM,
    "---",
    `<style>${CSS}</style>`,
    "",
    "[&larr; All methodologies](../../)",
    "",
    `\`${cell(r.name)}\` — declared by \`${cell(r.instance)}\` — ${BADGE[r.state]}`,
    "",
    `**Applies when.** ${prose(r.appliesWhen)}`,
    "",
    `**Origin.** ${prose(r.origin)}`,
    "",
  ];
  if (r.evidence.length > 0) {
    b.push(
      r.state === "dangling" ? "**Cited sources — at least one does not resolve:**" : "**Ingested sources:**",
      "",
      ...r.evidence.map((e) => evidenceLine(e, links, fromPage)),
      "",
    );
  }
  if (appliedBy.length > 0) {
    b.push(
      "**Applied by skills:**",
      "",
      ...appliedBy.map((a) => (a.href ? `- [\`${cell(a.skill)}\`](${a.href})` : `- \`${cell(a.skill)}\``)),
      "",
    );
  }
  if (file) b.push(`**Node file:** [${cell(posix.basename(r.path!))}](${file})`, "");
  b.push("---", "", r.path && nodeHref ? rebaseLinks(body, r.path, nodeHref) : body);
  return b.join("\n").trimEnd() + "\n";
}

export function page(
  rows: readonly MethodologyRow[],
  report: EvidenceReport,
  links?: LibraryResolver,
  fromPage = "",
  nodeHref?: (path: string) => string | undefined,
): string {
  const byState = (s: MethodologyRow["state"]): number => rows.filter((r) => r.state === s).length;
  const instances = [...new Set(rows.map((r) => r.instance))].sort();
  const names = new Set(rows.map((r) => r.name));
  const prose = (v: string): string => linkProse(v, names, "", links, fromPage);

  const b: string[] = [
    "---",
    'title: "Methodologies"',
    'description: "The methodologies this repository has adopted — what each is for, where it came from, and whether the source it rests on is held here."',
    GENERATED_FM,
    "---",
    `<style>${CSS}</style>`,
    "",
    "A **methodology** here is somebody else's named, external work that this",
    "repository has adopted — a decision method, a responsibility matrix, an",
    "evidence framework. That is the line `methodology-adoption` draws: a method",
    "with no external origin is a *house process*, and belongs in `skills/`",
    "written as one rather than dressed as an adoption.",
    "",
    "So every node below carries an **origin**. Whether this checkout also holds",
    "the source that origin names is a separate question, and the one the third",
    "column answers.",
    "",
    '<div class="mv-grid">',
    `<div class="mv-stat"><b>${rows.length}</b><span>adopted methodologies</span></div>`,
    `<div class="mv-stat"><b>${byState("ingested")}</b><span>with the source held here</span></div>`,
    `<div class="mv-stat"><b>${byState("cited-only")}</b><span>cited, not ingested</span></div>`,
    `<div class="mv-stat"><b>${instances.length}</b><span>instance(s) declaring the graph</span></div>`,
    "</div>",
    "",
    "## Choosing one",
    "",
    "`applies-when` is what a selection question matches against, so it is the",
    "column to read first. A methodology whose applicability is unstated is one an",
    "agent picks by resemblance, which is why the schema requires the field.",
    "",
    '<p class="mv-scroll-hint">Scroll horizontally to see all columns &rarr;</p>',
    "",
    "| methodology | applies when | origin held? | declared by |",
    "|---|---|---|---|",
  ];

  for (const r of rows) {
    b.push(
      `| **[${pairTicks(cell(r.title))}](#${r.name})**<br>\`${cell(r.name)}\` | ${prose(pairTicks(cell(r.appliesWhen)))} | ` +
        `${BADGE[r.state]} | \`${cell(r.instance)}\` |`,
    );
  }

  b.push(
    "",
    "## Where each one came from",
    "",
    "The three states are different facts and are kept apart deliberately.",
    "**Source held** means an `evidence:` reference resolves to a document in a",
    "declared library — you can open it from this checkout. **Cited, not",
    "ingested** means the node names an origin and nobody has fetched it; that is",
    "an open question, reported by `check:methodology-evidence` and gated by",
    "nothing. **Citation does not resolve** is neither: the node claims a source",
    "and the slug names nothing, which reads as evidence in every listing and is",
    "strictly worse than declaring none.",
    "",
  );

  for (const r of rows) {
    const cleanOrigin = cell(r.origin)
      .replace(/\s*Section numbers below are the paper's\.?/gi, "")
      .trim();
    b.push(
      `### ${cell(r.title)} {#${r.name}}`,
      "",
      `\`${cell(r.name)}\` — declared by \`${cell(r.instance)}\` — ${BADGE[r.state]}`,
      "",
      `**Applies when.** ${prose(cell(r.appliesWhen))}`,
      "",
      `**Origin.** ${prose(cleanOrigin)}`,
      "",
    );
    if (r.path && nodeHref) b.push(`**The method, as extracted:** [read it](${nodePageDir(r)})`, "");
    if (r.evidence.length > 0) {
      b.push(
        r.state === "dangling"
          ? "**Cited sources — at least one does not resolve:**"
          : "**Ingested sources:**",
        "",
        ...r.evidence.map((e) => evidenceLine(e, links, fromPage)),
        "",
      );
    } else {
      b.push(
        "**No ingested source.** The origin above names one; nothing in this",
        "checkout holds it. `literature-search` is the skill that closes one of",
        "these.",
        "",
      );
    }
  }

  // Reported either way. "Nothing untagged" and "the check did not look" are
  // different facts, and a section that appeared only on failure could not
  // tell them apart.
  b.push("## Files in the graph that are not methodology nodes", "");
  if (report.untagged.length === 0) {
    // NO BACKTICK INSIDE A TEMPLATE LITERAL. `check:viewer-backticks` exists
    // because one of these ends the string and the file stops parsing — as
    // "No tests found" rather than as a syntax error. Plain strings here.
    b.push("None — every `.md` in the declared directories carries", "`$schema: folio-methodology/v1`.", "");
  } else {
    b.push(
      `**${report.untagged.length}.** A README or an index sitting in the graph`,
      "directory is untagged and correct; a node nobody tagged is one no consumer",
      "of the graph can see. Both look like this, which is why they are listed",
      "rather than counted.",
      "",
      ...report.untagged.map((f) => `- \`${cell(f.node)}\` — ${cell(f.detail)}`),
      "",
    );
  }

  if (report.invalid.length > 0) {
    b.push(
      "## Nodes that do not validate",
      "",
      `**${report.invalid.length}.** Tagged \`folio-methodology/v1\` and refused by`,
      "`schemas/process/methodology.ts`. The schema is `strict()`, so a misspelled key is a",
      "finding rather than a silent omission.",
      "",
      ...report.invalid.map((f) => `- \`${cell(f.node)}\` — ${cell(f.detail)}`),
      "",
    );
  }

  return b.join("\n").trimEnd() + "\n";
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const report = checkMethodologyEvidence(INSTANCE_ROOT);

  if (report.undetermined) {
    // The fourth state, above the three the page renders. Refuse rather than
    // write a page saying "0 methodologies", which is what a corpus that was
    // never found looks like from the outside.
    console.error("::error::gen-methodologies-viz: no directory declares a `methodology` graph — nothing was rendered");
    process.exit(2);
  }

  const allRows = methodologyRows(methodologyNodes(INSTANCE_ROOT), report);
  if (allRows.length === 0) {
    console.error("::error::gen-methodologies-viz: the methodology graph yielded no valid nodes");
    process.exit(1);
  }
  // A scoped site (`--scope`, owner 2026-11-08 Q-SZ-2 "B") lists and writes its
  // scope's methodologies only; the others are on their own layer's site.
  const scope = siteScope();
  const rows = allRows.filter((r) => inScope(scope, r.instance));
  // The methodologies this site lists: a code span naming one links to it.
  const names = new Set(rows.map((r) => r.name));
  if (scope !== undefined) console.log(`  scope ${scopeArg(scope)}: ${rows.length} of ${allRows.length} methodolog(ies)`);

  const PAGE = pageRelPath(REPO);
  if (PAGE === undefined) {
    console.error(`::error::gen-methodologies-viz: no visualiser declared for graph typology '${KIND}'`);
    process.exit(1);
  }

  const docsBase = siteTarget(localSiteDir(INSTANCE_ROOT) ?? baseDocsDir(REPO));
  const rendered = withRenderedByFrontMatter(
    page(rows, report, libraryResolver(REPO, INSTANCE_ROOT, docsBase), PAGE, nodeHrefResolver(REPO)),
    VIEWER_TOOL,
  );
  const out = join(docsBase, PAGE);

  // BUILT AT PUBLISH (owner, 2026-10-14, "B1"; 2026-10-15). The page joins
  // every methodology node the checkout's composition declares to every
  // declared library (`libraryResolver` reads the library projection and each
  // layer's READMEs), so it moved with the index's pins. The layer
  // declares the route `builtAtPublish` with this script as its writer, and
  // `derive:publish` runs it; under `--check` a declared page has no committed
  // bytes to compare, so it is skipped there (the `folio:viz` rule).
  const builtHere = isBuiltAtPublish(readDeclaration(INSTANCE_ROOT)?.builtAtPublish ?? [], posix.join(siteDirFor(INSTANCE_ROOT), PAGE));

  if (check && builtHere) {
    console.log(`✓ methodologies viewer: ${PAGE} is built at publish (builtAtPublish), not committed — nothing to compare; \`bun run cat methodologies:viz\` writes it`);
  } else if (check) {
    const current = existsSync(out) ? readFileSync(out, "utf-8") : "";
    if (current !== rendered) {
      console.error(`::error::gen-methodologies-viz: ${PAGE} is stale — run \`bun run cat methodologies:viz\``);
      process.exit(1);
    }
    const links = libraryResolver(REPO, INSTANCE_ROOT, docsBase);
    const hrefOf = nodeHrefResolver(REPO);
    const applied = appliedByIndex(REPO, hrefOf);
    for (const r of rows) {
      if (!r.path) continue;
      const rel = nodePageRel(PAGE, r);
      const want = withRenderedByFrontMatter(nodePage(r, bodyOf(readFileSync(join(REPO, r.path), "utf-8")), links, rel, hrefOf, applied.get(r.name), names), VIEWER_TOOL);
      const dest = join(docsBase, rel);
      if ((existsSync(dest) ? readFileSync(dest, "utf-8") : "") !== want) {
        console.error(`::error::gen-methodologies-viz: ${rel} is stale — run \`bun run cat methodologies:viz\``);
        process.exit(1);
      }
    }
    console.log(`✓ methodologies viewer is current — ${rows.length} methodolog(ies)`);
  } else {
    mkdirSync(join(out, ".."), { recursive: true });
    writeFileSync(out, rendered);
    // One page per node under the list page. Each layer's directory is
    // this writer's alone, so it is cleared first: a node renamed or removed
    // leaves no page behind.
    const links = libraryResolver(REPO, INSTANCE_ROOT, docsBase);
    const hrefOf = nodeHrefResolver(REPO);
    const applied = appliedByIndex(REPO, hrefOf);
    for (const inst of new Set(rows.map((r) => r.instance))) rmSync(join(out, "..", inst), { recursive: true, force: true });
    for (const r of rows) {
      if (!r.path) continue;
      const rel = nodePageRel(PAGE, r);
      const dest = join(docsBase, rel);
      mkdirSync(join(dest, ".."), { recursive: true });
      const body = bodyOf(readFileSync(join(REPO, r.path), "utf-8"));
      writeFileSync(dest, withRenderedByFrontMatter(nodePage(r, body, links, rel, hrefOf, applied.get(r.name), names), VIEWER_TOOL));
    }
    console.log(`methodologies viewer: ${rows.length} node(s) → ${PAGE}, and one page each under it`);
    console.log(
      `  ${rows.filter((r) => r.state === "ingested").length} with the source held, ` +
        `${rows.filter((r) => r.state === "cited-only").length} cited only, ` +
        `${rows.filter((r) => r.state === "dangling").length} dangling`,
    );
  }
}
