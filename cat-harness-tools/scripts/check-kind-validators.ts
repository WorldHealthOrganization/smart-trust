#!/usr/bin/env bun
/**
 * Every graph typology that declares a validator — does it actually load?
 *
 * 1. **A declared validator that does not resolve** — a wrong path, a missing
 *    export, or a module that exports an interface rather than a Zod schema.
 *    Fails.
 * 2. **A kind with no validator at all** — reported, never failed.
 *    `--require-all` turns this into a failure.
 *
 * @module folio-assistant/scripts/check-kind-validators
 * @covers validators, block-kinds, content-adapters, qa-checkers, pipeline-plugins, computed — every
 *   block kind's adapter must name a `content-adapters/` node, and an untyped vocabulary's module must exist; every
 *   `qa-checkers` and `pipeline-plugins` node is loaded through the platform root's dependency
 *   tree and must resolve to the code its table ref names; every discovered block kind is checked against
 *   the kinds BlockSchema types, both directions; every `folio-validator/v1` node is parsed, resolved and
 *   joined onto a kind (one naming no kind is a finding), which is fixed coverage of the
 *   `validators` graph; the KINDS it sweeps are whichever declare `nodeSchemas`, so that half
 *   is computed and a literal list would go stale silently
 */

// The REGISTRY, not BASE_GRAPH_TYPOLOGIES: since bean dmx1 a harness DECLARES its
// kinds in a typologies/ graph, and a sweep over the code list alone stopped checking
// every kind that moved (the FHIR IG harness's, cat-openapi's — now cat-harness/openapi/ — core's). Measured
// 2026-10-04 while building riit; core's code-registered kinds are imported too.
import {
  BASE_GRAPH_TYPOLOGIES,
  declaredKindNodes,
  defaultGraphTypologies,
  type GraphTypologyRegistry,
} from "../schemas/kg/graph-typology-registry.js";
import { FOLIO_GRAPH_TYPOLOGY } from "../schemas/kg/folio-graph-typology.js";
import { BLOCK_KINDS, CONTENT_ADAPTER_NODES, DISCOVERED_BLOCK_KIND_NODES } from "../schemas/content/block-kinds.js";
import { declaredNodeFiles } from "../schemas/kg/declared-nodes.js";
import { allTypedBlockKinds, vocabularies as loadedVocabularies } from "../schemas/content/vocabulary-modules.js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";
import { dirname, join, relative, resolve } from "node:path";

import { directoryEntriesForGraph, findInstanceRoot, layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.js";
import { familyBody, nodeFamilyTag, resolveKindValidator, resolveNodeSchemas } from "../schemas/kg/kind-validator.js";
import { HARNESS_ROOT, REPO_ROOT } from "./lib/roots.ts";
import { ContributionRegistry } from "../schemas/content/contributions.js";
import { loadContributionsSync } from "../schemas/kg/harness-config.js";
import { resolveSubgraphSource } from "../schemas/kg/subgraph-source.js";
import { mountChoiceOf } from "../schemas/kg/remote-mount.js";
import { graphReadPath } from "./graph-read.ts";
import { ownedOutside, typologyOwner } from "../schemas/kg/node-kind-index.js";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
const instanceRoot = HARNESS_ROOT;

export interface ValidatorSweep {
  resolved: string[];
  /**
   * A kind that has DECIDED a runtime validator cannot apply, with its reason.
   *
   * Bean `rj0n`. These were counted as `undeclared` until 2026-09-24, which made
   * the gap read as seven items over a real backlog of zero and made
   * `--require-all` a flag that could never pass. Kept as its own list rather
   * than folded into `resolved`, because "a schema parses these nodes" and "no
   * schema can" are different facts and a reader needs both.
   */
  notApplicable: { kind: string; reason: string }[];
  /** Has NOT said — the only state `--require-all` fails on. */
  undeclared: string[];
  unresolvable: { kind: string; reason: string }[];
  /**
   * A kind claiming BOTH a runnable schema and that none can exist. Reported
   * rather than resolved by precedence: picking a winner would let a
   * contradiction ship silently, and there is no reading under which both are
   * true.
   */
  contradictory: string[];
  /**
   * A kind owned by a layer this checkout does not hold (`ownedOutside`),
   * with that owner: its validator is that layer's to declare and its gate's to
   * judge, so it is in none of the states above. Standalone these are the
   * fixture's kinds (bean `w1gy`); in a composed checkout it is empty.
   */
  elsewhere: { kind: string; owner: string }[];
}

/** Code in another repository: it cannot declare a validator node in this one. */
export const FOREIGN_REPOSITORY_PREFIXES: readonly string[] = ["bootstrap-tools:", "bootstrap:"];

/**
 * Every validator string a kind's AUTHORED definition still carries: the code
 * list, the kinds/ nodes and the code-registered `folio` kind, read BEFORE the
 * registry joins validator nodes on, which is what tells a string an author
 * wrote from one the registry filled in.
 */
export function authoredValidatorStrings(): { kind: string; family?: string; ref: string }[] {
  const out: { kind: string; family?: string; ref: string }[] = [];
  const add = (kind: string, d: { validator?: string; nodeSchemas?: Readonly<Record<string, unknown>> }) => {
    if (d.validator) out.push({ kind, ref: d.validator });
    for (const [family, e] of Object.entries(d.nodeSchemas ?? {})) {
      const v = (e as { validator?: string }).validator;
      if (v) out.push({ kind, family, ref: v });
    }
  };
  for (const [k, d] of Object.entries(BASE_GRAPH_TYPOLOGIES)) add(k, d);
  add("folio", FOLIO_GRAPH_TYPOLOGY);
  for (const { node } of declaredKindNodes(join(import.meta.dir, "..", ".."))) add(node.kind, node);
  return out;
}

export async function sweep(root: string): Promise<ValidatorSweep> {
  const out: ValidatorSweep = { resolved: [], notApplicable: [], undeclared: [], unresolvable: [], contradictory: [], elsewhere: [] };
  for (const kind of defaultGraphTypologies.names()) {
    // Another layer's kind is left to that layer (bean `w1gy`).
    if (ownedOutside(defaultGraphTypologies, kind, join(root, ".."))) {
      out.elsewhere.push({ kind, owner: typologyOwner(defaultGraphTypologies, kind)! });
      continue;
    }
    const def = defaultGraphTypologies.get(kind);
    const na = def?.validatorNotApplicable;
    // The contradiction first, because everything below would otherwise pick a
    // winner between two claims that cannot both hold.
    if (na && (def?.validator || def?.nodeSchemas)) {
      out.contradictory.push(kind);
      continue;
    }
    const r = await resolveKindValidator(kind, root);
    if (r.state === "resolved") out.resolved.push(kind);
    // A kind that names its `$schema` families is checked per family above,
    // so it is not "undeclared" merely for having no kind-level validator.
    else if (r.state === "undeclared" && def?.nodeSchemas) out.resolved.push(`${kind} (per $schema family)`);
    else if (r.state === "undeclared" && na) out.notApplicable.push({ kind, reason: na });
    else if (r.state === "undeclared") out.undeclared.push(kind);
    else out.unresolvable.push({ kind: r.kind, reason: r.reason });
  }
  return out;
}

/** What a per-family sweep found for one kind that declares `nodeSchemas`. */
export interface FamilySweep {
  kind: string;
  /** Tag → [nodes, nodes that parsed] — parsed only for Zod families. */
  counts: Record<string, { nodes: number; checked: number; parsed: number; state: string }>;
  /** A tag on disk the map does not name — the map claimed completeness. */
  unmapped: { tag: string; example: string }[];
  /**
   * A tag the map does not name, met ONLY inside a checkout-built
   * `builtAtPublish` path: a projection of another layer's graph (the byte
   * copies under `docs/assets/library/jsonld/`, bean `8pzh`), whose nodes are
   * judged where their source is declared. Reported, never a failure.
   */
  projected?: { tag: string; example: string }[];
  /** A family whose reference does not resolve. */
  unresolvable: { tag: string; reason: string }[];
  /** A node that fails its family's Zod schema. */
  invalid: { file: string; issue: string }[];
  /** No layer declares a directory of this kind — nested, or not yet present. */
  noDirectory?: boolean;
  /**
   * Every declared directory of this kind keeps its content on a branch TIP
   * that this checkout has not mounted, so there was nothing here to read.
   *
   * **Could not determine — never a pass and never `EXAMINED NOTHING`.** The
   * two are different claims: `EXAMINED NOTHING` says the graph was read and
   * found to hold no node, and that is false of a graph this checkout cannot
   * reach. The gate that FAILS on an unmounted cutover is
   * `check:declared-dirs` (its `unmounted` finding, whose remedy is
   * `bun run cat state:mount`); duplicating the failure here would give one defect
   * two red gates and a reader no way to see which is the real one.
   *
   * Carries the reason `graphReadPath` refused with, so the remedy travels.
   */
  unreachable?: { id: string; reason: string }[];
  /**
   * The graph WAS read — in the checkout or at its mount — and holds no node,
   * and that is a legitimate state for it.
   *
   * Only for a kind whose content is kept at a branch TIP: one live copy that
   * a running process writes, where zero nodes means zero decisions have been
   * taken yet. A determined empty, not an unexamined corpus. Bean `najo`: the
   * merge queue's first entry is a steward's to write, and a gate that went
   * red until somebody wrote one would be answered by writing a FABRICATED
   * decision — which is exactly what bean `30jr` refused to do.
   *
   * A graph tracked in the checkout gets no such allowance: there, emptiness
   * is a corpus that should be there and is not, which is what
   * `EXAMINED NOTHING` is for.
   */
  emptyLiveStore?: { id: string; at: string }[];
  /**
   * The kind's content is DERIVED and kept on a commit-keyed branch (`qa` on
   * `qa-reports`), and the local working copy holds no node.
   *
   * **Could not determine — never `EXAMINED NOTHING`.** A commit-keyed
   * directory is not committed, so what is on disk is whatever other writers
   * left in it earlier in the same run. Calling it empty made the verdict
   * depend on gate order (cat-harness-tools#1204, the same defect #759 fixed
   * in `test-run-conformance`).
   */
  derivedNotComputed?: { id: string; at: string; branch: string }[];
  /**
   * Declared directories of this kind that the mount which placed their
   * layer did NOT choose: the upstream declares them, the lock
   * (`instances[].directories`) does not record them, and they are not on
   * disk. **Not examined — never `EXAMINED NOTHING`.** A downstream that
   * mounts only an upstream's `glossary/` has no `references/` to read, and
   * that is its choice, not an empty corpus. A directory the lock DOES record,
   * mounted and empty, is still `EXAMINED NOTHING`.
   */
  notMounted?: { id: string; path: string; lock: string }[];
  /**
   * Declared directories of this kind whose content the declaration says is
   * BUILT AT PUBLISH (`builtAtPublish` names a path inside them) and that hold
   * no node in this checkout: gitignored, never committed, so no checkout has
   * them until the writer runs. **Not examined — never `EXAMINED NOTHING`.**
   * A directory with no `builtAtPublish` claim gets no such allowance.
   */
  builtNotHere?: { id: string; path: string; writers: string[] }[];
  /** How many directories of this kind were actually read. */
  read?: number;
  /** Directories of this kind stored on a branch FAMILY: by declaration not in the checkout (bean lehh). */
  onFamily?: number;
}

/**
 * The JSON nodes in {@link dir} — asked of git, not of the disk.
 *
 * Two defects, both hit on 2026-09-26 the moment a gate installed a
 * publishable package's devDependencies (bean `rsi6`):
 *
 * 1. **It swept `node_modules/`.** A declared directory containing an
 *    untracked subtree meant thousands of third-party `.json` files routed
 *    through this repository's `$schema` map — and a tag the map does not
 *    name is a FAILURE here, so every one of them would have been a finding.
 * 2. **A dangling symlink CRASHED it.** `statSync` on `node_modules/.bin/`
 *    threw `ENOENT` and took the whole sweep with it, so the check reported
 *    nothing at all rather than reporting what it could not read. A checker
 *    that dies is strictly worse than one that says "could not determine".
 *
 * `gitCorpus` fixes the first; `statSync` is now guarded for the second,
 * because a broken symlink is a fact about the tree and not a reason to stop.
 */
function jsonFiles(dir: string): string[] {
  // `.jsonld` too: a library's manifest, sections and blocks are JSON-LD, and
  // are routed by the class they instantiate (cat-harness's library-nodes.ts).
  const listed = gitCorpus(dir, ["*.json", "*.jsonld"]);
  if (listed !== undefined) return listed;

  // Fallback for a directory git cannot answer about — a temp fixture, or a
  // path outside any work tree. Looser than the git answer, so it can only
  // over-report.
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const p = join(dir, e);
    let isDir: boolean;
    try {
      isDir = statSync(p).isDirectory();
    } catch {
      return []; // dangling symlink, or a race: not readable is not a crash
    }
    return isDir ? jsonFiles(p) : p.endsWith(".json") || p.endsWith(".jsonld") ? [p] : [];
  });
}

/**
 * Bean `rdkm`: for every kind that declares `nodeSchemas`, read each JSON
 * node in its declared directories, route it by its `$schema` tag, and
 * validate it where the family has a Zod schema. A tag the map does not name
 * fails — declaring the map is the claim that it is complete.
 */
export async function sweepFamilies(
  root: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Promise<FamilySweep[]> {
  const out: FamilySweep[] = [];
  // Every directory the checkout declares, with the kinds it carries. A node
  // under a MORE SPECIFIC declared directory belongs to that directory's
  // kinds, not to an enclosing one's: the DAK base layer declares
  // `library/<entry>/l1-extraction/` as `l1-extraction` inside its `library/`,
  // and the library map must not call that kind's run contexts and work lists
  // "unmapped" (folio-assistant#2529).
  const declaredDirs: { abs: string; kinds: readonly string[] }[] = [];
  // The checkout-built `builtAtPublish` paths of every layer: what they
  // hold is computed over OTHER layers, so a family met only there is the
  // projected layer's (see `FamilySweep.projected`).
  const checkoutBuilt: string[] = [];
  for (const inst of layerRootsIn(join(root, ".."))) {
    for (const b of readDeclaration(inst)?.builtAtPublish ?? []) {
      if (b.because === "checkout") checkoutBuilt.push(join(inst, b.path).replace(/\/+$/, "") + (b.path.endsWith("/") ? "/" : ""));
    }
    for (const e of readDeclaration(inst)?.directories ?? []) {
      declaredDirs.push({ abs: join(inst, e.path).replace(/\/+$/, ""), kinds: e.graphTypologies as readonly string[] });
    }
  }
  const innermostDeclared = (file: string): { abs: string; kinds: readonly string[] } | undefined => {
    let best: { abs: string; kinds: readonly string[] } | undefined;
    for (const d of declaredDirs) {
      if (file.startsWith(`${d.abs}/`) && (best === undefined || d.abs.length > best.abs.length)) best = d;
    }
    return best;
  };
  // A NESTED kind: it names its `$schema` families and no layer declares a
  // directory of it, so its nodes sit inside a parent kind's directory (the
  // IG artefact JSON-LD that gen-ig-pages writes under an `ig-pages` docs
  // root). Its families route from the parent's sweep and count as its own.
  type RoutedFamily = Awaited<ReturnType<typeof resolveNodeSchemas>>[number] | { tag: string; state: "unvalidated" };
  const nested = new Map<string, { kind: string; fam: RoutedFamily }>();
  for (const kind of registry.names()) {
    const def = registry.get(kind)!;
    if (!def.nodeSchemas || declaredDirs.some((d) => d.kinds.includes(kind))) continue;
    for (const fam of await resolveNodeSchemas(kind, root, registry)) if (!nested.has(fam.tag)) nested.set(fam.tag, { kind, fam });
    for (const tag of Object.keys(def.nodeSchemas)) if (!nested.has(tag)) nested.set(tag, { kind, fam: { tag, state: "unvalidated" } });
  }
  const routed = new Map<string, Pick<FamilySweep, "counts" | "invalid">>();
  for (const kind of registry.names()) {
    const def = registry.get(kind)!;
    if (!def.nodeSchemas) continue;
    const fams = await resolveNodeSchemas(kind, root, registry);
    const byTag = new Map<string, RoutedFamily>(fams.map((f) => [f.tag, f]));
    // A family declared with `{}` in `nodeSchemas` and joined to no validator
    // in this checkout (e.g. `diig-phases-figure/v1` and
    // `smart-guidelines-approach-figure/v1`, baselined as unkinded in
    // `node-kinds.baseline.json`) is still a family the typology names:
    // routed here as `unvalidated`, never reported as `unmapped`.
    for (const tag of Object.keys(def.nodeSchemas)) if (!byTag.has(tag)) byTag.set(tag, { tag, state: "unvalidated" });
    const s: FamilySweep = { kind, counts: {}, unmapped: [], unresolvable: [], invalid: [], projected: [] };
    for (const f of fams) if (f.state === "unresolvable") s.unresolvable.push({ tag: f.tag, reason: f.reason });
    const repoRoot = join(root, "..");
    const inProjection = (file: string): boolean => checkoutBuilt.some((d) => file === d || (d.endsWith("/") && file.startsWith(d)));
    // WHERE TO READ, not where the declaration points. A graph kept at a branch
    // tip is read at its mount, and when nothing is mounted there is no
    // directory to read at all — which is a different answer from an empty one.
    // Bean `najo`; `graphReadPath` is the one implementation of the question.
    const dirs = new Set<string>();
    // A directory stored on a BRANCH FAMILY (bean lehh), or ROUTE-keyed on a
    // published branch (the site, `gh-pages`), holds its nodes on those
    // branches by declaration, never in the checkout: named, not swept.
    const onFamily = new Set<string>();
    const liveStores = new Map<string, string>();
    const derivedStores = new Map<string, { at: string; branch: string }>();
    let declared = 0;
    for (const inst of layerRootsIn(repoRoot)) {
      for (const e of readDeclaration(inst)?.directories ?? []) {
        const st = e.storage as { keyedBy?: string } | undefined;
        const src = e.source as { kind?: string } | undefined;
        if (e.graphTypologies.includes(kind as never) && (st?.keyedBy === "family" || st?.keyedBy === "route" || st?.keyedBy === "route-family" || src?.kind === "family")) onFamily.add(join(inst, e.path).replace(/\/$/, ""));
      }
      for (const d of directoryEntriesForGraph(inst, kind)) {
        if (onFamily.has(d.absPath.replace(/\/$/, ""))) continue;
        declared++;
        // Declared upstream, not chosen by the mount that placed this
        // layer, and not on disk: there is nothing here to read, and that
        // is not the same answer as an empty directory (see `notMounted`).
        if (!existsSync(d.absPath)) {
          const choice = mountChoiceOf(inst, d.absPath);
          if (choice !== undefined && !choice.chosen) {
            (s.notMounted ??= []).push({ id: d.id, path: relative(repoRoot, d.absPath) || ".", lock: choice.lock });
            continue;
          }
        }
        const src = (() => {
          try {
            return resolveSubgraphSource(d);
          } catch {
            // A contradictory declaration is `check:declared-dirs`'s finding,
            // and not a reason for this sweep to stop reading.
            return null;
          }
        })();
        const atTip = src?.kind === "branch" && src.keyedBy === "tip";
        // A directory in the checkout is read where its own layer declares
        // it. `graphReadPath` resolves an id across the whole repository, so
        // two layers' `glossary` would both resolve to one of them — only a
        // branch-stored graph needs it, to find its mount.
        if (src?.kind !== "branch") {
          // Built at publish and not built here: nothing committed to read.
          const rel = relative(inst, d.absPath).replace(/\/+$/, "");
          const built = (readDeclaration(inst)?.builtAtPublish ?? []).filter((b) => b.path.replace(/\/+$/, "").startsWith(`${rel}/`) || b.path.replace(/\/+$/, "") === rel);
          if (built.length > 0 && (!existsSync(d.absPath) || jsonFiles(d.absPath).length === 0)) {
            const writers = [...new Set(built.flatMap((b) => b.writer))];
            (s.builtNotHere ??= []).push({ id: d.id, path: relative(repoRoot, d.absPath) || ".", writers });
            continue;
          }
          dirs.add(d.absPath);
          continue;
        }
        const where = graphReadPath(d.id, repoRoot);
        if (where.state === "refused") {
          (s.unreachable ??= []).push({ id: d.id, reason: where.reason });
          continue;
        }
        const at = where.state === "ok" ? where.at : d.absPath;
        dirs.add(at);
        if (atTip) liveStores.set(d.id, at);
        else if (src.keyedBy === "commit") derivedStores.set(d.id, { at, branch: src.branch });
      }
    }
    s.onFamily = onFamily.size;
    s.read = dirs.size;
    if (declared === 0 && onFamily.size > 0) {
      out.push(s);
      continue;
    }
    if (declared === 0) {
      s.noDirectory = true;
      out.push(s);
      continue;
    }
    if (dirs.size === 0) {
      // Every directory of this kind is cut over and unmounted here.
      out.push(s);
      continue;
    }
    for (const dir of dirs) {
      for (const file of jsonFiles(dir)) {
        let node: unknown;
        try {
          node = JSON.parse(readFileSync(file, "utf8"));
        } catch {
          continue; // not a node; a malformed file is another check's finding
        }
        // `nodeFamilyTag` also reads a `structure.json`'s `_schema`, and a JSON-LD
        // node's class. Either is routed only when this kind lists it, as is any
        // tag of a `.jsonld` file, so what the sweep did not read before stays
        // unread rather than becoming an unmapped family.
        const tag = nodeFamilyTag(node);
        if (typeof tag !== "string") continue;
        const optIn = (node as { $schema?: unknown }).$schema === undefined || file.endsWith(".jsonld");
        if (optIn && !byTag.has(tag) && !nested.has(tag)) continue;
        // Under a more specific declared directory of other kinds: theirs.
        // MORE SPECIFIC than the directory being read, that is. `declaredDirs`
        // holds instance-level entries only, so a directory this kind is
        // declared at FROM WITHIN (`beans/beans.json`'s `workflows`, which
        // `directoryEntriesForGraph` resolves) is not in it, and the innermost
        // entry it finds for `beans/workflows/x.json` is the ENCLOSING
        // `beans/`. Asking only "is that entry of my kind?" then dropped every
        // `workflow-state` node from its own sweep, and `require-all` called
        // the kind EXAMINED NOTHING over the node it had just been handed
        // (bean `8lcl`, folio-assistant#2812). An enclosing directory never
        // takes a node away from the kind declared nearer to it; only a deeper
        // one does, which is the #2529 case this guard exists for. The node
        // still counts for `beans` too: `beans/` is read as a whole, and its
        // family map names the child families for exactly that reason.
        const inner = innermostDeclared(file);
        const reading = dir.replace(/\/+$/, "");
        if (inner !== undefined && !inner.kinds.includes(kind) && inner.abs.startsWith(`${reading}/`)) continue;
        const own = byTag.get(tag);
        const via = own === undefined ? nested.get(tag) : undefined;
        const fam = own ?? via?.fam;
        const rel = relative(join(root, ".."), file);
        if (!fam && inProjection(file)) {
          if (!s.projected!.some((u) => u.tag === tag)) s.projected!.push({ tag, example: rel });
          continue;
        }
        if (!fam) {
          if (!s.unmapped.some((u) => u.tag === tag)) s.unmapped.push({ tag, example: rel });
          continue;
        }
        const into = via === undefined ? s : (routed.get(via.kind) ?? routed.set(via.kind, { counts: {}, invalid: [] }).get(via.kind)!);
        const c = (into.counts[tag] ??= { nodes: 0, checked: 0, parsed: 0, state: fam.state });
        c.nodes++;
        if (fam.state !== "resolved") continue;
        c.checked++;
        const r = fam.schema.safeParse(familyBody(node));
        if (r.success) c.parsed++;
        else into.invalid.push({ file: rel, issue: `${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}` });
      }
    }
    // A live store that was READ and holds nothing: recorded here so the
    // reporter can say "determined empty" rather than "examined nothing".
    if (Object.values(s.counts).reduce((a, c) => a + c.nodes, 0) === 0 && liveStores.size > 0) {
      s.emptyLiveStore = [...liveStores].map(([id, at]) => ({ id, at: relative(repoRoot, at) || "." }));
    }
    // A derived, commit-keyed store with nothing local: not computed here.
    if (Object.values(s.counts).reduce((a, c) => a + c.nodes, 0) === 0 && derivedStores.size > 0) {
      s.derivedNotComputed = [...derivedStores].map(([id, d]) => ({ id, at: relative(repoRoot, d.at) || ".", branch: d.branch }));
    }
    out.push(s);
  }
  // A nested kind's nodes, met in its parents' directories, are reported as its own.
  for (const s of out) {
    const r = routed.get(s.kind);
    if (r === undefined) continue;
    for (const [tag, c] of Object.entries(r.counts)) {
      const t = (s.counts[tag] ??= { nodes: 0, checked: 0, parsed: 0, state: c.state });
      t.nodes += c.nodes;
      t.checked += c.checked;
      t.parsed += c.parsed;
    }
    s.invalid.push(...r.invalid);
  }
  return out;
}

async function main(): Promise<number> {
  const requireAll = process.argv.includes("--require-all");
  const families = await sweepFamilies(instanceRoot);
  let familyFail = false;
  for (const f of families) {
    const nodes = Object.values(f.counts).reduce((a, c) => a + c.nodes, 0);
    console.log(`${f.kind}: ${Object.keys(f.counts).length} $schema famil(ies) over ${nodes} node(s)`);
    for (const [tag, c] of Object.entries(f.counts)) {
      console.log(
        c.checked
          ? `  ✓ ${tag}: ${c.parsed}/${c.checked} parse`
          : c.state === "external"
              ? `  · ${tag}: ${c.nodes} node(s), an external specification — named, not run here`
              : c.state === "unvalidated"
                  ? `  · ${tag}: ${c.nodes} node(s), routed here, no validator in this checkout — could not determine`
                  : `  · ${tag}: ${c.nodes} node(s), a TypeScript shape, not runnable — could not determine`,
      );
    }
    if (f.onFamily && Object.keys(f.counts).length === 0) {
      console.log(`  · ${f.onFamily} director(ies) on a branch family or a route-keyed branch by declaration — the nodes are on those branches, not in this checkout, so not examined here`);
    } else if (f.noDirectory && nodes > 0) {
      console.log(`  · no instance declares a ${f.kind} directory — its nodes above were met in a parent kind's directory`);
    } else if (f.noDirectory) {
      console.log(`  · no instance declares a ${f.kind} directory — nothing to route (a nested kind is reached through its parent)`);
    } else if (f.builtNotHere && nodes === 0 && !f.read && !f.unreachable) {
      // NOT EXAMINED: the declaration says this content is written at publish
      // and never committed, so no checkout holds it until the writer runs.
      for (const b of f.builtNotHere) {
        console.log(`  · not examined — ${f.kind} at \`${b.id}\` (${b.path}) is built at publish${b.writers.length ? ` by ${b.writers.join(", ")}` : ""} (\`builtAtPublish\`) and holds no node in this checkout`);
      }
      for (const m of f.notMounted ?? []) console.log(`  · not examined — ${f.kind} at \`${m.id}\` (${m.path}) is declared upstream and not mounted here: ${m.lock} does not choose it`);
    } else if (f.notMounted && nodes === 0 && !f.read && !f.unreachable) {
      // NOT EXAMINED: every directory of this kind is one the mount did not
      // choose. Not a pass, and not `EXAMINED NOTHING` either — nothing here
      // was there to read. A chosen directory that is empty still fails below.
      for (const m of f.notMounted) {
        console.log(`  · not examined — ${f.kind} at \`${m.id}\` (${m.path}) is declared upstream and not mounted here: ${m.lock} does not choose it`);
      }
    } else if (f.unreachable && nodes === 0) {
      // COULD NOT DETERMINE. Never printed as a pass, and never as
      // `EXAMINED NOTHING`: nothing read this graph, so "no node was found" is
      // a claim this run is not entitled to. `check:declared-dirs` is the gate
      // that fails on it — one defect, one red gate. Bean `najo`.
      for (const u of f.unreachable) {
        console.log(`  ⚠ could not determine — ${f.kind} at \`${u.id}\` was not read: ${u.reason}`);
      }
    } else if (f.emptyLiveStore && nodes === 0) {
      // A DETERMINED empty: read, and holding nothing, which is a legitimate
      // state for one live copy a process writes. The alternative is a gate
      // whose only remedy is to fabricate a node (bean `30jr` refused that).
      for (const e of f.emptyLiveStore) {
        console.log(
          `  · ${f.kind} at \`${e.id}\` (${e.at}) was READ and holds no node — a determined empty, ` +
            `not an unexamined corpus: its content is one live copy at a branch tip that a running ` +
            `process writes, so zero nodes means zero have been written yet`,
        );
      }
    } else if (f.derivedNotComputed && nodes === 0) {
      // COULD NOT DETERMINE (cat-harness-tools#1204): the working copy of a
      // commit-keyed store is whatever earlier gates in this run wrote, so an
      // empty one says nothing about the kind.
      for (const d of f.derivedNotComputed) {
        console.log(
          `  ⚠ could not determine — ${f.kind} at \`${d.id}\` (${d.at}) is derived and stored on \`${d.branch}\`; ` +
            `no node is in this checkout's working copy, so it was not computed here`,
        );
      }
    } else if (nodes === 0) {
      console.log(`  ✗ EXAMINED NOTHING — ${f.kind} declares nodeSchemas and no node was found`);
      familyFail = true;
    }
    if (f.notMounted && (nodes > 0 || f.read || f.unreachable)) {
      for (const m of f.notMounted) console.log(`  · ${m.id} (${m.path}) is declared upstream and not mounted here (${m.lock} does not choose it) — not examined`);
    }
    for (const u of f.projected ?? [])
      console.log(`  · ${u.tag}: another instance's node in a checkout-built projection (e.g. ${u.example}), judged where its source is declared`);
    for (const u of f.unmapped) console.log(`  ✗ unmapped family ${u.tag} (e.g. ${u.example})`);
    for (const u of f.unresolvable) console.log(`  ✗ ${u.tag}: ${u.reason}`);
    if (f.unmapped.length || f.unresolvable.length) familyFail = true;
    for (const i of f.invalid.slice(0, 10)) console.log(`  ✗ ${i.file} — ${i.issue}`);
    if (f.invalid.length) familyFail = true;
  }
  if (families.length) console.log("");
  const r = await sweep(instanceRoot);
  const total = r.resolved.length + r.notApplicable.length + r.undeclared.length + r.unresolvable.length + r.contradictory.length;

  if (total === 0) {
    // A sweep over no kinds has not passed. This repository has paid three
    // times for a check that ticked over an empty set.
    console.log("⚠ EXAMINED NOTHING — no graph typologies are registered");
    return 1;
  }

  console.log(
    `${total} graph typology(s): ${r.resolved.length} with a validator that loads, ` +
      `${r.notApplicable.length} where one cannot apply`,
  );
  for (const k of r.resolved) console.log(`  ✓ ${k}`);
  // Printed with the REASON, never as a bare count. A reader has to be able to
  // check the claim — the reason names a file format or an absent subject, so
  // "not applicable" cannot become the polite way to launder a real gap.
  for (const n of r.notApplicable) console.log(`  · ${n.kind} — no runtime validator applies: ${n.reason}`);
  for (const e of r.elsewhere) console.log(`  · ${e.kind} — owned by ${e.owner}, which this checkout does not hold: judged there`);

  if (r.contradictory.length > 0) {
    console.log(
      `\n✗ ${r.contradictory.length} kind(s) claim BOTH a runnable schema and that none can exist — ` +
        `there is no reading under which both hold: ${r.contradictory.join(", ")}`,
    );
    return 1;
  }

  // THE CLEAN BREAK (bean riit, step 1c): a kind's AUTHORED definition names
  // no validator code; a `folio-validator/v1` node names the kind instead. The
  // one exception is code in ANOTHER repository (a submodule such as
  // bootstrap-tools), which cannot declare a node here; it is named, not failed.
  const authored = authoredValidatorStrings();
  const foreign = authored.filter((a) => FOREIGN_REPOSITORY_PREFIXES.some((p) => a.ref.startsWith(p)));
  const inline = authored.filter((a) => !foreign.includes(a));
  for (const f of foreign) console.log(`  · ${f.kind}${f.family ? ` ${f.family}` : ""}: validator in another repository (${f.ref}), kept as a string until it declares a node`);
  if (inline.length > 0) {
    console.log(`\n✗ ${inline.length} validator(s) written into a kind's definition rather than declared as a validators/ node:`);
    for (const i of inline) console.log(`  ✗ ${i.kind}${i.family ? ` ${i.family}` : ""}: ${i.ref}`);
    return 1;
  }

  // A VALIDATOR NODE naming a kind no layer declares (bean riit): the
  // registry cannot join it to anything, so its code checks nothing. A node
  // naming an unlisted family already throws at load, with its path.
  const orphans = defaultGraphTypologies.validatorNodeList().filter((v) => !defaultGraphTypologies.has(v.node.validates.kind));
  if (orphans.length > 0) {
    console.log(`\n✗ ${orphans.length} validator node(s) name a graph typology no instance declares:`);
    for (const o of orphans) console.log(`  ✗ ${o.file}: validates kind "${o.node.validates.kind}"`);
    return 1;
  }

  // BLOCK KINDS (bean riit, step 2): discovered from `folio-block-kind/v1`
  // nodes, while the per-kind Zod schemas are code. A discovered kind the code
  // does not type has no schema to validate its blocks; a typed kind nobody
  // declares is invisible to every list read off the nodes.
  const discovered = new Set<string>(BLOCK_KINDS);
  if (REPO_ROOT === undefined && discovered.size === 0) {
    // Standalone: the harness alone owns no vocabulary, so there is nothing to
    // hold the typed kinds against — said, never read as a pass.
    console.log("\n· block kinds not examined: standalone, no checkout holds the instances that declare them");
  } else {
    // BlockSchema's kinds and every typed vocabulary module's: a layer above
    // cat-harness types its own kinds, so a composition without it neither
    // discovers nor types them.
    let typedKinds: string[];
    try {
      typedKinds = allTypedBlockKinds();
    } catch (e) {
      // A module that breaks the contract would leave its kinds untyped and
      // every block of them failing validation: a finding, not a crash.
      console.log(`\n✗ a typed vocabulary module could not be loaded: ${(e as Error).message}`);
      return 1;
    }
    const typed = new Set(typedKinds);
    const untyped = [...discovered].filter((k) => !typed.has(k));
    const undiscovered = [...typed].filter((k) => !discovered.has(k));
    console.log(`\n${discovered.size} block kind(s) discovered from block-kinds/ nodes`);
    if (untyped.length || undiscovered.length) {
      for (const k of untyped) console.log(`  ✗ block kind "${k}" is declared by a node but neither BlockSchema nor a vocabulary module types it`);
      for (const k of undiscovered) console.log(`  ✗ block kind "${k}" is typed by BlockSchema but no block-kinds/ node declares it`);
      return 1;
    }
  }

  // CONTENT ADAPTERS (bean riit, step 5): every block kind's `adapter` names
  // a vocabulary some `folio-content-adapter/v1` node declares, and an untyped
  // vocabulary's `vocabulary` module exists in the layer that declares it.
  // A kind naming no vocabulary would split into neither the typed list nor
  // a contribution, and be read by nothing.
  {
    const vocabularies = new Set(CONTENT_ADAPTER_NODES.map((n) => n.adapter));
    const orphanKinds = DISCOVERED_BLOCK_KIND_NODES.filter((k) => !vocabularies.has(k.adapter));
    const missingModules: string[] = [];
    for (const { file, raw } of declaredNodeFiles(REPO_ROOT ?? resolve(HARNESS_ROOT, ".."), "content-adapters")) {
      const n = raw as { adapter?: string; vocabulary?: string };
      if (n.vocabulary === undefined) continue;
      const inst = findInstanceRoot(dirname(file));
      if (inst === undefined || !existsSync(join(inst, n.vocabulary))) missingModules.push(`${n.adapter}: ${n.vocabulary} (declared by ${file})`);
    }
    console.log(`\n${vocabularies.size} content-adapter vocabular(ies) discovered from content-adapters/ nodes`);
    for (const v of loadedVocabularies()) console.log(`  · ${v.adapter}: ${v.schemas.size} kind(s) typed by its vocabulary module (${relative(REPO_ROOT ?? resolve(HARNESS_ROOT, ".."), v.module)})`);
    if (orphanKinds.length || missingModules.length) {
      for (const k of orphanKinds) console.log(`  ✗ block kind "${k.kind}" names adapter "${k.adapter}", which no content-adapters/ node declares`);
      for (const m of missingModules) console.log(`  ✗ vocabulary module not found — ${m}`);
      return 1;
    }
  }

  // CONTRIBUTION NODES (bean riit, step 3b): every QA checker and pipeline
  // plugin a harness declares as a node must resolve to the table entry its
  // ref names. The platform root's dependency tree holds every layer, so
  // loading its contributions loads every node; a node naming code that is
  // not there throws, with the node's path.
  if (REPO_ROOT === undefined) {
    // Standalone: no checkout holds the contributing layers, so nothing is
    // examined — said, never read as a pass.
    console.log("\n· contribution nodes not examined: standalone, no checkout holds the instances that declare them");
  } else {
    try {
      const registry = loadContributionsSync(REPO_ROOT, new ContributionRegistry());
      console.log(
        `\n${registry.contributedPipelinePlugins().length} pipeline plugin(s) and ` +
          `${registry.contributedQaCheckers().length} contributed QA checker(s) resolve to code`,
      );
    } catch (e) {
      console.log(`\n✗ a contribution node does not resolve: ${(e as Error).message}`);
      return 1;
    }
  }

  if (r.unresolvable.length > 0) {
    console.log(`\n✗ ${r.unresolvable.length} declare a validator that does not resolve:`);
    for (const u of r.unresolvable) console.log(`  ✗ ${u.kind}: ${u.reason}`);
    return 1;
  }

  const msg =
    `${r.undeclared.length} kind(s) have said NOTHING about a validator — a node of those kinds ` +
    `cannot be checked, and must be reported as "could not determine" rather than as valid. ` +
    `Give it a validator, or say in \`validatorNotApplicable\` why one cannot apply: ${r.undeclared.join(", ")}`;
  if (r.undeclared.length > 0) {
    if (requireAll) {
      console.log(`\n✗ ${msg}`);
      return 1;
    }
    console.log(`\n⚠ ${msg}`);
  }
  if (familyFail) {
    console.log(`\n✗ a declared $schema family is unmapped, unresolvable, or has a node that fails it`);
    return 1;
  }
  console.log(
    `\n✓ every declared validator resolves to a runnable Zod schema, and every kind without one says why`,
  );
  return 0;
}

/**
 * Runs {@link main} and repeats every `✗` line at the end of the output.
 *
 * The CI summary keeps only the last 1,500 characters, and the family lines
 * print first, so a failing family was cut from the summary
 * (cat-harness-tools#1204; #1198 did the same for the sidecar judges).
 */
export async function runWithFailureRecap(run: () => Promise<number>, log: (line: string) => void = console.log): Promise<number> {
  const failed: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    for (const l of line.split("\n")) if (/^\s*✗/.test(l)) failed.push(l.trim());
    log(line);
  };
  let code: number;
  try {
    code = await run();
  } finally {
    console.log = original;
  }
  if (code !== 0 && failed.length > 1) {
    log(`\nFailures (${failed.length}), repeated so the CI summary keeps them:`);
    for (const l of failed) log(`  ${l}`);
  }
  return code;
}

if (import.meta.main) process.exit(await runWithFailureRecap(main));
