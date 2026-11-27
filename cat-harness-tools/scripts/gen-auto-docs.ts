#!/usr/bin/env bun
/**
 * Derived documentation for a sub-graph — one index per (type, sub-graph).
 *
 * @module scripts/gen-auto-docs
 * @covers docs, auto-docs
 *
 * A separate generator because auto-docs is two-axis (a TYPE crossed with a
 * SUB-GRAPH), unlike the one-axis `gen-schema-viz`, `gen-library-viz` and
 * `state-visualizer`. It reuses their routing:
 * `viewerPlacement(site, "<handler>/auto-docs/<type>", …)` (the
 * `<base>/<handler>/<kind>/<subject>` rule with the type as a segment), and
 * `orphanSubjectPages()` prunes the result.
 *
 * ## The sub-graph segment is the declared directory's `id`, not its path
 *
 * - `id` is what the declaration declares and what an override matches on, so
 *   the URL survives the directory moving (as in `state-visualizer.ts`).
 * - It stays one segment, which `orphanSubjectPages` relies on (it scans one
 *   level).
 * - Each page STATES its declared path, so the mapping is on the artefact.
 *
 * The URL does not mirror the tree; the declaration maps id to path.
 *
 * ## What this emits is an INDEX, not the documentation
 *
 * The per-process summary — what each one is FOR, when you would be in it,
 * what it is not — is authored by a human or agent under the `auto-docs`
 * skill, reusing these assets rather than paraphrasing them.
 *
 * ## Empty is not rendered
 *
 * A sub-graph contributing no items of a type gets NO page, so no nav entry
 * resolves to nothing.
 *
 * Usage:
 *   bun run cat auto:docs          # write
 *   bun run cat auto:docs --check  # fail if any artefact is stale, or orphaned
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { orphanSubjectPages, viewerPlacement } from "./gen-schema-viz.ts";
import { classify } from "./check-docs-populated.ts";
import { isSkillMd, kgRoots, skillMdDirs, corpusScopeFor } from "./known-skills.ts";
import { readRoleGraph } from "../schemas/process/role-graph.ts";
import {
  checkoutRootFor,
  findDeclarationFile,
  findInstanceRoot,
  layerRootsIn,
  isExemptFrom,
  readDeclaration,
  repoRootFor,
  resolveDirectories,
  siteDirFor,
  forgeLocation,
} from "../schemas/kg/cat-harness.ts";
import { checkoutDirectories } from "../schemas/kg/harness-config.ts";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { withInlineCode } from "../schemas/content/inline-code.ts";
import { skillPageHref, skillPagesOf } from "./lib/skill-pages.ts";
import { ownElementPattern } from "../schemas/kg/namespaces.js";
import { declaredRoute, declaredVisualisers, forwardingParts, pageParts, renderedPath, siteOwnerDir, tileCountsForPages, visualiserPageDir, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { publishPlan } from "./derive-at-publish.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { themedPage as sharedThemedPage } from "./lib/themed-page.ts";
import { siteTarget } from "./lib/site-target.ts";
import { outputTwinOf, readPathAt, writePathAt } from "./lib/layer-output.ts";
import { inScope, scopeArg, siteScope } from "./lib/site-scope.ts";
import { isGlobalTasksFile } from "../src/workflow/process-model.ts";

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#10;/g, " ").replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/**
 * The process's OWN documentation — a DIRECT child of `bpmn:process`, never
 * the first `<documentation>` anywhere after it opens. A process with none of
 * its own would otherwise borrow its first lane's (measured 2026-09-22: 16 of
 * 61 diagrams did). `(?:bpmn:)?` everywhere: the prefix is a document's choice.
 *
 * The workflow page reads the same fact from the knowledge graph instead —
 * `kg-export` puts the process's documentation on its `Process` node as
 * `summary` and `description` (bean `ax6r`) — so this is the derived HTML
 * index's own reading, not a second store.
 */
export function processDocumentation(xml: string): string | undefined {
  const procOpen = /<(?:bpmn:)?process\b[^>]*>/.exec(xml);
  if (procOpen === null) return undefined;
  const after = xml.slice(procOpen.index + procOpen[0].length);
  const d = /<(?:bpmn:)?documentation\b[^>]*>([\s\S]*?)<\/(?:bpmn:)?documentation>/.exec(after);
  if (d === null) return undefined;
  const between = after.slice(0, d.index).replace(/<!--[\s\S]*?-->/g, "").trim();
  return between === "" ? decodeEntities(d[1]!) : undefined;
}

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "auto-docs-viewer";

// The HARNESS, not this layer: the script moved up in 70lx B2 and still reads cat-harness's declarations.
const ROOT = HARNESS_ROOT;
const REPO_ROOT = repoRootFor(ROOT);
/**
 * The checkout holding the layer. Where it MOUNTS cat-harness, every page this
 * generator computes is written at the layer's output root
 * (`build/layers/cat-harness/…`, `lib/layer-output.ts`) and read back through
 * the overlay, so a run leaves the pinned mount as its lock pins it.
 */
const CHECKOUT = checkoutRootFor(ROOT);
const REPO = join(ROOT, "..");
const check = process.argv.includes("--check");

/** One artefact an index lists. */
export interface AutoDocItem {
  /** Repository-relative path — what a reader opens, and how a sub-graph claims it. */
  path: string;
  /** What to call it in a listing. */
  name: string;
  /**
   * What to print under the name, when the full `path` would only repeat
   * what the row already says. The link still goes to `path`. The glossary
   * sets it: its path is `<ledger>#<notation>`, and the notation is already
   * a fact on the row, so the full path made the term column a path column
   * (bean `n5be`, finding 4).
   */
  pathLabel?: string;
  /** One line, EXTRACTED from the artefact. Absent means the artefact does not carry one. */
  summary?: string;
  /** Type-specific facts, rendered as a small table. */
  facts?: Record<string, string>;
}

/**
 * An extractable documentation type.
 *
 * One `collect` per type, and the contract is the same for all of them —
 * which is the test of whether "auto-docs" names one thing. If a type cannot
 * produce `AutoDocItem[]`, it is a different generator wearing this one's
 * name.
 */
export interface AutoDocType {
  /** The URL segment(s), e.g. `index/skills`. Slashes nest. */
  id: string;
  title: string;
  /**
   * The graph typology whose declared directories hold this type's artefacts.
   *
   * **Not optional, and the first draft not having it was a real defect.**
   * Walking EVERY declared directory reported **1,522** skills where
   * `knownSkills()` finds ~136: `docs/` is declared too, and it holds a
   * generated markdown rendering of every skill, so each one was counted
   * again as though it were a second skill. A RENDERING of an artefact is not
   * the artefact. Naming the graph is what keeps an index about the thing
   * rather than about its copies.
   */
  graph: string;
  /**
   * Where this type's sub-graphs come from, when the ROOT declaration is not
   * the right source.
   *
   * Defaults to {@link declaredDirectories}`(graph)` — the root's own view,
   * which is correct for every type whose dependents' directories the root
   * already declares. `docs` is the exception and the reason this hook
   * exists: the root declares dependents' `skills/` and `library/` but CANNOT
   * declare their `docs/`, because `compose-docs.docsLayers` treats every
   * docs-kind entry in that file as a COMPOSITION LAYER — declaring
   * a DAK IG's `docs/` there overlays its `index.md` onto the site's own.
   * Measured: `compose-docs.test.ts` failed exactly that way when tried.
   *
   * So the docs type asks each layer about itself instead, which is what
   * `mount-instance-docs` already does.
   */
  directories?: () => Array<{ id: string; absPath: string; path: string }>;
  /** One line on the page saying what was extracted and from where. */
  extracts: string;
  collect(): AutoDocItem[];
}

/** YAML front matter's `description`, folded to one line. Absent is absent. */
function frontMatterDescription(text: string): string | undefined {
  if (!text.startsWith("---")) return undefined;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return undefined;
  const fm = text.slice(3, end);
  const m = /^description:\s*(.*)$/m.exec(fm);
  if (!m) return undefined;
  let body = m[1]!.trim();
  if (body === ">" || body === "|" || body === ">-" || body === "|-") {
    // A folded block: take the indented lines that follow.
    const after = fm.slice(m.index + m[0].length).split("\n");
    const lines: string[] = [];
    for (const l of after) {
      if (l.trim() === "") continue;
      if (!/^\s+/.test(l)) break;
      lines.push(l.trim());
    }
    body = lines.join(" ");
  }
  return body.replace(/\s+/g, " ").trim() || undefined;
}

/** The first sentence of a longer string, for a listing line. */
/**
 * A pre-rendered page's `<title>`, for the docs index.
 *
 * Docs are not uniformly markdown — the IRIS replica's `docs/` is four `.html` files —
 * so `frontMatterDescription` has nothing to read there. The title is what
 * such a page carries instead, and an absent one yields `undefined` rather
 * than a guess: a listing with no summary says less than a wrong one.
 */
/**
 * Docs directories across EVERY layer, each read from its own declaration.
 *
 * `layerRootsIn` rather than a list: its own docstring records two gates
 * that each carried `["cat-harness", "bootstrap"]` while four layers
 * existed, and reported clean runs over half the subject. A list that must be
 * edited when a directory is added is a list that will be wrong.
 *
 * `scope !== "repository"` matches what `mount-instance-docs` publishes, so
 * this index covers exactly the docs that get a route and no more.
 *
 * Ids are the DECLARING layer's own, which is what makes the sub-page a
 * per-dependency answer — `who-iris-docs`, `smart-trust-docs` — rather than
 * one page for the root's docs and silence about everyone else's.
 */
function docsDirectoriesAcrossInstances(): Array<{ id: string; absPath: string; path: string }> {
  const out = new Map<string, { id: string; absPath: string; path: string }>();
  for (const d of declaredDirectories("docs")) out.set(d.absPath, d);
  for (const instance of layerRootsIn(REPO)) {
    // `findDeclarationFile` returns a BASENAME, not a path — join it.
    // Without the join this reads relative to the process cwd, which silently
    // "works" for whichever layer happens to sit there and fails for every
    // other, leaving one sub-graph where there should be three. That is how
    // the first attempt at this looked correct.
    const declName = findDeclarationFile(instance);
    if (declName === undefined) continue;
    const decl = join(instance, declName);
    let parsed: { directories?: Array<{ id?: string; path?: string; scope?: string; graphTypologies?: string[] }> };
    try {
      parsed = JSON.parse(readFileSync(decl, "utf-8"));
    } catch {
      continue; // an unreadable declaration is somebody else's finding, not a silent drop of this index
    }
    for (const e of parsed.directories ?? []) {
      if (!e.id || !e.path || e.scope === "repository") continue;
      if (!(e.graphTypologies ?? []).includes("docs")) continue;
      const absPath = join(instance, e.path);
      if (!existsSync(absPath) || out.has(absPath)) continue;
      out.set(absPath, { id: e.id, absPath, path: relative(REPO, absPath).split("\\").join("/") });
    }
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

/**
 * Pages a declared visualiser marks `publish: "staging-only"`.
 *
 * `compose-docs.ts` withholds these from the CANONICAL build, and a docs
 * index that reads the source tree walks straight past that decision. It is
 * not cosmetic: `fsh-guts-unpublished.test.ts` asserts the string `fsh-guts`
 * appears NOWHERE in the built export, and listing
 * `cat-harness/docs/fsh-guts/index.md` in this index put it there. The test
 * caught it.
 *
 * Read from the declaration's own `publish` field rather than by name, so a
 * second staging-only page is withheld without editing this file — naming
 * `fsh-guts` here would be a rule true only for the layer somebody
 * remembered.
 */
function stagingOnlyRefs(): Set<string> {
  // Every harness's DECLARED visualisers (owner, 2026-10-09), each at its
  // route — the same route `compose-docs.ts` withholds.
  const out = new Set<string>();
  const site = siteOwnerDir(REPO_ROOT);
  for (const v of declaredVisualisers(REPO_ROOT)) {
    if (v.publish !== "staging-only") continue;
    // At BOTH of its addresses: under the locale segment, where it is written
    // now, and the one before it, where a copy written earlier may still sit.
    const parts = { harness: v.harness, visualiser: v.id };
    for (const at of [pageParts(parts), forwardingParts(parts)]) {
      const dir = renderedPath(REPO_ROOT, visualiserPageDir(site, at));
      for (const f of ["index.md", "index.html"]) out.add(`${dir}/${f}`);
    }
  }
  return out;
}

function htmlTitle(text: string): string | undefined {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(text);
  const t = m?.[1]?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
}

function firstSentence(s: string, max = 220): string {
  const one = s.replace(/\s+/g, " ").trim();
  const stop = one.search(/\.\s|\.$/);
  const cut = stop > 0 ? one.slice(0, stop + 1) : one;
  return cut.length > max ? cut.slice(0, max - 1).trimEnd() + "…" : cut;
}

function walk(dir: string, pred: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    // A dot-prefixed segment is skipped for the reason `directory-conventions`
    // gives: it is not a place this graph declares.
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) out.push(...walk(p, pred));
    else if (pred(e.name)) out.push(p);
  }
  return out.sort();
}

/**
 * The declared directories holding one graph typology, by id.
 *
 * Existence-filtered, because a declared-but-absent directory is the `dh4f`
 * defect — a consumer scans nothing and reports a clean run over it.
 */
export function declaredDirectories(graph: string): Array<{ id: string; absPath: string; path: string; instance: string }> {
  // The CORPUS this handler documents (placement PR0, bean `ejye`): this
  // layer plus everything stacked on it, which the platform's
  // `scope: "repository"` mirrors used to supply under ids of their own. Each
  // directory now keeps its OWNER's id; one that collides with an id already
  // taken (the DAK base layer's `processes`) is qualified by its layer, which is
  // the mirror id it had (`<instance>-processes`).
  const own = new Set(resolveDirectories([{ name: "(local)", root: ROOT, own: true }]).map((d) => d.absPath));
  const all = checkoutDirectories(ROOT, { stackedOn: ROOT })
    .filter((d) => (d.graphTypologies ?? []).includes(graph as never) && existsSync(d.absPath))
    .sort((a, b) => Number(!own.has(a.absPath)) - Number(!own.has(b.absPath)));
  const taken = new Set<string>();
  const out: Array<{ id: string; absPath: string; path: string; instance: string }> = [];
  for (const d of all) {
    const instance = d.member ?? d.declaredBy;
    const id = taken.has(d.id) ? `${instance}-${d.id}` : d.id;
    taken.add(id);
    out.push({ id, absPath: d.absPath, path: relative(REPO, d.absPath).split("\\").join("/"), instance });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, "en"));
}

/**
 * The types this handler implements.
 *
 * **`toc` is deliberately absent.** It was in the owner's first list and was
 * withdrawn in the same session — *"no toc,... ther is no meanging at folio
 * level"* — because a table of contents is a document-order notion and a
 * sub-graph has no single order to take one over. Recorded here as well as on
 * the bean, since this array is what a reader checks against that list.
 *
 * `glossary` was "declared but not built, bean `lqo9` holds a roast that gates
 * it". **That roast is held and slice 2 shipped**, so it is built below and
 * reads the ledger that slice writes.
 *
 * Still declared but NOT built: `index`, `index/bpmn`, `index/dmn`,
 * `index/tasks`, `index/roles`. Absent rather than stubbed: a type that emits
 * an empty page is indistinguishable from one whose sub-graphs are empty.
 */
/**
 * Every file under a graph's declared directories that `keep` admits, as
 * `AutoDocItem`s — read from the GIT CORPUS, not from the disk.
 *
 * Factored out because the four types added 2026-10-03 (`index/schemas`,
 * `index/tools`, `uml`, `lsi`) differ only in their extension filter and their
 * summary source, and writing the walk four times is how four copies drift into
 * four answers to "what counts as an artefact of this graph".
 *
 * **It uses `gitFiles` because the first draft used `readdirSync`, and that was
 * a measured defect rather than a style point.** The disk walk admitted
 * `cat-harness/schemas/block-qa-schema/dist/index.d.ts` — a gitignored build
 * output present in a working container and absent from a fresh checkout — so
 * `index/schemas` emitted **155** rows here and **154** in CI, `auto:docs`
 * wrote a different page in each, and `Skill-registration chain, unmasked
 * (hard)` went red on a tree that was green locally. `skill-register.ts`'s own
 * closing note names this exact trap — *"if it is red in CI but green here: ask
 * git what the corpus is, not the disk"* — citing a gitignored `node_modules/`
 * that inflated `cat-harness/schemas` from 227 nodes to 1441. An index of a
 * graph is an index of what the repository HOLDS, and git is what says so.
 *
 * `gitFiles` falls back to a walk where git cannot answer, skipping only `.git`
 * and `node_modules`, so the two paths admit the same set wherever git works.
 *
 * It descends RECURSIVELY, which `index/skills` deliberately does not — and the
 * difference is not an oversight. A skill's directory holds supporting pages
 * that are not skills, so that type asks `skillMdDirs()` instead. These four
 * have no such sub-artefact: a `.puml` under `uml/overview/<instance>/` is a
 * model, and an `.lsi.json` at any depth is an index.
 */
function filesOfGraph(
  graph: string,
  keep: (file: string) => boolean,
  summarise?: (abs: string) => string | undefined,
): AutoDocItem[] {
  const items: AutoDocItem[] = [];
  for (const d of declaredDirectories(graph)) {
    if (!existsSync(d.absPath)) continue;
    const { files } = gitFiles(
      d.absPath,
      (rel) => !rel.split("/").some((s) => s.startsWith(".")) && keep(basename(rel)),
    );
    for (const abs of files) {
      items.push({
        path: relative(REPO, abs).split("\\").join("/"),
        name: basename(abs).replace(/\.(ts|json|puml)$/, ""),
        summary: summarise?.(abs),
      });
    }
  }
  return dedupeByPath(items);
}

/** The first sentence of a leading `/** … *\/` module docblock, if there is one. */
function docblockSummary(abs: string): string | undefined {
  const text = readFileSync(abs, "utf-8").slice(0, 4000);
  const m = /\/\*\*([\s\S]*?)\*\//.exec(text);
  if (!m) return undefined;
  const body = m[1]!
    .split("\n")
    .map((l) => l.replace(/^\s*\*ic?\s?/, "").replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l !== "" && !l.startsWith("@"))
    .join(" ")
    .trim();
  return body === "" ? undefined : firstSentence(body);
}

/**
 * Every `.bpmn` in a declared `processes` graph, as `[repo-relative path, xml]`.
 *
 * Shared by `index/tasks` and `index/dmn`'s sibling so neither re-implements
 * the walk, and read through `gitFiles` for the reason `filesOfGraph` records:
 * a disk walk admits whatever the last build left behind.
 */
function processSources(ext = ".bpmn"): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const d of declaredDirectories("processes")) {
    if (!existsSync(d.absPath) || seen.has(d.absPath)) continue;
    seen.add(d.absPath);
    const { files } = gitFiles(d.absPath, (rel) => !rel.split("/").some((s) => s.startsWith(".")) && rel.endsWith(ext));
    for (const abs of files) out.push([relative(REPO, abs).split("\\").join("/"), readFileSync(abs, "utf-8")]);
  }
  return out;
}

/** Each global task a `.bpmn` defines, by id, with the skill refs inside it. */
function globalTaskSkills(xml: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /<((?:[\w.-]+:)?global(?:User|Script|Manual|BusinessRule)?Task)\b[^>]*?\sid="([^"]+)"[^>]*?(\/?)>/g;
  for (const m of xml.matchAll(re)) {
    if (m[3] === "/") {
      out.set(m[2]!, []);
      continue;
    }
    const start = m.index! + m[0].length;
    const end = xml.indexOf(`</${m[1]}>`, start);
    const body = xml.slice(start, end < 0 ? undefined : end);
    out.set(m[2]!, [...new Set([...body.matchAll(/<[\w.-]+:skill\b[^>]*\sref="([^"]+)"/g)].map((x) => x[1]!))]);
  }
  return out;
}

/** One row per file of `ext`, named by `nameRe`'s first group, else the filename. */
function bpmnishFiles(ext: string, nameRe: RegExp): AutoDocItem[] {
  const items: AutoDocItem[] = [];
  for (const [rel, xml] of processSources(ext)) {
    items.push({
      path: rel,
      name: nameRe.exec(xml)?.[1]?.trim() || basename(rel, ext),
      summary: /<(?:dmn:|bpmn:)?description[^>]*>([^<]+)</.exec(xml)?.[1]?.trim(),
    });
  }
  return dedupeByPath(items);
}

function skillsDirectoriesAcrossInstances(): Array<{ id: string; absPath: string; path: string }> {
  const out = new Map<string, { id: string; absPath: string; path: string }>();
  for (const d of declaredDirectories("skills")) out.set(d.absPath, d);
  for (const instance of layerRootsIn(REPO)) {
    const decl = readDeclaration(instance);
    if (!decl || isExemptFrom(decl, "visualiser")) continue;
    for (const e of decl.directories ?? []) {
      if (!e.id || !e.path || e.scope === "repository") continue;
      if (!(e.graphTypologies ?? []).includes("skills")) continue;
      const absPath = join(instance, e.path);
      if (!existsSync(absPath) || out.has(absPath)) continue;
      out.set(absPath, { id: e.id, absPath, path: relative(REPO, absPath).split("\\").join("/") });
    }
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}

export const TYPES: AutoDocType[] = [
  {
    id: "index/skills",
    title: "Skills",
    graph: "skills",
    directories: skillsDirectoriesAcrossInstances,
    extracts: "every skill markdown file, with the description it declares in its own front matter",
    collect(): AutoDocItem[] {
      // `skillMdDirs()`, NOT a recursive walk of the declared directories.
      //
      // The first draft walked them recursively and reported 227 skills
      // against `knownSkills()`'s 219. The seven extras were all the same
      // shape — `skills/<package>/<skill>/<page>.md`, a SUPPORTING PAGE of a
      // skill rather than a skill — and `isSkillMd` accepts them because they
      // carry the same front matter. `knownSkills` gets this right by listing
      // the directories that hold skill markdown instead of descending into
      // whatever is under them, so this asks the same function rather than
      // re-deriving the rule and disagreeing by seven.
      const items: AutoDocItem[] = [];
      const roots: Array<[string, string[][]]> = [[ROOT, skillMdDirs(ROOT, corpusScopeFor(ROOT))]];
      for (const instance of layerRootsIn(REPO)) {
        const decl = readDeclaration(instance);
        if (!decl || isExemptFrom(decl, "visualiser")) continue;
        roots.push([instance, skillMdDirs(instance, "instance")]);
      }
      for (const [base, dirs] of roots) {
        for (const parts of dirs) {
          const dir = join(base, ...parts);
          if (!existsSync(dir)) continue;
          for (const f of readdirSync(dir)) {
            if (!f.endsWith(".md")) continue;
            const abs = join(dir, f);
            // Per FILE, not per directory: admitting a package says the
            // directory holds skills, never that everything in it is one.
            if (!isSkillMd(abs)) continue;
            const desc = frontMatterDescription(readFileSync(abs, "utf-8"));
            items.push({
              path: relative(REPO, abs).split("\\").join("/"),
              name: basename(f, ".md"),
              summary: desc ? firstSentence(desc) : undefined,
            });
          }
        }
      }
      return dedupeByPath(items);
    },
  },
  {
    id: "index/schemas",
    title: "Schemas",
    graph: "schemas",
    extracts: "every schema module a declared `schemas` directory holds, with the first sentence of its module docblock",
    collect(): AutoDocItem[] {
      return filesOfGraph("schemas", (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"), docblockSummary);
    },
  },
  {
    id: "index/tools",
    title: "Tools",
    graph: "tools",
    // `.ts`, not `.json`. A Tool definition here is a TypeScript module
    // (`mcp.ts`, `viewers.ts`, `vocab-map.ts`), and the first draft of this
    // type filtered for `.json` on the strength of `AGENTS.md` calling them
    // "Tool definitions, themselves KG nodes". It emitted **0 items across 0
    // sub-graphs** and reported `✓` — which is the vacuous pass this corpus
    // keeps paying for: a type that finds nothing is indistinguishable from a
    // graph that holds nothing. Measured against the directory, not recalled.
    extracts: "every Tool module a declared `tools` directory holds, with the first sentence of its module docblock",
    collect(): AutoDocItem[] {
      return filesOfGraph("tools", (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"), docblockSummary);
    },
  },
  {
    id: "uml",
    title: "UML",
    graph: "uml",
    // `.puml` only, though each model is emitted as BOTH `.puml` and `.mmd`.
    // Listing both would double every row for one model in two notations —
    // the `index/skills` defect (a RENDERING is not the artefact) in a second
    // form. The `.mmd` sibling is reachable from the rendered page, which
    // links both sources.
    extracts: "every UML model a declared `uml` directory holds, one row per model rather than per notation",
    collect(): AutoDocItem[] {
      return filesOfGraph("uml", (f) => f.endsWith(".puml"));
    },
  },
  // There was an `lsi` type here until 2026-10-04 (bean `tqjj`), listing every
  // `.lsi.json` a declared `qa` directory held. It is GONE rather than fixed,
  // and the guard below is what settled that:
  //
  // The LSI index sidecars are no longer committed — their record is the
  // commit-keyed entry on the `qa-reports` branch — so `filesOfGraph`, which
  // reads the COMMITTED tree by contract, collects nothing while the `qa`
  // directories still hold 1,215 other files. The guard read that as "the
  // reader is wrong, or its source moved" and refused, correctly by its own
  // discrimination: files are there and the type cannot see them.
  //
  // The two repairs available were both worse than removal:
  //
  //   · read the FILESYSTEM instead of git — the index would then be listed
  //     or not depending on whether this container happens to hold a working
  //     copy, which is precisely bean `in5a`'s defect;
  //   · narrow the guard so this type may report zero — that spends the one
  //     check standing between an empty index and a vacuous `✓`.
  //
  // And the page it drew was already a second answer to a question that has
  // one: `cat-harness/docs/lsi/index.md` IS the index of the indexes — its
  // committed half lists every declared prose graph and whether it needs one,
  // and the docs-site build adds each index's detail from the record on the
  // branch. A docs-auto type over a family `main` does not carry can only ever
  // report zero, and a docs-auto index is for the committed tree.
  {
    id: "index/roles",
    title: "Roles",
    // `scenarios`, because that is where `roles.json` is declared. A role is
    // not a file of its own, so this type reads the role GRAPH rather than
    // walking for an extension — `readRoleGraph` is the same reader the
    // `glossary` type already uses, asked once instead of re-derived.
    graph: "scenarios",
    extracts: "every role a declared `scenarios` graph defines, with the description it declares",
    collect(): AutoDocItem[] {
      const items: AutoDocItem[] = [];
      for (const d of declaredDirectories("scenarios")) {
        // `d.absPath`, NOT its parent. `readRoleGraph`'s own docblock says so:
        // *"callers that hand this function every declared graph root pass the
        // scenarios directory ITSELF"* — the role graph became a declared
        // directory on 2026-09-21 rather than a subdirectory of one. The first
        // draft passed `dirname()` and this type emitted **0 items across 0
        // sub-graphs** while printing `✓`, which is the same vacuous pass
        // `index/tools` shipped with an hour earlier.
        for (const r of readRoleGraph(d.absPath)?.roles ?? []) {
          items.push({
            path: `${relative(REPO, d.absPath).split("\\").join("/")}/roles.json#${r.id}`,
            name: r.title ?? r.id,
            summary: r.description ? firstSentence(r.description) : undefined,
          });
        }
      }
      return dedupeByPath(items);
    },
  },
  {
    id: "index/dmn",
    title: "Decisions",
    graph: "processes",
    extracts: "every DMN decision table a declared `processes` graph holds, with the decision's own name",
    collect(): AutoDocItem[] {
      return bpmnishFiles(".dmn", /<(?:dmn:)?decision[^>]*\sname="([^"]*)"/);
    },
  },
  {
    id: "index/tasks",
    title: "Tasks",
    graph: "processes",
    // Activities ACROSS processes, which is a different granularity from
    // `index/processes` — that type answers "what processes are there", this
    // one "what work do they contain". Listing a process here as well would
    // be the double-count `AutoDocType.graph` exists to prevent.
    extracts: "every named activity in a declared `processes` graph — task, user, service, manual, script and call activities",
    collect(): AutoDocItem[] {
      const items: AutoDocItem[] = [];
      for (const [rel, xml] of processSources()) {
        // `(?:bpmn:)?` on the element, for the reason `index/processes`
        // records: the prefix is a DOCUMENT's choice, and
        // `translation-workflow.bpmn` declares BPMN as the default namespace
        // and writes its activities unprefixed. A prefixed-only regex reads
        // that file as having no work in it at all.
        const re =
          /<(?:bpmn:)?(task|userTask|serviceTask|manualTask|scriptTask|callActivity)\b[^>]*\sname="([^"]*)"[^>]*>/g;
        for (const m of xml.matchAll(re)) {
          const kind = m[1]!;
          const label = m[2]!.replace(/\s+/g, " ").trim();
          // An UNNAMED activity is skipped rather than listed under its id: a
          // row whose name is `Activity_1x2y3z` tells a reader nothing and
          // makes the index look populated. Absent is the honest state, and
          // `check-lane-documentation` is what reports the omission.
          if (label === "") continue;
          items.push({ path: `${rel}#${label}`, name: label, summary: `${kind} in ${basename(rel, ".bpmn")}` });
        }
      }
      return dedupeByPath(items);
    },
  },
  {
    id: "index/docs",
    title: "Docs",
    graph: "docs",
    directories: docsDirectoriesAcrossInstances,
    extracts:
      "every AUTHORED documentation page an instance publishes, with the title and description its own front matter declares",
    collect(): AutoDocItem[] {
      // AUTHORED only, and `classify` from `check-docs-populated.ts` is what
      // decides — imported rather than re-derived.
      //
      // 261 of this layer's 316 docs markdown files are the GENERATED
      // reference (`docs/reference/**`, written by `gen-schema-docs` and
      // `gen-skill-docs`), plus this generator's own output under
      // `auto-docs/`. Listing them would bury the ~55 authored pages a reader
      // came for, and duplicate `index/skills`, which already lists the skill
      // instruction bodies those pages are generated FROM.
      //
      // The obvious implementation is a list of directory names to skip, and
      // it is the wrong one twice over: it is the hardcoded path literal
      // `check:declared-paths` refuses, and it would be a SECOND answer to
      // "is this page generated" — `check-docs-populated.ts` already owns
      // that question, having learned the hard way that a substring search
      // for "generated by" marks an authored page that merely DESCRIBES a
      // generator. Its anchored markers are the tested rule; this reuses them.
      // `.html` AS WELL AS `.md`, and that is not defensive breadth.
      // The IRIS replica's `docs/` holds FOUR pages and every one is `.html` —
      // pre-rendered rather than Jekyll source. An `.md`-only filter reports
      // that layer as having no documentation while it publishes four
      // pages, which is the `dh4f` shape: a consumer scanning nothing and
      // calling the result clean. Measured before this was written.
      const items: AutoDocItem[] = [];
      // A page BUILT AT PUBLISH (bean 0b8c) is derived, never authored, and
      // is on disk only where `derive:publish` happened to run — counting it
      // made this index differ between a local tree and CI's.
      const withheld = new Set([...stagingOnlyRefs(), ...publishPlan(REPO).map((a) => a.artefact)]);
      for (const d of docsDirectoriesAcrossInstances()) {
        for (const abs of walk(d.absPath, (n) => n.endsWith(".md") || n.endsWith(".html"))) {
          const rel = relative(REPO, abs).split("\\").join("/");
          if (withheld.has(rel)) continue;
          const text = readFileSync(abs, "utf-8");
          if (classify(abs, text) === "generated") continue;
          const md = abs.endsWith(".md");
          const desc = md ? frontMatterDescription(text) : htmlTitle(text);
          items.push({
            path: relative(REPO, abs).split("\\").join("/"),
            name: basename(abs, md ? ".md" : ".html"),
            summary: desc ? firstSentence(desc) : undefined,
          });
        }
      }
      return dedupeByPath(items);
    },
  },
  {
    id: "index/processes",
    title: "Processes",
    graph: "processes",
    extracts: "every BPMN process, with its own documentation, its lanes, and the skills its activities name",
    collect(): AutoDocItem[] {
      const items: AutoDocItem[] = [];
      // BOTH the split kind and the umbrella it came out of. `processes` is
      // where an in-tree diagram lives after 2026-09-21; `cat-harness` is
      // where a downstream layer's still is, and dropping it would make
      // this index silently empty for them — which is worse than useless,
      // because an empty index reads as "this instance has no processes".
      //
      // This comment said `workflows` until the kind was renamed later the
      // same day, while the call below already read `processes` — a comment
      // naming a kind the code does not use is the one kind of staleness a
      // type checker cannot catch.
      const seen = new Set<string>();
      for (const d of [...declaredDirectories("processes"), ...declaredDirectories("cat-harness")]) {
        if (seen.has(d.absPath)) continue;
        seen.add(d.absPath);
        // This directory's global tasks, by id → skills: a layer shares its
        // steps within itself only (c1), so one directory's file is enough.
        const globalsHere = new Map<string, string[]>();
        for (const f of walk(d.absPath, (n) => n.endsWith(".bpmn"))) {
          const xml = readFileSync(f, "utf-8");
          if (isGlobalTasksFile(xml)) for (const [id, sk] of globalTaskSkills(xml)) globalsHere.set(id, sk);
        }
        for (const f of walk(d.absPath, (n) => n.endsWith(".bpmn"))) {
          const xml = readFileSync(f, "utf-8");
          // `(?:bpmn:)?` on EVERY element, because the prefix is a document's
          // choice and not a fact about BPMN. `translation-workflow.bpmn`
          // declares BPMN as the DEFAULT namespace and writes `<lane>`,
          // `<userTask>`, `<documentation>` unprefixed — valid, and invisible
          // to a prefixed regex.
          //
          // It did not vanish from this index, which is why it survived: the
          // entry appeared, fell back to its FILENAME for a name, and showed
          // no lanes, no skills and no summary. An absent row might have been
          // noticed; an empty one reads as a diagram with nothing to say.
          // Found 2026-09-22 — the same defect in a fourth reader, after
          // `check-lane-documentation` and `glossary-export`.
          const name = /<(?:bpmn:)?process[^>]*\sname="([^"]*)"/.exec(xml)?.[1];
          // The process's OWN documentation — a DIRECT child, not the first
          // `<documentation>` anywhere after the process opens.
          //
          // Measured 2026-09-22: **16 of 61 diagrams** were showing a LANE's
          // documentation as the process summary. The old regex took the
          // first match in the file, and a process with no documentation of
          // its own therefore borrowed its first lane's.
          //
          // It was correct until two days earlier, and that is the instructive
          // part: bean `sqtq` wrote 157 lane `<documentation>` elements, and
          // every diagram whose process carried none started presenting a
          // lane's instead. A generated index, compared by a check against its
          // own generator, so nothing went red — the defect arrived with the
          // fix to a different one.
          // A layer's shared global-tasks file (owner, 2026-10-20, "a1") holds
          // no process: listed as what it is, and its tasks' skills counted on
          // the processes that call them, so moving a step there loses no row.
          if (isGlobalTasksFile(xml)) {
            const defs = globalTaskSkills(xml);
            const shared = [...new Set([...defs.values()].flat())].sort();
            items.push({
              path: relative(REPO, f).split("\\").join("/"),
              // Named by its LAYER, not its file: every layer's file is
              // `processes/global-tasks.bpmn` (a diagram is its layer plus
              // its path), so a basename here would label two rows alike.
              name: `Shared steps (${d.instance})`,
              summary: `${defs.size} global task(s) that this layer's processes call by id.`,
              // `activities: 0` because that is true of it — no process, so no
              // activity in one — and because every row of this index carries
              // the fact: absent would read as unmeasured.
              facts: { activities: "0", "global tasks": String(defs.size), ...(shared.length ? { skills: shared.join(", ") } : {}) },
            });
            continue;
          }
          const doc = processDocumentation(xml);
          const lanes = [...xml.matchAll(/<(?:bpmn:)?lane\b[^>]*\sname="([^"]*)"/g)].map((m) => m[1]!);
          const called = [...xml.matchAll(/<(?:bpmn:)?callActivity\b[^>]*\scalledElement="([^"]+)"/g)].flatMap(
            (m) => globalsHere.get(m[1]!) ?? [],
          );
          const skills = [
            ...new Set([...[...xml.matchAll(ownElementPattern(xml, "skill", String.raw`\s+ref="([^"]+)"`))].map((m) => m[1]!), ...called]),
          ];
          const acts = (xml.match(/<(?:bpmn:)?(task|serviceTask|userTask|callActivity)\b/g) ?? []).length;
          const facts: Record<string, string> = { activities: String(acts) };
          if (lanes.length) facts.lanes = lanes.join(" · ");
          if (skills.length) facts.skills = skills.sort().join(", ");
          items.push({
            path: relative(REPO, f).split("\\").join("/"),
            name: name ?? basename(f, ".bpmn"),
            summary: doc ? firstSentence(doc) : undefined,
            facts,
          });
        }
      }
      return dedupeByPath(items);
    },
  },
  {
    id: "glossary",
    title: "Glossary",
    graph: "swimlane-glossary",
    extracts:
      "every term this instance's swimlanes define — the role's title and description, " +
      "the lane names that bind it, and whether the term has been retired",
    collect(): AutoDocItem[] {
      // Reads the LEDGER, not the glossary document.
      //
      // The document is derived and lives in `_kg/` (or `_site/` on a
      // deploy), so it is absent from a plain checkout — an index built from
      // it would be empty locally and full in CI, which is the worst of both.
      // The ledger is committed, is the declared `glossary` graph, and is the
      // one artefact that carries retirement. Reading it also means this page
      // shows a RETIRED term, which a reader looking up a word they met in an
      // old commit needs more than a reader of live terms does.
      //
      // `glossary-export.ts` is deliberately NOT imported: it builds the whole
      // KG export to do its job, which is seconds of work for a page that
      // needs four fields. `06e3`'s own rule — an index reuses assets rather
      // than recomputing them.
      // The DEFINITION, joined from the role registry.
      //
      // The ledger stores identity and retirement and nothing else, on
      // purpose: a definition copied into it would be a second copy free to
      // drift from `roles.json`, which is the authored source. So this joins
      // the two exactly as `glossary-export.ts` does — ledger for memory,
      // registry for meaning — rather than widening the ledger.
      //
      // The first version omitted this and every one of the 44 rows read "no
      // description in the artefact": a glossary index that defines nothing,
      // which is the thing issue #596 asked for the opposite of. Caught by
      // opening the page rather than by reading the count.
      const descriptions = new Map<string, string>();
      for (const kgRoot of kgRoots(ROOT)) {
        for (const r of readRoleGraph(kgRoot)?.roles ?? []) {
          if (!descriptions.has(r.id) && r.description) descriptions.set(r.id, r.description);
        }
      }

      const items: AutoDocItem[] = [];
      for (const d of declaredDirectories("swimlane-glossary")) {
        for (const f of walk(d.absPath, (n) => n === "glossary-ledger.json")) {
          let parsed: { instance?: string; concepts?: Record<string, { prefLabel?: string; firstSeen?: string; retiredOn?: string | null }> };
          try {
            parsed = JSON.parse(readFileSync(f, "utf-8"));
          } catch {
            // A ledger this code cannot read is NOT a layer with no terms.
            // Skipping it silently would report a clean, empty glossary over a
            // broken file — `dh4f`, which is the shape this whole handler is
            // careful about.
            items.push({
              path: relative(REPO, f).split("\\").join("/"),
              name: "(unreadable ledger)",
              summary: "This file could not be parsed, so its terms are unknown — not absent.",
            });
            continue;
          }
          for (const [key, entry] of Object.entries(parsed.concepts ?? {}).sort(([a], [b]) => a.localeCompare(b, "en"))) {
            const retired = typeof entry.retiredOn === "string";
            items.push({
              // The ledger is one file holding many terms, so each item points
              // at the file and distinguishes itself by `name`. `dedupeByPath`
              // keys on path, so it is deliberately not applied here.
              path: `${relative(REPO, f).split("\\").join("/")}#${key}`,
              // The ledger, relative to the sub-graph: more than one ledger
              // lives under it (a layer's own, and bootstrap's), so which
              // one is still worth a line — the `#key` is the notation fact.
              pathLabel: relative(d.absPath, f).split("\\").join("/"),
              name: entry.prefLabel ?? key,
              summary: retired
                ? `Retired ${entry.retiredOn} — kept, never deleted, so retirement and accident do not look alike.`
                : // A retired term has no role to define it any more, which is
                  // why the branch above wins: its label comes from the ledger
                  // and its definition is genuinely gone.
                  (key.startsWith("role/") ? descriptions.get(key.slice("role/".length)) : undefined),
              facts: {
                notation: key,
                ...(entry.firstSeen ? { "first seen": entry.firstSeen } : {}),
                status: retired ? "retired" : "current",
              },
            });
          }
        }
      }
      // ALPHABETICAL BY THE NAME A READER SEES (bean `n5be`, finding 2).
      // Rows used to follow ledger order and then the notation key, so
      // "Activity log" (`role/log`) sat after "Librarian", and each ledger
      // restarted the alphabet. A reader scanning a glossary scans by term.
      // The notation breaks a tie, so the order stays deterministic.
      return items.sort(
        (a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
          a.path.localeCompare(b.path, "en"),
      );
    },
  },
];

/**
 * One item per path.
 *
 * Declared directories NEST — `cat-harness/skills/` contains
 * `cat-harness/processes/`, and both are declared — so a naive walk
 * lists the inner files twice. Deduplicating by path keeps the count honest;
 * the SUB-GRAPH a file is attributed to is decided separately, by
 * {@link owningDirectory}, which picks the most specific declaration.
 */
function dedupeByPath(items: AutoDocItem[]): AutoDocItem[] {
  const byPath = new Map<string, AutoDocItem>();
  for (const i of items) if (!byPath.has(i.path)) byPath.set(i.path, i);
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path, "en"));
}

/**
 * Which declared directory an item belongs to — the MOST SPECIFIC one.
 *
 * `cat-harness/processes/x.bpmn` is inside both `cat-harness` (id
 * `cat-harness`, path `cat-harness/skills/`) and the workflow directory. The
 * longest matching declared path wins, because that is the sub-graph that
 * actually describes it; attributing it to the outer one would make the inner
 * declaration index nothing while looking populated.
 */
export function owningDirectory(
  itemPath: string,
  dirs: Array<{ id: string; path: string }>,
): { id: string; path: string } | undefined {
  let best: { id: string; path: string } | undefined;
  for (const d of dirs) {
    const prefix = d.path.endsWith("/") ? d.path : `${d.path}/`;
    if (!itemPath.startsWith(prefix)) continue;
    if (!best || prefix.length > best.path.length) best = { id: d.id, path: prefix };
  }
  return best;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const FORGE = "https://github.com/litlfred/folio-assistant";
/** A file's page on the forge — in its submodule's own repository when it sits in one. */
const blobUrl = (path: string): string => {
  const at = forgeLocation(path, FORGE);
  return `${at.repoUrl}/blob/main/${at.path}`;
};

/**
 * The chrome every page here shares — SCOPED to `.da-page`, because these are
 * THEMED pages now.
 *
 * Extracted when the LEVEL pages were added (bean `06e3`): two renderers with
 * two copies of one stylesheet is two answers to what this looks like, and the
 * copy that is not edited is the one a reader meets first.
 *
 * Until 2026-10-07 every page here was a standalone document with its own
 * paper, ink and accent, and so the one family on the site with no top band
 * (search, Folio, language): `docs-ui.js` builds the band, and it reaches only
 * pages on the theme's `default` layout. On the layout, a rule on `body`,
 * `:root` or `a` would restyle the THEME, so there are none: every selector
 * sits under the wrapper, and colour comes from the theme through
 * `currentColor`, opacity and a neutral translucent edge, which read on the
 * dark ground and the light one alike. Muted text is held at opacity 0.9,
 * which keeps the theme's light-scheme body ink above 4.5:1 on white.
 */
const PAGE_CSS = `<style>
  .da-page h1 { margin: 0 0 .3rem; }
  .da-page .lede { opacity: .9; margin: 0 0 1.4rem; }
  .da-page .note { border-left: 4px solid rgba(127,127,127,.4); padding: .7rem 1rem; margin: 1.4rem 0; font-size: .93rem; }
  .da-page table { display: table; width: 100%; border-collapse: collapse; font-size: .95rem; }
  .da-page th, .da-page td { text-align: left; padding: .6rem .6rem; border: 0; border-bottom: 1px solid rgba(127,127,127,.4); vertical-align: top; background: transparent; }
  .da-page th { background: rgba(127,127,127,.12); }
  .da-page td:first-child { width: 20rem; }
  /* A repo-relative path is long and has no spaces, so it breaks mid-word
     unless the breakpoints are named. Slashes are where a reader expects it. */
  .da-page .p { opacity: .9; font-size: .8rem; font-family: var(--fa-font-mono,Menlo,Consolas,monospace); word-break: normal; overflow-wrap: anywhere; line-break: anywhere; }
  .da-page .none { opacity: .9; font-style: italic; }
  .da-page .f { margin-top: .35rem; font-size: .85rem; opacity: .9; }
  .da-page .f .k { display: inline-block; min-width: 5.2rem; font-weight: 600; }
  .da-page ul.subs { list-style: none; padding: 0; margin: 0 0 1.6rem; }
  /* The theme puts a bullet before every list item in .main-content; this
     list is rows, not bullets. */
  .da-page ul.subs > li::before { content: none; }
  /* display:flow-root CONTAINS the floated count, and it is not cosmetic.
     .n is float:right and is emitted AFTER the name and the path, so it is
     floated onto whichever line box it is reached on. At 390 px the longer
     ids wrap, the float lands on the second line, and a plain block li does
     not contain a float — so it overflowed into the NEXT row.

     Measured 2026-10-04 on /cat-harness/auto-docs/index/docs/who-iris-docs/
     at 390 px: the smart-trust-docs li occupied y 721-756 while its own count
     2153 rendered at y 750-775, i.e. 19 px inside the who-iris-docs row
     beneath it, beside THAT row's count. Two readings wrong from one overflow
     — a DAK IG showed no count, and the IRIS replica appeared to show "6 2153".
     overflowX was 0 and no gate was red; only a browser at phone width showed
     it, which is the gjli lesson again.

     The phone-width block below already fixed the same class of defect for the
     #da-index TABLE (bean n5be, finding 4). This list was not covered by it
     and kept the float. */
  .da-page ul.subs li { display: flow-root; margin: 0; padding: .3rem 0; border-bottom: 1px solid rgba(127,127,127,.4); }
  .da-page .fa-table-filter { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; margin: .75rem 0 .5rem; }
  .da-page .fa-table-filter label { font-weight: 600; }
  .da-page .fa-table-filter input { flex: 1 1 14rem; min-width: 0; max-width: 28rem; min-height: 44px; padding: 0 .75rem;
    font: inherit; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 4px; }
  .da-page .fa-table-filter-count { font-size: .875em; opacity: .9; }
  .da-page table[data-fa-filtered] tr[hidden] { display: none !important; }
  .da-page .n { float: right; opacity: .9; font-variant-numeric: tabular-nums; }
  /* ON A PHONE THE TERM SITS ABOVE ITS DEFINITION (bean n5be, finding 4).
     Two side-by-side columns at 390 px left the term 89 px and broke its path
     over four lines, and narrow-viewport.css then made the table a sideways
     scroll box. Each row becomes a block: the name, then the definition at
     the full width of the screen. By id, so it outranks that file's
     type selector; the header row is dropped because each cell is now
     self-evidently what it is. */
  @media (max-width: 799.98px) {
    .da-page #da-index, .da-page #da-index tbody, .da-page #da-index tr, .da-page #da-index td { display: block; width: auto; min-width: 0; }
    .da-page #da-index { mask-image: none; animation: none; overflow: visible; }
    .da-page #da-index thead { display: none; }
    .da-page #da-index td { border-bottom: 0; padding: .25rem 0; overflow-wrap: anywhere; }
    .da-page #da-index tr { border-bottom: 1px solid rgba(127,127,127,.4); padding: .5rem 0; }
  }
</style>`;

/**
 * The table filter, written into the page rather than left to `docs-ui.js`
 * (bean `0fua`).
 *
 * The site-wide filter (`mountTableFilters` in `docs-ui.js`, #1592) reached the
 * processes and tools pages and NOT these while they were standalone HTML,
 * which is why the 2026-09-30 re-run found the glossary's 48 rows and the skills
 * index's 273 still unfilterable. They are on the theme's layout now, so
 * `docs-ui.js` does load — and it skips a table already carrying
 * `data-fa-filtered`, so the page's own box is the only one. Kept here so the
 * filter works on the committed file with no site script at all, and so
 * there is exactly one control. Same threshold, label, matching (every word
 * typed must appear) and live "N of M rows" count as the site-wide one.
 *
 * NO BACKTICKS AND NO DOLLAR-BRACE in the script: it is interpolated into a
 * template literal.
 */
const TABLE_FILTER_MIN = 25;

const TABLE_FILTER_BOX = `<div class="fa-table-filter">
<label for="fa-table-filter-0">Filter this table</label>
<input type="search" id="fa-table-filter-0" autocomplete="off" spellcheck="false" aria-describedby="fa-table-filter-0-count">
<span class="fa-table-filter-count" id="fa-table-filter-0-count" aria-live="polite"></span>
</div>`;
const TABLE_FILTER_SCRIPT = `<script>
(function () {
  var input = document.getElementById("fa-table-filter-0");
  var count = document.getElementById("fa-table-filter-0-count");
  var table = document.querySelector("table[data-fa-filtered]");
  if (!input || !count || !table || !table.tBodies[0]) return;
  var rows = Array.prototype.slice.call(table.tBodies[0].rows);
  var texts = rows.map(function (r) { return (r.textContent || "").toLowerCase(); });
  function apply() {
    var words = input.value.toLowerCase().split(/\\s+/).filter(Boolean);
    var shown = 0;
    rows.forEach(function (row, n) {
      var hit = words.every(function (w) { return texts[n].indexOf(w) !== -1; });
      row.hidden = !hit;
      if (hit) shown++;
    });
    count.textContent = shown + " of " + rows.length + " rows";
  }
  input.addEventListener("input", apply);
  apply();
})();
</script>`;

/**
 * One index page.
 *
 * `scope` carries the declared directory's id, and it is emitted as the same
 * `var SCOPE = "…";` line the viewer generators use — deliberately, because
 * that line is what `orphanSubjectPages` reads to establish ownership before
 * pruning. A fourth marker would mean a fourth pruner.
 */
/**
 * Where a description's inline code may point when it is not a row on the
 * page: a skill's instruction page, or a repository file's source. Both return
 * `undefined` for a name they cannot resolve, and the code then stays plain.
 */
export interface CodeRefs {
  skill(name: string): string | undefined;
  file(path: string): string | undefined;
}

/** The resolver for a page written at `pageDir`: skill pages relative to it, files on GitHub. */
export function codeRefsFor(site: string, pageDir: string, repoRoot: string, pages: ReadonlySet<string>): CodeRefs {
  const fromPage = relative(site, join(pageDir, "index.html"));
  return {
    skill: (name) => skillPageHref(name, fromPage, pages),
    file: (path) =>
      /^[\w.@-]+(\/[\w.@-]+)+$/.test(path) && existsSync(join(repoRoot, path)) ? blobUrl(path) : undefined,
  };
}

export function autoDocPage(
  type: AutoDocType,
  items: AutoDocItem[],
  scope: string,
  scopePath: string | undefined,
  siblings: Array<{ id: string; path: string; count: number }>,
  refs?: CodeRefs,
  /** Where the counts file is, relative to this page; absent, no badge is filled. */
  countsUrl?: string,
): string {
  // A description naming ANOTHER artefact on this page links to its row (bean
  // `qgjh`): role descriptions say "Inherits `reviewer`", the reviewer is a row
  // here, and the relation the sentence states could not be followed. The key
  // is the last segment of the artefact's fragment (`#role/reviewer` →
  // `reviewer`), exact, and only when ONE row on the page carries it — a
  // name two rows share has no row it could honestly point at, and stays code.
  const keyOf = (i: AutoDocItem) => i.path.split("#", 2)[1]?.split("/").pop() ?? "";
  const rowId = (i: AutoDocItem) => `a-${i.path.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
  const byKey = new Map<string, AutoDocItem | null>();
  for (const i of items) {
    const k = keyOf(i);
    if (k) byKey.set(k, byKey.has(k) ? null : i);
  }
  const linkCodes = (self: AutoDocItem, html: string) =>
    html.replace(/<code>([^<]+)<\/code>/g, (whole, text: string) => {
      const target = byKey.get(text);
      if (target && target !== self) return `<a href="#${esc(rowId(target))}">${whole}</a>`;
      // Not a row here: a skill with an instruction page, then a file this
      // repository holds (bean `qgjh`, the 2026-09-30 re-run's 19 plain code
      // references). A name that resolves to neither — a permission has no
      // page — stays code rather than linking somewhere guessed.
      const href = refs?.skill(text.replace(/\.md$/, "")) ?? refs?.file(text);
      return href ? `<a href="${esc(href)}">${whole}</a>` : whole;
    });
  const rows = items
    .map((i) => {
      const facts = i.facts
        ? Object.entries(i.facts)
            .map(([k, v]) => `<div class="f"><span class="k">${esc(k)}</span> ${esc(v)}</div>`)
            .join("")
        : "";
      return `<tr${keyOf(i) ? ` id="${esc(rowId(i))}"` : ""}>
  <td><a href="${esc(blobUrl(i.path))}"><code>${esc(i.name)}</code></a><br><span class="p">${esc(i.pathLabel ?? i.path)}</span></td>
  <td>${i.summary ? linkCodes(i, withInlineCode(i.summary, esc)) : '<span class="none">no description in the artefact</span>'}${facts}</td>
</tr>`;
    })
    .join("\n");

  // RELATIVE TO WHERE THIS PAGE IS. The type's own page sits one level ABOVE
  // its sub-graph pages, so a sibling is `<id>/` from there and `../<id>/`
  // from a sibling. Both were `../<id>/`, which from the type's page pointed
  // one level too high: `/index/root-docs/` (a 404), and `../docs/` back at
  // the page itself. Found by `check:nav-names` reading the rail.
  const up = scope === "" ? "" : "../";
  const nav = siblings
    .map(
      (s) =>
        `<li>${s.id === scope ? "<strong>" : `<a href="${up}${esc(s.id)}/">`}${esc(s.id)}${s.id === scope ? "</strong>" : "</a>"}` +
        ` <span class="p">${esc(s.path)}</span> ${countBadge(`${type.id}/${s.id}`)}</li>`,
    )
    .join("\n");

  // NO RAIL OF ITS OWN (2026-10-07). This page was standalone and declared a
  // rail section (#1757) listing the sibling sub-graphs and this one's rows.
  // On the theme's layout the theme's sidebar is the navigation, and a second
  // rail inside the content column would be two answers to "where can I go".
  // The sibling list below and the table's filter remain the way in.
  return themedPage(
    `${type.title}${scope ? ` — ${scope}` : ""} · auto-docs`,
    `<div class="da-page">
<h1 id="da-title">${esc(type.title)}${scope ? ` <span class="p">${esc(scope)}</span>` : ""}</h1>
<p class="lede">Derived: ${esc(type.extracts)}.${scopePath ? ` Sub-graph <code>${esc(scopePath)}</code>${siblings.length <= 1 ? `, ${items.length} ${items.length === 1 ? "entry" : "entries"}` : ""}.` : ""}</p>

<div class="note">
  <strong>This is an index, not the documentation.</strong> It says what exists and what each
  artefact declares about itself. What a process is <em>for</em>, when you would be in it, and
  what it is not, is authored beside it and reuses these entries rather than restating them —
  see the <code>auto-docs</code> skill.
</div>

${
  // A sibling list of ONE names this page a third time, after the heading
  // and the lede (bean `n5be`, finding 5): it navigates nowhere. Shown only
  // when there is somewhere else to go; the count it carried moves into the
  // lede above.
  siblings.length > 1 ? `<ul class="subs">\n${nav}\n</ul>\n` : ""
}
${items.length > TABLE_FILTER_MIN ? TABLE_FILTER_BOX : ""}
<table id="da-index"${items.length > TABLE_FILTER_MIN ? ' data-fa-filtered="true"' : ""}>
<thead><tr><th>Artefact</th><th>What it declares about itself</th></tr></thead>
<tbody>
${rows || '<tr><td colspan="2" class="none">Nothing in scope.</td></tr>'}
</tbody>
</table>
</div>
<script>
/* The sub-graph this page indexes. Read by orphanSubjectPages() to establish
   ownership before pruning — the same line the viewer generators emit. */
var SCOPE = "${scope}";
</script>
${items.length > TABLE_FILTER_MIN ? TABLE_FILTER_SCRIPT : ""}${siblings.length > 1 && countsUrl ? `\n${countsScript(countsUrl)}` : ""}`,
  );
}

/** One built type, as a LEVEL page needs to describe it. */
export interface LevelChild {
  /** The path segment, which is also the directory name. */
  seg: string;
  /** A type's own title, or the segment when the child is another level. */
  title: string;
  /** What the type extracts, or how many types sit under this level. */
  detail: string;
  /** Items indexed, where the child is a type. */
  count?: number;
  /**
   * The child's key in the fetched counts ({@link COUNTS_FIELD}), where it has
   * a count. The page carries the key, never the number.
   */
  countKey?: string;
}

/**
 * COUNTS ARE FETCHED, NOT BAKED (cone-shrinking, 2026-10-31).
 *
 * Every sub-graph page listed every sibling with its item count, and every
 * level page listed each type's count. So one file added anywhere rewrote
 * about 40 published pages, none of which a reader would call changed. The
 * same rule the tiles follow (cat-harness#434): a number many pages show
 * lives in one fetched file. The pages carry a key and a pending mark; the
 * numbers live in `assets/auto-docs/index.json` under this field, beside the
 * tile counts, so a new file changes that one JSON.
 *
 * Absent is a third state, as for tiles: a key the file does not hold, or a
 * file that cannot be read, shows no number, never `0`.
 */
export const COUNTS_FIELD = "counts" as const;

/** The pending count badge a page carries for `key`. */
export function countBadge(key: string): string {
  return `<span class="n" data-da-count="${esc(key)}" data-da-count-state="pending">\u2026</span>`;
}

/**
 * The script that fills the badges from the counts file at `url`, relative to
 * the page. NO BACKTICKS AND NO DOLLAR-BRACE: it is interpolated into a
 * template literal.
 */
export function countsScript(url: string): string {
  return `<script>
(function () {
  var badges = document.querySelectorAll(".da-page [data-da-count]");
  if (!badges.length) return;
  function set(counts) {
    Array.prototype.forEach.call(badges, function (b) {
      var n = counts ? counts[b.getAttribute("data-da-count")] : undefined;
      var ok = typeof n === "number" && isFinite(n);
      b.textContent = ok ? String(n) : "";
      b.setAttribute("data-da-count-state", ok ? "some" : counts ? "absent" : "error");
    });
  }
  fetch(${JSON.stringify(url)}, { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { set(j && j.${COUNTS_FIELD} && typeof j.${COUNTS_FIELD} === "object" ? j.${COUNTS_FIELD} : null); })
    .catch(function () { set(null); });
})();
</script>`;
}

/**
 * The index for a LEVEL — a directory that holds types rather than items.
 *
 * **Bean `06e3`, and it is the same defect `§4(a)` fixed one level up.**
 * `viewerPlacement` gives a type like `index/skills` a nested page directory,
 * so `auto-docs/` and `auto-docs/index/` came into existence as directories
 * with nothing in them. A route that reads like a section and answers nothing
 * is `dh4f` in navigation form — and the authored landing page had to name
 * `auto-docs` WITHOUT a link because of it.
 *
 * The children are derived from the built types, never listed: a type added to
 * `TYPES` appears here the moment it is built, and a level with nothing under
 * it does not get a page at all rather than getting an empty one. An empty
 * list and a complete list look identical, which is the whole reason the
 * absent-rather-than-stubbed rule is on `TYPES` already.
 *
 * It carries the same `var SCOPE` line as every other page here, so ownership
 * is read off the file by the one pruner rather than assumed from the path.
 */
export function levelPage(prefix: string, children: readonly LevelChild[], countsUrl?: string): string {
  const here = prefix === "" ? "auto-docs" : prefix;
  const rows = children
    .map(
      (c) =>
        `<li><a href="${esc(c.seg)}/">${esc(c.title)}</a>` +
        (c.countKey === undefined ? "" : ` ${countBadge(c.countKey)}`) +
        `<div class="f">${esc(c.detail)}</div></li>`,
    )
    .join("\n");

  return themedPage(
    `${here} · auto-docs`,
    `<div class="da-page">
<h1 id="da-title">auto-docs${prefix ? ` <span class="p">${esc(prefix)}</span>` : ""}</h1>
<p class="lede">Derived documentation over a declared sub-graph. Each entry below is
generated from the repository on every build, so it is what the tree actually holds
rather than what anybody remembered.</p>

<div class="note">
  <strong>These are indexes, not the documentation.</strong> They say what exists and what
  each artefact declares about itself. What a thing is <em>for</em>, when you would reach for
  it, and what it is not, is authored beside them and reuses these entries rather than
  restating them — see the <code>auto-docs</code> skill.
</div>

<ul class="subs">
${rows || '<li class="none">Nothing is built under this level.</li>'}
</ul>
</div>
<script>
/* The level this page indexes. Read by orphanSubjectPages() to establish
   ownership before pruning — the same line every other page here emits. */
var SCOPE = "${esc(prefix === "" ? "auto-docs" : prefix.split("/").pop()!)}";
</script>${countsUrl && children.some((c) => c.countKey !== undefined) ? `\n${countsScript(countsUrl)}` : ""}`,
  );
}

/**
 * A page body as a THEMED Jekyll page (2026-10-07): the shared
 * `lib/themed-page.ts` shape, with this family's scoped stylesheet first.
 * Every page here was a standalone `<!DOCTYPE html>` document, so the one
 * family on the site without the top band — search, Folio, language — which
 * `docs-ui.js` builds only on the theme's `default` layout. `renders` /
 * `rendered-by` go into the front matter afterwards, through
 * `withRendersFrontMatter`, which is how `viewerPages` reads a themed page.
 */
export function themedPage(title: string, body: string): string {
  return sharedThemedPage({
    title,
    generator: "cat-harness-tools/scripts/gen-auto-docs.ts",
    command: "bun run auto:docs",
    body: `${PAGE_CSS}\n${body}`,
  });
}

let stale = 0;

/**
 * Write one generated file — a page or the manifest — checking rather than
 * writing under `--check`, where a difference is counted as stale.
 */
function emitRaw(path: string, content: string): void {
  if (check) {
    // The output root's copy when this checkout wrote one, else the pinned copy.
    const at = readPathAt(CHECKOUT, path);
    const current = existsSync(at) ? readFileSync(at, "utf-8") : "";
    if (current === content) return;
    console.error(`  ✗ ${path} ${existsSync(at) ? "is stale" : "is missing"}`);
    stale++;
    return;
  }
  // Inside a mounted cat-harness, at the layer's output root (bean
  // `cat-tools-sm8r`, item 4, step 4); in cat-harness's own checkout, `path`.
  const to = writePathAt(CHECKOUT, path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, content);
}

/**
 * The FROM-WITHIN NODE for this kind — `auto-docs.json`, naming one
 * sub-sub-graph per auto-doc type.
 *
 * The owner, 2026-10-03: *"auto-docs is one declared subgraph, with declared
 * sub-sub-graphs per writer."* `docs/docs.json` names `auto-docs` as a
 * sub-graph of `docs`; this names what `auto-docs` itself holds, the same
 * shape one level further down — `ContentDirectory` entries with paths
 * relative to this file's directory, exactly as `beans/beans.json` and
 * `docs/docs.json` do it.
 *
 * **Generated from {@link TYPES}, never hand-written**, and that is the whole
 * reason it is here rather than committed as authored JSON. `TYPES` carries
 * `collect()` functions that cannot live in JSON, so `TYPES` has to stay the
 * source — and a hand-kept manifest beside it would be a second answer to
 * "what auto-doc types exist", free to disagree the moment either moves. This
 * repository has paid for that shape more than any other.
 *
 * Every entry declares `graphTypologies: ["auto-docs"]`. Sibling directories
 * sharing one kind is not a smell and has precedent: `beans.json`'s `defs` and
 * `archive` both declare `bean-defs`. A sub-sub-graph's identity is its
 * directory **id**, not a kind of its own — eleven kinds for eleven indexes
 * would be eleven registry entries saying the same sentence.
 */
function autoDocsManifest(): string {
  const directories = TYPES.map((t) => ({
    id: t.id.split("/").join("-"),
    path: t.id,
    graphTypologies: ["auto-docs"],
    // `extracts` is authored as a fragment and does not end in punctuation,
    // so one is supplied here rather than requiring eleven authors to remember
    // it — the alternative produced "…has been retired Indexes the graph."
    description: `${t.title} — ${t.extracts.replace(/[.\s]+$/, "")}. Indexes the \`${t.graph}\` graph.`,
  })).sort((a, b) => a.id.localeCompare(b.id, "en"));
  return `${JSON.stringify(
    {
      _comment:
        "GENERATED by scripts/gen-auto-docs.ts from its own `TYPES` — do not hand-edit; run `bun run " +
        "auto:docs`, and `auto:docs --check` fails on a stale copy. The from-within node for the " +
        "`auto-docs` kind (owner, 2026-10-03: \"auto-docs is one declared subgraph, with declared " +
        "sub-sub-graphs per writer\"), the same shape as `docs/docs.json` and `beans/beans.json`: " +
        "`ContentDirectorySchema` entries whose paths are relative to THIS file's directory. It is " +
        "generated rather than authored because `TYPES` carries `collect()` functions that cannot live " +
        "in JSON, so a hand-kept copy here would be a second answer to what types exist.",
      name: basename(ROOT),
      directories,
    },
    null,
    2,
  )}\n`;
}

// THROUGH `emitRaw`, since 2026-10-07. Every page here was written through
// `makeEmit`, which injects the harness rail into a STANDALONE page — and
// passes a page with front matter through unchanged, because the theme's
// sidebar is its navigation. These pages are themed now, so there is no rail
// to inject and nothing for the wrapper to do; one writer, one contract.
function emit(path: string, content: string): void {
  emitRaw(path, content);
}

/**
 * What a type's tile badge counts, singular and plural. Named per type
 * because only the type knows its noun; an unnamed one says `items`.
 */
function unitOf(type: AutoDocType): readonly [string, string] {
  const named: Record<string, readonly [string, string]> = {
    "index/skills": ["skill", "skills"],
    "index/docs": ["page", "pages"],
    "index/schemas": ["schema", "schemas"],
    "index/tools": ["tool", "tools"],
    "index/processes": ["diagram", "diagrams"],
  };
  return named[type.id] ?? ["item", "items"];
}

if (import.meta.main) {
  const handler = readDeclaration(ROOT)?.name;
  if (!handler) {
    console.log("  · this instance declares no name — no handler segment to publish under");
    process.exit(0);
  }
  // THE ROUTE IS DECLARED (owner, 2026-10-09): cat-harness's `auto-docs`
  // visualiser, rendered by this Tool, at `<harness>/<id>/`. Each auto-doc
  // TYPE is a declared sub-graph beneath it (`auto-docs.json`).
  //
  // NOT under the locale segment yet (folio-assistant#2527), unlike every
  // other visualiser's pages: this route is itself a DECLARED DIRECTORY —
  // `docs/docs.json`'s `auto-docs`, at `cat-harness/auto-docs` — and the
  // `auto-docs.json` written below names each type's directory relative to
  // it. Writing the pages under `en/` while that declaration stays would leave
  // every declared type directory empty. They move when the declaration does.
  const route = declaredRoute(ROOT, VIEWER_TOOL);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
    process.exit(0);
  }
  const site = siteTarget(join(ROOT, siteDirFor(ROOT)));
  const countFile = join(site, "assets", "auto-docs", "index.json");
  /** The counts file as a page at `pageDir` reaches it. */
  const countsUrlFrom = (pageDir: string): string => relative(pageDir, countFile).split("\\").join("/");
  /** Every count a page shows, by badge key — written once, to `countFile`. */
  const counts: Record<string, number> = {};

  /** Items indexed per BUILT type — what the level pages below count. */
  const built = new Map<string, number>();
  /** Each sub-graph page and its own item count, for the tile counts below. */
  const counted: Array<{ page: string; count: number; unit: readonly [string, string] }> = [];

  const SITE_SCOPE = siteScope();
  if (SITE_SCOPE !== undefined) console.log(`  scope ${scopeArg(SITE_SCOPE)}: items of these instances only`);
  const ownerOf = new Map<string, string>();
  /** The declared name of the instance whose directory holds `repoRel` (the deepest one). */
  const ownerName = (repoRel: string): string => {
    const dir = dirname(join(REPO, repoRel.split("#")[0]!));
    const hit = ownerOf.get(dir);
    if (hit !== undefined) return hit;
    const inst = findInstanceRoot(join(REPO, repoRel.split("#")[0]!));
    const name = inst === undefined ? "" : (readDeclaration(inst)?.name ?? basename(inst));
    ownerOf.set(dir, name);
    return name;
  };
  for (const type of TYPES) {
    const dirs = (type.directories ?? (() => declaredDirectories(type.graph)))();
    // A scoped site (`--scope`, owner 2026-11-08 Q-SZ-2 "B") indexes its
    // scope's items only; the other layers' indexes are on their own sites.
    const items = type.collect().filter((i) => inScope(SITE_SCOPE, ownerName(i.path)));
    // Attribute each item to its most specific declared sub-graph, then keep
    // only the sub-graphs that actually have something. An empty one gets no
    // page: `dh4f` as a nav entry.
    const byDir = new Map<string, AutoDocItem[]>();
    for (const i of items) {
      const owner = owningDirectory(i.path, dirs);
      if (!owner) continue;
      (byDir.get(owner.id) ?? byDir.set(owner.id, []).get(owner.id)!).push(i);
    }
    const populated = [...byDir.keys()].sort((a, b) => a.localeCompare(b, "en"));
    const siblings = populated.map((id) => {
      const d = dirs.find((x) => x.id === id);
      return { id, path: d?.path ?? "", count: byDir.get(id)!.length };
    });
    for (const s of siblings) counts[`${type.id}/${s.id}`] = s.count;

    const { pageDir } = viewerPlacement(site, `${route}/${type.id}`, "auto-docs");
    const skillPages = skillPagesOf(REPO_ROOT);
    emit(
      join(pageDir, "index.html"),
      withRenderedByFrontMatter(
        autoDocPage(type, items, "", undefined, siblings, codeRefsFor(site, pageDir, REPO_ROOT, skillPages), countsUrlFrom(pageDir)),
        VIEWER_TOOL,
      ),
    );
    for (const id of populated) {
      const sub = viewerPlacement(site, `${route}/${type.id}/${id}`, "auto-docs");
      counted.push({ page: relative(REPO_ROOT, join(sub.pageDir, "index.html")), count: byDir.get(id)!.length, unit: unitOf(type) });
      emit(
        join(sub.pageDir, "index.html"),
        withRenderedByFrontMatter(
          autoDocPage(
            type,
            byDir.get(id)!,
            id,
            dirs.find((d) => d.id === id)?.path,
            siblings,
            codeRefsFor(site, sub.pageDir, REPO_ROOT, skillPages),
            countsUrlFrom(sub.pageDir),
          ),
          VIEWER_TOOL,
        ),
      );
    }

    // ── A TYPE THAT FINDS NOTHING WHERE ITS GRAPH HOLDS FILES IS A DEFECT ──
    //
    // Bean `06e3`: *"a stale or moved source makes the derivation FAIL, never
    // render empty."* This is that guard, and it is not speculative — it was
    // written after shipping the failure TWICE in one session, 2026-10-03:
    //
    //   - `index/tools` filtered `.json` on the strength of `AGENTS.md`
    //     calling them "Tool definitions"; `tools/` holds `.ts`. It emitted
    //     **0 items across 0 sub-graphs and printed `✓`**.
    //   - `index/roles` passed `dirname()` where `readRoleGraph` wants the
    //     scenarios directory itself. Same symptom, same `✓`.
    //
    // Both were caught by a human reading the count, which is exactly the
    // check a gate is supposed to make unnecessary.
    //
    // The DISCRIMINATION is `dh4f`'s, and getting it right is the whole
    // difference between a guard and a nuisance:
    //
    //   - no declared directory for the graph  → nothing to index. Silent.
    //     A fresh folio declaring no `processes/` must not fail `index/dmn`.
    //   - declared directories, all EMPTY      → nothing to index. Silent.
    //     "the directory is not there" and "the directory is empty" are
    //     different facts, and neither is a defect.
    //   - declared directories WITH FILES, and the type collects nothing
    //     → the reader is wrong, or its source moved. **Refuse.**
    //
    // So this cannot fire on a layer that simply does not have the
    // material; it fires when the material is there and the type cannot see
    // it. `check` mode counts it as stale rather than throwing, so one run
    // reports every type rather than dying on the first.
    if (items.length === 0 && dirs.length > 0) {
      const holdsFiles = dirs.some(
        (d) => existsSync(d.absPath) && gitFiles(d.absPath, () => true).files.length > 0,
      );
      if (holdsFiles) {
        const where = dirs.map((d) => d.id).join(", ");
        console.error(
          `  ✗ ${type.id}: collected NOTHING, but its \`${type.graph}\` directories hold files (${where}) — ` +
            `a moved source or a wrong filter, not an empty graph`,
        );
        stale++;
        continue;
      }
    }

    // The guard above runs BEFORE the orphan prune on purpose. With the
    // order reversed — as the first draft had it — a wrong filter made the
    // prune DELETE every sub-graph page first and the guard then reported a
    // defect against a tree it had already emptied. Measured: reintroducing
    // the `index/tools` `.json` bug pruned four pages before complaining.
    // `deletion-requires-confirmation` is the rule that forbids it — an agent
    // does not remove a durable artefact on its own initiative, least of all
    // because its own reader is broken.

    // Orphans — bean `ankg`'s helper, unchanged. A sub-graph that stops
    // contributing items keeps its page otherwise, indexing a set that no
    // longer exists.
    // Both copies: the pinned mount's, and what this checkout computed at the output root.
    const pageTwin = outputTwinOf(CHECKOUT, pageDir);
    const pinned = orphanSubjectPages(pageDir, populated);
    const computed = pageTwin !== undefined && existsSync(pageTwin) ? orphanSubjectPages(pageTwin, populated) : { owned: [], foreign: [] };
    const owned = [...new Set([...pinned.owned, ...computed.owned])];
    const foreign = [...new Set([...pinned.foreign, ...computed.foreign])];
    for (const name of foreign) {
      console.error(`  ! ${join(pageDir, name)} does not identify itself — left in place`);
    }
    for (const name of owned) {
      const dir = join(pageDir, name);
      if (check) {
        console.error(`  ✗ ${dir} is an orphan — its sub-graph contributes nothing to this type`);
        stale++;
        continue;
      }
      // Pruned where this run writes. A page left in a pinned mount stays
      // until the layer is re-pinned: a run never edits a mount.
      const prune = writePathAt(CHECKOUT, dir);
      if (existsSync(prune)) {
        rmSync(prune, { recursive: true });
        console.log(`  ✗ pruned ${prune}`);
      }
      if (prune !== dir && existsSync(dir)) console.log(`  ! ${dir} is an orphan in the pinned mount — left until the layer is re-pinned`);
    }


    built.set(type.id, items.length);
    counts[type.id] = items.length;
    if (!check) {
      console.log(`  ✓ ${type.id}: ${items.length} item(s) across ${populated.length} sub-graph(s)`);
    }
  }

  // ── The LEVEL pages — bean `06e3`, the same defect §4(a) fixed one up ──
  //
  // A type id may carry a slash (`index/skills`), so `viewerPlacement` nests
  // its page directory and the levels above it came into existence holding
  // nothing. Each one now gets an index derived from the types actually BUILT,
  // so a type added to `TYPES` appears here the day it builds and a level with
  // nothing under it gets no page rather than an empty one.
  {
    const levels = new Map<string, LevelChild[]>();
    for (const id of built.keys()) {
      const segs = id.split("/");
      for (let i = 0; i < segs.length; i++) {
        const prefix = segs.slice(0, i).join("/");
        const seg = segs[i]!;
        const childId = segs.slice(0, i + 1).join("/");
        const kids = levels.get(prefix) ?? levels.set(prefix, []).get(prefix)!;
        if (kids.some((k) => k.seg === seg)) continue;
        const type = TYPES.find((t) => t.id === childId);
        kids.push(
          type
            ? { seg, title: type.title, detail: type.extracts, count: built.get(childId), countKey: childId }
            : {
                seg,
                title: seg,
                // Counted, not named: the types under a level are listed on
                // the level's own page, and repeating them here would be the
                // restatement the note on every page forbids.
                detail: `${[...built.keys()].filter((k) => k.startsWith(`${childId}/`)).length} type(s) below`,
              },
        );
      }
    }
    for (const [prefix, kids] of levels) {
      kids.sort((a, b) => a.seg.localeCompare(b.seg, "en"));
      const at = viewerPlacement(site, `${route}${prefix ? `/${prefix}` : ""}`, "auto-docs");
      emit(join(at.pageDir, "index.html"), levelPage(prefix, kids, countsUrlFrom(at.pageDir)));
      if (!check) console.log(`  ✓ level ${prefix || "auto-docs"}: ${kids.length} child(ren)`);
    }
  }

  // The from-within node, at the kind's own root — beside the type directories
  // it names, which is what "from within" means.
  {
    const at = viewerPlacement(site, route, "auto-docs");
    emitRaw(join(at.pageDir, "auto-docs.json"), autoDocsManifest());
    if (!check) console.log(`  ✓ auto-docs.json: ${TYPES.length} sub-sub-graph(s)`);
  }

  // THE TILE COUNTS (folio-assistant#931, owner's ruling 2026-10-29): a
  // directory's tile opens its sub-graph page here, so its badge is that
  // page's own item count. Build-time data like every projection
  // `scanTileCounts` reads, so `--check` does not compare it.
  //
  // The PAGE counts ride in the same file (COUNTS_FIELD): the pages carry
  // keys, so a file added anywhere changes this one JSON and no page.
  if (!check) {
    const tiles = tileCountsForPages(counted, REPO_ROOT, ROOT);
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
    const countAt = writePathAt(CHECKOUT, countFile);
    mkdirSync(dirname(countAt), { recursive: true });
    writeFileSync(countAt, JSON.stringify({ ...tileCounts(tiles), [COUNTS_FIELD]: sorted }, null, 2) + "\n");
    console.log(
      `  ✓ tile counts: ${Object.keys(tiles).length} tile(s), page counts: ${Object.keys(sorted).length} → assets/auto-docs/index.json`,
    );
  }

  if (stale > 0) {
    console.error(`\n${stale} artefact(s) stale — run \`bun run cat auto:docs\``);
    process.exit(1);
  }
  if (check) console.log(`auto-docs: ${TYPES.length} type(s) up to date`);
}
