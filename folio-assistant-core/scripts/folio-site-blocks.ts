/**
 * What the folio site says about each block beyond its text: its QA verdicts
 * and its Lean formalisation. Owner, 2026-10-10: per block, an `[edit]
 * [feedback]` row (already there, `edit-links.js`), a `[QA]` badge that opens
 * the block's QA report, a Lean link that is GREYED when the kind expects Lean
 * and none resolves, and the Lean compile status.
 *
 * Ported from the qou-side prototype (`qou/scripts/folio-site/qou-site-extras.py`,
 * branch `claude/stoic-franklin-5nsz1v`), with every qou constant replaced by
 * the platform's own resolver:
 *
 * | fact | read with | never |
 * |---|---|---|
 * | where a block's verdict lives | `readWitnessDoc("block", …)` → `existingBlockQaPath` (results tree, then the legacy sibling) | a composed `<root>.qa.json` |
 * | whether a verdict still holds | the witness's `freshness`, from `freshnessOf` against the files on disk | the sidecar's own `source_hashes` |
 * | a `lean.ref`'s file | `resolveCanonicalFormal` (core's injection point; the Lean layer is installed by the CLI) | a hand regex over Lean source |
 * | whether it compiles | a MEASURED status file (`--lean-status`, `qou-lean-status/v1`) | a `sorry` grep, or the sidecar's `proof-lean-compiles` |
 *
 * ## The verdict is the MOST RECENT entry, not the first
 *
 * `readWitnessDoc` reports each criterion's verdict from its FIRST entry. On
 * qou that is the superseded one: measured 2026-10-10 over 2000 sidecars, of
 * 20,896 criteria with more than one entry, 20,658 have their newest entry
 * LAST and 237 FIRST — writers disagree on whether a new review is prepended
 * or appended. So the verdict shown here is the entry with the latest
 * `reviewed_at`; the platform reader still supplies where the file is and how
 * fresh each witness is, and the two are joined by entry position, which
 * `readWitnessDoc` preserves (`witnesses` is `entries.map(...)`).
 *
 * ## Lean compile status is measured or it is "unchecked"
 *
 * A file with no `sorry` may not compile, and a file with one may; reading the
 * text cannot say which. Without `--lean-status` every Lean link says
 * `unchecked`, which is true.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { readWitnessDoc, type QaWitness } from "@litlfred/cat-harness-tools/pipeline/qa-witness.js";
import { entryDate } from "@litlfred/cat-harness-tools/pipeline/qa-utils.js";
import { readTreeCommitIndex } from "@litlfred/cat-harness-tools/scripts/qa-site-assets.js";
import { formalRefResolverConfigured, resolveCanonicalFormal, type FormalTreeCache } from "@litlfred/cat-harness-tools/schemas/formal-ref.js";
import { configureLeanPackages, leanPackagesConfigured, type LeanPackage } from "@litlfred/cat-harness-tools/schemas/lean-packages.js";
import { optionalPipelinePlugin } from "@litlfred/cat-harness-tools/pipeline/pipeline-plugins.js";

// ── QA ──────────────────────────────────────────────────────────

/** A criterion's verdict, normalised the way `qa-witness.ts` does; anything else is `unknown`. */
export type SiteQaResult = "pass" | "fail" | "warn" | "n/a" | "unknown";

/** One criterion as the report panel shows it: its most recent verdict and who gave it. */
export interface SiteQaCriterion {
  id: string;
  /** Display group: `Milnor` first, then the id's own prefix (`voice`, `da`, `proof`…). */
  group: string;
  result: SiteQaResult;
  severity?: string;
  /** The verdict's recorded field hash no longer matches the block's files on disk. */
  stale: boolean;
  /** `fresh` | `partial` | `stale` | `unknown`, from the platform's freshness check. */
  freshness: string;
  /** What changed, or why the comparison could not be made. */
  changed?: string[];
  at?: string;
  reviewer: string;
  by?: string;
  model?: string;
  notes?: string;
  /** How many reviews the criterion has had; the shown one is the latest. */
  history: number;
}

/** The full report, written beside the site and fetched only when a reader opens it. */
export interface BlockQaView {
  $schema: "folio-site-qa-report/v1";
  subject: string;
  /** Repo-relative path(s) of the sidecar the report was read from. */
  sidecars: string[];
  counts: SiteQaCounts;
  criteria: SiteQaCriterion[];
}

export interface SiteQaCounts {
  pass: number;
  fail: number;
  warn: number;
  na: number;
  unknown: number;
  stale: number;
}

/** The badge's data, carried in the block payload itself: no extra request per block. */
export interface SiteQaSummary {
  counts: SiteQaCounts;
  /** Milnor-exposition criteria and how many of them do not pass; absent when the block has none. */
  milnor?: { total: number; notPassing: number };
}

const MILNOR = /^(expo-milnor|milnor-)/;

/** The display group of a criterion id. Milnor exposition is one group and comes first. */
export function criterionGroup(id: string): string {
  if (MILNOR.test(id)) return "Milnor";
  const i = id.indexOf("-");
  return i > 0 ? id.slice(0, i) : id;
}

function normalise(r: unknown): SiteQaResult {
  return r === "pass" || r === "fail" || r === "warn" || r === "n/a" ? r : "unknown";
}

interface RawEntry {
  result?: string;
  severity?: string;
  reviewed_at?: string;
  reviewed_tree?: string;
  notes?: string;
}

/**
 * Tree id → commit date, from `repoRoot`'s first-parent history: the date a
 * verdict on that tree is shown and ordered by (owner rulings 2026-11-06,
 * cards "QA dates" and "Date source", option 1: derive the date ON READ from
 * the reviewed tree; writers stamp no clock). Read once per root, through the
 * same reader the deploy's `tree-commits` step uses. A checkout without git
 * history dates nothing, and a verdict then falls back to its own legacy date.
 */
const treeDatesByRoot = new Map<string, Readonly<Record<string, string>>>();
function treeDatesFor(repoRoot: string): Readonly<Record<string, string>> {
  const cached = treeDatesByRoot.get(repoRoot);
  if (cached) return cached;
  let d: Readonly<Record<string, string>>;
  try {
    d = readTreeCommitIndex(repoRoot).dates ?? {};
  } catch {
    d = {};
  }
  treeDatesByRoot.set(repoRoot, d);
  return d;
}

/**
 * Index of the most recent entry by its date (`entryDate`: the reviewed tree's
 * commit date from `treeDates`, else a legacy `reviewed_at`). On a tie or a
 * missing date, the EARLIER position: order is the verdict (`list[0]` is a
 * criterion's effective result in the platform's `qa-witness.ts`, and a new
 * adjudication is inserted at the front). Verdicts on one tree share its date,
 * so the tie is the common case once writers stamp no clock.
 */
export function latestEntryIndex(
  entries: readonly { reviewed_at?: string; reviewed_tree?: string }[],
  treeDates?: Readonly<Record<string, string>>,
): number {
  let best = -1;
  let bestAt = "";
  entries.forEach((e, i) => {
    const at = entryDate(e, treeDates) ?? "";
    if (best < 0 || at > bestAt) {
      best = i;
      bestAt = at;
    }
  });
  return best;
}

function sortCriteria(rows: SiteQaCriterion[]): SiteQaCriterion[] {
  const groupRank = (g: string) => (g === "Milnor" ? 0 : 1);
  return rows.sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id));
}

/**
 * A block's QA report, or `undefined` when it has no verdict anywhere the
 * platform looks. `subjectPath` is the block's `.md` (or `.ts`), absolute.
 */
export function blockQaReport(subjectPath: string, repoRoot: string): BlockQaView | undefined {
  const doc = readWitnessDoc("block", subjectPath, repoRoot);
  if (!doc || doc.sidecars.length === 0) return undefined;
  let raw: { criteria?: Record<string, RawEntry[]> };
  try {
    raw = JSON.parse(readFileSync(join(repoRoot, doc.sidecars[0]!), "utf-8"));
  } catch {
    return undefined;
  }
  const rows: SiteQaCriterion[] = [];
  for (const view of doc.criteria) {
    const entries = Array.isArray(raw.criteria?.[view.id]) ? raw.criteria![view.id]! : [];
    if (entries.length === 0) continue;
    const dates = treeDatesFor(repoRoot);
    const i = latestEntryIndex(entries, dates);
    const e = entries[i]!;
    const at = entryDate(e, dates);
    const w: QaWitness | undefined = view.witnesses[i];
    rows.push({
      id: view.id,
      group: criterionGroup(view.id),
      result: normalise(e.result),
      ...(e.severity ? { severity: e.severity } : {}),
      stale: w?.freshness === "stale",
      freshness: w?.freshness ?? "unknown",
      ...(w?.changed?.length ? { changed: w.changed } : {}),
      ...(at ? { at: at.slice(0, 10) } : {}),
      reviewer: w?.kind ?? "script",
      ...(w?.skill || w?.id ? { by: w.skill ?? w.id } : {}),
      ...(w?.model ? { model: w.model } : {}),
      ...(e.notes ? { notes: e.notes.slice(0, 4000) } : {}),
      history: entries.length,
    });
  }
  const counts: SiteQaCounts = { pass: 0, fail: 0, warn: 0, na: 0, unknown: 0, stale: 0 };
  for (const r of rows) {
    if (r.result === "n/a") counts.na++;
    else counts[r.result]++;
    if (r.stale) counts.stale++;
  }
  return { $schema: "folio-site-qa-report/v1", subject: doc.subject, sidecars: doc.sidecars, counts, criteria: sortCriteria(rows) };
}

/** The badge's summary of a report. */
export function qaSummary(r: BlockQaView): SiteQaSummary {
  const milnor = r.criteria.filter((c) => c.group === "Milnor");
  return {
    counts: r.counts,
    ...(milnor.length ? { milnor: { total: milnor.length, notPassing: milnor.filter((c) => c.result !== "pass").length } } : {}),
  };
}

// ── Lean ────────────────────────────────────────────────────────

/**
 * The kinds that are expected to carry Lean. The block-kinds graph declares
 * `provable` but nothing about a formalisation (and `provable` includes
 * `conjecture`, whose Lean is optional), so this is the fallback the brief
 * names: `definition` (where `lean` is required by type) and the four
 * theorem-like kinds. A block with a `lean.ref` expects Lean whatever its kind.
 */
export const LEAN_EXPECTED_KINDS: ReadonlySet<string> = new Set(["definition", "theorem", "lemma", "proposition", "corollary"]);

/** `qou-lean-status/v1`: per-file compile status from a measured sweep. */
export interface LeanStatusFile {
  schema?: string;
  measured_at?: string;
  method?: string;
  toolchain?: string;
  /** Repo-relative `.lean` path → status. */
  files?: Record<string, LeanStatusEntry>;
  /** Library module → status, with its source path in `src`. */
  library?: Record<string, LeanStatusEntry & { src?: string }>;
}
export interface LeanStatusEntry {
  status?: string;
  error?: string;
  sorry?: boolean;
}
export type LeanCompile = "pass" | "fail" | "unverifiable" | "unchecked";

/** A status file indexed by repo-relative source path. */
export interface LeanStatusIndex {
  byPath: Map<string, LeanStatusEntry>;
  meta?: { measuredAt?: string; method?: string; toolchain?: string };
}

export function loadLeanStatus(path: string | undefined): LeanStatusIndex {
  const byPath = new Map<string, LeanStatusEntry>();
  if (!path) return { byPath };
  const s = JSON.parse(readFileSync(path, "utf-8")) as LeanStatusFile;
  for (const v of Object.values(s.library ?? {})) if (v.src) byPath.set(v.src, v);
  for (const [k, v] of Object.entries(s.files ?? {})) byPath.set(k, v);
  return { byPath, meta: { measuredAt: s.measured_at, method: s.method, toolchain: s.toolchain } };
}

/** What a block's payload says about its Lean. */
export interface SiteLean {
  /** The kind (or a `lean.ref`) says this block should be formalised. */
  expected: boolean;
  /** Repo-relative path of the formalisation, when one resolves. */
  path?: string;
  via?: "sibling" | "ref";
  ref?: string;
  /** Why a declared ref did not resolve: `unresolved`, or `no-resolver` when no formalism layer was installed. */
  refState?: "unresolved" | "no-resolver";
  /** `sorry` present: the measured compiler warning when the status file says, else a text reading. */
  sorry?: boolean;
  sorryBasis?: "measured" | "text";
  compiles?: LeanCompile;
  error?: string;
}

/** `sorry` when a `sorry` term remains outside comments. A TEXT reading, labelled as one. */
export function textHasSorry(src: string): boolean {
  const code = src.replace(/\/-[\s\S]*?-\//g, "").replace(/--.*$/gm, "");
  return /\bsorry\b/.test(code);
}

export function blockLean(
  opts: { kind: string; ref?: string; sibling?: string; repoRoot: string; status: LeanStatusIndex; cache?: FormalTreeCache },
): SiteLean {
  const out: SiteLean = { expected: LEAN_EXPECTED_KINDS.has(opts.kind) || !!opts.ref };
  if (opts.ref) out.ref = opts.ref;
  let abs: string | undefined;
  if (opts.sibling && existsSync(opts.sibling)) {
    abs = opts.sibling;
    out.via = "sibling";
  } else if (opts.ref) {
    if (!leanPackagesConfigured()) out.refState = "no-resolver";
    else {
      if (!formalRefResolverConfigured()) {
        try {
          optionalPipelinePlugin("lean-lexer");
        } catch {
          /* no contribution root available */
        }
      }
      abs = resolveCanonicalFormal(opts.ref, opts.repoRoot, opts.cache);
      if (abs && existsSync(abs)) out.via = "ref";
      else {
        abs = undefined;
        out.refState = "unresolved";
      }
    }
  }
  if (!abs) return out;
  out.path = relative(opts.repoRoot, abs);
  const st = opts.status.byPath.get(out.path);
  const c = st?.status;
  out.compiles = c === "pass" || c === "fail" || c === "unverifiable" ? c : "unchecked";
  if (st?.error) out.error = st.error.slice(0, 500);
  if (typeof st?.sorry === "boolean") {
    out.sorry = st.sorry;
    out.sorryBasis = "measured";
  } else {
    out.sorry = textHasSorry(readFileSync(abs, "utf-8"));
    out.sorryBasis = "text";
  }
  return out;
}

/**
 * Declare the folio's Lake packages to the Lean resolver. Importing
 * `lean-formal-ref` installs the resolver into core's injection point; this
 * gives it the packages, without which every `lean.ref` would read as
 * unresolved rather than as unchecked. The list is the FOLIO's: from
 * `--lean-packages <module>` or, by default, `<repo>/schemas/lean-packages.ts`
 * when the folio declares one there (its exported `LEAN_PACKAGES`).
 */
export async function configureFolioLeanPackages(repoRoot: string, module?: string): Promise<{ from?: string; count: number }> {
  // declared-path-literal: the FOLIO's own registry module, where qou's AGENTS.md
  // tells an author to register a new Lake package; no declaration names it, and
  // `--lean-packages` overrides it.
  const path = module ? resolveFrom(repoRoot, module) : join(repoRoot, "schemas", "lean-packages.ts");
  if (!existsSync(path)) return { count: 0 };
  const m = (await import(path)) as { LEAN_PACKAGES?: readonly LeanPackage[]; default?: readonly LeanPackage[] };
  const pkgs = m.LEAN_PACKAGES ?? m.default;
  if (!Array.isArray(pkgs)) return { from: relative(repoRoot, path), count: 0 };
  configureLeanPackages(pkgs);
  return { from: relative(repoRoot, path), count: pkgs.length };
}

const resolveFrom = (root: string, p: string) => (p.startsWith("/") ? p : join(root, p));
