#!/usr/bin/env bun
/**
 * The Indexing evidence page: which held papers back each indexing method, and
 * which skills, Tools and processes apply it.
 *
 * @covers qa
 *
 * ## Why the page is this, and not an index report
 *
 * Until cat-harness#1144 this route drew every LSI index — its dimensions, its
 * findings, and which prose graphs need one. The owner (2026-11-08): the papers
 * the platform ingested about indexing are there as EVIDENCE for the
 * processes, skills and tools that add indexing to a document or a graph —
 * extracting a glossary, extracting keywords, keyword and latent search — and
 * the health half belongs in the existing repository health report. So the
 * health half moved to `scripts/lsi-health.ts` and the `lsi-indexes` check of
 * `bun run cat health`, and this page draws the evidence chain.
 *
 * ## The chain, read from the graph's own edges
 *
 * | edge | from | to | declared by |
 * |---|---|---|---|
 * | `evidence` | a methodology node | a held library entry | the methodology |
 * | `uses-methodology` | a skill | a methodology node | the skill |
 * | `satisfies` | a Tool | a skill | the Tool |
 * | `<…:skill ref>` | a BPMN activity | a skill | the process |
 *
 * Nothing is hand-listed except WHICH methods are indexing methods
 * ({@link INDEXING_METHODS}, all four this layer's own nodes) and which skills
 * do indexing without applying any of them: a skill whose graph typology is
 * `glossary`, and the lexical search skill ({@link LEXICAL_SEARCH_SKILLS}).
 * Those are drawn as **no evidence yet** — the gap is the point of the page.
 *
 *   bun run cat lsi:viz            # write the page
 *   bun run cat lsi:viz:check      # the page is built at publish: says so and exits 0
 *
 * `--detail` and `--ref` are accepted and ignored: the docs-site build passed
 * them when this page drew stored indexes, and still does until it is told
 * otherwise.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { LSI_DOCS_ROOT, VIEWER_DIR } from "./lsi.ts";
import { withRenderedByFrontMatter } from "./viewer-declarations.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteArg, siteTarget } from "./lib/site-target.ts";
import { baseDocsDir } from "./compose-docs.js";
import { KEYWORDS_GRAPH_DIR, KeywordsGraphSchema, type KeywordsGraph } from "../schemas/library/library-keywords.ts";
import { checkoutRootFor, declaredGraphs, layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { readPathAt, writePathAt } from "./lib/layer-output.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { checkMethodologyEvidence, frontMatterOf, methodologyNodes } from "./check-methodology-evidence.ts";
import {
  appliedByIndex,
  evidenceLine,
  methodologyRows,
  nodePageDir,
  pageRelPath as methodologiesPageRel,
  short,
  type MethodologyRow,
} from "./gen-methodologies-viz.ts";
import { libraryResolver, type LibraryResolver } from "./lib/library-links.ts";
import { isSkillMd, skillMdDirs } from "./known-skills.ts";
import { skillPageHref, skillPagesOf } from "./lib/skill-pages.ts";
import { discoverTools } from "../tools/discover.ts";
import { activityRefs, skillName } from "./check-process-bindings.ts";
import { entriesOf, KEYWORD_VARIANTS, keywordsGraphs } from "./library-keywords.ts";
import { keywordsPage, keywordsPageModel } from "./lib/keywords-page.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "lsi-viewer";
/**
 * Every page this writes declares itself generated in its own front matter —
 * the `generated:` key `check:reference-direction` reads (bean `ws99`). The page
 * names skills, Tools and processes of every layer in the checkout, so
 * without the key those names read as authored prose in this layer naming the
 * layers above it.
 */
const GENERATED_FM = "generated: gen-lsi-viz.ts — do not hand-edit; run `bun run cat lsi:viz`";

const REPO = resolve(dirname(HARNESS_ROOT));
const INSTANCE_ROOT = resolve(HARNESS_ROOT);
/** `--site <dir>`: the same route under a site being built (`visualiser-writers.ts`). */
const SITE = siteArg();
// The docs root comes from `lsi.ts`, which spells it once (cat-harness-tools#2385).
const OUT = SITE === undefined ? join(VIEWER_DIR, "index.md") : join(SITE, relative(LSI_DOCS_ROOT, VIEWER_DIR), "index.md");
/** The page's own path under the base docs layer, for relative links. */
const PAGE_REL = relative(LSI_DOCS_ROOT, join(VIEWER_DIR, "index.md")).split("\\").join("/");
/** The keyword viewer, a page under this one (cat-harness#1144, owner card "B"). */
const KEYWORDS_OUT = join(dirname(OUT), "keywords", "index.md");
const KEYWORDS_PAGE_REL = posix.join(posix.dirname(PAGE_REL), "keywords", "index.md");

/**
 * The methods that add an index to a text: latent retrieval, its parallel
 * track, assigning controlled-vocabulary terms, and judging an assignment.
 * Each is a cat-harness methodology node, so naming them here names nothing
 * above this layer. In page order.
 */
export const INDEXING_METHODS = ["lsi", "correspondence-analysis", "skill-pipeline-subject-indexing", "consensus-grounded-subject-evaluation"] as const;
/** Skills that index without a method node: lexical keyword search. A cat-harness skill. */
export const LEXICAL_SEARCH_SKILLS = ["corpus-grep"] as const;
/** A skill over this graph typology adds glossary terms to a document or graph — indexing work. */
const GLOSSARY_KIND = "glossary";

/** One skill, reduced to what the page shows. */
export interface SkillRow {
  name: string;
  instance: string;
  description: string;
  methods: string[];
  /** Tool ids that `satisfies` it, sorted. */
  tools: string[];
  /** Processes (BPMN file stems) with an activity bound to it, sorted. */
  processes: string[];
}

/** Everything the page draws, so the drawing is testable without a checkout. */
export interface EvidenceModel {
  methods: (Pick<MethodologyRow, "name" | "title" | "appliesWhen" | "instance" | "evidence" | "state"> & { skills: SkillRow[] })[];
  /** Indexing skills that apply no indexing method. */
  unbacked: SkillRow[];
}

/** Every skill document in the checkout: name, instance, description, typologies, methods. */
function skillCatalogue(repo = REPO): Map<string, { instance: string; description: string; typologies: string[]; methods: string[] }> {
  const out = new Map<string, { instance: string; description: string; typologies: string[]; methods: string[] }>();
  for (const root of layerRootsIn(repo)) {
    const instance = readDeclaration(root)?.name ?? posix.basename(root);
    for (const parts of skillMdDirs(root)) {
      const dir = join(root, ...parts);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).sort()) {
        const abs = join(dir, f);
        if (!f.endsWith(".md") || !isSkillMd(abs)) continue;
        const fm = frontMatterOf(readFileSync(abs, "utf-8"));
        if (fm === undefined) continue;
        let p: Record<string, unknown> | undefined;
        try {
          p = parseYaml(fm) as Record<string, unknown>;
        } catch {
          continue; // unparseable front matter is the skill gates' finding
        }
        const name = typeof p?.name === "string" ? p.name : f.replace(/\.md$/, "");
        if (out.has(name)) continue; // the first instance holding the name owns it, as `skillHolders` reads it
        const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);
        out.set(name, {
          instance,
          description: typeof p?.description === "string" ? p.description : "",
          typologies: list(p?.["graph-typologies"]),
          methods: list(p?.["uses-methodology"]),
        });
      }
    }
  }
  return out;
}

/** skill → Tool ids that `satisfies` it. */
function toolsBySkill(repo = REPO): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of discoverTools(repo).tools as unknown as { id: string; satisfies?: unknown[] }[]) {
    for (const s of t.satisfies ?? []) {
      const id = typeof s === "string" ? s : ((s as { skill?: string; ref?: string })?.skill ?? (s as { ref?: string })?.ref);
      if (id) out.set(id, [...(out.get(id) ?? []), t.id].sort());
    }
  }
  return out;
}

function bpmnFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) bpmnFiles(p, out);
    else if (e.name.endsWith(".bpmn")) out.push(p);
  }
  return out;
}

/** skill → processes (BPMN file stems) with an activity bound to it. */
function processesBySkill(repo = REPO): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const root of layerRootsIn(repo)) {
    for (const g of declaredGraphs(root)) {
      if (!g.absPath || seen.has(g.absPath) || !g.graphTypologies.some((k) => k === "processes" || k === "business-processes")) continue;
      seen.add(g.absPath);
      if (!existsSync(g.absPath) || !statSync(g.absPath).isDirectory()) continue;
      for (const f of bpmnFiles(g.absPath)) {
        const stem = posix.basename(f).replace(/\.bpmn$/, "");
        for (const r of activityRefs(readFileSync(f, "utf-8"))) {
          const s = skillName(r.ref);
          out.set(s, (out.get(s) ?? new Set()).add(stem));
        }
      }
    }
  }
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** The model, from the checkout. */
export function evidenceModel(repo = REPO): EvidenceModel {
  const rows = methodologyRows(methodologyNodes(INSTANCE_ROOT), checkMethodologyEvidence(INSTANCE_ROOT));
  const applied = appliedByIndex(repo);
  const skills = skillCatalogue(repo);
  const tools = toolsBySkill(repo);
  const procs = processesBySkill(repo);
  const row = (name: string): SkillRow => {
    const s = skills.get(name);
    return {
      name,
      instance: s?.instance ?? "?",
      description: s?.description ?? "",
      methods: s?.methods ?? [],
      tools: tools.get(name) ?? [],
      processes: procs.get(name) ?? [],
    };
  };
  const methods = INDEXING_METHODS.flatMap((m) => {
    const r = rows.find((x) => x.name === m);
    if (r === undefined) return [];
    return [{ name: r.name, title: r.title, appliesWhen: r.appliesWhen, instance: r.instance, evidence: r.evidence, state: r.state, skills: (applied.get(m) ?? []).map((a) => row(a.skill)) }];
  });
  const indexing = new Set<string>(INDEXING_METHODS);
  const unbacked = [...skills]
    .filter(([name, s]) => (s.typologies.includes(GLOSSARY_KIND) || (LEXICAL_SEARCH_SKILLS as readonly string[]).includes(name)) && !s.methods.some((m) => indexing.has(m)))
    .map(([name]) => row(name))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  return { methods, unbacked };
}

const cell = (v: string): string => v.replace(/[\\|]/g, "\\$&").replace(/</g, "&lt;").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
const code = (s: string): string => "`" + cell(s) + "`";

/** Links the page can make; each absent one leaves plain code, never a link that 404s. */
export interface EvidenceLinks {
  library?: LibraryResolver;
  /** The methodologies list page, relative to the base docs layer. */
  methodologiesPage?: string;
  skillPages?: ReadonlySet<string>;
}

function skillCell(s: SkillRow, links: EvidenceLinks): string {
  const href = links.skillPages ? skillPageHref(s.name, PAGE_REL, links.skillPages) : undefined;
  const name = href ? `[${code(s.name)}](${href})` : code(s.name);
  return `${name}<br><small>${cell(s.instance)}</small>`;
}

function skillTable(rows: readonly SkillRow[], links: EvidenceLinks): string[] {
  const L = ["| skill | what it does | Tools | processes |", "|---|---|---|---|"];
  for (const s of rows) {
    L.push(
      `| ${skillCell(s, links)} | ${short(s.description, 180) || "—"} | ${s.tools.length ? s.tools.map(code).join("<br>") : "—"} | ` +
        `${s.processes.length ? s.processes.map(code).join("<br>") : "—"} |`,
    );
  }
  return L;
}

/** The page, from a model. Pure. */
export function evidencePage(model: EvidenceModel, links: EvidenceLinks = {}): string {
  const papers = new Set(model.methods.flatMap((m) => m.evidence));
  const applying = new Set(model.methods.flatMap((m) => m.skills.map((s) => s.name)));
  const L: string[] = [];
  L.push("---");
  L.push('title: "Indexing evidence"');
  L.push('description: "The papers held in the library that back each indexing method, and the skills, Tools and processes that apply it — keywords, glossary terms, search and near-duplicates."');
  L.push(GENERATED_FM);
  L.push("---");
  L.push("<style>");
  L.push(".ie-grid{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0}");
  L.push(".ie-stat{flex:1 1 8rem;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:.5rem .7rem}");
  L.push(".ie-stat b{display:block;font-size:1.25rem;line-height:1.2}");
  L.push(".ie-stat span{font-size:.75rem;opacity:.75}");
  L.push("</style>");
  L.push("");
  L.push("**Indexing** is adding an index to a document or a graph: keywords for each");
  L.push("section, glossary terms, subject terms from a controlled vocabulary, a search");
  L.push("that finds what is said in other words, and near-duplicate proposals.");
  L.push("");
  L.push("Each indexing **method** rests on papers held in the library. A **skill** applies");
  L.push("the method (`uses-methodology`), **Tools** carry the skill out (`satisfies`),");
  L.push("and **processes** call the skill from an activity. Read a row left to right and");
  L.push("you have the evidence for that piece of indexing work. A skill with no method");
  L.push("has no held evidence yet, and is listed at the end.");
  L.push("");
  // The keyword viewer is a page under this one (cat-harness#1144); a reader
  // who lands here had no way to reach it but its URL.
  L.push("The keywords these methods extract from every library entry are on the");
  L.push("[Keywords](keywords/) page, with the extraction variants side by side.");
  L.push("");
  L.push('<div class="ie-grid">');
  L.push(`<div class="ie-stat"><b>${model.methods.length}</b><span>indexing methods</span></div>`);
  L.push(`<div class="ie-stat"><b>${papers.size}</b><span>papers cited as their evidence</span></div>`);
  L.push(`<div class="ie-stat"><b>${applying.size}</b><span>skills applying them</span></div>`);
  L.push(`<div class="ie-stat"><b>${model.unbacked.length}</b><span>indexing skills with no evidence yet</span></div>`);
  L.push("</div>");
  L.push("");
  L.push("## Evidence by method");
  L.push("");
  for (const m of model.methods) {
    L.push(`### ${cell(m.title)} {#${m.name}}`);
    L.push("");
    const node = links.methodologiesPage
      ? `[${code(m.name)}](${posix.relative(posix.dirname(PAGE_REL), posix.join(posix.dirname(links.methodologiesPage), nodePageDir(m)))}/)`
      : code(m.name);
    L.push(`Method ${node}, declared by ${code(m.instance)}.`);
    L.push("");
    L.push(`**Applies when.** ${short(m.appliesWhen, 400)}`);
    L.push("");
    if (m.evidence.length) {
      L.push(m.state === "dangling" ? "**Evidence — at least one citation does not resolve:**" : "**Evidence, held in the library:**");
      L.push("");
      for (const e of m.evidence) L.push(evidenceLine(e, links.library, PAGE_REL));
    } else {
      L.push("**No held evidence.** The method names an origin that nothing in this checkout holds; `literature-search` is the skill that closes one.");
    }
    L.push("");
    if (m.skills.length) {
      L.push("**Applied by:**");
      L.push("");
      L.push(...skillTable(m.skills, links));
    } else {
      L.push("**Applied by no skill yet.** The evidence is held, and nothing declares `uses-methodology: " + m.name + "`.");
    }
    L.push("");
  }
  L.push("## Indexing work with no evidence yet");
  L.push("");
  L.push("These skills add glossary terms or search a corpus, and apply none of the methods");
  L.push("above, so no held paper backs them. To give one evidence: adopt a method from a held");
  L.push("source (`adopt-methodology-from-source`), then declare `uses-methodology` in the skill.");
  L.push("");
  if (model.unbacked.length) L.push(...skillTable(model.unbacked, links));
  else L.push("None — every indexing skill applies a method with held evidence.");
  L.push("");
  L.push("## Index health");
  L.push("");
  L.push("Which prose graphs need a latent semantic index, whether each stored index is fresh,");
  L.push("and what each index found (narrow dimensions, near-duplicate pairs) are in the");
  L.push("repository health report: `bun run cat health`, check `lsi-indexes`.");
  L.push("");
  L.push("---");
  L.push("");
  L.push(
    "Generated by " + code("bun run cat lsi:viz") + " from the graph's own edges: each method's " + code("evidence") + ", each skill's " +
      code("uses-methodology") + ", each Tool's " + code("satisfies") + " and each process activity's skill binding (cat-harness#1144).",
  );
  return withRenderedByFrontMatter(L.join("\n") + "\n", VIEWER_TOOL);
}

/**
 * The keywords graph `library:keywords` already wrote into `site`, when it is
 * there and carries exactly this layer's variants. At publish it is: the
 * `docs/assets/keywords/` route is declared before this page's, and
 * `derive:publish` runs writers in that order. Otherwise the graph is
 * computed here, so the page never depends on write order for correctness.
 */
export function builtKeywordsGraphs(site: string): KeywordsGraph[] | undefined {
  const dir = join(site, KEYWORDS_GRAPH_DIR);
  const indexFile = join(dir, "index.json");
  if (!existsSync(indexFile)) return undefined;
  try {
    const index = JSON.parse(readFileSync(indexFile, "utf8")) as { variants?: { id: string }[]; nodes?: { href: string }[] };
    if (JSON.stringify((index.variants ?? []).map((v) => v.id)) !== JSON.stringify(KEYWORD_VARIANTS.map((v) => v.id))) return undefined;
    return (index.nodes ?? []).map((n) => KeywordsGraphSchema.parse(JSON.parse(readFileSync(join(site, n.href), "utf8"))));
  } catch {
    return undefined;
  }
}

/** The keyword viewer over this checkout: the derived keywords graph, its variants side by side. */
export function renderKeywords(repo = REPO, site = siteTarget(baseDocsDir(repo))): string {
  const dirs = new Map(entriesOf(repo).map((e) => [`${e.instance}/${e.id}`, join(repo, e.dir)]));
  const model = keywordsPageModel(builtKeywordsGraphs(site) ?? keywordsGraphs(undefined, repo), repo, (g) => dirs.get(`${g.instance}/${g.entry}`), libraryResolver(repo, INSTANCE_ROOT), KEYWORDS_PAGE_REL, KEYWORD_VARIANTS);
  return withRenderedByFrontMatter(keywordsPage(model, GENERATED_FM), VIEWER_TOOL);
}

/** The page over this checkout. */
export function render(repo = REPO): string {
  const methodologies = methodologiesPageRel(repo);
  return evidencePage(evidenceModel(repo), {
    library: libraryResolver(repo, INSTANCE_ROOT),
    ...(methodologies ? { methodologiesPage: methodologies } : {}),
    skillPages: skillPagesOf(repo),
  });
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  if (process.argv.includes("--detail") || process.argv.includes("--ref"))
    console.log("lsi viewer: --detail and --ref are ignored — the page draws no stored index; index health is `bun run cat health` (lsi-indexes)");

  // BUILT AT PUBLISH (owner, 2026-10-14, "B1"; 2026-10-15). cat-harness
  // declares the route `builtAtPublish` with this script as its writer, and
  // `derive:publish` runs it; under `--check` a declared page has no committed
  // bytes to compare, so it is skipped there (the `folio:viz` rule).
  const harnessRoot = join(REPO, "cat-harness");
  const builtHere =
    SITE === undefined && isBuiltAtPublish(readDeclaration(harnessRoot)?.builtAtPublish ?? [], relative(harnessRoot, OUT).split("\\").join("/"));
  if (check && builtHere) {
    console.log("lsi viewer: " + relative(REPO, OUT) + " is built at publish (builtAtPublish), not committed — nothing to compare; `bun run cat lsi:viz` writes it");
    process.exit(0);
  }
  const pages: [string, string][] = [
    [OUT, render()],
    [KEYWORDS_OUT, renderKeywords()],
  ];
  // Where cat-harness is MOUNTED (bean `cat-tools-sm8r`, item 4), the pages
  // are computed output for the layer's output root (`build/layers/<instance>/…`,
  // `lib/layer-output.ts`), never the pinned mount; a check compares the copy a
  // reader would see. In cat-harness's own checkout, and under `--site`, both
  // are `out` itself.
  const checkout = checkoutRootFor(HARNESS_ROOT);
  for (const [out, page] of pages) {
    if (check) {
      const at = readPathAt(checkout, out);
      const cur = existsSync(at) ? readFileSync(at, "utf8") : "";
      if (cur !== page) {
        console.error(relative(REPO, out) + " is stale — run `bun run cat lsi:viz` and commit it.");
        process.exit(1);
      }
      console.log("lsi viewer: " + relative(REPO, out) + " is current");
    } else {
      const to = writePathAt(checkout, out);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, page);
      console.log("lsi viewer → " + relative(REPO, to));
    }
  }
}
