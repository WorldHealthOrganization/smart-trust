#!/usr/bin/env bun
/**
 * Read every declared `voices` directory — the voices, their rules, and the
 * citation each rule carries.
 *
 * @module scripts/voices-graph
 * @graphNode none — a reader over the voices graph, not a schema itself
 *
 * A voice is **auditable rather than asserted**: every rule carries the page
 * and the quote it was read from (`check-voices.ts`). This reader makes those
 * citations readable without opening JSON.
 *
 * ## A declared directory with no voices is reported
 *
 * A `voices` directory that is declared but absent is reported as a declared
 * directory with no voices rather than omitted: that is a gap somebody should
 * close, unlike a layer that never claimed any.
 *
 * ## A voice that will not load THROWS
 *
 * `loadVoices` throws on a malformed voice and this reader does not catch it.
 * A malformed voice must not present as a layer with fewer voices: the
 * second is a legitimate state and the first is a defect. Same rule as
 * `shippedVoices` in `pipeline/voice-criteria.ts`, which is the other
 * cross-instance reader over this graph.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import {
  directoriesForGraph,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
  siblingScopeFor,
} from "../schemas/kg/cat-harness.ts";
import {
  loadVoices,
  voiceProvenanceFlags,
  type VoiceProfile,
  type VoiceProvenanceFlag,
  type VoiceRule,
  VOICES_DECLARATION_FILE,
  voiceFilesIn,
} from "../schemas/content/voices.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** How a rule's citation resolves — the reader's verdict, never the file's claim. */
export type CitationKind = "library" | "kg-node" | "none";

/** One rule, flattened for display. */
export interface VoiceRuleView {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  /** Whether the rule has a mechanical half a checker can run. */
  patterns: number;
  terminology: number;
  judgementOnly: boolean;
  /**
   * Which KIND of thing the rule cites.
   *
   * `none` is unreachable through the schema — `VoiceRuleSourceSchema`
   * requires exactly one of (`libraryId` + `sectionId`) or `path` — and is
   * carried anyway, because a reader that cannot represent the state it is
   * checking for cannot report it. If `none` ever appears on this page, the
   * schema stopped being enforced somewhere and the page says so instead of
   * rendering a blank cell.
   */
  citation: CitationKind;
  /** The cited document or node, as written. */
  cites?: string;
  /** The layer holding the cited corpus, when the rule names one. */
  citesInstance?: string;
  /** Page range in the SOURCE document, as a reader holding the paper would cite it. */
  pages?: string;
  /** The passage the rule was read from. The thing this whole page exists to show. */
  quote: string;
  /** Flagged as counterintuitive by the voice-skill schema, with its explanation. */
  counterintuitive?: boolean;
  commonError?: string;
}

/** One voice. */
export interface VoiceView {
  id: string;
  title: string;
  description: string;
  /** The declared name of the layer that DERIVED it. */
  instance: string;
  /** Repo-relative directory or file the voice was read from. */
  path: string;
  provenance: string;
  /**
   * The severity of the derived overlay criterion.
   *
   * Declared rather than computed from the rules, and the criterion id below
   * is what a QA sidecar carries. See `pipeline/voice-criteria.ts` for
   * why the obvious derivation was rejected.
   */
  overlaySeverity: string;
  /** The QA criterion derived from this voice. */
  criterion: string;
  /** Source publications the voice was derived from. */
  sources: { title: string; year?: number }[];
  /** Whether a `SKILL.md` sits beside the rules — the skill half of a voice skill. */
  hasInstructions: boolean;
  /**
   * Where the declared `provenance` sits oddly against what the rules cite.
   *
   * A QUESTION FOR A PERSON, not a defect — the owner's 2026-09-21 ruling, and
   * `voiceProvenanceFlags` carries why. Empty is the common case, and it is
   * empty for four of the five voices here.
   */
  provenanceFlags: VoiceProvenanceFlag[];
  rules: VoiceRuleView[];
}

/** One layer's declared voices directory. */
export interface VoicesDirectory {
  instance: string;
  /** Repo-relative. */
  dir: string;
  /**
   * Whether the declared directory is actually there.
   *
   * The `dh4f` state, reported rather than smoothed over: a declared-but-absent
   * directory makes every consumer scan nothing and call it a clean run.
   */
  present: boolean;
  voices: string[];
}

/** The whole reading. */
export interface VoicesGraph {
  directories: VoicesDirectory[];
  voices: VoiceView[];
  /** Totals a badge row can show without recomputing them in the page. */
  totals: {
    voices: number;
    rules: number;
    /** Rules citing an ingested library document. */
    citingLibrary: number;
    /** Rules citing a node of their own layer's knowledge graph. */
    citingKgNode: number;
    /** Rules with a mechanical half — at least one pattern or terminology pair. */
    mechanical: number;
  };
}

/** How a rule's citation resolves. */
function citationKindOf(src: VoiceRule["source"]): CitationKind {
  if (src.libraryId !== undefined && src.sectionId !== undefined) return "library";
  if (src.path !== undefined) return "kg-node";
  return "none";
}

function ruleView(r: VoiceRule): VoiceRuleView {
  const kind = citationKindOf(r.source);
  const extra = r as unknown as { counterintuitive?: boolean; commonError?: string };
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    severity: r.severity,
    patterns: r.patterns?.length ?? 0,
    terminology: r.terminology?.length ?? 0,
    judgementOnly: r.judgementOnly === true,
    citation: kind,
    cites:
      kind === "library"
        ? `${r.source.libraryId}#${r.source.sectionId}`
        : kind === "kg-node"
          ? r.source.path
          : undefined,
    citesInstance: r.source.instance,
    pages: r.source.pages,
    quote: r.source.quote,
    counterintuitive: extra.counterintuitive,
    commonError: extra.commonError,
  };
}

/**
 * Where a voice was read from, repo-relative.
 *
 * Both layouts `voiceFilesIn` accepts are probed, in the order it prefers, so
 * this cannot disagree with the loader about which file it read. Returning the
 * directory for a voice skill and the file for a bare profile is the honest
 * answer to "where do I look": the skill is a directory of two files.
 */
function voicePath(dir: string, id: string, repoRoot: string): string {
  return relative(repoRoot, voiceLocation(dir, id)).split("\\").join("/");
}

/**
 * Where a voice actually is: a skill directory or a bare profile, wherever the
 * loader found it. Asked of `voiceFilesIn` itself rather than re-probed, so the
 * two cannot disagree. They did once: the loader read `vendors/` and this did
 * not, and the first vendor voice was reported at a path that does not exist.
 * Since bean `rkqp` the sub-graphs are DECLARED (`voices.json`,
 * `vendors/vendors.json`), and only the walker knows them.
 */
function voiceLocation(dir: string, id: string): string {
  const hit = existsSync(dir) ? voiceFilesIn(dir).find((v) => v.id === id) : undefined;
  if (hit === undefined) return join(dir, `${id}.json`);
  return basename(hit.path) === "voice.json" ? dirname(hit.path) : hit.path;
}

/** Does a `SKILL.md` sit beside the rules? */
function hasInstructions(dir: string, id: string): boolean {
  return existsSync(join(voiceLocation(dir, id), "SKILL.md"));
}

/** Voice ids found in a directory, by either layout. Sorted; `[]` when absent. */
function voiceIdsIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (existsSync(join(p, "voice.json"))) out.push(name);
    } else if (name.endsWith(".json") && name !== VOICES_DECLARATION_FILE) {
      out.push(name.slice(0, -".json".length));
    }
  }
  return out;
}

/**
 * Read every declared `voices` directory reachable from these roots.
 *
 * Each entry of `roots` is a LAYER root. Pass `repoRootIn` when you are
 * starting from the repository root instead — see the note inside.
 *
 * Returns `null` when no root declares one — not an empty graph. A layer
 * with no voices simply has none, and a consumer rendering the two alike
 * reports a clean run over something it never opened. The same three-state
 * discipline `readLibraryGraph` follows.
 */
export function readVoicesGraph(roots: string[], repoRootIn?: string): VoicesGraph | null {
  // `repoRootFor` is `dirname` and is documented as taking a LAYER root, so
  // deriving it from `roots[0]` is right only when that root IS one. A caller
  // passing the repository root gets its PARENT, finds no layer beneath it,
  // and this reader returns `null` — "no voices are declared" for a repository
  // that declares three. Measured while writing `check-voice-skills.ts`, which
  // did exactly that: `repoRootFor("/…/folio-assistant")` is `/home/user`.
  //
  // So a caller that already knows the repository root SAYS SO, rather than
  // this function guessing between two readings of the same argument. That is
  // the rule `resolveCoveragePath` states one level up: resolving against
  // whichever root happens to work is worse than picking wrong, because the
  // wrong pick is visible and the lucky one is not.
  // `siblingScopeFor`: given the ROOT layer, `dirname` lists no layer (g43f).
  const repoRoot = repoRootIn ?? siblingScopeFor(roots[0] ?? ".");
  // Every layer in the repository, not only the roots passed in: a voice is
  // owned by whoever DERIVED it, and the platform derives none — so a reader
  // that asked only its own root would find nothing and report it as an
  // absence rather than as somebody else's.
  const dirs = new Map<string, string>();
  for (const root of [...roots, ...layerRootsIn(repoRoot)]) {
    for (const d of directoriesForGraph(root, "voices")) {
      if (!dirs.has(d)) dirs.set(d, root);
    }
  }
  if (dirs.size === 0) return null;

  const directories: VoicesDirectory[] = [];
  const voices: VoiceView[] = [];

  for (const [dir, root] of [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const instance = readDeclaration(root)?.name ?? basename(root);
    const ids = voiceIdsIn(dir);
    directories.push({
      instance,
      dir: relative(repoRoot, dir).split("\\").join("/"),
      present: existsSync(dir),
      voices: ids,
    });
    // `loadVoices` reads the layer's DECLARED directory, which is the one
    // resolved above — asking it by root rather than by path keeps one answer
    // to "where do this instance's voices live".
    for (const v of loadVoices(root)) {
      const ext = v as VoiceProfile & { overlaySeverity?: string };
      voices.push({
        id: v.id,
        title: v.title,
        description: v.description,
        instance,
        path: voicePath(dir, v.id, repoRoot),
        provenance: v.provenance,
        // Kept in step with `overlaySeverityOf` by the test rather than by
        // hope: `voices-viz.test.ts` asserts the two agree on every voice
        // this repository ships, because a page showing one severity while
        // the sidecars carry another is worse than a page showing none.
        overlaySeverity: ext.overlaySeverity ?? "major",
        criterion: `voice-overlay-${v.id}`,
        sources: (v.sources ?? []).map((s) => ({ title: s.title, year: s.year })),
        hasInstructions: hasInstructions(dir, v.id),
        provenanceFlags: voiceProvenanceFlags(v.provenance, v.rules),
        rules: v.rules.map(ruleView),
      });
    }
  }

  voices.sort((a, b) => a.id.localeCompare(b.id));
  const rules = voices.flatMap((v) => v.rules);
  return {
    directories,
    voices,
    totals: {
      voices: voices.length,
      rules: rules.length,
      citingLibrary: rules.filter((r) => r.citation === "library").length,
      citingKgNode: rules.filter((r) => r.citation === "kg-node").length,
      mechanical: rules.filter((r) => r.patterns > 0 || r.terminology > 0).length,
    },
  };
}

if (import.meta.main) {
  const root = join(HARNESS_ROOT);
  const g = readVoicesGraph([root, repoRootFor(root)]);
  if (g === null) {
    console.log("no voices directory is declared — nothing to read");
    process.exit(0);
  }
  for (const d of g.directories) {
    console.log(
      `  · ${d.instance.padEnd(22)} ${d.dir.padEnd(34)} ` +
        (d.present ? `${d.voices.length} voice(s)` : "DECLARED BUT ABSENT"),
    );
  }
  for (const v of g.voices) {
    const cited = v.rules.filter((r) => r.citation !== "none").length;
    console.log(
      `  · ${v.id.padEnd(26)} ${v.rules.length} rule(s), ${cited} cited, ` +
        `overlay ${v.overlaySeverity}, ${v.instance}` +
        (v.hasInstructions ? "" : "  [no SKILL.md]"),
    );
  }
  const t = g.totals;
  console.log(
    `\n${t.voices} voice(s), ${t.rules} rule(s) — ` +
      `${t.citingLibrary} citing library, ${t.citingKgNode} citing a KG node, ` +
      `${t.mechanical} with a mechanical half`,
  );
}
