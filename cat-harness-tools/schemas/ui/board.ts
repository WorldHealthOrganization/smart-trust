/**
 * A board — the surface a folio's notes and its content are read on together.
 *
 * @module schemas/board
 * @graphNode schema
 *
 * `board-positions.ts` keys its document by board id; this is the object
 * that id names: what a board is called and what it shows.
 *
 * ## What a board SHOWS
 *
 * Everything by default, with an optional declared filter: `filter` absent
 * means *the whole folio*. The filter is **a query, not a stored list**,
 * re-evaluated against the folio every time the board is rendered, so a board
 * never goes stale and an empty folio still has a board to open.
 *
 * ## The layering
 *
 * This SCHEMA lives in the platform. A board INSTANCE lives under a folio's
 * `todos/`. The tools that operate a board are kept separate, so the only
 * functions here are readers over a declared document; nothing in this module
 * writes, fetches or mounts anything.
 *
 * ## The arrows run one way
 *
 * `folio → board → position → note`. A board names content by page and node
 * id and names notes not at all — the positions layer does that, one level
 * down. Asserted at the import level in the tests, as for
 * `board-positions.ts`.
 */
import { z } from "zod";

/** The document's own declaration of what it is, inside the file. */
export const BOARD_SCHEMA_TAG = "folio-board/v1";

/**
 * Which content a board shows, when it does not show all of it.
 *
 * Two axes, and the semantics are stated here because {@link boardShows} is
 * the only thing that implements them: **OR within an axis, AND across axes.**
 * A filter naming two pages and one kind shows nodes on either page that are
 * also of that kind.
 *
 * An axis that is ABSENT is unconstrained; an axis that is present and EMPTY
 * is refused, because `pages: []` reads to a human as "no restriction" and to
 * a matcher as "nothing matches", and a document whose meaning depends on
 * which of those the reader assumed is a document nobody can review.
 */
export const BoardFilterSchema = z
  .object({
    /** Page slugs. Absent: every page. */
    pages: z.array(z.string().min(1)).nonempty().optional(),
    /** Content kinds. Absent: every kind. */
    kinds: z.array(z.string().min(1)).nonempty().optional(),
  })
  .strict()
  .refine((f) => f.pages !== undefined || f.kinds !== undefined, {
    message: "a filter with no axis is not a filter — omit `filter` to show the whole folio",
  });
export type BoardFilter = z.infer<typeof BoardFilterSchema>;

/** A board. */
export const BoardSchema = z
  .object({
    $schema: z.literal(BOARD_SCHEMA_TAG),
    /** The id the positions layer already keys by. */
    id: z.string().min(1),
    /** What a reader sees in a tab or a heading. */
    title: z.string().min(1),
    /**
     * What this board shows. **Absent is the default and means the whole
     * folio** — see the module docs; it is the state that cannot go stale.
     */
    filter: BoardFilterSchema.optional(),
  })
  .strict();
export type Board = z.infer<typeof BoardSchema>;

/** The directory a folio keeps its boards in, under its `todos/` graph. */
export const BOARDS_DIR = "boards";

/**
 * The part of a content node a board matches on.
 *
 * Structural rather than imported: a board is ABOVE the content graph in the
 * layering, and naming the fields it reads keeps this module importing nothing
 * but `zod` — the same discipline `board-positions.ts` holds against notes.
 */
export type BoardContentNode = {
  /** The page slug the node is on. */
  page: string;
  /** The node's id within that page. */
  node: string;
  /** The node's kind, when it has one. */
  kind?: string;
};

/**
 * Whether this board shows this content node.
 *
 * The **total** answer, including the two states that are easy to render as a
 * blank instead: a board with no filter shows everything, and a node with no
 * kind is excluded by a `kinds` filter rather than silently passing it.
 */
export function boardShows(board: Board, node: BoardContentNode): boolean {
  const f = board.filter;
  if (f === undefined) return true;
  if (f.pages !== undefined && !f.pages.includes(node.page)) return false;
  if (f.kinds !== undefined && (node.kind === undefined || !f.kinds.includes(node.kind))) return false;
  return true;
}

/**
 * The content this board shows, in the order it was given.
 *
 * **Document order is preserved deliberately** — it is what R4's linear
 * collapse renders, so a board that reordered its content would make the
 * collapsed view disagree with the board it collapsed from, and the collapsed
 * view is the accessibility floor rather than a convenience.
 */
export function boardContent<T extends BoardContentNode>(board: Board, nodes: readonly T[]): T[] {
  return nodes.filter((n) => boardShows(board, n));
}

/** A board that shows the whole folio — the default, as a value. */
export function wholeFolioBoard(id: string, title: string): Board {
  return { $schema: BOARD_SCHEMA_TAG, id, title };
}
