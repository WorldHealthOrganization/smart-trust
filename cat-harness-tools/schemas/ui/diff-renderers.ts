/**
 * The diff renderers a reviewer chooses between on the review page.
 *
 * @module schemas/diff-renderers
 * @graphNode schema
 *
 * ## Why a registry
 *
 * No single diff suits every block kind: a word diff of a table's Markdown is
 * unreadable, and a side-by-side view of a one-word edit hides the word. So
 * each renderer is declared here as DATA (what it needs, which block kinds it
 * defaults for), and the page offers every renderer that can run on a block,
 * with a default chosen by that block's kind.
 *
 * It lives in the harness because it describes RENDERING TOOLS, and the page
 * that uses it (`gen-review-page.ts`) is harness code too.
 *
 * ## What a renderer NEEDS decides whether it is offered
 *
 * - `text`: the block's prose on the sides it has (`changeset-text.json`).
 * - `pages`: a URL for each side (the preview, and `main` from
 *   `staging.json`).
 * - `screenshots`: a picture of the block on each side, from the
 *   `folio-block-screenshots` Tool's `visual-diff.json`.
 *
 * A renderer whose input is missing for a block is still LISTED, disabled,
 * with the reason, so it does not read as nonexistent.
 *
 * ## Shipped
 *
 * Word diff, inline rendered diff, side-by-side and the visual diff. A DAK
 * structural diff is NOT listed: a registry entry with nothing behind it is a
 * declared-but-absent Tool.
 */
import { z } from "zod";

export const DIFF_RENDERER_INPUTS = ["text", "pages", "screenshots", "structure"] as const;

/**
 * A `defaultFor` entry that names no kind: any block the build published
 * STRUCTURED sides for (`changeset-structure.json`, its manifest's fields
 * before and after). The structured kinds — a DAK persona, requirement, data
 * element — are declared by the layers above this one (a DAK layer's
 * `block-kinds/`), which this layer may not name, so the renderer is the
 * default by what the block HAS rather than by a list of kinds (bean f327).
 *
 * It is the FALLBACK for such a block, not its first choice: a structured
 * block still opens inline when it has text (owner, 2026-11-02: "i cant see
 * any changes in 'fields, before after'. I would want that the review page
 * defaults to in-line for all elements"). The field table lists metadata
 * such as IRIs, and hides the words a reader sees change.
 */
export const STRUCTURED = "@structured" as const;

export const DiffRendererSchema = z.object({
  /** Stable, and what a viewer's saved choice refers to. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** What the selector shows. Words, never an icon alone. */
  label: z.string().min(1),
  /** One sentence: what the reviewer will see. */
  description: z.string().min(1),
  needs: z.array(z.enum(DIFF_RENDERER_INPUTS)).min(1),
  /**
   * Block kinds this renderer is the DEFAULT for, from `BLOCK_KINDS`. `*` is
   * the fallback, and exactly one renderer carries it. {@link STRUCTURED} is
   * any block with structured sides, and comes after its kind and `*`: it is
   * chosen only when those cannot run on the block. Two renderers may list
   * the same kind: order is preference, and the page takes the first one
   * that can run on the block. A test holds every
   * other entry to a kind that exists, so a renamed kind cannot silently
   * lose its default.
   */
  defaultFor: z.array(z.string().min(1)),
});
export type DiffRenderer = z.infer<typeof DiffRendererSchema>;

export const DIFF_RENDERERS: readonly DiffRenderer[] = z.array(DiffRendererSchema).parse([
  {
    id: "word",
    label: "Word diff of the source",
    description: "The block's Markdown with removed words struck through and added words marked. Shows exactly what the author typed.",
    needs: ["text"],
    defaultFor: [],
  },
  {
    // Every block opens inline (owner, 2026-10-31: "review pages should
    // default to 'inline as rendered' not 'side by side'", and "'inline as
    // rendered' -> 'inline'"). It lists the picture kinds too, so it wins for
    // them; when a block has no text, the page falls back to the next
    // renderer that lists its kind (pictures, then side by side).
    id: "inline",
    label: "Inline",
    description: "The block as a reader sees it now, with added words marked and removed words struck through where they were.",
    needs: ["text"],
    defaultFor: ["*", "prose", "remark", "definition", "example", "recommendation", "table", "figure", "diagram", "equation", "simulator"],
  },
  {
    id: "visual",
    label: "Pictures, before and after",
    description: "A picture of the block on the published page and on this preview, with a slider between them and a view that marks every changed pixel. For figures, diagrams and tables, whose markup says little.",
    needs: ["screenshots"],
    defaultFor: ["table", "figure", "diagram", "equation", "simulator"],
  },
  {
    id: "side-by-side",
    label: "Side by side",
    description: "The published page and this preview next to each other, each scrolled to the block. For tables, figures and anything whose layout is the change.",
    needs: ["pages"],
    // The second choice for the same kinds: the page opens a block on the
    // FIRST renderer that lists its kind and can run, so a build that
    // published no pictures opens tables side by side, not on a word diff.
    defaultFor: ["table", "figure", "diagram", "equation", "simulator"],
  },
  {
    id: "fields",
    label: "Fields, before and after",
    description: "The block's fields side by side, one row each, with every added, removed and changed field named. For structured blocks — a persona, a requirement, a data element — whose source diff is unreadable.",
    needs: ["structure"],
    defaultFor: [STRUCTURED],
  },
]);

/**
 * The renderer a block of `kind` opens with when every renderer can run on it;
 * `structured` when the build published its fields. The page falls back to
 * the field renderer only when this one cannot run (no text for the block).
 */
export function defaultRendererFor(kind: string, renderers: readonly DiffRenderer[] = DIFF_RENDERERS, structured = false): DiffRenderer {
  return (
    renderers.find((r) => r.defaultFor.includes(kind)) ??
    renderers.find((r) => r.defaultFor.includes("*")) ??
    (structured ? renderers.find((r) => r.defaultFor.includes(STRUCTURED)) : undefined) ??
    renderers[0]!
  );
}
