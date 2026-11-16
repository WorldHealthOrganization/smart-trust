#!/usr/bin/env bun
/**
 * Run the detangle criterion over this repository's knowledge graph.
 *
 * Usage:
 *   bun run cat kg:detangle            # every candidate group
 *   bun run cat kg:detangle --group X  # one group, with its worklist
 *   bun run cat kg:detangle --json
 *
 * ## What counts as an edge, and why the list is short on purpose
 *
 * Four extractors, each of which reads a declaration the repository already
 * makes rather than guessing at meaning:
 *
 *   - `md-link`       a relative markdown link between two graph files
 *   - `bpmn-skill`    `<bootstrap.processes:skill ref="…">` on an activity
 *   - `json-skill`    a skill name in `roles.json` or a package manifest
 *   - `ts-import`     a relative import between schema modules
 *
 * There is deliberately NO full-text extractor. A skill that merely MENTIONS
 * another by name in prose is not depending on it, and counting prose
 * mentions would make every package that cites `AGENTS.md`'s examples look
 * tangled into all of them. Under-counting shows up as a group that looks
 * cleaner than it is; the adjudicator is told which extractors ran, so that
 * limit is visible rather than silent.
 *
 * A reference to a node outside the scanned set is a DANGLING reference, and
 * it is reported separately. It is not an outbound edge: counting it as one
 * would make a group with a broken link look entangled, which is a different
 * finding calling for a different fix.
 *
 * @module skills/kg/graph-management/kg-detangle
 * @covers cat-harness, skills
 */
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { basename, join, relative, resolve, dirname } from "path";
import { detangleResultsDir, sidecarFor, sidecarPathFor, staleFields } from "../../../schemas/kg/detangle-sidecar.ts";
import { overlayDirs, overlayPath, writePathOf } from "../../../scripts/lib/layer-output.ts";
import { gitCorpus } from "../../../schemas/sdlc/git-corpus.ts";
import { groupDepthFor } from "./group-depth.ts";
import { TOPICS_FILE, topicsOf } from "../../../scripts/skill-topics.ts";
import { defaultGraphTypologies } from "../../../schemas/kg/graph-typology-registry.ts";
import {
  DEFAULT_THRESHOLDS,
  measure,
  failingClauses,
  classifyByDirection,
  type ClassifiedEdge,
  type DetangleEdge,
  type DetangleNode,
  type EdgeAuthority,
} from "../../../schemas/kg/detangle.js";
import { allowedFromNeeds, directionOf, type LayerRule } from "../../../schemas/kg/layer-direction.js";
import { ancestorsOf, flattenDependencies } from "../../../schemas/kg/dependency-order.js";
import { ownElementPattern } from "../../../schemas/kg/namespaces.js";
import { contentLayerInstance } from "../../../schemas/kg/graph-typology-registry.js";
import { isDirectoryReadme } from "../../../schemas/kg/kg-node.ts";
import { checkoutDirectories, orderedDependencies } from "../../../schemas/kg/harness-config.ts";
import { HARNESS_ROOT } from "../../../scripts/lib/roots.ts";
import { againstOrUsage, qaStorageOf } from "../../../scripts/qa-results.ts";
import { readQaTree } from "../../../scripts/qa-store.ts";

const ROOT = resolve(dirname(HARNESS_ROOT));

/** The content layer's schemas, when one is composed: the layer declaring the `core` layer's kinds. */
function contentLayerScan(): Array<{ path: string }> {
  const c = contentLayerInstance();
  return c === undefined ? [] : [{ path: `${c.name}/schemas` }];
}

/**
 * Directories scanned. The depth at which each names its groups is DERIVED —
 * see {@link groupDepthFor}.
 *
 * Each entry used to carry a hardcoded `groupDepth`, and the reasoning those
 * numbers encoded is kept here because it is still true about the LAYOUT even
 * though it no longer has to be written down as a number:
 *
 * - `processes/` and `scenarios/` are SIBLINGS of `skills/` since 2026-09-21,
 *   not subdirectories of it. Under the old table they were listed at depth 3
 *   as `cat-harness/skills/workflows` and `.../roles`; once they moved out, the
 *   `cat-harness/skills` entry stopped reaching them and they were measured
 *   NOWHERE — this report is only as wide as this list, so a directory missing
 *   from it reads as "nothing to report" rather than as a gap.
 * - `cat-harness/skills` names its groups one level down and `bootstrap/skills`
 *   does not, despite being the same graph typology. That is a fact about where each
 *   layer keeps its nodes, which is why the depth is measured rather than
 *   inferred from the kind.
 *
 * An entry naming a directory that does not exist is REPORTED as a determined
 * empty and left alone — removing it is a person's edit, not this script's.
 */
// declared-path-literal: the scan list is REPO-relative (see the comment on the last entry): which cat-harness directories detangle walks. cat-harness-tools reads cat-harness's directory here; 70lx moved this code up a layer and kept the path, which is now an implementer reading the layer below it (downward). Resolving it through cat-harness's declaration is the follow-up; counted, not hidden.
const LITERAL_SCAN: Array<{ path: string }> = [
  { path: "cat-harness/skills" },
  { path: "cat-harness/processes" },
  { path: "cat-harness/scenarios" },
  { path: "cat-harness/schemas" },
  { path: "cat-harness/tools" },
  { path: "cat-harness/src/skills" },
  // declared-path-literal: the scan list is REPO-relative. The grouping depth it
  // used to pair with each path is now derived (`groupDepthFor`); the PATHS
  // remain literals, which is a separate and still-open concern.
  // The content layer's schemas: the layer declaring the `core` layer's
  // kinds, read from where they were declared (folio-assistant#2598), and
  // absent when no content layer is composed.
  ...contentLayerScan(),
  { path: "bootstrap/skills" },
  { path: "bootstrap/processes" },
];

/**
 * Every layer's OWN `skills` directories, resolved from the declarations —
 * never hardcoded. Owner ruling, 2026-10-01 (separation arc S0, bean `hx65`):
 * placement PR1 moved eight skill packages out of `cat-harness/skills/` into
 * the layers that own them, which left their detangle sidecars measuring a
 * path nobody had. The ruling was to WIDEN THE SCAN rather than delete the
 * measurements, so a package is measured wherever its owner declares it.
 *
 * A declared directory nested inside one already scanned (e.g.
 * a layer's `skills/lean/` under that same layer's `skills/`) is
 * dropped, because scanning both would count its nodes twice.
 */
function declaredSkillScan(literal: ReadonlyArray<{ path: string }>): Array<{ path: string }> {
  const out = [...literal];
  const covers = (outer: string, inner: string): boolean => inner === outer || inner.startsWith(`${outer}/`);
  const declared = checkoutDirectories(ROOT)
    .filter((d) => d.graphTypologies.includes("skills" as never))
    .map((d) => relative(ROOT, d.absPath).split("\\").join("/").replace(/\/+$/, ""))
    .filter((p) => p.length > 0 && !p.startsWith(".."))
    .sort((a, b) => a.length - b.length);
  for (const p of declared) {
    if (out.some((s) => covers(s.path, p) || covers(p, s.path))) continue;
    out.push({ path: p });
  }
  return out;
}

/**
 * `--gate-direction` keeps the LITERAL scan, for now. Widening it to every
 * layer's skills turns 104 refs that were dangling (and so excluded) into
 * resolved WRONG-DIRECTION edges — 91 of them harness BPMN naming skills that
 * placement PR1 moved up, which PR1 deferred to PR3 (bean `63wl`, which moves
 * those diagrams to their owners), plus `cat-harness/scenarios/roles.json`
 * naming upper-layer skills. They are real placement debt, not noise; the
 * owner's ruling widened the MEASUREMENT (sidecars), and turning a hard gate
 * red over debt with a scheduled fix is a separate decision. Measured
 * 2026-10-01 (S0, bean `hx65`): `kg:detangle --gate-direction` over the
 * widened scan reports 104. Drop this exception when PR3 lands.
 */
const GATING_DIRECTION = process.argv.includes("--gate-direction");
const SCAN: Array<{ path: string }> = GATING_DIRECTION ? [...LITERAL_SCAN] : declaredSkillScan(LITERAL_SCAN);
const WIDENED = new Set(SCAN.slice(LITERAL_SCAN.length).map((s) => s.path));

/**
 * Topics a WIDENED skills directory inherits from the layers it stacks on.
 *
 * Topic membership is option A (bean `1g4s`): the same-named directory of every
 * layer stacked on the declarer is a MEMBER of the topic, never a group of
 * its own — the content core declares `content`, so the formal-math layer's
 * `skills/content/authoring-math` is the group, exactly as
 * `cat-harness/skills/authoring/authoring-math` was before placement PR1 moved
 * it. Only the widened entries inherit: the literal ones were measured with
 * their own topics before this change, and their groups must not shift.
 */
function inheritedTopics(path: string): string[] {
  if (!WIDENED.has(path)) return [];
  const instance = join(ROOT, path.split("/")[0]!);
  const out: string[] = [];
  let deps: string[] = [];
  try {
    deps = orderedDependencies(instance).map((d) => d.rootPath);
  } catch {
    return []; // a cycle is `check:instance-graph`'s finding
  }
  for (const dep of deps) {
    const skills = join(dep, "skills");
    if (!existsSync(skills)) continue;
    for (const t of topicsOf(skills)) if (existsSync(join(ROOT, path, t.path))) out.push(t.path);
  }
  return out;
}

const EXT = /\.(md|bpmn|dmn|json|ts)$/;

/** The files a grouping kind names its groups in (`skills.json`, `processes.json`, …) — labels, never nodes. */
const DECLARATION_FILES = new Set<string>([
  TOPICS_FILE,
  ...defaultGraphTypologies
    .names()
    .map((k) => defaultGraphTypologies.get(k)?.declarationFile)
    .filter((f): f is string => typeof f === "string"),
]);

/** Per-directory file names that name no node — see the name index below. */
const CONVENTIONAL = new Set(["README", "AGENTS"]);

/**
 * A bare filesystem descent. Kept ONLY as the fallback for when git cannot
 * answer — see {@link corpusOf}, which is what callers use.
 */
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(e)) out.push(p);
  }
  return out;
}

/** True when any segment of `rel` is dot-prefixed, as {@link walk} skipped. */
function hasDotSegment(rel: string): boolean {
  return rel.split("/").some((seg) => seg.startsWith("."));
}

/**
 * The nodes of one scanned directory — asked of git, not of the disk.
 *
 * ## Why this is not a bare walk any more
 *
 * A bare walk skips dot-prefixed entries and nothing else, so it counts
 * whatever happens to be on the machine. On 2026-09-26 that stopped being
 * theoretical: `check:published-packages` (bean `rsi6`) runs `bun install`
 * inside `cat-harness/schemas/block-qa-schema`, and the moment it did, this
 * scan's answer for `cat-harness/schemas` went from **227** to **1441** —
 * 1214 files of a dependency tree and a build directory, counted as
 * knowledge-graph nodes and pinned into a committed sidecar, which
 * `gen-uml-overview` then republished as `1441 | 0.96 | 25 | 4`.
 *
 * Measured four ways on one tree, with this module's own `EXT`: bare walk
 * 1441, excluding `node_modules/` 228, also excluding `dist/` 227,
 * `git ls-files` 227.
 *
 * **The sharp part is that it was order-dependent WITHIN a single run.** That
 * install happens at line 823 of `code-quality-gates.yml` and
 * `kg:detangle:check` at line 663, so a runner measures 227 while a developer
 * container that has already run the gate set measures 1441 — and the two
 * disagree about a number that is committed. A measurement whose value depends
 * on which gate ran first is not a measurement of the repository.
 *
 * This was the THIRTEENTH instance of `xd1g`'s class and the first outside
 * `scripts/`, which is why that bean's survey — a syntactic filter over
 * `scripts/*.ts` — could not have found it.
 *
 * ## `undefined` is not `[]`
 *
 * {@link gitCorpus} returns `undefined` when git could not answer and `[]` when
 * git looked and there is nothing. Collapsing them is the `dh4f` shape —
 * reporting a clean corpus nobody read.
 *
 * But there are **three** cases here, not two, because `gitCorpus` also answers
 * `undefined` for a directory that is not there — and an absent directory is a
 * DETERMINED empty, not an unknown. Found immediately: `SCAN` still names
 * `cat-harness/src/skills`, which #760 removed, so the first version of this
 * function reported *"git could not enumerate 1 directory"* about a directory
 * whose answer is perfectly known. That is a could-not-determine manufactured
 * out of a fact, which is as bad as the reverse.
 *
 * So:
 *
 *   absent      -> `[]`, and recorded in {@link absentScanTargets}. A declared
 *                  scan target that does not exist is `dh4f` itself — a
 *                  consumer scanning nothing and reporting a clean run over it
 *                  — so it is REPORTED rather than silently skipped, and left
 *                  for a person to remove from `SCAN`.
 *   git refused -> a bare {@link walk}, recorded in {@link corpusFallbacks},
 *                  because a measurement pinned from a bare walk counts
 *                  whatever is on the machine and must be legible as such.
 *   git answers -> that list, filtered to {@link EXT} and to the dot-prefix
 *                  rule `walk` applied.
 *
 * Neither is a failure. `gates` must stay runnable where git cannot be asked,
 * and a stale `SCAN` entry is a person's edit, not this script's to make.
 */
const corpusFallbacks: string[] = [];
const absentScanTargets: string[] = [];

function corpusOf(dir: string): string[] {
  const shown = relative(ROOT, dir) || dir;
  if (!existsSync(dir)) {
    absentScanTargets.push(shown);
    return [];
  }
  const listed = gitCorpus(dir);
  if (listed === undefined) {
    corpusFallbacks.push(shown);
    return walk(dir);
  }
  return listed.filter((abs) => EXT.test(abs) && !hasDotSegment(relative(dir, abs)));
}

const nodes: DetangleNode[] = [];
const byId = new Map<string, string>(); // id -> absolute path
/** Skill name (front-matter `name:` or basename) -> node id. A name may be carried by two bodies; both are kept. */
const byName = new Map<string, string[]>();

for (const { path } of SCAN) {
  // A README is documentation ABOUT a directory, never a node IN it — the
  // rule `isSkillMd` states for the skill scan. It mattered little while
  // READMEs were rare; `subgraph-readmes` writes one into every declared
  // directory, and counting them would add a node to every group and tilt
  // `groupDepthFor`'s here-vs-nested count at every root.
  // `skills.json` is the same kind of thing as a README one level up: the
  // labelling node that says which subdirectories are TOPICS (bean `9umr`),
  // about the directory rather than a node in it.
  //
  // Every concern-group declaration file is that same labelling node —
  // `processes/processes.json` since placement PR3 (bean `63wl`) — so each is
  // excluded at its scan root, read from the registry rather than listed.
  const scanned = corpusOf(join(ROOT, path)).filter(
    (p) => !isDirectoryReadme(p) && !(DECLARATION_FILES.has(basename(p)) && dirname(p) === join(ROOT, path)),
  );
  const groupDepth = groupDepthFor(path, scanned);
  // A group that is a declared TOPIC is not a package, it holds packages; the
  // package one level down is the group, so `kg/graph-management` stays the
  // group it was as `graph-management` rather than merging into `kg`.
  const topics = new Set([...topicsOf(join(ROOT, path)).map((t) => t.path), ...inheritedTopics(path)]);
  for (const abs of scanned) {
    const id = relative(ROOT, abs);
    const segs = id.split("/");
    const inTopic = topics.has(segs[groupDepth - 1] ?? "") && segs.length > groupDepth + 1;
    const group = segs.slice(0, inTopic ? groupDepth + 1 : groupDepth).join("/");
    nodes.push({ id, group });
    byId.set(id, abs);
    const base = id.split("/").pop()!.replace(EXT, "");
    const fm = /^---\n[\s\S]*?\bname:\s*([A-Za-z0-9._-]+)/m.exec(readFileSync(abs, "utf8"));
    // `README` and `AGENTS` are CONVENTIONAL names every directory may carry,
    // never a name a sentence uses to point at one node. Indexing them made
    // every skill mentioning "AGENTS.md" read as coupled to whichever package
    // last held one — measured 2026-09-23 when kg-navigation's pair moved into
    // `cat-harness/skills/` (bean `byql`) and nine groups' prose counts moved.
    for (const n of new Set([base, fm?.[1]].filter((x) => x && !CONVENTIONAL.has(x)) as string[])) {
      byName.set(n, [...(byName.get(n) ?? []), id]);
    }
  }
}

const edges: DetangleEdge[] = [];
const dangling: Array<{ from: string; ref: string; via: string }> = [];

/**
 * `enforced` means a build or engine breaks if the arrow is reversed. Only
 * three extractors qualify; see `EdgeAuthority` for why the distinction
 * decides the whole classification.
 */
// `EdgeAuthority`, not a restatement of it. This read
// `Record<string, "enforced" | "recorded">` — two of the three levels — while
// the table below assigns `"prose"` and line 157 assigns it directly. A real
// TS2322 that nothing caught, because `tsconfig.json` did not include this
// tree; `detangle/`, `large-datasets/` and two content layers' directories
// were all outside the program while the file's own comment said "Every tree
// is now compiled".
const AUTHORITY: Record<string, EdgeAuthority> = {
  "ts-import": "enforced",
  "bpmn-call": "enforced",
  "bpmn-import": "enforced",
  "bpmn-decision": "enforced",
  "bpmn-skill": "recorded",
  "json-skill": "recorded",
  "md-link": "recorded",
  "prose-mention": "prose",
};

/**
 * The authority for an extractor, REFUSING rather than defaulting.
 *
 * This read `AUTHORITY[via] ?? "recorded"`. The fallback was unreachable —
 * measured 2026-09-21, the eight `via` values the extractors emit are exactly
 * the eight {@link AUTHORITY} declares — so it silenced nothing today and
 * would have silenced the next extractor added.
 *
 * That matters more here than a default usually does, because `recorded` is
 * not a neutral guess: it is the value that makes a boundary edge stop
 * counting toward `role`. A new `enforced` extractor landing as `recorded`
 * would turn real directed dependencies into `undetermined` verdicts, and the
 * report would look exactly as it does when the analysis is right.
 *
 * Bean `kvsx`'s first requirement is that every extractor DECLARES its
 * authority. A `??` makes that true by coincidence rather than by
 * construction, which is the `6tkl` shape: the check cannot fail, so it cannot
 * tell you anything.
 */
function authorityOf(via: string): EdgeAuthority {
  const a = AUTHORITY[via];
  if (a === undefined) {
    throw new Error(
      `kg-detangle: extractor '${via}' declares no authority. Add it to AUTHORITY in this file as ` +
        `'enforced' (a build or engine breaks if the arrow is reversed) or 'recorded' (the direction is ` +
        `where the author filed the pointer) or 'prose' (a mention, which moves no verdict). ` +
        `Defaulting would file it as 'recorded' and silently drop it from every role verdict.`,
    );
  }
  return a;
}

function link(from: string, toId: string | undefined, ref: string, via: string) {
  if (toId && byId.has(toId)) edges.push({ from, to: toId, via, authority: authorityOf(via) });
  else dangling.push({ from, ref, via });
}

/**
 * The node a relative TS import names, as Bun resolves it (bean `cjvs`).
 *
 * The first cut rewrote `.js` to `.ts` and stopped, so every EXTENSIONLESS
 * specifier — `./cat-harness` with no suffix, the house style in `schemas/` — became a
 * dangling ref: 156 edges the blocking `direction` gate never saw. A specifier
 * that is not itself a file is tried as `<spec>.ts`, then `<spec>/index.ts`.
 */
function tsImportTarget(fromDir: string, spec: string): string {
  const p = resolve(fromDir, spec.replace(/\.js$/, ".ts"));
  const candidates = [p, `${p}.ts`, join(p, "index.ts")];
  const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? p;
  return relative(ROOT, hit);
}

/**
 * Resolve a name to a node.
 *
 * `kinds` is NOT optional and that is the fix for a measured defect. A first
 * cut preferred a hit in the SAME group, on the reasoning that a package's own
 * copy should win over a sibling layer's. Five `<bootstrap.processes:skill ref>` values —
 * `activity-log`, `getting-started`, `l2-dak-authoring`, `qa-report-signing`,
 * `upstream-version-adoption` — are ALSO the basenames of diagrams sitting in
 * the same directory, so every one of them resolved to the .bpmn referring to
 * it rather than to the skill body. That produced 31 phantom internal edges in
 * `processes` and was the whole of its reported cohesion of 0.09.
 *
 * A skill ref names a SKILL. Restricting the candidate set by extension is what
 * makes the name collision harmless instead of silently self-referential.
 */
function byNameOfKind(from: string, name: string, kinds: string[]): string | undefined {
  const hits = (byName.get(name) ?? []).filter((h) => kinds.some((k) => h.endsWith(k)));
  if (!hits.length) return undefined;
  const g = from.split("/").slice(0, 3).join("/");
  return hits.find((h) => h.startsWith(g)) ?? hits[0];
}

for (const n of nodes) {
  const abs = byId.get(n.id)!;
  const text = readFileSync(abs, "utf8");

  if (n.id.endsWith(".md")) {
    for (const m of text.matchAll(/\]\((\.\.?\/[^)\s#]+\.md)[^)]*\)/g)) {
      link(n.id, relative(ROOT, resolve(dirname(abs), m[1])), m[1], "md-link");
    }
    // PROSE MENTIONS. Link targets are stripped first, so an edge here is a
    // name appearing in running text with no link and no declaration behind it
    // — the weakest evidence in the graph, and the owner's "maybe the prose is
    // in the wrong place" made countable. Never weighed into a verdict.
    const prose = text.replace(/\]\([^)]*\)/g, "").replace(/^---\n[\s\S]*?\n---/, "");
    const self = n.id.split("/").pop()!.replace(/\.md$/, "");
    for (const [nm, tgts] of byName) {
      if (nm === self || nm.length < 5) continue;
      const t = tgts.find((x) => x.endsWith(".md"));
      if (!t || t === n.id) continue;
      if (new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(prose)) {
        edges.push({ from: n.id, to: t, via: "prose-mention", authority: "prose" });
      }
    }
  }
  if (n.id.endsWith(".bpmn") || n.id.endsWith(".dmn")) {
    for (const m of text.matchAll(ownElementPattern(text, "skill", String.raw`\s+ref="([^"]+)"`))) {
      link(n.id, byNameOfKind(n.id, m[1], [".md"]), m[1], "bpmn-skill");
    }
    // A diagram calling another diagram, and a diagram importing one. These
    // are the INTERNAL edges of a workflow graph and the first cut extracted
    // neither, which understated cohesion for exactly the group whose carve
    // was under discussion.
    for (const m of text.matchAll(/<bpmn:import[^>]*location="([^"]+)"/g)) {
      link(n.id, relative(ROOT, resolve(dirname(abs), m[1])), m[1], "bpmn-import");
    }
    for (const m of text.matchAll(/calledElement="([^"]+)"/g)) {
      // calledElement names a PROCESS id (`Process_DeriveContent`), not a file.
      // Resolve through the file that declares that id.
      const owner = nodes.find(
        (o) =>
          (o.id.endsWith(".bpmn") || o.id.endsWith(".dmn")) &&
          new RegExp(`<bpmn:process[^>]*id="${m[1]}"`).test(readFileSync(byId.get(o.id)!, "utf8")),
      );
      link(n.id, owner?.id, m[1], "bpmn-call");
    }
    for (const m of text.matchAll(/decisionRef="([^"]+)"|([A-Za-z0-9_-]+\.dmn)/g)) {
      const ref = m[1] ?? m[2];
      link(n.id, byNameOfKind(n.id, ref.replace(/\.dmn$/, ""), [".dmn"]), ref, "bpmn-decision");
    }
  }
  if (n.id.endsWith(".json")) {
    // Only string ARRAY members are read as references. A free-form description
    // mentioning a skill is prose, and prose is not a dependency.
    for (const m of text.matchAll(/"([a-z][a-z0-9-]{3,})"(?=\s*[,\]])/g)) {
      const t = byNameOfKind(n.id, m[1], [".md"]);
      if (t && t !== n.id) edges.push({ from: n.id, to: t, via: "json-skill", authority: "recorded" });
    }
  }
  if (n.id.endsWith(".ts")) {
    for (const m of text.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)) {
      link(n.id, tsImportTarget(dirname(abs), m[1]), m[1], "ts-import");
    }
  }
}

// ── Direction — bean `j79e`.
//
// A node's LAYER is the layer it lives in: the first path segment, when
// that directory declares itself with `<name>/<name>.json`. What a layer may
// reach is its declared `needs`, transitively, plus itself — the same
// relation `check:partition` applies to repos, through the same function.
//
// A layer with no `needs` is UNDETERMINED and its edges stay so. Filling
// it in here would be deciding a layering nobody has declared.
const layerNeeds = new Map<string, readonly string[] | undefined>();
for (const seg of new Set(nodes.map((n) => n.id.split("/")[0]))) {
  const decl = join(ROOT, seg, `${seg}.json`);
  if (!existsSync(decl)) continue;
  const needs = (JSON.parse(readFileSync(decl, "utf8")) as { needs?: string[] }).needs;
  layerNeeds.set(seg, needs);
}
const flat = flattenDependencies(
  [...layerNeeds].map(([id, needs]) => ({ id, needs: (needs ?? []).filter((n) => layerNeeds.has(n)), fatal: false })),
);
if (flat.problems.length) {
  // Refused rather than walked: no ancestor set exists for a broken graph,
  // and a partial one would report allowed edges as wrong-direction.
  throw new Error(`kg-detangle: instance needs graph is broken — ${flat.problems.map((p) => p.detail).join("; ")}`);
}
const layerRule: LayerRule = { allowed: allowedFromNeeds(layerNeeds, ancestorsOf(flat.order)) };
const layerOf = (id: string): string | undefined => {
  const seg = id.split("/")[0];
  return layerNeeds.has(seg) ? seg : undefined;
};
/** Edges whose direction nothing declared could settle — kept apart, because `unclassified` alone would hide them among the allowed. */
const undeterminedEdges = new Set<DetangleEdge>();
const classify = (e: DetangleEdge): ClassifiedEdge => {
  const d = directionOf(e, layerOf(e.from), layerOf(e.to), layerRule);
  if (d.verdict === "undetermined") undeterminedEdges.add(e);
  return classifyByDirection(e, d);
};

const groups = [...new Set(nodes.map((n) => n.group))].sort();
const only = process.argv.includes("--group")
  ? process.argv[process.argv.indexOf("--group") + 1]
  : undefined;

const results = groups.map((g) => {
  const m = measure(g, nodes, edges);
  const classified = m.worklist.map(classify);
  return {
    ...m,
    classified,
    wrongDirection: classified.filter((e) => e.kind === "wrong-direction").length,
    undeterminedDirection: m.worklist.filter((e) => undeterminedEdges.has(e)).length,
    clauses: failingClauses(m, DEFAULT_THRESHOLDS),
  };
});

// ── The durable record — bean `sb6z`, and the owner's ruling on what it holds.
//
// `--check` compares; the default WRITES. Same shape as `kg:audit` /
// `kg:audit:check`, and for the same reason: the check fails on a STALE
// sidecar rather than on a bad number, so it cannot become the gate that
// always passes. `detangle.ts` says the carve is an adjudication — that stays
// a person's call, and nothing here grades it.
// Since bean `oqe3`, only where the tree is NOT stored on `qa-reports`: a
// stored copy is a measurement, so a stale one there is advisory (see
// `detangleStored` below).
// The declared `qa` directory's `detangle/`, resolved in ONE place so every
// reader of the sidecars agrees with this writer (see `detangleResultsDir`).
const HARNESS = join(ROOT, "cat-harness");
const RESULTS_DIR = detangleResultsDir(HARNESS);

/**
 * Is there a pinned record in the checkout to compare against? Read ONCE,
 * before the writer can create the directory.
 *
 * Bean `oq1j` (arc `3fva`, reader `R12`). The sidecars are derived QA, bound
 * for the `qa-reports` branch (owner rulings D1/D4). With the DIRECTORY
 * absent, `--check` used to call every group STALE, which named a defect
 * nobody made. It now computes, which it always did, and compares nothing,
 * because there is nothing pinned to be stale (proposal §2.3, "committed ≠
 * fresh: gone"). It says so, and never prints the "current" line it did not
 * earn. With the directory PRESENT, from the checkout or from `bun run
 * qa:fetch`, the comparison and the orphan sweep run exactly as before, so a
 * group with no sidecar beside ones that have them is still STALE.
 */
// Through the layer output overlay: a mounted layer's sidecars are under
// `build/layers/<instance>/` (bean `cat-tools-sm8r`, item 4).
const pinnedInCheckout = overlayDirs(RESULTS_DIR).length > 0;

/**
 * Is the detangle tree STORED on `qa-reports` (bean `oqe3`)? cat-harness
 * declares its `qa` directory with `storage`, so yes. Then the copy in the
 * checkout is a measurement of the last run, not a record, and a stale or
 * orphaned sidecar there is ADVISORY: reported in full, never what fails
 * `--check`. The same rule as `kg:audit:check`'s derived tree. A stale
 * sidecar here was a regenerate-and-commit round on every PR that moved a
 * file, and a merge conflict between any two of them (bean `oqe3`). The
 * stored record is rebuilt by `qa:refresh` in the publish job.
 *
 * Unstored, the working copy is still the record, and both stay findings.
 */
const detangleStored = qaStorageOf(RESULTS_DIR) !== undefined;

function writeSidecars(): { written: string[]; stale: { path: string; fields: string[] }[] } {
  const written: string[] = [];
  const stale: { path: string; fields: string[] }[] = [];
  for (const r of results) {
    const rel = sidecarPathFor(r.group);
    const abs = join(RESULTS_DIR, rel);
    const fresh = sidecarFor(r);
    let committed: unknown = null;
    try {
      committed = JSON.parse(readFileSync(overlayPath(abs), "utf-8"));
    } catch {
      // Absent or unreadable — every field differs, which `staleFields` says.
    }
    const fields = pinnedInCheckout ? staleFields(committed, fresh) : [];
    if (fields.length > 0) stale.push({ path: rel, fields });
    // `--gate-direction` reads the tree and grades it; it must not also
    // rewrite the pinned record it is not grading. A gate that mutates its
    // own subject is the shape this repository keeps paying for.
    //
    // ── `import.meta.main` is the THIRD condition, and it is bean `ymsu`'s
    //    clause 1 ────────────────────────────────────────────────────────
    //
    // This module is a SCRIPT: everything outside a function runs on import,
    // including the call to this writer. That is fine for `bun run cat kg:detangle`
    // and it is a defect for every other way the module can be loaded — and
    // there is one, measured rather than imagined.
    //
    // `src/tools/degradation.ts#loadSkillNeeds` walks every declared knowledge-
    // graph root and `await import()`s each `.ts` to read the skills that
    // declare the capabilities they require. This file is in one of those
    // roots, so capability detection EXECUTED the detangler, and `src/tools/
    // degradation.test.ts` does it three times over the real corpus. Measured
    // 2026-09-30 on `origin/main` `e718627f198`, with `folio-core`'s `internal`
    // hand-staled to 999:
    //
    //     bun run cat kg:detangle:check   alone     -> exit 1, "STALE … — internal"
    //     bun run cat gates               same tree -> that check PASSED, and the
    //                                              runner's own guard reported
    //                                              `bun test` reverting the file
    //
    // So the writer ran 1140 lines before its own checker and handed it a
    // repaired copy — the whole of this bean, arriving through a consumer that
    // has no idea it is running a script.
    //
    // The guard is here rather than only at that consumer because the property
    // belongs to THIS file: a module in a knowledge-graph directory is
    // importable by anything that scans the graph, so its side effects have to
    // be conditional on being the entry point. Fixing only `loadSkillNeeds`
    // would leave the next scanner to rediscover this.
    //
    // The paragraph above deliberately does NOT spell the field name
    // `loadSkillNeeds` selects on: that loader now reads a file's source and
    // skips one that does not mention it, so writing the literal here would put
    // this script back in its candidate set. A docblock documenting a tag
    // necessarily contains the tag — `audit-coverage` records the same trap, and
    // this comment is how it was hit the first time the guard was measured.
    if (!checking && !gatingDirection && import.meta.main) {
      // Never into a mount: a mounted layer's sidecar goes to its layer output root.
      const to = writePathOf(abs);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, JSON.stringify(fresh, null, 2) + "\n", "utf-8");
    }
    written.push(rel);
  }
  return { written, stale };
}

/**
 * Sidecars no current group accounts for.
 *
 * Bean `3jj9`, paid for one package over: a sidecar whose SUBJECT was renamed
 * sat in the tree reporting a verdict about a path nobody had, while the live
 * subject had no sidecar at all, and `--check` exited 0 across both. The loop
 * above only ever looks from group to file; this looks the other way.
 *
 * REPORTED, NEVER DELETED. An orphan can also mean the group is temporarily
 * undiscovered — a declaration gap, not a dead group — and deleting on that
 * evidence destroys a measurement to hide a defect.
 * `deletion-requires-confirmation`: the agent reports, a person decides.
 */
function sweepOrphans(accountedFor: string[]): string[] {
  const known = new Set(accountedFor);
  const out: string[] = [];
  const walk = (dir: string, prefix = ""): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // no results directory yet is not an orphan
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), rel);
      else if (e.name.endsWith(".detangle.json") && !known.has(rel)) out.push(rel);
    }
  };
  // The union of the output root and the layer's own directory.
  for (const d of overlayDirs(RESULTS_DIR)) walk(d);
  return [...new Set(out)].sort();
}

const checking = process.argv.includes("--check");

/**
 * `--against <ref>` — compare this run with the stored record at a
 * `qa-reports` ref instead of the working copy, and REPORT what moved. Never
 * gated: the carve is an adjudication, so a moved measurement is a reason to
 * look, not a defect. A ref with no entry is UNKNOWN and is reported. A
 * malformed ref is a usage error (exit 2).
 */
const { against, exit: badAgainst } = againstOrUsage("kg:detangle:check", process.argv.slice(2));
if (badAgainst !== undefined) process.exit(badAgainst);

/** What moved between this run and the record stored at `against`, or why it could not be read. */
function compareWithStored(ref: string): { from: string; moved: { path: string; fields: string[] }[]; orphans: string[] } | { unknown: string } {
  const storage = qaStorageOf(RESULTS_DIR);
  const tree = readQaTree(ref, RESULTS_DIR, storage ? { branch: storage, repoRoot: ROOT } : { repoRoot: ROOT });
  if (tree.state !== "hit") return { unknown: `qa-reports ${ref}: ${tree.state} — ${tree.reason}` };
  const prefix = tree.prefix ? `${tree.prefix}/` : "";
  const known = new Set<string>();
  const moved: { path: string; fields: string[] }[] = [];
  for (const r of results) {
    const rel = sidecarPathFor(r.group);
    known.add(rel);
    const text = tree.files.get(prefix + rel);
    let stored: unknown = null;
    try {
      stored = text === undefined ? null : JSON.parse(text);
    } catch {
      // readQaTree already refuses an entry with a JSON file that does not parse.
    }
    const fields = staleFields(stored, sidecarFor(r));
    if (fields.length > 0) moved.push({ path: rel, fields });
  }
  const orphans = [...tree.files.keys()]
    .map((p) => (prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p))
    .filter((p) => p.endsWith(".detangle.json") && !known.has(p))
    .sort();
  return { from: `qa-reports ${tree.key}`, moved, orphans };
}

/**
 * `--gate-direction` — the CROSS-INSTANCE wrong-direction gate. Bean `p11x`,
 * the owner's Option 2 ruling of 2026-09-30.
 *
 * ## What it grades, and what it deliberately does not
 *
 * Everything else this script reports is **pinned, not graded**: the carve is
 * an adjudication a person makes (`detangle.ts`, "taste is a declared step"),
 * so `--check` fails on a STALE or ORPHANED sidecar (in an unstored tree;
 * advisory in a stored one, bean `oqe3`) and never on a number being wrong.
 * **That ruling stands and this flag does not touch it.**
 *
 * The one number that is not taste is this one. A module's BUCKET is a
 * judgement; an import pointing at a layer that declares a dependency on
 * you is a contradiction between two declarations, and no amount of taste
 * makes it consistent. So the direction count is graded and the rest is not,
 * and the two live behind DIFFERENT FLAGS with different npm scripts and
 * different CI steps — because a reader looking at a red run has to be able
 * to tell "somebody moved a file and did not re-pin" from "somebody inverted
 * the layering", and a third behaviour on `--check` would report both as one.
 *
 * ## Why this axis is here rather than in `check:partition`
 *
 * `check:partition` resolves its ROOT to `<checkout>/cat-harness`, so the
 * wrong-direction count it prints is scoped to ONE layer and is silent
 * about edges between already-extracted siblings. `bf5l` measured the
 * discriminator: with `cat-harness/schemas/library/intake.ts` importing
 * `folio-assistant-core` in place, `check:instance-graph` and
 * `check:partition` were both green and this script reported 1. A node's
 * layer HERE is the layer it lives in, which is why it can see the axis at
 * all.
 *
 * ## It writes nothing, and that is load-bearing twice over
 *
 * A gate that mutates the tree it is judging is not a gate, and this one runs
 * in CI. It also means the flag does not inherit `ymsu` — that defect is
 * `bun test` repairing a SIDECAR that a later gate then compares against
 * itself, and a live-computed edge count has no sidecar to repair. `ymsu` is
 * open and untouched (the owner accepted that cost when ruling Option 2);
 * what is claimed here is only that this particular flag is outside its
 * mechanism, which is checkable: nothing below reads a committed file.
 */
const gatingDirection = process.argv.includes("--gate-direction");
const { written: sidecarsWritten, stale: staleSidecars } = writeSidecars();
const orphanSidecars = sweepOrphans(sidecarsWritten);

if (gatingDirection) {
  gateDirection();
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ thresholds: DEFAULT_THRESHOLDS, results, dangling }, null, 2));
} else {
  console.log(`\nDetangle — ${nodes.length} nodes, ${edges.length} edges, ${dangling.length} dangling\n`);
  // Stated rather than silent: a measurement pinned from a bare walk counts
  // whatever is on the machine, which is the defect `corpusOf` exists for. A
  // reader must be able to tell which kind of number they are looking at.
  if (corpusFallbacks.length > 0) {
    console.log(
      `  ? git could not enumerate ${corpusFallbacks.length} scanned directory(ies); a bare walk was used, so`,
    );
    console.log("    their counts may include untracked residue: " + corpusFallbacks.join(", "));
    console.log("");
  }
  if (absentScanTargets.length > 0) {
    console.log(`  ? ${absentScanTargets.length} declared scan target(s) do not exist, so nothing was measured`);
    console.log("    for them — a determined empty, not an unknown. Remove from SCAN or create: ");
    console.log("    " + absentScanTargets.join(", "));
    console.log("");
  }
  console.log(
    "  " +
      ["group".padEnd(40), "size".padStart(5), "coh".padStart(6), "in".padStart(5), "out".padStart(6), "grps".padStart(5), "dir".padStart(6), "enf".padStart(4), "prose".padStart(6), "wdir".padStart(5), "undet".padStart(6), "role".padEnd(13), "verdict"].join(" "),
  );
  console.log("  " + "-".repeat(135));
  for (const r of results) {
    if (only && r.group !== only) continue;
    const v = r.clauses.length === 0 ? "CANDIDATE" : `${r.clauses.length} clause(s) fail`;
    console.log(
      "  " +
        [
          r.group.padEnd(40),
          String(r.size).padStart(5),
          r.cohesion.toFixed(2).padStart(6),
          String(r.inbound).padStart(5),
          String(r.outbound).padStart(6),
          String(r.distinctTargetGroups).padStart(5),
          r.directionality.toFixed(2).padStart(6),
          String(r.enforcedBoundary).padStart(4),
          String(r.proseMentions).padStart(6),
          String(r.wrongDirection).padStart(5),
          String(r.undeterminedDirection).padStart(6),
          r.role.padEnd(13),
          v,
        ].join(" "),
    );
    if (only) {
      for (const c of r.clauses) console.log(`      · ${c}`);
      if (r.worklist.length) {
        // Wrong-direction first: it is the kind a declaration decides, so it
        // is the part of the list that needs no adjudication to act on.
        console.log(`\n      Detangling worklist — every outbound edge, wrong-direction first:`);
        const ordered = [...r.classified].sort((a, b) => Number(b.kind === "wrong-direction") - Number(a.kind === "wrong-direction"));
        for (const e of ordered) {
          console.log(`      → ${e.to}   [${e.via}]   from ${e.from}\n          ${e.kind} — ${e.basis}`);
        }
      }
    }
  }
  console.log(
    `\n  Nothing here decides anything. A failing clause is a reason to LOOK.\n` +
      `  The carve is an adjudication — see cat-harness/schemas/kg/detangle.ts, "taste is a declared step".\n`,
  );
}

/**
 * The cross-instance direction verdict — see {@link gatingDirection}.
 *
 * Prints its own short report rather than the candidate table. The table ends
 * with "Nothing here decides anything", which is true of it and false of this,
 * and putting a verdict under that sentence is how a reader learns to discount
 * both.
 */
function gateDirection(): void {
  const offenders = results.filter((r) => r.wrongDirection > 0);
  const total = offenders.reduce((n, r) => n + r.wrongDirection, 0);
  const undetermined = results.reduce((n, r) => n + r.undeterminedDirection, 0);

  console.log(`\nCross-instance direction — ${nodes.length} nodes, ${edges.length} edges\n`);

  // ── THE DENOMINATOR, stated before the numerator. Bean `cjvs`, Done-when 2:
  // *"`kg:detangle` says whether its wrong-direction count is over all edges
  // or only the resolving ones. Today a reader cannot tell."*
  //
  // It is over the RESOLVING ones, and that has to be said by a gate that
  // BLOCKS on the number. A dangling ref is a link-shaped value that does not
  // dereference (`blv9`), and it is excluded from the graph before any edge is
  // classified — so a `0` here is `0 among the edges that resolve`, which is a
  // weaker claim than `0`. Left unstated, this gate could go green because an
  // edge failed to resolve rather than because the layering held, which is
  // `1xhc` arriving through the back door of its own remedy.
  //
  // REPORTED, NOT GRADED, and the split is the same one this whole flag is
  // built on: whether a dangling ref would have been a wrong-direction edge is
  // NOT KNOWABLE from the count, so failing on it would be grading a
  // could-not-determine. `cjvs` owns triaging them; this only refuses to let
  // the number be read as if they were not there.
  const danglingByVia = new Map<string, number>();
  for (const d of dangling) danglingByVia.set(d.via, (danglingByVia.get(d.via) ?? 0) + 1);
  const viaBreakdown = [...danglingByVia].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${n} ${v}`).join(", ");
  console.log(`  denominator: the ${edges.length} edge(s) that RESOLVE. ${dangling.length} dangling ref(s) are excluded`);
  console.log(`  before any edge is classified${viaBreakdown ? ` (${viaBreakdown})` : ""}, so the count below is`);
  console.log(`  "0 among the edges that resolve" and not "0". Whether a dangling ref would have been a`);
  console.log(`  wrong-direction edge is not knowable from here — reported, never graded (bean cjvs).`);
  console.log("");

  // SCOPE FIRST, because a bare count is exactly the over-broad claim this
  // gate exists to stop being made (`p11x`; corrected by comment on #1465).
  // The axis is only as wide as SCAN, and saying so is not a disclaimer — a
  // directory missing from that list reads as "nothing to report" rather than
  // as a gap, which is `1xhc` with a smaller blast radius.
  console.log(`  scope: the ${SCAN.length} declared scan target(s) below, as WHOLE INSTANCES —`);
  console.log(`  a node's layer is the instance it lives in, and what a layer may reach is its`);
  console.log(`  declared \`needs\`, transitively. This is the axis \`check:partition\` cannot see:`);
  console.log(`  that tool's ROOT is one instance, so its count is silent about edges between them.`);
  for (const s of SCAN) console.log(`    ${s.path}${absentScanTargets.includes(s.path) ? "   (absent — measured as a determined empty)" : ""}`);
  console.log("");

  // ── THE INSTANCE-LEVEL DENOMINATOR, and it is the one that matters most.
  //
  // `cjvs` made the gate state its EDGE denominator. This is the same demand
  // one level up: how many of the checkout's layers the axis actually
  // reaches. Without it a `0` is read as "the layering holds" when it may
  // only mean "the two instances I looked at agree".
  //
  // It is worse than an ordinary blind spot, because SCAN's coverage is
  // asymmetric and the two halves fail differently:
  //
  //   - an importer outside SCAN is not a node, so its edges are never
  //     extracted at all and appear NOWHERE, not even as dangling;
  //   - an importer inside SCAN reaching a target outside it produces a
  //     DANGLING ref, which the denominator above already excludes.
  //
  // Either way the edge cannot be wrong-direction however blocking this gate
  // is made. Measured 2026-09-30: `cat-harness/` imports from
  // `bootstrap-tools/` — a SIBLING layer (both declare `needs:
  // ["bootstrap"]`, so neither is the other's ancestor) which `cat-harness`
  // does not declare needing, and which no `permits` entry exempts because
  // the repository declares none. 20 import statements across 24 files; 10 of
  // those files are under `cat-harness/schemas` and in SCAN, 14 are under
  // `scripts`/`content` and are not; 6 surface as dangling refs and the rest
  // are invisible. `check:partition` cannot see them either (its ROOT is one
  // layer) and `check:instance-graph` reports ✓ because it judges
  // declarations and never imports — `bf5l`'s three-green-checks table with a
  // fourth row.
  //
  // NOT FIXED HERE, and deliberately not fixed by adding `bootstrap-tools` to
  // SCAN: that would add nodes and edges to a set of PINNED adjudications
  // mid-flight, and whether `cat-harness` should declare it among its `needs`
  // or `bootstrap-tools` should fold into `bootstrap` is a declaration ruling
  // for the owner, not a side effect of wiring a gate. What this block does
  // is refuse to let the omission read as clean — the unreached layers are
  // DERIVED from the checkout and named, so one added tomorrow shows up here
  // without an edit, and a `0` can never again be mistaken for a verdict over
  // layers this axis never looked at.
  const declaredInstances = readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .filter((n) => existsSync(join(ROOT, n, `${n}.json`)))
    .sort();
  const unreached = declaredInstances.filter((n) => !layerNeeds.has(n));
  console.log(`  instance denominator: ${layerNeeds.size} of the checkout's ${declaredInstances.length} declared instance(s)`);
  console.log(`  contribute nodes to this graph. The verdict below is over THOSE, and no others.`);
  if (unreached.length > 0) {
    console.log("");
    console.log(`  ! ${unreached.length} declared instance(s) are NOT REACHED by any scan target, so this gate has`);
    console.log(`    no opinion whatever about edges into or out of them — not "clean", NOT MEASURED:`);
    console.log(`      ${unreached.join(", ")}`);
    console.log(`    An import from an unscanned directory is never extracted; an import INTO an`);
    console.log(`    unscanned one becomes a dangling ref and is excluded above. Either way it cannot`);
    console.log(`    be wrong-direction here, however blocking this gate is. Reported, never graded:`);
    console.log(`    widening SCAN changes a set of pinned adjudications and is a person's decision.`);
  }
  console.log("");

  if (corpusFallbacks.length > 0) {
    console.log(`  ? git could not enumerate ${corpusFallbacks.length} scanned directory(ies); a bare walk was`);
    console.log(`    used, so their edges may include untracked residue: ${corpusFallbacks.join(", ")}`);
    console.log("");
  }

  // Reported, never graded. `undetermined` means no declaration settles the
  // direction — failing on it would be this gate deciding a layering nobody
  // declared, which is the opposite of what it is for. Printed so that
  // could-not-determine is never rendered as clean.
  if (undetermined > 0) {
    console.log(`  ? ${undetermined} outbound edge(s) have an UNDETERMINED direction — an endpoint's instance`);
    console.log(`    declares no \`needs\`, so nothing here settles which way they run. Reported, not graded:`);
    console.log(`    grading them would be this gate deciding a layering nobody has declared.`);
    console.log("");
  }

  if (total === 0) {
    console.log(`  ✓ 0 wrong-direction edges across the scanned instances.`);
    return;
  }

  console.error(`  ✗ ${total} wrong-direction edge(s) across the scanned instances:\n`);
  for (const r of offenders) {
    for (const e of r.classified.filter((c) => c.kind === "wrong-direction")) {
      console.error(`    ${e.from}  ->  ${e.to}   [${e.via}]`);
      console.error(`        ${e.basis}`);
    }
  }
  console.error(
    `\n    An instance may not reference one that declares a dependency on it. Either the` +
      `\n    IMPORT is wrong, or the two \`<instance>.json\` \`needs\` declarations are — check the` +
      `\n    target's declaration before the importer's.` +
      `\n\n    This is the only detangle number that is GRADED. The rest are pinned, because the` +
      `\n    carve is an adjudication; a contradiction between two declarations is not.`,
  );
  process.exit(1);
}

// ── Report the pinned record, after the table so it reads as a footnote to it.
if (!process.argv.includes("--json") && !gatingDirection) {
  const where = relative(process.cwd(), RESULTS_DIR);
  if (checking && !pinnedInCheckout) {
    // Not "current": nothing was compared. Said in full, so the line cannot
    // be mistaken for the pass it is not.
    console.log(`  ? ${sidecarsWritten.length} group measurement(s) computed; no pinned record in the checkout (${where}/ is absent).`);
    console.log("    Nothing was compared and the orphan sweep did not run: with no record there is nothing to be stale");
    console.log("    (proposal §2.3). The record is derived QA on the qa-reports branch; `bun run cat qa:fetch` brings it back to");
    console.log("    compare against, and `bun run cat kg:detangle` writes a fresh one.");
  } else if (checking) {
    if (staleSidecars.length === 0 && orphanSidecars.length === 0) {
      console.log(`  \u2713 ${sidecarsWritten.length} pinned measurement(s) current in ${where}/`);
    }
  } else {
    console.log(`\n  wrote ${sidecarsWritten.length} pinned measurement(s) to ${where}/`);
  }
  // NAMED, never counted — the question a stale sidecar raises is WHICH number
  // moved, and a bare count makes the reader go and diff it themselves.
  const advisory = checking && detangleStored;
  if (advisory && staleSidecars.length + orphanSidecars.length > 0) {
    console.log(
      `  advisory: ${staleSidecars.length} stale and ${orphanSidecars.length} orphaned sidecar(s) in ${where}/ — not gated:` +
        " the tree is stored on qa-reports (judge, never compare; bean oqe3). `qa:refresh` rebuilds the record.",
    );
  }
  for (const s of staleSidecars) {
    console[checking && !advisory ? "error" : "log"](`  ${advisory ? "moved " : checking ? "STALE" : "updated"}  ${s.path} — ${s.fields.join(", ")}`);
  }
  for (const o of orphanSidecars) {
    console[advisory ? "log" : "error"](`  ORPHAN ${o} — no current group measures this. Reported, not deleted: it may be a declaration gap rather than a dead group.`);
  }
  if (checking && against !== undefined) {
    const c = compareWithStored(against);
    if ("unknown" in c) console.log(`  ? UNKNOWN — no stored detangle record to compare with (${c.unknown}). Reported, not gated.`);
    else {
      console.log(`  against ${c.from}: ${c.moved.length} group measurement(s) moved, ${c.orphans.length} stored sidecar(s) no current group measures. Reported, not gated.`);
      for (const m of c.moved) console.log(`    moved  ${m.path} — ${m.fields.join(", ")}`);
      for (const o of c.orphans) console.log(`    ORPHAN ${o}`);
    }
  }
}

if (checking && !detangleStored && (staleSidecars.length > 0 || orphanSidecars.length > 0)) {
  console.error(`\n  Run \`bun run cat kg:detangle\` and commit the result.`);
  process.exit(1);
}
