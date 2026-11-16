/**
 * A document KIND — a named structure of sections that a document authored
 * with a harness follows.
 *
 * @graphNode schema
 * @module schemas/document-kind
 *
 * ## Not a content profile
 *
 * A profile (`CONTENT_PROFILES` in `block-kinds.ts`) says which BLOCK KINDS a
 * folio may contain, and is a compile-time union in core. A document kind
 * says what a publication's STRUCTURE is: which sections it has, which are
 * required, and what each is derived from. Only a document kind can be
 * contributed by a harness as DATA, without core naming it.
 *
 * Core knows that document kinds exist; it never knows which. A harness
 * declares its kinds in a `document-kinds` directory of its `<instance>.json`,
 * one JSON file per kind.
 *
 * ## Two rules the schema enforces
 *
 * - **A structure is never invented.** Every kind names its `sources`, and every
 *   section may name its own — a kind whose sections come from several
 *   publications says which section came from which.
 * - **"Computed from" is a claim to check.** A section's `computedFrom` names
 *   DECLARED graph ids (e.g. `library`), so a reader can check the graph
 *   exists. `modelledBy` names what kind of thing the section holds, in a
 *   pinned external model.
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";

/**
 * A node kind since issue #2195 (owner, 2026-10-06), so every harness's
 * document kinds get pages. Renamed from `folio-document-kind/v1` with the
 * other short SemVer names; `retag-schemas.ts` moved the files.
 */
export const DOCUMENT_KIND_SCHEMA_TAG = "document-kind/1.0.0";

/** Where a structure, or one section of it, comes from. */
export const DocumentKindSourceSchema = z.object({
  /** A library entry id or a URL — something a reader can open. */
  ref: z.string().min(1),
  /** The part of it that says so: a chapter, a section, a table. */
  locator: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

export const DocumentKindSectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(1),
  /** Declared graph ids this section is derived from. */
  computedFrom: z.array(z.string().min(1)).optional(),
  /**
   * The classes of an external vocabulary this section's content instantiates,
   * each as `<system>#<code>` in a PINNED snapshot (`folio-pinned-terminology/v1`)
   * the harness declares. `computedFrom` says where a section's content comes
   * from; this says what KIND of thing it is in a model someone else owns.
   * Resolving the terms is the harness's check, because only it knows which
   * snapshot it pinned — core names no vocabulary.
   */
  modelledBy: z.array(z.string().regex(/^[a-z0-9][a-z0-9.-]*#[A-Za-z0-9][A-Za-z0-9._-]*$/, "a term is `<system>#<code>`")).optional(),
  /** This section's own sources, when they differ from the kind's. */
  sources: z.array(DocumentKindSourceSchema).optional(),
});

export const DocumentKindKind = nodeKind(
  DOCUMENT_KIND_SCHEMA_TAG,
  [],
  {
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    description: z.string().min(1),
    /**
     * `fixed`: exactly these sections, every one required.
     * `semi-fixed`: the required sections must be present; others are allowed.
     */
    structure: z.enum(["fixed", "semi-fixed"]),
    /** A parent kind's id; this kind's sections extend the parent's. */
    extends: z.string().min(1).optional(),
    sections: z.array(DocumentKindSectionSchema).min(1),
    sources: z.array(DocumentKindSourceSchema).min(1),
    /** Set when the file is generated; names the generator, so a hand edit is visibly a defect. */
    generatedBy: z.string().min(1).optional(),
  },
  {
    refine: (k, ctx) => {
      const ids = k.sections.map((s) => s.id);
      const dup = ids.find((id, i) => ids.indexOf(id) !== i);
      if (dup) ctx.addIssue({ code: "custom", path: ["sections"], message: `section id "${dup}" appears twice` });
      if (k.structure === "fixed") {
        const optional = k.sections.filter((s) => !s.required).map((s) => s.id);
        if (optional.length > 0) {
          ctx.addIssue({
            code: "custom",
            path: ["sections"],
            message: `a fixed structure has no optional sections; optional here: ${optional.join(", ")}`,
          });
        }
      }
      },
  },
);
export const DocumentKindSchema = DocumentKindKind.schema;

export type DocumentKind = z.infer<typeof DocumentKindSchema>;
export type DocumentKindSection = z.infer<typeof DocumentKindSectionSchema>;

// ── Coverage: how one subject realises a kind ───────────────────────────

/**
 * How one SUBJECT (a layer, a document) realises a kind, section by
 * section, as computed by whoever owns the kind.
 *
 * Generic like the kind itself: the rule that assigns a member to a section is
 * the harness's (the DAK layer computes the DAK view of an IG from FHIR resource
 * types), and `method` says what that rule was so the page can state it. What
 * no rule placed is listed in `unplaced`, never dropped — a coverage report
 * that hid its remainder would read as complete.
 */
export const DOCUMENT_KIND_COVERAGE_SCHEMA_TAG = "document-kind-coverage/1.0.0";

const CoverageMemberSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const DocumentKindCoverageKind = nodeKind(DOCUMENT_KIND_COVERAGE_SCHEMA_TAG, [], {
  /** The kind's id. */
  kind: z.string().min(1),
  /** The layer whose content was classified. */
  subject: z.string().min(1),
  /** Repo-relative path of what was classified. */
  from: z.string().min(1),
  /** The rule, in a sentence a reader can check. */
  method: z.string().min(1),
  total: z.number().int().nonnegative(),
  sections: z.array(z.object({ id: z.string().min(1), members: z.array(CoverageMemberSchema) })),
  /** What no rule placed, grouped so the remainder is legible. */
  unplaced: z.array(z.object({ group: z.string().min(1), count: z.number().int().positive() })),
  generatedBy: z.string().min(1),
});
export const DocumentKindCoverageSchema = DocumentKindCoverageKind.schema;

export type DocumentKindCoverage = z.infer<typeof DocumentKindCoverageSchema>;
