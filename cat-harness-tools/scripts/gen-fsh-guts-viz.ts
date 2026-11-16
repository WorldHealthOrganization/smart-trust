#!/usr/bin/env bun
/**
 * Render the `fsh-guts` graph — the trashcan that is kept.
 *
 * @module cat-harness/scripts/gen-fsh-guts-viz
 * @covers fsh-guts
 *
 * ## Rendered, but not published
 *
 * The graph is deliberately absent from the published site, so the page is
 * declared `publish: "staging-only"` and `compose-docs.ts` withholds it unless
 * told `--staging`. A local build or a `branches/<slug>/` preview has the page;
 * the published site does not.
 *
 * It is an INDEX: each entry links to the file on GitHub rather than
 * inlining it, so the graph stays the one copy.
 *
 * ## Three states, not two
 *
 * Files declare themselves with `$schema: folio-fsh-guts/v1`:
 *
 * - a file carrying the tag is **declared**;
 * - a file whose format cannot carry YAML front matter at all — a script, a
 *   PDF, a JSON, an HTML page — is **described by sidecar** when a tagged
 *   `.md` sibling of the same basename describes it;
 * - anything else is **undeclared**, and that is a finding.
 *
 * A format that cannot comply is not filed beside a file that simply omitted
 * the tag, and `unknown` is never rendered as clean.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-fsh-guts-viz.ts
 *   bun run cat-harness-tools/scripts/gen-fsh-guts-viz.ts --check
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { frozenSubtreeNote, fshGutsDirectory, withoutFrozenSubtrees } from "../schemas/kg/fsh-guts.js";
import { BranchStoreUsageError, exitUnlessMounted, readMarker } from "./branch-store.js";
import { baseDocsDir } from "./compose-docs.js";
import { publishPlan } from "./derive-at-publish.js";
import { visualiserSitePath } from "./viewer-declarations.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { localSiteDir } from "./lib/local-site-dir.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), which cat-harness declares its `fsh-guts` visualiser `renderedBy`. */
const VIEWER_TOOL = "staging-graph-viewer";

function resolveRepoRoot(): string {
  const dir = import.meta.dir;
  const idx = dir.indexOf("/.claude/worktrees");
  if (idx !== -1) {
    return dir.slice(0, idx);
  }
  return resolve(dir, "..", "..");
}

const REPO = resolveRepoRoot();
const TAG = "folio-fsh-guts/v1";
/** The graph typology this renders — the one literal, and it is a KIND, not a path. */
const KIND = "fsh-guts";

/** How a file meets — or fails — the graph's self-declaration contract. */
export type DeclState = "declared" | "sidecar" | "undeclared";

export interface GutsFile {
  /** Path relative to the graph's own directory. */
  readonly rel: string;
  /** Top-level directory under the graph — `proposals`, `retired`, `scripts`. */
  readonly group: string;
  readonly state: DeclState;
  /** The file's own title, where it has one. */
  readonly title?: string;
}

/**
 * The graph's directory, READ FROM THE DECLARATION.
 *
 * Not `join(REPO, "fsh-guts")`. The path is declared, it is `repository`
 * scoped, and a literal here is the `check:declared-assets` shape — a
 * generator that keeps working after the directory moves, over nothing.
 */
export function gutsDir(repo = REPO): string | undefined {
  // The shared resolution (bean 9c7h): the checkout's root layer declares
  // it since placement PR0a, and `fshGutsDirectories` reads cat-harness's own
  // declaration after it, as this function did. More than one declared
  // trashcan is no single answer, so it is `undefined`, never "the first".
  try {
    return fshGutsDirectory(repo);
  } catch {
    return undefined;
  }
}

/** The declarations that may hold the trashcan: the checkout's root layer, then the platform. */
export function pageRelPath(repo = REPO): string | undefined {
  try {
    const cat = existsSync(join(repo, "cat-harness")) ? join(repo, "cat-harness") : repo;
    return visualiserSitePath(cat, VIEWER_TOOL).rel;
  } catch {
    return undefined;
  }
}

/** Every file under `dir`, relative, sorted, dotfiles skipped. */
function walk(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/** A file's first markdown heading, where it has one. */
function titleOf(abs: string): string | undefined {
  // MARKDOWN ONLY. `readFileSync(..., "utf-8")` does not throw on a PDF — it
  // returns the bytes with every invalid sequence replaced — so the regex
  // below happily matched inside binary and the page rendered raw PDF
  // fragments as a file's title. Seen 2026-09-30, the moment 33 archived
  // sources arrived: four rows of the table came out as mojibake.
  //
  // A non-markdown file's title comes from its `.md` sidecar, which the
  // caller resolves; there was never a reason to open the file itself.
  if (!abs.endsWith(".md")) return undefined;
  let text: string;
  try {
    text = readFileSync(abs, "utf-8");
  } catch {
    return undefined;
  }
  const m = /^#\s+(.+)$/m.exec(text);
  return m?.[1]?.trim();
}

/**
 * Tracked files under `dir`: when mounted from a state branch, read from the
 * mount marker so untracked local files (e.g. `fsh-guts/logs/*.json` written
 * by the activity logger) are excluded. Falls back to a filesystem walk when
 * not a mount (e.g. in test fixtures).
 */
function trackedRels(dir: string, repo = REPO): string[] {
  let m: ReturnType<typeof readMarker>;
  try {
    m = readMarker(repo, KIND);
  } catch (e) {
    // Outside a git checkout (the standalone layer copy) there is no mount
    // to consult, so the walk is the answer rather than an error.
    if (!(e instanceof BranchStoreUsageError)) throw e;
  }
  if (m && resolve(repo, m.into) === resolve(dir)) {
    return Object.keys(m.files)
      .filter((r) => existsSync(join(dir, r)))
      .sort();
  }
  return walk(dir);
}

/**
 * Read the corpus and classify every file.
 *
 * Exported so the classification is unit-testable without the page: the
 * `sidecar` state is the part most easily got wrong, and a test that went
 * through the rendered markdown would be testing the table renderer.
 */
export function gutsFiles(dir: string, repo = REPO): GutsFile[] {
  const rels = trackedRels(dir, repo);
  // Only a file that can CARRY a node is opened: markdown front matter or a
  // top-level JSON `$schema` (`readFshGutsNode`). Since the separation the
  // trashcan holds each separated layer's in-tree copy as a `.tar.gz`
  // (272 MB with the uploaded PDFs), and decoding every byte of it to search
  // for the tag took ~6 s a run — past the 5 s budget of the test that runs
  // this writer. Same rule as `titleOf` above, for the same reason.
  const tagged = new Set(
    withoutFrozenSubtrees(dir, rels).live.filter((r) => {
      if (!/\.(?:md|json)$/i.test(r)) return false;
      try {
        return readFileSync(join(dir, r), "utf-8").includes(TAG);
      } catch {
        return false;
      }
    }),
  );
  // A FROZEN subtree (sub-kg-lifecycle stage 13) is ONE row, not one per
  // file: it is another repository's state at one commit, described as a
  // whole by its tagged sibling note — the `sidecar` relation, at directory
  // scale. Listing its thousands of files would bury the corpus this page
  // indexes (7.7k of them arrived at once on 2026-10-06, bean 61t6).
  const { live, frozen } = withoutFrozenSubtrees(dir, rels);
  const subtreeRows: GutsFile[] = frozen.map((d) => {
    const title = frozenSubtreeNote(join(dir, d))?.title;
    return { rel: `${d}/`, group: d.split("/")[0]!, state: "sidecar", ...(title ? { title } : {}) };
  });
  const fileRows = live.map((rel): GutsFile => {
    const slash = rel.lastIndexOf("/");
    const group = slash === -1 ? "." : rel.slice(0, rel.indexOf("/"));
    let state: DeclState = "undeclared";
    if (tagged.has(rel)) state = "declared";
    // ANY non-markdown file, not a hand-listed set of extensions. The rule is
    // "this format cannot carry YAML front matter", and that is true of a PDF
    // and a JSON exactly as it is of a `.py`. Listing extensions made the
    // check answer a narrower question than its own docblock states, and the
    // 2026-09-30 upload sweep walked straight into it: 40 archived sources and
    // their extraction companions each have a tagged `.md` sibling and every
    // one read as `undeclared` — a false finding, in the direction that looks
    // like a violation. `detangle-schema-viewer.html` had been reading that
    // way since it arrived.
    else if (!rel.endsWith(".md") && tagged.has(rel.replace(/\.[^./]+$/, ".md"))) state = "sidecar";
    const title = titleOf(join(dir, rel));
    return { rel, group, state, ...(title ? { title } : {}) };
  });
  return [...fileRows, ...subtreeRows].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

const BADGE: Record<DeclState, string> = {
  declared: '<span class="fg-tag fg-ok">declared</span>',
  sidecar: '<span class="fg-tag fg-side">via sidecar</span>',
  undeclared: '<span class="fg-tag fg-gap">undeclared</span>',
};

const CSS = `
.fg-tag{display:inline-block;padding:.05rem .4rem;border-radius:3px;font-size:.75rem;
  font-weight:600;white-space:nowrap;border:1px solid currentColor}
/* Work item rtuo: light-page inks measured 2.19-2.29:1 on the default dark page
   (#27262b). Dark inks by default; the light scheme keeps the originals. */
.fg-ok{color:#5cd3bd}    /* 8.23:1 on #27262b */
.fg-side{color:#b9a8ec}  /* 7.06:1 */
.fg-gap{color:#f5a070}   /* 7.25:1 */
:root[data-fa-scheme="light"] .fg-ok{color:#0d6e5e}
:root[data-fa-scheme="light"] .fg-side{color:#6b5b95}
:root[data-fa-scheme="light"] .fg-gap{color:#a8430f}
`;

/** Escape a cell so a filename containing a pipe cannot break the table. */
function cell(v: string): string {
  return v.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
}

/** Escape an attribute value so quotes cannot break the tag. */
function escAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/[\\|]/g, "\\$&");
}

export function page(files: GutsFile[], blobBase: string): string {
  const counts: Record<DeclState, number> = { declared: 0, sidecar: 0, undeclared: 0 };
  for (const f of files) counts[f.state]++;
  const groups = [...new Set(files.map((f) => f.group))].sort();

  const body: string[] = [
    "---",
    'title: "fsh-guts — the trashcan that is kept"',
    'description: "Deprecated and throwaway structured content, kept rather than deleted. Not published to the canonical site."',
    "---",
    `<style>${CSS}</style>`,
    "",
    "This page is **not on the published site**. It is declared",
    "`publish: \"staging-only\"`, so `compose-docs.ts` withholds it from the canonical",
    "deploy and includes it in a local build or a `STAGING/<slug>/` preview.",
    "",
    "`fsh-guts` holds content that was **relocated rather than deleted**. The rule",
    "it makes enforceable is the one `AGENTS.md` states for work items and means",
    "generally: a scrapped item stops the next agent re-entering a dead end, while",
    "a deleted one cannot be told from an accident. Delete here means relocate, and",
    "relocate is reversible.",
    "",
    `**${files.length} file(s)** across ${groups.length} group(s). Each links to the file itself —`,
    "this page indexes what is kept, it does not republish it.",
    "",
    "> **Count relationship:** This page indexes all tracked files across the repository's trashcan.",
    "> The interactive viewer (▦ Actions → Settings → Discarded or navigation bar fish icon) inspects",
    `> the declared items from the \`@graph\` export (${counts.declared} declared nodes) plus any stickies discarded locally in this browser.`,
    "",
    "## Does each file declare itself?",
    "",
    `The graph's declaration says files carry \`$schema: ${TAG}\`. Three states,`,
    "kept apart on purpose: a `.py` or `.ts` script **cannot** carry YAML front",
    "matter, so a tagged `.md` sibling is the contract met by the only mechanism",
    "open to it. Filing that beside a markdown file that simply omitted the line",
    "would make the format's limit and somebody's omission look the same.",
    "",
    "| state | files | what it means |",
    "|---|---|---|",
    `| ${BADGE.declared} | ${counts.declared} | carries the tag itself |`,
    `| ${BADGE.sidecar} | ${counts.sidecar} | a script, or a frozen copy of a separated graph, described by a tagged \`.md\` sibling |`,
    `| ${BADGE.undeclared} | ${counts.undeclared} | **neither** — a gap, not a format limit |`,
    "",
  ];

  if (counts.undeclared > 0) {
    body.push(
      `The ${counts.undeclared} undeclared are listed below with the rest rather than in a`,
      "separate section: they are part of the corpus, and a gap hidden behind a",
      "summary count is the failure this table exists to avoid.",
      "",
    );
  }

  for (const g of groups) {
    const inGroup = files.filter((f) => f.group === g);
    body.push(`## ${g === "." ? "at the root" : g}`, "", `${inGroup.length} file(s).`, "");
    body.push("| file | what it is | declares itself |", "|---|---|---|");
    for (const f of inGroup) {
      const name = f.rel.slice(f.group === "." ? 0 : f.group.length + 1);
      const link = `<a href="${blobBase}/${f.rel}" target="_blank" rel="noopener noreferrer" title="View on GitHub" aria-label="${escAttr(name)} (opens on GitHub)">${cell(name)} ↗</a>`;
      body.push(
        `| ${link} | ${cell(f.title ?? "—")} | ${BADGE[f.state]} |`,
      );
    }
    body.push("");
  }
  return body.join("\n").trimEnd() + "\n";
}

/**
 * The base docs layer — the SAME answer `compose-docs.ts` uses, not a literal.
 *
 * `site-dir-single-answer.test.ts` refuses a hardcoded site root here and is
 * right to: the root has moved twice (beans `x4a6`, `wggr`), and a generator
 * holding its own copy keeps writing where the site used to be while every
 * check reports clean.
 *
 * `docsLayers()` rather than `siteDirFor()`, and the difference bit once
 * already: `siteDirFor` answers RELATIVE TO A LAYER (`"docs"`), so
 * `join(repo, siteDirFor(...))` resolves to the repository's OVERLAY layer
 * rather than to `cat-harness`'s base. `docsLayers` reads both from the
 * declaration and marks which is which, so asking it is the one answer —
 * and it is the same one the composer withholds against.
 */

if (import.meta.main) {
  exitUnlessMounted("fsh-guts", "gen-fsh-guts-viz", REPO);
  const check = process.argv.includes("--check");
  const dir = gutsDir();
  if (dir === undefined || !existsSync(dir)) {
    // A declared graph with no directory is the `dh4f` shape: scanning nothing
    // and reporting a clean run. Refuse rather than write an empty page.
    console.error("::error::gen-fsh-guts-viz: no directory declared for graph typology 'fsh-guts'");
    process.exit(1);
  }
  const files = gutsFiles(dir);
  // A directory that EXISTS and holds nothing is a store nobody has relocated
  // anything into yet (a downstream's freshly seeded `cat/<instance>/fsh-guts`),
  // not the `dh4f` shape above: the page says "0 file(s)", which is true, rather
  // than failing the site build that owes it.
  if (files.length === 0) console.log(`gen-fsh-guts-viz: ${relative(REPO, dir)} holds no kept file yet; writing the empty index`);
  const blobBase = `https://github.com/litlfred/folio-assistant/blob/main/${relative(REPO, dir)}`;
  const rendered = page(files, blobBase);
  const PAGE = pageRelPath(REPO);
  if (PAGE === undefined) {
    // No declared visualiser means no withholding either, so writing a page
    // here would publish it. Refuse rather than choose a path.
    console.error(`::error::gen-fsh-guts-viz: no visualiser declared for graph typology '${KIND}'`);
    process.exit(1);
  }
  const INSTANCE_ROOT = HARNESS_ROOT;
  const docsRoot = localSiteDir(INSTANCE_ROOT) ?? baseDocsDir(REPO);
  const ownOut = join(docsRoot, PAGE);
  // `--site <dir>`: a site being built gets the page at the same route (`visualiser-writers.ts`).
  const out = join(siteTarget(docsRoot), PAGE);

  let isPublishArtefact = false;
  try {
    isPublishArtefact = publishPlan(REPO).some((a) => join(REPO, a.artefact) === ownOut);
  } catch {
    try {
      isPublishArtefact = publishPlan(INSTANCE_ROOT).some((a) => join(INSTANCE_ROOT, a.artefact) === ownOut);
    } catch {
      isPublishArtefact = false;
    }
  }

  if (check && isPublishArtefact) {
    // Built at publish (bean 0b8c, #2230): the page is derived from a graph
    // kept on a branch, so there is no committed copy to compare against —
    // a comparison would go red on main and every PR the moment somebody
    // writes to the branch, which is exactly what happened on 2026-10-05.
    // What is left to judge is that the graph renders: mounted, declared,
    // non-empty, and the page built without error (all checked above).
    console.log(`✓ fsh-guts viewer renders — ${files.length} file(s); built at publish by \`derive:publish\`, never committed`);
  } else if (check) {
    const current = existsSync(out) ? readFileSync(out, "utf-8") : "";
    if (current !== rendered) {
      console.error(`::error::gen-fsh-guts-viz: ${PAGE} is stale — run \`bun run cat fsh-guts:viz\``);
      process.exit(1);
    }
    console.log(`✓ fsh-guts viewer is current — ${files.length} file(s)`);
  } else {
    mkdirSync(join(out, ".."), { recursive: true });
    writeFileSync(out, rendered);
    const n = files.filter((f) => f.state === "undeclared").length;
    console.log(`fsh-guts viewer: ${files.length} file(s) → ${PAGE}`);
    console.log(n === 0 ? "  every file declares itself" : `  ${n} undeclared — shown as such on the page`);
  }
}
