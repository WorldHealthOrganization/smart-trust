#!/usr/bin/env bun
/**
 * Do the declared directories' subgraphs have any edge between them?
 *
 * A **subgraph** is a set of nodes with the graph's edges between them; every
 * set of files induces one. A **directory** is where a named subgraph is
 * written down so tooling can find it (`subgraphTree` and `owningDirectory`
 * in `schemas/kg/cat-harness.ts` are pure path containment, derived from the
 * declared paths).
 *
 * The intent measured here:
 *
 * > **The partition by declared directory should have no edge crossing it** —
 * > equivalently, it should COARSEN the graph's partition into connected
 * > components. Each declared subgraph is then a union of components, and
 * > "should be disconnected" means mutually disconnected.
 *
 * `byPair` below computes the crossing edges per pair of subgraphs.
 *
 * It REPORTS the entanglement and does not gate on it. `--check` exits
 * non-zero ONLY when a subgraph's edges could not be read at all.
 *
 * Usage:
 *   bun run cat subgraphs            # the tree and the entanglement report
 *   bun run cat check:subgraphs      # same, non-zero only if something is unreadable
 *
 * @covers cat-harness
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Glob } from "bun";

import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";

import {
  defaultGraphTypologies,
  isDerivedGraph,
  isPublishedGraphTypology,
  isRenderable,
  owningDirectory,
  readDeclaration,
  resolveDirectories,
  subgraphTree,
} from "../schemas/kg/cat-harness.js";
import { checkoutDirectories, checkoutRootFor } from "../schemas/kg/harness-config.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.js";
import type { GraphTypologyRegistry } from "../schemas/kg/graph-typology-registry.js";
import { corpusScopeFor } from "./known-skills.js";
import { gateOwnInstances, nothingOwnLine } from "./lib/gate-own.ts";
import { mayLeaveMain } from "./qa-results.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { overlayPath } from "./lib/layer-output.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

const ROOT = resolve(HARNESS_ROOT);

export interface CrossEdge {
  from: string;
  fromDir: string;
  to: string;
  toDir: string;
}

export interface SubgraphReport {
  /** id → directories nested immediately inside it. */
  tree: ReturnType<typeof subgraphTree>;
  edges: CrossEdge[];
  /**
   * A link out of a subgraph whose target does not exist.
   *
   * **The first draft of this file skipped these**, with the comment *"a
   * dangling link is `blv9`, not this"*. That was wrong, and it hid the
   * largest finding in the corpus: relocating CRDM into `methodologies/crdm/`
   * (bean `g43o`, hours earlier — CRDM has since moved again, to
   * `sdlc/skills/crdm/`, and this sentence is kept in the past tense on purpose:
   * it records what the check caught, not where the files are today) broke
   * **13 sibling links** in
   * `crdm-requirements-workflow.md` — `interaction-modality.md`,
   * `staging-review.md`, `todo-manager.md` and the rest were siblings when
   * CRDM lived in `skills/folio-core/`, and nothing caught it.
   *
   * In a check about disentangling subgraphs, a dead link OUT of one is not
   * a neighbouring concern — it is the strongest available evidence of an
   * INCOMPLETE MOVE. Skipping it made a half-finished relocation read as a
   * clean disconnection, which is the precise inversion the report exists to
   * prevent.
   */
  dangling: Array<{ from: string; fromDir: string; target: string }>;
  /**
   * Links that name a path a layer has MOVED, resolved at its new place
   * through that layer's declared `moves` (sdlc skill `two-phase-move`).
   * Not dangling while the move's window is open; each is a link its layer
   * still has to switch to the new path. `to` is the file it resolved to.
   */
  moved: Array<{ from: string; fromDir: string; target: string; to: string; move: string }>;
  /** Every move the layers of this checkout declare, with how many links still use the old path. */
  moves: Array<ResolvedMove & { inbound: number }>;
  /**
   * Links into a declared directory that is ABSENT from this checkout and may
   * be (`mayLeaveMain`: every kind it holds is one the qa-reports arc moves
   * off `main`). Whether such a link resolves cannot be determined here, so it
   * is neither dangling nor resolved — the third state, reported by count.
   * Bean `cxcn`: with the derived corpus absent, `test/README.md`'s generated
   * link to `results/README.md` read as a broken link.
   *
   * Also links into a declared `builtAtPublish` path that is not built in this
   * checkout ({@link unbuiltPublishPaths}): the publish build writes it, so
   * whether the target exists cannot be judged before that build has run.
   */
  unverifiable: Array<{ from: string; fromDir: string; target: string }>;
  /**
   * Directories skipped BY DECLARATION — they hold only unpublished graph
   * kinds, so their links are not held to resolution.
   *
   * `fsh-guts/` is the standing case, and the distinction matters: it was
   * already skipped before 2026-09-20, but by ACCIDENT — a repository-scoped
   * path fell out of attribution, and the right outcome arrived for the wrong
   * reason (bean `3ye4`). A thing in the trashcan is there because it was
   * superseded, and its links pointing at what moved is EXPECTED; that is a
   * decision, and a decision should be readable.
   *
   * Keyed on the declared graph typology rather than a new field, because
   * `isPublishedGraphTypology` already answers exactly this question and the
   * directory already declares `graphTypologies: ["fsh-guts"]`. Same shape as the
   * `published: false` a skill now carries: the thing says what it is.
   */
  exempt: string[];
  /**
   * Links inside a RENDERABLE graph that do not resolve in the source tree.
   *
   * DIFFERENT from `exempt`, which drops a retired directory wholesale. This
   * keeps the directory in scope and routes one class of link out of
   * `dangling`: a renderable graph addresses the PUBLISHED tree, so
   * `docs/concepts/architecture.md -> api/` names a directory the docs build
   * generates and `docs/concepts/skills.md -> ...migration.html` names a page Jekyll
   * renders. Neither is a file here and neither is broken.
   *
   * **Counted and printed, never asserted, and the number is why.** Declaring
   * `docs/` — 241 files, until 2026-09-20 invisible to every
   * declaration-driven consumer — put them in scope for the first time and
   * produced 171, of which 23 ARE source-tree links carrying one `../` too
   * many, rot left by the move of the layer under `cat-harness/`. That
   * audit is bean `mi97`.
   *
   * Without this the gate below could not be held at 0 once `docs/` was
   * declared, and the choice would have been 171 false findings or a silent
   * skip — which this module already refuses two paragraphs up.
   */
  siteResolved: Array<{ from: string; fromDir: string; target: string }>;
  /**
   * Links inside a DERIVED graph that do not resolve — the source document's
   * own, not ours.
   *
   * Third bucket for the same reason `siteResolved` is the second: the
   * directory stays in scope and one class of link is routed out of
   * `dangling`. A derived graph is machine-produced FROM a source, so a
   * markdown link inside it is whatever the derivation carried across. An
   * ingested page of the Claude Platform Docs prints `./REFERENCE.md` and
   * `./FORMS.md` inside an EXAMPLE of a skill directory; those were never
   * edges in this graph, and there is nothing to repoint.
   *
   * **The rule already existed one layer down, and this check was simply not
   * applying it.** `schemas/kg/cat-harness.ts` says of the `derived` layer that
   * *"a QA finding against a derived section is a finding against its
   * GENERATOR, not against the corpus, and it sends a reviewer to fix the
   * wrong file"*. That is exactly what happened on 2026-09-23: five ingested
   * documents produced 12 findings, every one asking somebody to edit a
   * transcription of a document this project did not write.
   *
   * **Repointing them would be worse than a waste.** Editing an extracted
   * section to satisfy a checker breaks the one promise a library entry
   * makes — that it says what the source said. Same reason `uses[]` is never
   * populated from Lean and a narrative is never invented.
   *
   * Counted and printed, never asserted, exactly as `siteResolved` is.
   */
  derivedLinks: Array<{ from: string; fromDir: string; target: string }>;
  /** Files that could not be read — the third state. */
  unreadable: string[];
  /**
   * Declared directories that exist and hold markdown, yet contributed no
   * attributed file — so nothing in them was examined.
   *
   * Added 2026-09-20 after this sweep reported **0 dangling links** over a
   * corpus in which a just-retired page still carried seven. The page had
   * moved to `fsh-guts/`, which is `scope: "repository"` and therefore sits
   * OUTSIDE this layer — and `owningDirectory` compares in the layer's
   * path space, so every repository-scoped directory was skipped without a
   * word. `bootstrap/skills/` and `uploads/` are skipped the
   * same way.
   *
   * Skipping retired content is defensible; skipping it SILENTLY is not,
   * because "0 dangling" then reads as "everything resolves" when it means
   * "everything I looked at resolves". That is the could-not-determine state
   * rendered as clean, which this repository refuses everywhere else.
   */
  notExamined: string[];
  scanned: number;
}

/**
 * Blank out code — a link inside an EXAMPLE is not a link.
 *
 * Added 2026-09-20 after the first real triage of this check's findings
 * (bean `rl3h`): of 18 targets it reported as naming nothing, most were
 * illustrations rather than references —
 *
 *  - ``[`prop:Y`](Y.md)`` inside an inline code span in
 *    `proposition-consolidation-audit.md`, showing what a cross-reference
 *    LOOKS like;
 *  - `` `[audit](../../../docs/audits/...)` `` in a `one-voice-audit.md`
 *    table cell, quoting a pattern the audit tells you to search FOR and
 *    remove;
 *  - two invented bean ids in a blockquoted specimen turn report.
 *
 * Counting them is the wolf-crying this file's header already refuses once,
 * and it is worse here than a plain false positive: the remedy a reader
 * infers is to "fix" prose that is correct, and in the third case to invent
 * two beans to satisfy a link in an example.
 *
 * Same rule and same reason as `check-declared-paths`'s `stripComments`,
 * which exists because its scanner matched its own documentation. Replaces
 * with spaces rather than deleting, so offsets survive.
 */
function stripCode(text: string): string {
  let out = text.replace(/^(\s*)(```|~~~)[\s\S]*?^\s*\2\s*$/gm, (m) => " ".repeat(m.length));
  // Inline spans, longest fence first so ``a `b` c`` is one span.
  out = out.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (m) => " ".repeat(m.length));
  return out;
}

/** Markdown link targets that look like a path into this repository. */
function linkTargets(raw: string): string[] {
  const text = stripCode(raw);
  const out: string[] = [];
  for (const m of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const t = m[1]!;
    if (/^(?:https?:|mailto:|#)/.test(t)) continue;
    // A PLACEHOLDER is not a target. `crdm-requirements-workflow.md` line 245
    // is an illustrative table — `| Landing | [main](…) | [staging](…) |` —
    // showing the shape of an output, and its ellipses never named a file.
    // Reporting them would be two standing false findings, which is the
    // wolf-crying this file's header already refuses once.
    //
    // Same rule and same reason as `check-declared-paths`, which skips
    // `${…}` and `<locale>`: a template is not a path a link could resolve.
    if (/^[…\.]+$/.test(t) || /[$<]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

/**
 * Resolve a link target in the SOURCE tree, or `undefined`.
 *
 * A `.html` target is a RENDERED PAGE, not a file here: jekyll builds
 * `docs/skills.html` from `docs/concepts/skills.md`. Testing the `.html` on disk
 * reports every correct site link as broken, and the first triage (bean
 * `rl3h`) hit exactly that. Resolving to the source tells a page with a
 * source apart from one that genuinely does not exist; skipping `.html`
 * outright would hide the second.
 *
 * It is a FUNCTION rather than two inline blocks because `overDeepLinks`
 * has to test a candidate repair under the SAME rule that put the link in
 * the unresolved bucket. Two copies of that rule is two answers to "does
 * this resolve", free to disagree — and the count below would then be
 * measuring something other than what the scan measured.
 */
/** A link destination as a path: percent-decoded, or unchanged if the escapes are malformed. */
/** A typology whose pages a renderable PARENT publishes — `within` a renderable one. */
function publishedByParent(g: string, registry: GraphTypologyRegistry): boolean {
  const parent = registry.get(g)?.within;
  return parent !== undefined && isRenderable(parent, registry);
}

/**
 * Do the links of a directory of these kinds address the PUBLISHED tree
 * rather than this one? A renderable kind's do; so do a kind `within` a
 * renderable one ({@link publishedByParent}) and a kind whose markdown is
 * shown on a published page (`shownOnPublishedPages`: an IG annex appended
 * to its host page). Those links go to
 * `siteResolved`; judging them from the page that shows them is the kind
 * owner's gate (fhir-harness's `check:ig-annex-links`), since only it knows
 * which page that is.
 *
 * Read through a cast so this compiles against a cat-harness pinned before
 * cat-harness#618 added the field; an older registry simply never sets it.
 */
export function addressesPublishedTree(kinds: readonly string[], registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  return kinds.some((g) => isRenderable(g, registry) || publishedByParent(g, registry) || (registry.get(g) as { shownOnPublishedPages?: boolean } | undefined)?.shownOnPublishedPages === true);
}

export function decodeLinkTarget(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function resolveInTree(abs: string): string | undefined {
  // Over the layer overlay: a mounted layer's generated pages are at its
  // output root (bean `cat-tools-sm8r`, item 4).
  const at = overlayPath(abs);
  if (existsSync(at)) return at;
  if (abs.endsWith(".html")) {
    const asSource = overlayPath(`${abs.slice(0, -".html".length)}.md`);
    if (existsSync(asSource)) return asSource;
  }
  return undefined;
}

/**
 * Of the links that do not resolve, the ones carrying ONE `../` too many —
 * the signature a directory move leaves behind, and the only kind of
 * unresolved link in a renderable graph that is rot rather than a published
 * address.
 *
 * **Computed, never remembered.** This number was a STRING LITERAL in the
 * report for five days (bean `syrl`): measured once on 2026-09-20, written
 * into the message, and printed unchanged beside a total that re-measured
 * every run. A reader could not tell whether any of them had been repaired.
 * That is the repository's own rule — `kg-audit`'s *never quote a count from
 * prose*, `turn-reporting`'s *a count without its measurement is a claim* —
 * broken by its own tooling, and with a longer half-life than the prose case
 * because it arrives wearing the authority of a measurement.
 *
 * The repair is tested against disk, not inferred from the shape: a target
 * that merely starts with `../` proves nothing, and a `../` dropped from a
 * path that still does not resolve is a different defect.
 */
export function overDeepLinks(
  root: string,
  links: ReadonlyArray<{ from: string; fromDir: string; target: string }>,
): Array<{ from: string; fromDir: string; target: string; repaired: string }> {
  const out: Array<{ from: string; fromDir: string; target: string; repaired: string }> = [];
  for (const link of links) {
    if (!link.target.startsWith("../")) continue;
    const repaired = link.target.slice("../".length);
    if (repaired.length === 0) continue;
    const abs = resolve(root, dirname(link.from), decodeLinkTarget(repaired));
    if (resolveInTree(abs) !== undefined) out.push({ ...link, repaired });
  }
  return out;
}

/**
 * The markdown nodes in {@link abs}, as paths relative to it.
 *
 * **Asked of git, not of the disk** (`gitCorpus`). A bare glob here was
 * correct for as long as no declared directory happened to contain an
 * untracked subtree — and stopped being correct the moment a gate installed a
 * publishable package's devDependencies, at which point this sweep descended
 * into `node_modules/` and reported **31 broken links**, every one inside a
 * third-party README linking to its own repository's files. Bean `rsi6`; the
 * same shape as `ramz` one directory over.
 *
 * Falls back to the glob when git cannot answer — a temp fixture is not a
 * work tree, and refusing there would trade a false finding for an unrunnable
 * check. The fallback is the LOOSER set, so it can only over-report.
 */
function markdownIn(abs: string): string[] {
  const listed = gitCorpus(abs, ["*.md"]);
  if (listed !== undefined) return listed.map((f) => relative(abs, f));
  return [...new Glob("**/*.md").scanSync({ cwd: abs })];
}

/**
 * The bean store's archive VIEW, paired with the store it sits inside.
 *
 * Bean `e8m3`: the owner ruled 2026-09-26 that archiving is a view rather
 * than a terminal state, so an archived bean is still part of the store and
 * still resolves. `beans archive` (a third-party binary) moves a file from
 * `defs/` to `defs/archive/` and rewrites nothing, so after a sweep two kinds
 * of link stop resolving on disk while still naming the right bean
 * (cat-harness-tools#1248):
 *
 * - a link FROM an archived bean, written relative to `defs/`;
 * - a link TO an archived bean, written as `defs/<bean>.md`.
 *
 * Both are tried again in the other half of the pair. Only `bean-defs`
 * directories nested inside another `bean-defs` directory pair up, so no
 * other graph gets this leniency.
 */
export function beanArchiveViews(
  dirs: ReadonlyArray<{ absPath?: string; path: string; graphTypologies: readonly string[] }>,
  root: string,
): Array<{ store: string; view: string }> {
  const defs = dirs
    .filter((d) => d.graphTypologies.includes("bean-defs"))
    .map((d) => resolve(d.absPath ?? join(root, d.path)));
  const out: Array<{ store: string; view: string }> = [];
  for (const view of defs) {
    for (const store of defs) {
      if (view !== store && view.startsWith(store + "/")) out.push({ store, view });
    }
  }
  return out;
}

/** {@link resolveInTree}, then the other half of a store/archive pair ({@link beanArchiveViews}). */
export function resolveAcrossArchive(
  file: string,
  target: string,
  wanted: string,
  views: ReadonlyArray<{ store: string; view: string }>,
): string | undefined {
  const direct = resolveInTree(wanted);
  if (direct !== undefined) return direct;
  for (const { store, view } of views) {
    // From an archived bean, as if it still sat in the store.
    const from = dirname(file);
    if (from === view || from.startsWith(view + "/")) {
      const moved = resolveInTree(resolve(join(store, relative(view, from)), target));
      if (moved !== undefined) return moved;
    }
    // To a bean that has since been archived.
    if (dirname(wanted) === store) {
      const archived = resolveInTree(join(view, relative(store, wanted)));
      if (archived !== undefined) return archived;
    }
  }
  return undefined;
}

/** One entry of a layer's `moves`, with its paths made absolute. */
export interface ResolvedMove {
  /** `<instance>:<from>`, how the report names it. */
  id: string;
  absFrom: string;
  absTo: string;
  until: string;
  /** `until` is before today: the move is no longer honoured. */
  expired: boolean;
}

/**
 * The moves the layers under {@link roots} declare (`moves` on each
 * declaration). An unreadable declaration contributes none; reporting it is
 * `check:harness-dirs`'s job.
 */
export function declaredMoves(roots: readonly string[], asOf?: string): ResolvedMove[] {
  let today = asOf;
  if (today === undefined) {
    // input-site: traced #d197ddc4 — today, which decides whether a declared move has expired, unless the caller gives a date: a run that reads it records no hash
    inputSiteReached("check-subgraphs: today");
    today = new Date().toISOString().slice(0, 10);
  }
  const out: ResolvedMove[] = [];
  for (const root of new Set(roots.map((r) => resolve(r)))) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch {
      continue;
    }
    for (const m of decl?.moves ?? []) {
      out.push({
        id: `${decl!.name}:${m.from}`,
        absFrom: resolve(root, m.from),
        absTo: resolve(root, m.to),
        until: m.until,
        expired: m.until < today,
      });
    }
  }
  return out;
}

/**
 * Where {@link wanted} resolves through a move whose window is still open, or
 * `undefined`. The old path is answered for, not kept on disk: a copy left in
 * both places mints one IRI twice (`kg-separation`, "A file left in BOTH layers").
 */
export function resolveThroughMove(
  wanted: string,
  moves: readonly ResolvedMove[],
): { resolved: string; move: ResolvedMove } | undefined {
  for (const move of moves) {
    if (move.expired) continue;
    if (wanted !== move.absFrom && !wanted.startsWith(move.absFrom + "/")) continue;
    const resolved = resolveInTree(join(move.absTo, relative(move.absFrom, wanted)));
    if (resolved !== undefined) return { resolved, move };
  }
  return undefined;
}

/**
 * What a link sweep needs to know about the corpus, computed once: the
 * declared directories, how each is labelled, which absent ones may be, and
 * the bean store's archive views. {@link scanSubgraphs} sweeps every file with
 * it; {@link danglingLinksIn} judges ONE file's text with the same rule, which
 * is how `state:push` judges the files it is about to splice (bean `asq1`).
 */
export interface LinkContext {
  root: string;
  own: ReturnType<typeof resolveDirectories>;
  dirs: ReturnType<typeof resolveDirectories>;
  label: (d: ReturnType<typeof resolveDirectories>[number]) => string;
  absentOffMain: string[];
  archiveViews: Array<{ store: string; view: string }>;
  /** The `moves` the checkout's layers declare (sdlc skill `two-phase-move`). */
  moves?: ResolvedMove[];
  /**
   * Declared `builtAtPublish` paths (absolute) that are not built in this
   * checkout. A link into one cannot be judged until the publish build runs,
   * so it is `unverifiable`, not `dangling`; once the path exists, a missing
   * target is dangling again. See {@link unbuiltPublishPaths}.
   */
  unbuilt?: string[];
}

/**
 * The `builtAtPublish` paths the layers under {@link roots} declare that
 * are ABSENT here, as absolute paths (a directory entry keeps its trailing
 * `/`). Only an absent one counts: a built one is judged like any other file,
 * so a link to a file the build did not write is still reported. An
 * unreadable declaration contributes none (`check:harness-dirs` reports it).
 */
export function unbuiltPublishPaths(roots: readonly string[]): string[] {
  const out: string[] = [];
  for (const root of new Set(roots.map((r) => resolve(r)))) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch {
      continue;
    }
    for (const e of decl?.builtAtPublish ?? []) {
      const abs = resolve(root, e.path);
      if (existsSync(abs)) continue;
      out.push(e.path.endsWith("/") ? `${abs}/` : abs);
    }
  }
  return out;
}

/** Whether {@link wanted} lies at or under one of {@link unbuilt} ({@link unbuiltPublishPaths}). */
function underUnbuilt(wanted: string, unbuilt: readonly string[]): boolean {
  return unbuilt.some((u) => (u.endsWith("/") ? wanted === u.slice(0, -1) || wanted.startsWith(u) : wanted === u));
}

export function linkContext(root: string = ROOT): LinkContext {
  // The CORPUS on the platform's own run (placement PR0, bean `ejye`): what
  // the platform's `scope: "repository"` mirrors used to bring into this sweep
  // is asked of the checkout now. Ids repeat across layers there (several
  // `library`), so ownership is compared by ABSOLUTE PATH below and a foreign
  // directory is labelled `<member>/<id>`; the containment TREE is still this
  // layer's own declaration, the question it always answered.
  const own = resolveDirectories([{ name: "(local)", root, own: true }]);
  const dirs = corpusScopeFor(root) === "checkout" ? checkoutDirectories(root, { stackedOn: root }) : own;
  // `own` on a checkout entry means "its own instance's", not this one's, so
  // the test is membership of THIS layer's resolution.
  const ownPaths = new Set(own.map((o) => o.absPath));
  const label = (d: (typeof dirs)[number]): string =>
    ownPaths.has(d.absPath) || d.member === undefined ? d.id : `${d.member}/${d.id}`;
  // Declared directories that are absent and allowed to be: a link into one
  // cannot be judged from this checkout.
  const absentOffMain = dirs
    .filter((d) => mayLeaveMain(d as { graphTypologies?: string[]; storage?: unknown }))
    .map((d) => resolve(d.absPath ?? join(root, d.path)))
    .filter((a) => !existsSync(a));
  const instances = [root, ...layerRootsIn(checkoutRootFor(root))];
  const moves = declaredMoves(instances);
  const unbuilt = unbuiltPublishPaths(instances);
  return { root, own, dirs, label, absentOffMain, archiveViews: beanArchiveViews(dirs, root), moves, unbuilt };
}

/** Retired content is not held to link resolution — see `exempt`. */
function isExemptDirectory(dir: { graphTypologies: readonly string[] }): boolean {
  return dir.graphTypologies.length > 0 && dir.graphTypologies.every((g) => !isPublishedGraphTypology(g));
}

/**
 * Where one link of `file` (owned by `owner`) goes: the file it resolves to,
 * or the bucket an unresolved link is reported in.
 */
function judgeLink(
  ctx: LinkContext,
  file: string,
  owner: { graphTypologies: readonly string[] },
  target: string,
): { resolved: string; move?: ResolvedMove } | { bucket: "unverifiable" | "siteResolved" | "derivedLinks" | "dangling" } {
  // `resolveInTree` carries the `.html` → `.md` rule and its reasoning.
  // A link destination is a URL: `%20`, `%28`, `%40` name the file's own
  // characters (`linkTarget` in subgraph-readmes writes them), so decode
  // before asking the filesystem. Malformed escapes stay as written.
  const decoded = decodeLinkTarget(target);
  const wanted = resolve(dirname(file), decoded);
  const resolved = resolveAcrossArchive(file, decoded, wanted, ctx.archiveViews);
  if (resolved !== undefined) return { resolved };
  // Through a declared move whose window is open: resolved, and reported as moved.
  const through = resolveThroughMove(wanted, ctx.moves ?? []);
  if (through !== undefined) return { resolved: through.resolved, move: through.move };
  if (ctx.absentOffMain.some((a) => wanted === a || wanted.startsWith(a + "/"))) return { bucket: "unverifiable" };
  // Into a declared publish-time artefact that is not built here: judged once the build has run.
  if (underUnbuilt(wanted, ctx.unbuilt ?? [])) return { bucket: "unverifiable" };
  // A renderable graph addresses the PUBLISHED tree, not this one.
  // A typology `within` a renderable one is published BY it — the
  // docs graph's named groups (bean `xka5`), `proposals` and
  // `requirements` are not sites of their own, but their pages are docs
  // pages on the docs site, so their links address the same tree.
  // A kind whose markdown a published page SHOWS (an IG annex) is the same case.
  const renderable = addressesPublishedTree(owner.graphTypologies);
  // A DERIVED graph's links came from the SOURCE document rather than
  // from an author here — see `derivedLinks`. Tested after
  // `renderable` only because no kind is currently both; if one ever
  // is, addressing the published tree is the more specific claim and
  // should win.
  const derived = owner.graphTypologies.some((g) => isDerivedGraph(g));
  return { bucket: renderable ? "siteResolved" : derived ? "derivedLinks" : "dangling" };
}

/**
 * The targets in `text` that {@link scanSubgraphs} would report as
 * `dangling` if `text` were the content of `file` (an absolute path): none
 * when its owner is exempt, and `undefined` when no declared directory owns
 * it, which the sweep never reaches and so cannot judge.
 *
 * The text is passed rather than read so a caller can judge two versions of
 * one file — what is on disk and what the branch tip holds — under the same
 * rule, and report only what the edit introduced (`state:push`, bean `asq1`).
 */
export function danglingLinksIn(ctx: LinkContext, file: string, text: string): string[] | undefined {
  const owner = owningDirectory(ctx.dirs, file);
  if (owner === undefined) return undefined;
  if (isExemptDirectory(owner)) return [];
  return linkTargets(text).filter((t) => {
    const j = judgeLink(ctx, file, owner, t);
    return "bucket" in j && j.bucket === "dangling";
  });
}

/**
 * `scope`, when given, sweeps only the directories those layers commit
 * (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`). Every
 * directory stays a link TARGET, so an edge into a mounted layer is still
 * resolved and reported.
 */
export function scanSubgraphs(root: string = ROOT, scope?: ReadonlySet<string>): SubgraphReport {
  const ctx = linkContext(root);
  const { own, dirs, label } = ctx;
  const tree = subgraphTree(own);
  const edges: CrossEdge[] = [];
  const dangling: SubgraphReport["dangling"] = [];
  const moved: SubgraphReport["moved"] = [];
  const unverifiable: SubgraphReport["unverifiable"] = [];
  const derivedLinks: SubgraphReport["derivedLinks"] = [];
  const unreadable: string[] = [];
  const notExamined: string[] = [];
  const exempt: string[] = [];
  const siteResolved: SubgraphReport["siteResolved"] = [];
  const buckets = { dangling, unverifiable, derivedLinks, siteResolved };
  let scanned = 0;

  for (const dir of dirs) {
    if (scope !== undefined && dirs !== own && !scope.has((dir as { member?: string }).member ?? (dir as { declaredBy?: string }).declaredBy ?? "")) continue;
    const abs = dir.absPath ?? join(root, dir.path);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) continue;
    if (isExemptDirectory(dir)) {
      exempt.push(`${label(dir)} (${dir.path})`);
      continue;
    }
    let attributed = 0;
    let unowned = 0;
    for (const rel of markdownIn(abs)) {
      const file = join(abs, rel);
      // ABSOLUTE, not instance-relative. A `scope: "repository"` directory
      // resolves OUTSIDE this layer, so `relative(root, …)` yields a
      // `../…` path that matches no declared prefix and the file is
      // attributed to nothing — silently. Six declared directories were
      // swept past that way (bean `3ye4`), and the symptom was a sweep
      // reporting ZERO dangling links over a corpus that had some.
      //
      // `owningDirectory` compares in the space of the path it is given, and
      // every resolved directory carries `absPath`, so absolute is the space
      // in which instance-relative and repository-scoped entries are
      // commensurable at all.
      const owner = owningDirectory(dirs, file);
      if (owner === undefined) unowned += 1;
      // Attribute the file to its DEEPEST owner, not to the directory whose
      // sweep happened to reach it — that attribution IS the `x4v4` defect.
      if (owner === undefined || owner.absPath !== dir.absPath) continue;
      scanned += 1;
      attributed += 1;
      let text: string;
      try {
        text = readFileSync(file, "utf-8");
      } catch {
        unreadable.push(relative(root, file));
        continue;
      }
      for (const target of linkTargets(text)) {
        const j = judgeLink(ctx, file, owner, target);
        if ("bucket" in j) {
          buckets[j.bucket].push({ from: relative(root, file), fromDir: label(owner), target });
          continue;
        }
        const resolved = j.resolved;
        if (j.move !== undefined) {
          moved.push({ from: relative(root, file), fromDir: label(owner), target, to: relative(root, resolved), move: j.move.id });
        }
        const to = owningDirectory(dirs, resolved);
        if (to === undefined || to.absPath === owner.absPath) continue;
        edges.push({
          from: relative(root, file),
          fromDir: label(owner),
          to: relative(root, resolved),
          toDir: label(to),
        });
      }
    }
    // NOT EXAMINED means a file this sweep could attribute to NOTHING — the
    // `3ye4` path-space defect. A directory whose every file belongs to a
    // DEEPER declared one (a member's `test/` holding only `test/results/`)
    // was examined, under that deeper owner; over the checkout (placement
    // PR0) that is the common case for an inherited member.
    if (attributed === 0 && unowned > 0) {
      notExamined.push(`${label(dir)} (${dir.path})`);
    }
  }
  const moves = (ctx.moves ?? []).map((m) => ({ ...m, inbound: moved.filter((l) => l.move === m.id).length }));
  return { tree, edges, dangling, moved, moves, unverifiable, derivedLinks, exempt, siteResolved, unreadable, notExamined, scanned };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // In a layer's PR checks, only the caller's own directories are swept (owner ruling 2026-11-05).
  const scope = gateOwnInstances();
  const { tree, edges, dangling, moves, unverifiable, derivedLinks, exempt, siteResolved, unreadable, notExamined, scanned } =
    scanSubgraphs(ROOT, scope);

  console.log(`Subgraphs  (${scanned} markdown node(s) attributed to a declared directory)\n`);

  if (tree.length === 0) {
    console.log("  No directory contains another. Nothing nests, so nothing to disentangle.");
  } else {
    console.log("NESTING — derived from declared paths, never restated:");
    for (const r of tree) console.log(`  ${r.parent}  ⊃  ${r.children.join(", ")}`);
  }

  // Vacuity before the verdict. With nothing attributed, "no cross edges"
  // is a statement about the sweep and not about the corpus.
  if (scanned === 0 && scope) {
    console.log(nothingOwnLine("check:subgraphs", "markdown in a declared directory", scope));
    process.exit(0);
  }
  if (scanned === 0) {
    console.error("\n✗ ATTRIBUTED NO FILES. This is not a pass: nothing was examined.");
    process.exit(1);
  }

  const byPair = new Map<string, CrossEdge[]>();
  for (const e of edges) {
    const k = `${e.fromDir} → ${e.toDir}`;
    byPair.set(k, [...(byPair.get(k) ?? []), e]);
  }

  if (byPair.size === 0) {
    // Pairwise, and about the PARTITION rather than about any one directory:
    // a lone subgraph is not disconnected from anything, and a component is
    // connected by definition. See §"Vocabulary" for why the old wording —
    // "every declared directory is a disconnected component" — was false.
    console.log("\n✓ no edge crosses a declared directory: the declared partition coarsens the components.");
  } else {
    console.log(`\nENTANGLEMENT — ${edges.length} edge(s) crossing ${byPair.size} pair(s).`);
    console.log("Reported, not refused: the owner's own framing is that these are");
    console.log("*in the process of being disentangled*, and a gate on work already");
    console.log("known to be outstanding is a gate somebody switches off.\n");
    for (const [pair, list] of [...byPair].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${String(list.length).padStart(3)}  ${pair}`);
      for (const e of list.slice(0, 4)) console.log(`         ${e.from}  →  ${e.to}`);
      if (list.length > 4) console.log(`         … and ${list.length - 4} more`);
    }
  }

  if (unverifiable.length > 0) {
    console.log(
      `\n? ${unverifiable.length} link(s) point into a declared directory absent from this checkout ` +
        `(derived QA, kept off main): COULD NOT DETERMINE whether they resolve — not counted as broken, not as clean.`,
    );
  }

  if (dangling.length > 0) {
    const byDir = new Map<string, typeof dangling>();
    for (const d of dangling) byDir.set(d.fromDir, [...(byDir.get(d.fromDir) ?? []), d]);
    console.log(`\nBROKEN LINKS OUT — ${dangling.length}, and each is an edge whose`);
    console.log("target cannot be attributed to any subgraph. A cluster of these in one");
    console.log("directory is the signature of a RELOCATION THAT DID NOT FINISH.\n");
    for (const [dir, list] of [...byDir].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${String(list.length).padStart(3)}  ${dir}`);
      for (const d of list) console.log(`         ${d.from}  →  ${d.target}`);
    }
  }

  if (moves.length > 0) {
    console.log(`\nMOVES — ${moves.length} declared; a link to the old path resolves at the new one until \`until\` (skill \`two-phase-move\`):`);
    for (const m of moves) {
      const state = m.expired ? "EXPIRED, not honoured" : m.inbound === 0 ? "nothing links to the old path: remove the entry" : `${m.inbound} link(s) still to switch`;
      console.log(`  ${m.id}  until ${m.until}  — ${state}`);
    }
  }

  if (siteResolved.length > 0) {
    const byDir = new Map<string, number>();
    for (const l of siteResolved) byDir.set(l.fromDir, (byDir.get(l.fromDir) ?? 0) + 1);
    console.log(
      `\n· ${siteResolved.length} link(s) in RENDERABLE graph(s) do not resolve in the source tree:`,
    );
    for (const [id, n] of [...byDir].sort((a, b) => b[1] - a[1])) console.log(`    ${id}: ${n}`);
    // MEASURED here, not remembered: bean `syrl`. The sentence below used to
    // carry the count as a string literal, so it could not move when the
    // links did.
    const overDeep = overDeepLinks(ROOT, siteResolved);
    console.log(
      "  Not a finding: a renderable graph addresses the PUBLISHED tree, where the\n" +
        "  site build resolves `api/`, `*.html` and generated pages. NOT a clean bill\n" +
        "  either — bean `mi97` audits them.",
    );
    if (overDeep.length > 0) {
      console.log(
        `  Of those, ${overDeep.length} carry one \`../\` too many — dropping one resolves\n` +
          "  on disk, which is the signature of a relocation that did not finish.",
      );
      for (const l of overDeep.slice(0, 5)) console.log(`         ${l.from}  →  ${l.target}`);
      if (overDeep.length > 5) console.log(`         … and ${overDeep.length - 5} more`);
    } else {
      console.log("  None of them carries one `../` too many; the rest address the site.");
    }
  }

  if (derivedLinks.length > 0) {
    const byDir = new Map<string, number>();
    for (const l of derivedLinks) byDir.set(l.fromDir, (byDir.get(l.fromDir) ?? 0) + 1);
    console.log(
      `\n· ${derivedLinks.length} link(s) in DERIVED graph(s) do not resolve in the source tree:`,
    );
    for (const [id, n] of [...byDir].sort((a, b) => b[1] - a[1])) console.log(`    ${id}: ${n}`);
    console.log(
      "  Not a finding: a derived graph is machine-produced FROM a source, so a link\n" +
        "  inside it is the SOURCE document's — an ingested page printing `./FORMS.md`\n" +
        "  inside an example was never an edge here. Repointing one would edit a\n" +
        "  transcription to satisfy a checker, which breaks the only promise a library\n" +
        "  entry makes. NOT a clean bill either: a link a GENERATOR mangled would land\n" +
        "  here too, and telling those apart needs the generator, not this sweep.",
    );
  }

  if (exempt.length > 0) {
    console.log(`\nEXEMPT BY DECLARATION — ${exempt.length} directory(ies) hold only`);
    console.log("unpublished graph typologies, so their links are not held to resolution:\n");
    for (const d of exempt) console.log(`  · ${d}`);
    console.log(
      "\nRetired content is superseded by definition, so a link of its pointing at\n" +
        "what moved is expected. Stated here rather than inferred, because this WAS\n" +
        "skipped accidentally until 2026-09-20 and a right answer for the wrong\n" +
        "reason is one nobody can rely on.",
    );
  }

  if (notExamined.length > 0) {
    console.log(
      `\nNOT EXAMINED — ${notExamined.length} declared directory(ies) hold markdown but`,
    );
    console.log("contributed no attributed file, so nothing in them was checked. A clean");
    console.log("result above is a statement about what WAS looked at:\n");
    for (const d of notExamined) console.log(`  · ${d}`);
    console.log(
      "\nRepository-scoped entries resolve outside this instance, which is why they\n" +
        "fall out. Retired content under `fsh-guts/` is deliberately not held to\n" +
        "link resolution; the others are a gap, not a decision.",
    );
  }

  const expired = moves.filter((m) => m.expired);
  if (check && expired.length > 0) {
    console.error(
      `\n✗ ${expired.length} declared move(s) are past \`until\`: ${expired.map((m) => m.id).join(", ")}.\n` +
        "Remove the entry from the declaration; any link above still using the old path is now broken.",
    );
    process.exit(1);
  }

  // GATED, as of 2026-09-20 — and only now, because only now is the number
  // trustworthy. It read 0 while six declared directories went unattributed
  // (bean `3ye4`), so gating it then would have enforced a statement about
  // what the sweep happened to look at. With attribution fixed the corpus
  // stands at 0 with every directory either examined or exempt by
  // declaration, and a new broken link is a regression somebody introduced.
  //
  // The ENTANGLEMENT report above stays ungated, deliberately: disentangling
  // is work the owner has said is in progress, and a gate on known-
  // outstanding work is one somebody switches off (bean `x4v4`).
  if (check && dangling.length > 0) {
    console.error(
      `\n✗ ${dangling.length} link(s) point at nothing. Repoint them, or remove the\n` +
        "link and keep the text — a reader cannot tell a stale link from a wrong one.",
    );
    process.exit(1);
  }

  if (unreadable.length > 0) {
    console.error(`\n✗ ${unreadable.length} file(s) could not be read, so their edges are UNKNOWN:`);
    for (const u of unreadable) console.error(`  · ${u}`);
    console.error("\nCould-not-determine is never a pass — it outranks the report above.");
    if (check) process.exit(1);
  }
}
