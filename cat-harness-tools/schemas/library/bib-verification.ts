/**
 * Bibliography verification schema — the source ledger.
 *
 * WHERE IT LIVES: the attestation store's `bib-verification` family, one
 * file per reference (`schemas/sdlc/qa-attestations.ts`), read and written only
 * through `schemas/library/bib-attestations.ts`. Before a folio is migrated
 * (`cat-harness-tools/scripts/migrate-bib-attestations.ts`) it is the single
 * file `<folio>/bib-qa-verifications.json`, and the same reader falls back to
 * it. The shapes below are the ROW shape either way.
 *
 * Each entry records a single examination of a reference against either a
 * local PDF or an external source. The discriminated `Verifier` union
 * distinguishes an agent claim from a human adjudication, so the dashboard,
 * `validate-bib`, and the authors-note disclosure can treat them differently.
 * `bib-qa.ts` and `validate-bib.ts` parse this shape strictly;
 * `pipeline/migrate-bib-verifier.ts` converts legacy free-text `verified_by`
 * entries.
 * @graphNode schema
 */

/** Verification statuses for a single reference. */
export type VerificationStatus =
  | "verified-clean"      // PDF inspected, citations match
  | "partial"              // title+publisher upgrade; awaiting PDF
  | "fixed"                // misattributions corrected post-verification
  | "uncited"              // bib orphan — no citation site in the paper
  | "paper-mismatch"       // local PDF metadata != bib entry
  | "unfetchable"          // URL/DOI did not resolve
  | "pending-placement";   // intended-to-keep entry, citation site TBD

/** Discriminated union: agent-only vs human-adjudicated verifier.
 *
 * The two cases convey different epistemic weight.  `kind: "agent"` is a
 * machine-generated claim awaiting human review; `kind: "human"` is a
 * human adjudication, which may have been assisted by an agent but is
 * the human's stated position. */
export type Verifier =
  | {
      kind: "agent";
      /** The model identifier (e.g. `claude-opus-4-7`).  Bare model
       *  string only — no surrounding parens, no "Claude" prefix. */
      model: string;
    }
  | {
      kind: "human";
      /** The human's preferred attribution name. */
      name: string;
      /** Optional record of an agent that assisted with this
       *  verification.  Present when the human reviewed an agent-
       *  generated draft and accepted (with or without edits). */
      agent_assistance?: {
        model: string;
      };
    };

/** A single verification entry.  One per reference id in
 *  `content/schema/references.ts` that has been examined. */
export interface VerificationEntry {
  /** Reference id (matches a key in `references.ts`). */
  id: string;
  /** Current verification status. */
  status: VerificationStatus;
  /** Path to a local PDF that was inspected, if any. */
  local_pdf?: string | null;
  /** ISO 8601 timestamp of the verification. */
  verified_at?: string;
  /** Who / what produced the verification claim. */
  verified_by: Verifier;
  /** Separate human-adjudication provenance.  Distinct from
   *  `verified_by`: an entry can be `verified_by: { kind: "agent", ... }`
   *  and *also* carry `human_adjudicated` if a human has subsequently
   *  reviewed the agent's claim.  Status transitions like
   *  `paper-mismatch` and `uncited` (which trigger reference removal /
   *  metadata rewrite) SHOULD require this field to be set. */
  human_adjudicated?: {
    who: string;
    at: string;
    note?: string;
  };
  /** Number of citation-site fixes applied as part of this verification. */
  fixes_applied?: number;
  /** Reference to the commit that landed the fixes, if any. */
  fix_commit?: string;
  /** Free-text note for the verifier's reasoning. */
  note?: string;
}

/** Top-level JSON shape of `bib-qa-verifications.json`. */
export interface VerificationRoster {
  /** Self-describing schema string. */
  _schema: string;
  /** Statement of what this file is authoritative for. */
  _authoritative_for?: string;
  /** The verification entries. */
  entries: VerificationEntry[];
}

/** Type guard: is this an agent-only verifier? */
export function isAgentVerifier(v: Verifier): v is Extract<Verifier, { kind: "agent" }> {
  return v.kind === "agent";
}

/** Type guard: is this a human verifier? */
export function isHumanVerifier(v: Verifier): v is Extract<Verifier, { kind: "human" }> {
  return v.kind === "human";
}

/** Render a Verifier as a short human-readable string for dashboards. */
export function verifierLabel(v: Verifier): string {
  if (v.kind === "agent") return `agent (${v.model})`;
  const base = `human (${v.name})`;
  return v.agent_assistance ? `${base}, assisted by ${v.agent_assistance.model}` : base;
}

// ─── Source ledger (2026-08-08) ──────────────────────────────────────────────
//
// The roster above answers "was this reference checked against a source?".
// It is extended here to also answer "is the source *relevant*, and what
// should the author do about it?" — the paper-relevance triage.
//
// ## One source of truth
//
// The ledger stores judgements, never bibliography.  Exactly one file owns
// each fact:
//
// | Fact                                   | Owner                              |
// |----------------------------------------|------------------------------------|
// | title, authors, year, DOI, URL, type   | `content/schema/references.ts`     |
// | source document ↔ reference join       | this ledger (`source` + `id`)      |
// | was the source checked                 | this ledger (`status`)             |
// | is it relevant, what to do about it    | this ledger (`relevance`)          |
// | the resulting work items               | `beans/`                          |
//
// A ledger entry therefore carries NO bibliographic metadata — no `title`,
// no `authors`, no `year`.  It points at a reference by `id` and the
// consumer joins.  A reviewer who wants a title for an orphan reads it out
// of the PDF at display time; it is never written here, because the moment
// a source is judged worth citing the triage's first action is to create
// its `ref()` entry, and metadata is born in `references.ts` or nowhere.
//
// Migration history:
//   2026-08-08  `source` discriminated union + `relevance` block; `id`
//               becomes nullable so a local document with no reference yet
//               (an "orphan" upload) is a first-class row.  `local_pdf` is
//               superseded by `source: { kind: "upload", file }` and is
//               retained only as a deprecated read-path for old consumers.

/** Where the examined source lives.
 *
 * Mirrors the `Verifier` discriminated-union idiom above.  An `upload` row
 * is a document committed under `uploads/`; an `external` row was checked
 * against a remote source with no local copy. */
export type SourceRef =
  | {
      kind: "upload";
      /** Repo-relative path, e.g. `uploads/0409565v2.pdf`. */
      file: string;
    }
  | {
      kind: "external";
      /** The URL or DOI that was consulted. */
      url: string;
    };

/** How relevant a source is to this folio's own argument. */
export type RelevanceVerdict =
  /** Supplies a result the paper uses, or demonstrably should use. */
  | "core"
  /** Background, technique, or context worth citing but not load-bearing. */
  | "supporting"
  /** Same field, no result this paper can consume. */
  | "tangential"
  /** No bearing on the paper. */
  | "not-relevant"
  /** Not yet assessed. */
  | "undetermined";

/** A single result inside the source that the folio could consume. */
export interface KeyResult {
  /** Locator *within the source*: "Thm 3.2", "§4.1", "eq. (12)", "p. 87". */
  locator: string;
  /** What the result says, in one sentence. */
  statement: string;
  /** What this folio could do with it — the reason it is listed. */
  useForFolio: string;
  /** Candidate content-block labels this would attach to. */
  targets?: string[];
}

/** The kinds of link a triage can propose between a source and the folio. */
export type LinkageAction =
  /** No `ref()` entry exists yet — create one in `references.ts`. */
  | "add-reference"
  /** Reference exists; cite it at a named block that currently does not. */
  | "cite-in-block"
  /** Supplies a lemma or technique for a named `sorry` / proof gap. */
  | "aid-proof"
  /** Warrants a `remark` block interpreting the result for this folio. */
  | "new-remark"
  /** Warrants importing a definition/proposition as a content block. */
  | "new-block"
  /** Carries a numerical claim worth cross-checking against a witness. */
  | "compute-check"
  /** Read and judged to need nothing. */
  | "no-action";

/** One proposed link, and the work item it became. */
export interface ProposedAction {
  action: LinkageAction;
  /** Why this action, specifically — the evidence for the proposal. */
  rationale: string;
  /** Block label, Lean declaration, or script path the action targets. */
  target?: string;
  /** Beans id once the action has been queued as work (e.g. `qou-f4el`). */
  bean?: string;
}

/** The relevance triage of one source.
 *
 * Epistemically parallel to `VerificationEntry`: `assessed_by` carries the
 * same agent-vs-human distinction, because a relevance verdict is a
 * judgement call and an agent's is a claim awaiting review, not a fact. */
export interface RelevanceAssessment {
  verdict: RelevanceVerdict;
  /** Why this verdict — the reasoning, not a restatement of the verdict. */
  rationale: string;
  /** Results worth consuming.  Empty for `tangential` / `not-relevant`. */
  keyResults: KeyResult[];
  /** What the author could do about it. */
  proposedActions: ProposedAction[];
  /** Who produced the assessment. */
  assessed_by: Verifier;
  /** ISO 8601 timestamp. */
  assessed_at: string;
  /** Human review of an agent assessment, same semantics as
   *  `VerificationEntry.human_adjudicated`. */
  human_adjudicated?: {
    who: string;
    at: string;
    note?: string;
  };
  /** 12-char SHA-256 prefix of the source file at assessment time.  A
   *  re-upload changes the hash and marks the assessment stale — the same
   *  staleness idiom the `.qa.json` sidecars use. */
  source_sha?: string;
}

/** A row in the source ledger.
 *
 * Supersedes `VerificationEntry`.  Every `VerificationEntry` maps onto a
 * `LedgerEntry` with `id` set and `source` derived from `local_pdf`
 * (`upload`) or the reference's URL (`external`). */
export interface LedgerEntry {
  /** The document this row is about. */
  source: SourceRef;
  /** Reference id in `references.ts`, or `null` when the source backs no
   *  reference yet (an orphan upload awaiting triage). */
  id: string | null;
  /** Source-verification status.  `unreviewed` for a freshly-indexed
   *  upload that nothing has looked at. */
  status: VerificationStatus | "unreviewed";
  verified_at?: string;
  verified_by?: Verifier;
  human_adjudicated?: {
    who: string;
    at: string;
    note?: string;
  };
  fixes_applied?: number;
  fix_commit?: string;
  note?: string;
  /** The relevance triage, once run. */
  relevance?: RelevanceAssessment;
  /**
   * @deprecated Superseded by `source: { kind: "upload", file }`.  Written
   * by the migration for one release so pre-2026-08-08 readers keep
   * working; new writers must not set it.
   */
  local_pdf?: string | null;
}

/** Top-level JSON shape of the extended `bib-qa-verifications.json`. */
export interface SourceLedger {
  _schema: string;
  _authoritative_for?: string;
  entries: LedgerEntry[];
}

/** The repo-relative path of a ledger entry's local document, if it has one. */
export function ledgerLocalFile(e: LedgerEntry): string | null {
  if (e.source?.kind === "upload") return e.source.file;
  return e.local_pdf ?? null;
}

/** Stable key for a ledger row.  Uploads key by file (they exist whether or
 *  not a reference does); external rows key by reference id. */
export function ledgerKey(e: LedgerEntry): string {
  return e.source.kind === "upload" ? e.source.file : (e.id ?? e.source.url);
}

/** Has this source been triaged for relevance? */
export function isTriaged(e: LedgerEntry): boolean {
  return !!e.relevance && e.relevance.verdict !== "undetermined";
}
