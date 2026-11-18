/**
 * A portfolio: an umbrella knowledge graph that LINKS other graphs' libraries,
 * level by level, and copies none of them.
 *
 * @module schemas/kg/portfolio
 * @graphNode schema
 *
 * ## What a portfolio is
 *
 * A portfolio names levels (`L1`, `L2`, … or any other ids its harness
 * chooses), and each level names one or more LIBRARIES whose members belong
 * there. A library is reached one of three ways:
 *
 * - **`library`** — a layer's own library catalogue, all of it or the items
 *   listed by their ids (such as IRIS handles);
 * - **`discover`** — the repositories of an owner whose names start with one
 *   of `prefixes`, found when the portfolio is read, so a new repository joins
 *   without an edit here;
 * - **`repos`** — repositories listed by name.
 *
 * `discover` and `repos` may say which kind of member they take
 * (`memberKind`, such as `folio-document` or `fhir-ig`). The word is the
 * reader's: this kind does not interpret it, so a harness can add one without
 * a change here.
 *
 * ## Linked, never materialized
 *
 * A member is addressed by its repository or item id and published where its
 * own site publishes it. The portfolio holds the index a reader needs (title,
 * date, cover, entry page), derived when it is read; it never holds the
 * member's content. The owner, 2026-11-10: the umbrella graph links libraries
 * of L1, L2, L3 documents.
 *
 * ## Subclasses
 *
 * A harness that fixes what its levels mean declares a child kind with this
 * one as its parent and a `refine` over `levels`: a guidelines layer's
 * `guideline-portfolio` pins the WHO SMART Guidelines levels L1 to L4.
 */
import { z } from "zod";

import { nodeKind } from "./node-kind.js";

export const PORTFOLIO_SCHEMA_ID = "portfolio/1.0.0";

/** A short lower-case id: a URL segment. */
const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a lower-case slug: letters, digits and `-`");

/** `owner/name` on the forge. */
const RepoName = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "`owner/name`");

/** What kind of member a discovered or listed library takes. Open: the reader's word. */
const MemberKind = Slug;

/** A layer's library catalogue: every item, or the items listed. */
export const LibrarySourceSchema = z
  .object({
    library: z
      .object({
        /** The repository whose catalogue holds the items. */
        repo: RepoName,
        /** Where its items' entry pages are published. */
        site: z.string().url().optional(),
        /** The items, by the catalogue's own ids (IRIS handles). Absent: all of them. */
        items: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict(),
  })
  .strict();

/** Repositories found by name when the portfolio is read. */
export const DiscoverSourceSchema = z
  .object({
    discover: z
      .object({
        owner: z.string().min(1),
        prefixes: z.array(z.string().min(1)).min(1),
        /** Repository names (without owner) left out. */
        exclude: z.array(z.string().min(1)).optional(),
        memberKind: MemberKind.optional(),
      })
      .strict(),
  })
  .strict();

/** Repositories listed by name. */
export const ReposSourceSchema = z
  .object({
    repos: z.array(RepoName).min(1),
    memberKind: MemberKind.optional(),
  })
  .strict();

export const PortfolioLibrarySourceSchema = z.union([LibrarySourceSchema, DiscoverSourceSchema, ReposSourceSchema]);

/** One library linked into a level. */
export const PortfolioLibrarySchema = z
  .object({
    /** Unique within the portfolio. */
    id: Slug,
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    source: PortfolioLibrarySourceSchema,
  })
  .strict();
export type PortfolioLibrary = z.infer<typeof PortfolioLibrarySchema>;

/** One level, and the libraries whose members belong to it. */
export const PortfolioLevelSchema = z
  .object({
    /** `L1`, `L2`, …: short, upper-case first. Unique within the portfolio. */
    id: z.string().regex(/^[A-Z0-9][A-Za-z0-9-]*$/, "a short id such as `L1`"),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    /** Empty is allowed: a level the portfolio names before it has members. */
    libraries: z.array(PortfolioLibrarySchema),
  })
  .strict();
export type PortfolioLevel = z.infer<typeof PortfolioLevelSchema>;

/** Every id that appears more than once. */
function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const id of ids) (seen.has(id) ? twice : seen).add(id);
  return [...twice];
}

export const PortfolioKind = nodeKind(
  PORTFOLIO_SCHEMA_ID,
  [],
  {
    id: Slug,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    levels: z.array(PortfolioLevelSchema).min(1),
    /**
     * Display data no member's repository holds (a DAK's cover, its WHO
     * publication link), keyed by member name. Never the member's content.
     */
    memberOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  },
  {
    strict: true,
    term: "Portfolio",
    summary: "An umbrella knowledge graph that links other graphs' libraries, level by level, without copying them.",
    refine: (p, ctx) => {
      for (const id of duplicates(p.levels.map((l) => l.id))) {
        ctx.addIssue({ code: "custom", path: ["levels"], message: `level \`${id}\` is declared twice` });
      }
      for (const id of duplicates(p.levels.flatMap((l) => l.libraries.map((b) => b.id)))) {
        ctx.addIssue({ code: "custom", path: ["levels"], message: `library \`${id}\` is declared twice` });
      }
    },
  },
);

export const PortfolioSchema = PortfolioKind.schema;
export type Portfolio = z.infer<typeof PortfolioSchema>;
