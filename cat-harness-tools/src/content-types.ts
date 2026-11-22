/**
 * The content model the harness carries, and the content half of an adapter.
 *
 * Moved verbatim out of `src/types.ts` (bean `w2gr`, step 1). That file is the
 * server's plug-in contract and moves to `cat-harness-tools`; these types are
 * what a content package (the content core's document adapter, sci's
 * paper adapter) implements and returns, and the owner ruled on 2026-10-01 that
 * core does not depend on that layer. (Superseded the same day by ruling C1,
 * which put the tools layer BELOW core; the content model staying in the
 * harness is now simply where both layers can reach it.) So they stay here, and
 * `src/types.ts` re-exports them unchanged for its existing importers.
 *
 * Like `src/types.ts`, this imports nothing from `schemas/`: the harness may
 * not import the core content model it stands in for (bean `jcmx`).
 *
 * @module folio-assistant/content-types
 */

// ── What a harness signature needs of the content it carries ─────

/**
 * The minimum a HARNESS signature needs of a feedback item, and the macro
 * shape a document may carry.
 *
 * ## Why these are declared here rather than imported
 *
 * `src/types.ts` imported `FeedbackItem` and `PaperMacro` from
 * `schemas/types.ts`. That was the LAST wrong-direction edge in the
 * repository's partition (`bun run cat check:partition`): core may import the
 * harness, the harness may not import core, and this file is the harness's
 * plug-in contract. Bean `jcmx`.
 *
 * ## Why NOT a copy of the core types, and why not generics
 *
 * A copy is how this file was wrong before. The note below records a
 * hand-written second `FeedbackItem` that drifted from the schema's — it
 * narrowed `origin`, flipped three fields' optionality and omitted five
 * more, and nothing caught it because every call site in between was typed
 * `any`. Duplicating a model is the defect, not the fix.
 *
 * Generics were the first design and were dropped on a measurement: NOTHING
 * reads a field off `.todos` or `.macros` through these shapes anywhere in
 * the repository. They are CARRIED, not inspected. A type parameter that no
 * consumer instantiates differently is ceremony that still has to be
 * threaded through five interfaces and six files.
 *
 * So each declares only what a harness signature genuinely needs, and
 * TypeScript's structural typing does the rest: `FeedbackItem` satisfies
 * `TodoRef`, `PaperMacro` satisfies `MacroDef`, and an adapter returning the
 * richer core types still type-checks. No `unknown`, no `any`, no field a
 * caller loses — measured, not assumed.
 *
 * This is the typed form of the pattern `getFeedbackStore?()` already
 * states below: *declare the slot, name the type where it is owned.*
 */
export interface TodoRef {
  /** Unique id. Enough to reference one; not enough to re-implement one. */
  id: string;
  /** One-line summary — the only field a harness-side log or error names. */
  summary: string;
  /**
   * Lifecycle status, as a plain string.
   *
   * Core narrows this to the `TodoStatus` union, and a union of string
   * literals is assignable to `string`, so the narrower type satisfies this
   * one. Restating the union here would be the copy this whole comment
   * exists to refuse.
   */
  status: string;
}

/**
 * A macro definition: `{ tex, unicode? }` — structurally identical to the
 * core `PaperMacro`, so nothing is lost by naming it here.
 *
 * It also fixes a CONTENT-PROFILE leak that predates the edge. `macros` sits
 * on the GENERIC `ResolvedDocument`, and a `document` folio has no macros at
 * all — `PaperMacro` is the paper adapter's vocabulary. Typing the generic
 * slot with a paper-specific name said the platform knew about papers.
 */
export interface MacroDef {
  /** LaTeX expansion (e.g. `"\\mathfrak{p}"`). Used by KaTeX and LaTeX. */
  tex: string;
  /** UTF-8 display string for plain-text contexts (e.g. `"\u{1D52D}"`). */
  unicode?: string;
}

/**
 * The correction this file already paid for once, kept because the hazard is
 * permanent: there was a second, hand-written `FeedbackItem` here that had
 * drifted from the one in `schemas/types.ts` — the one `FeedbackItemSchema`
 * validates against and the one every feedback file on disk is written as
 * (`satisfies FeedbackItem[]`). The copy narrowed `origin` to
 * `"human" | "agent"`, so a `"qc"`-origin item (the validation pipeline's own
 * output, and a documented `TodoOrigin`) was a type error to pass through
 * this layer; it also made `comment` optional and `author`/`authorEmail`/
 * `assignee` required, both the opposite of the schema, and omitted
 * `targetLabel`, `updatedAt`, `updatedBy`, `data` and `related` entirely.
 * Nothing caught the divergence because every call site in between was typed
 * `any`.
 *
 * It was then fixed by RE-EXPORTING the core type, which is what created the
 * wrong-direction edge. `TodoRef` above is the third answer and the first one
 * that is neither a copy nor an import. The re-export had no consumers when
 * it was removed, so nothing downstream changed.
 */

// ── Content adapter interface ────────────────────────────────────

export interface FolioItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  authors: string[];
  date?: string;
  stats: Record<string, number>;
}

export interface OutlineSection {
  title: string;
  label?: string;
  blockCount: number;
}

export interface OutlineChapter {
  number?: number;
  tabLabel?: string;
  title: string;
  label?: string;
  dir: string;
  sections: OutlineSection[];
}

export interface ContentOutline {
  id: string;
  title: string;
  authors: string[];
  affiliations?: string[];
  date?: string;
  chapters: OutlineChapter[];
  branch: string;
}

export interface ResolvedBlock {
  rootName: string;
  kind: string;
  label?: string;
  title?: string;
  uses?: string[];
  examples?: string[];
  proofs?: string[];
  lean?: { ref: string; file?: string; validation?: string; source?: string };
  status?: string;
  tex?: string;
  caption?: string;
  tags?: string[];
  rendered?: Array<{ mime: string; url: string; blockIndex: number; hash?: string }>;
  md: string;
  todos?: TodoRef[];
}

export interface ResolvedSection {
  title: string;
  label?: string;
  blocks: ResolvedBlock[];
  subsections?: ResolvedSection[];
}

export interface ResolvedChapter {
  number?: number;
  tabLabel?: string;
  title: string;
  label?: string;
  sections: ResolvedSection[];
  todos?: TodoRef[];
}

export interface ResolvedDocument {
  id: string;
  title: string;
  authors: string[];
  affiliations?: string[];
  date?: string;
  /** `Paper.macros` is `Record<string, PaperMacro>` — `{ tex, unicode? }`
   *  objects, which is what the viewer reads (`buildKatexMacros` uses
   *  `def.tex`). This declared `Record<string, string>`; the values passed
   *  through untouched so nothing broke at runtime, but the type was a lie and
   *  any consumer doing string work on them would get "[object Object]". Same
   *  correction as `PaperOutline` in the MCP resolver; surfaced here once the
   *  paper import stopped being `as any`. */
  macros?: Record<string, MacroDef>;
  chapters: ResolvedChapter[];
  todos?: TodoRef[];
  branch: string;
  /** Flattened O(1) lookup: rootName → block. */
  blocksByName?: Map<string, ResolvedBlock>;
}

export interface BlockDiff {
  rootName: string;
  kind: string;
  label?: string;
  title?: string;
  status: "added" | "removed" | "changed" | "unchanged";
  mdDiff?: { base: string; head: string };
  leanDiff?: { base: string; head: string };
  statusDiff?: { base: string; head: string };
  todos?: TodoRef[];
}

export interface DocumentDiff {
  base: string;
  head: string;
  documentId: string;
  blocks: BlockDiff[];
  summary: { added: number; removed: number; changed: number; unchanged: number };
  mergeBase?: string;
}

export interface BranchCharacterization {
  title: string;
  summary: string;
  categories: string[];
  impact: "minor" | "moderate" | "major";
  suggestions?: string[];
  error?: string;
}

export interface TriageResult {
  assessment: string;
  actionable: boolean;
  proposedEdit?: {
    description: string;
    newMd?: string;
    targetBranch?: string;
  };
  error?: string;
}

export interface SectionStub {
  title: string;
  label?: string;
  blockCount: number;
  blockStubs: Array<{
    rootName: string;
    kind: string;
    label?: string;
    title?: string;
    status?: string;
    lean?: { ref?: string; file?: string; validation?: string };
    todoCount: number;
  }>;
}

export interface ChapterDetail {
  number?: number;
  tabLabel?: string;
  title: string;
  label?: string;
  dir: string;
  sections: SectionStub[];
  todos?: TodoRef[];
}

/**
 * ContentSource — the CONTENT half of a content adapter: discovery, editing,
 * diff and the AI judgements, every one answered in the content model above.
 *
 * Split out of `ContentAdapter` (bean `w2gr`, owner ruling 2026-10-01) so the
 * half a content package implements can stay in the harness while the server
 * half — chat, HTTP routes, MCP registration — moves to `cat-harness-tools`.
 * `ContentAdapter` in `src/types.ts` extends this; nothing here names a
 * server type.
 */
export interface ContentSource {
  /** Adapter type identifier (e.g. "paper", "guideline"). */
  readonly type: string;

  /** Human-readable name for logs/UI. */
  readonly name: string;

  /** Root directory of the content repo. */
  readonly repoRoot: string;

  // ── Discovery ────────────────────────────────────────────────

  /** List all content items (papers, guidelines, etc.) */
  listItems(branch?: string): Promise<{ title: string; papers: FolioItem[]; branch: string }>;

  /** Get lightweight outline (chapter/section stubs, no block content). */
  getOutline(itemId: string, branch?: string): Promise<ContentOutline | null>;

  /** Get chapter detail (section stubs with block metadata, no md/lean). */
  getChapterDetail(itemId: string, chapterDir: string, branch?: string): Promise<ChapterDetail | null>;

  /** Get full section with block content (md, lean source). */
  getSection(itemId: string, chapterDir: string, sectionIndex: number, branch?: string): Promise<ResolvedSection | null>;

  /** Get full resolved document tree. */
  getDocument(itemId: string, branch?: string): Promise<ResolvedDocument | null>;

  // ── Editing ──────────────────────────────────────────────────

  /** Save block markdown content. Returns the file path written. */
  saveBlock(itemId: string, rootName: string, md: string): Promise<string>;

  /** Invalidate caches for a document (call after edits). */
  invalidateCache(itemId?: string): void;

  // ── Diff ─────────────────────────────────────────────────────

  /** Compute diff between two branches for a document. */
  computeDiff(itemId: string, base: string, head: string): Promise<DocumentDiff>;

  // ── AI ───────────────────────────────────────────────────────

  /** Characterize branch changes via AI (or fallback heuristic). */
  characterizeChanges(diff: DocumentDiff): Promise<BranchCharacterization>;

  /** AI triage of feedback on a block. */
  triageFeedback(
    todo: TodoRef,
    blockContent: string,
    blockKind: string,
    itemId: string,
    rootName: string,
  ): Promise<TriageResult>;

  /**
   * The adapter's feedback store, handed to the feedback route as a service.
   *
   * **`unknown` deliberately.** `FeedbackStore` is the content layer's, and
   * the harness may not import it — the slot is declared here, the type is
   * named where it is owned. An adapter with no feedback surface returns
   * `undefined`, and the route declaration's `needs` turns that into a named
   * skip at boot rather than a `TypeError` inside a handler later.
   */
  getFeedbackStore?(): unknown;
}
