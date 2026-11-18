/**
 * The SHAPES of the record families the harness's `qa` and `lsi` graphs hold —
 * `qa-witness/v1`, `qa-results/v1`, `translation-qa/v1`, `folio-lsi-index/v1`.
 *
 * Definitions, so they live here; the code that writes and reads these records
 * is in the tools layer above this one and re-exports them. The graph-typology
 * registry's `nodeSchemas` names these by `module#Export`, and a reference from
 * the harness can only resolve inside the harness.
 *
 * @module cat-harness/schemas/qa-record-shapes
 * @graphNode schema
 */
import type { QaCriterionEntry, QaFieldHash } from "../sdlc/block-qa.ts";

// ── from the tools layer's pipeline/qa-witness.ts ──

/**
 * Whether a witness's verdict still applies to the files on disk.
 *
 * `partial` exists because some criteria hash something that is not a file.
 * `graph` is the chapter's `uses[]` edge set and `lean_statement` is the
 * declaration signatures lexed out of a `.lean`; both are DERIVED, and
 * recomputing them here would mean re-running a slice of the sweep on every
 * docs build. Reporting them as "reviewed, now missing on disk" made 1012 of
 * 5424 witnesses read `unknown` in the first corpus-wide run — a fifth of the
 * panel alarming about files that never existed.
 *
 * So `partial` says exactly what happened: every FILE the entry recorded still
 * matches, and a named derived input was not re-checked. It is not folded into
 * `fresh`, because `fresh` means fully verified and nothing should quietly
 * widen it.
 */
export type QaFreshness = "fresh" | "partial" | "stale" | "unknown";

/** One reviewer's provenance for one criterion, flattened for publication. */
export interface QaWitness {
  /** `script` — a deterministic checker. `agent` — an LLM. `human` — a person. */
  kind: "script" | "agent" | "human";
  /** Script path, model + skill, or GitHub login. */
  id: string;
  version?: string;
  /** When the review ran (ISO-8601), or absent when the sidecar records none. */
  at?: string;
  /** Repo HEAD at review time — read from older sidecars, no longer written. */
  sha?: string;
  /**
   * Tree of repo HEAD at review time — what verdicts record since bean 69lr
   * (owner card Q4, 2026-11-05): a PR run's HEAD commit can vanish, its tree
   * cannot.
   */
  tree?: string;
  /** Hash of the checker's own source, and the commit it was last changed in. */
  scriptHash?: string;
  scriptCommitSha?: string;
  /** Hash of every extra input the checker consulted beyond the subject. */
  depsHash?: string;
  /** Agent provenance. */
  model?: string;
  session?: string;
  skill?: string;
  /** How the verdict was measured, where the checker records it. */
  method?: string;
  /** Whether the verdict still holds for the files on disk. */
  freshness: QaFreshness;
  /**
   * On `stale`, the subject files whose hash moved. On `unknown`, why the
   * comparison could not be made, one phrase per unresolved input.
   */
  changed?: string[];
  /** On `partial`, the derived inputs that were not re-computed. */
  notCompared?: string[];
  notes?: string;
}

// ── from the tools layer's scripts/qa-results.ts ──

/**
 * One finding family within a result.
 *
 * `count` is carried beside `entries` rather than derived on read, because a
 * consumer that only wants "is this clean" should not have to parse entries
 * whose shape differs per family.
 */
export interface QaResultFamily {
  /** What this family means, for a reader who has only the file. */
  summary: string;
  /** How many findings — `0` is a determined empty, not an absent answer. */
  count: number;
  /** The findings themselves, in whatever shape the producer records. */
  entries: unknown[];
}

/** A whole-artefact QA result. */
export interface QaResult {
  $schema: "qa-results/v1";
  /** What produced this, so a finding can be traced to the code that made it. */
  producer: {
    /** Repo-relative path to the script. */
    script: string;
    /** 12-char SHA-256 prefix of that script's source, as `script-qa` writes. */
    script_hash: string;
  };
  /** The artefact the findings are ABOUT — not an authored subject. */
  subject: { kind: string; id: string };
  // No `updated_at`, on purpose (bean `y7b3`, #1707). A committed file that
  // records WHEN it was produced conflicts on every pair of concurrent changes:
  // both branches change findings, each writes a new stamp, and that one line
  // collides while the body merges cleanly. Measured over 300 merges:
  // `skill-register.qa-results.json` conflicted in 89, and 80 of its 86
  // conflicting lines were this field. `git log` already records when a file
  // changed, and no reader consumed it — every comparison held it out.
  /** Finding families, keyed by name. */
  families: Record<string, QaResultFamily>;
  /** Total findings across every family, so "clean" is one read. */
  total: number;
}

// ── from the tools layer's pipeline/translation-block-qa.ts ──

/**
 * A translation verdict's inputs: the block's own companions, plus the `.po`.
 *
 * Widened HERE rather than by adding `po` to `COMPANION_ROLES`, deliberately.
 * That list gates criterion APPLICABILITY across every adapter — a role added
 * to it is a role `hashBlockFiles` walks and `depends_on` can name for every
 * block in every folio. The PO is a companion of a (block, LOCALE) pair, not of
 * the block, so the roles list is the wrong place for it and widening it there
 * would be a schema change reaching well past this sweep.
 */
export type TranslationFieldHash = QaFieldHash & { po?: string; pot?: string };

/** A block-qa entry whose hashed inputs include the PO. */
export type TranslationQaEntry = Omit<QaCriterionEntry, "field_hash"> & {
  field_hash: TranslationFieldHash;
};

export interface TranslationBlockQaReport {
  $schema: "translation-qa/v1";
  /** `trans:<locale>/<stem>`, the convention `schemas/content/translation.ts` fixes. */
  label: string;
  /** The content block this translates, by ITS label — a different identity. */
  block?: string;
  locale: string;
  /**
   * Repo-relative paths of the subject's files: a block's or page's `.md` (and
   * `.ts`), or — for a catalogue measured against its template, which has no
   * page of its own here (an IG page, a glossary) — the `.pot`.
   */
  paths: { md?: string; ts?: string; pot?: string };
  /** The PO this verdict was measured against, repo-relative. */
  po: string;
  source_hashes: TranslationFieldHash;
  criteria: Record<string, TranslationQaEntry[]>;
  /** Optional and no longer written (owner rulings 2026-11-06, cards "QA dates" and "Date source"): the date is derived on read from the entries' `reviewed_tree`. */
  updated_at?: string;
}

// ── from the tools layer's pipeline/lsi.ts ──

export interface LsiOptions {
  /** Requested rank. Capped at `min(terms, units) - 1`. Default 100 — the
   *  literature's working range for small collections is 50–300, and
   *  `k` is reported with the variance it retains so a reader can judge it. */
  k?: number;
  weighting?: "log-entropy" | "tfidf" | "raw";
  /** A term must occur in at least this many units to be kept. A term in one
   *  unit can create no co-occurrence and only adds a row. Default 2. */
  minDf?: number;
  /** Drop terms in more than this share of units. Default 0.5. */
  maxDfShare?: number;
  /** Power iterations for the randomized range finder. Default 4. */
  powerIterations?: number;
  seed?: number;
}

// ── from the tools layer's scripts/lsi.ts ──

/** The committed per-graph index sidecar, `folio-lsi-index/v1`. */
export interface LsiSidecar {
  $schema: "folio-lsi-index/v1";
  method: string;
  instance: string;
  graph: string;
  path: string;
  docs: string[] | null;
  fingerprint: string;
  options: LsiOptions;
  units: number;
  terms: number;
  k: number;
  retained: number;
  dimensions: Array<{ dim: number; sigma: number; positive: string[]; negative: string[] }>;
  findings: {
    nearDuplicates: Array<{ a: string; b: string; cosine: number }>;
    narrowDimensions: Array<{ dim: number; units: string[] }>;
  };
  neighbours: Record<string, Array<[string, number]>>;
}
