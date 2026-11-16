/**
 * Where a note is attached, as a three-state answer.
 *
 * @module schemas/note-anchor
 * @graphNode schema
 *
 * `CarriedNoteSchema` already carries `targetLabel` (the block label a note is
 * attached to), exercised by `sticky-todos.e2e.ts`. What it cannot say is the
 * difference between:
 *
 * | | meaning |
 * |---|---|
 * | **`block`** | attached to one block, named by its label |
 * | **`page`** | deliberately page-global, at the top of the page |
 * | **`none`** | attached to nothing, and nobody has said otherwise |
 *
 * With an optional string, `page` and `none` are both `undefined`, though the
 * second is a defect and the first a choice.
 *
 * ## Page-global is an ABSENCE of block, not a reserved block id
 *
 * A sentinel like `__page__` in `targetLabel` would put a non-label in a
 * label field and collide with a real block of that label; and a page-global
 * sticky (e.g. on the landing page) may have no block to point at.
 *
 * ## Beans get NO anchor — a rule
 *
 * A bean says **what is being worked on**; a sticky says **where a note sits
 * on a page**. A move is recorded on a bean as a **note**, which
 * `workflow/bean-link.ts` already writes, needing no new field. The bean
 * schema is not changed: a bean's front matter is written by a third-party
 * CLI, so an added field is not guaranteed to survive a round-trip.
 *
 * ## `targetLabel` stays
 *
 * An anchor of kind `block` **is** a `targetLabel` with its state made
 * explicit, and `anchorOf` derives one from a note that has only the old
 * field. New writers set `anchor`; every reader can answer from either.
 */
import { z } from "zod";

/** A note attached to one block, named by the block's label. */
export const BlockAnchorSchema = z
  .object({ kind: z.literal("block"), label: z.string().min(1) })
  .strict();

/**
 * A note deliberately floated to the top of a page.
 *
 * Carries the page it belongs to, because *"global"* is global **to a page**
 * rather than to the site — a sticky on the landing page must not surface on
 * every other one.
 */
export const PageAnchorSchema = z
  .object({ kind: z.literal("page"), page: z.string().min(1) })
  .strict();

/** Attached to nothing, and nobody has said otherwise. */
export const NoAnchorSchema = z.object({ kind: z.literal("none") }).strict();

export const NoteAnchorSchema = z.discriminatedUnion("kind", [
  BlockAnchorSchema,
  PageAnchorSchema,
  NoAnchorSchema,
]);
export type NoteAnchor = z.infer<typeof NoteAnchorSchema>;

/** The unattached anchor, as a value rather than a literal repeated at each site. */
export const NO_ANCHOR: NoteAnchor = { kind: "none" };

/**
 * Anything with an anchor, or with only the legacy field, or with neither.
 *
 * Both fields are optional because the three populations all exist at once: a
 * todo written today, one written before `anchor` did, and one attached to
 * nothing at all.
 */
export type Anchored = { anchor?: NoteAnchor; targetLabel?: string };

/**
 * What {@link moveNote} hands back: the note, now definitely anchored.
 *
 * **Returning bare `T` would have been a lie**, and the compiler caught it —
 * a move sets `anchor` on a note that may not have declared the field, so a
 * caller reading `moved.anchor` off `T` would be told it does not exist. The
 * intersection says what the function actually promises: whatever you gave it,
 * plus an anchor it is now carrying.
 */
export type Moved<T> = T & Anchored & { anchor: NoteAnchor };

/**
 * A note's anchor, read from either the new field or the old one.
 *
 * **The fallback is what makes this additive.** A note written before `anchor`
 * existed carries only `targetLabel`, and every such note is block-attached or
 * unattached — never page-global, because page-global had no representation.
 * So deriving it is exact, not a guess.
 */
export function anchorOf(note: Anchored): NoteAnchor {
  if (note.anchor) return note.anchor;
  return note.targetLabel ? { kind: "block", label: note.targetLabel } : NO_ANCHOR;
}

/**
 * Re-anchor a note, keeping its identity.
 *
 * **A move re-anchors; it does not re-create.** The owner, 2026-09-19: a drop
 * is always a move, never an implicit copy. The id is deliberately untouched —
 * a bean id is referenced from commits, issues and other beans, and a "move"
 * that mints a new one silently breaks every one of those references while
 * looking, from the board, exactly like a move that worked.
 *
 * `targetLabel` is kept in step so a reader that has not learned about anchors
 * still sees the truth. Moving to a page or to nothing clears it, because a
 * stale label is worse than no label: it points somewhere the note is not.
 */
export function moveNote<T extends { id: string } & Anchored>(
  note: T,
  to: NoteAnchor,
): Moved<T> {
  return {
    ...note,
    anchor: to,
    ...(to.kind === "block" ? { targetLabel: to.label } : { targetLabel: undefined }),
  };
}

/**
 * Copy a note to a new anchor, under a new id.
 *
 * **Duplication is explicit, and that is the whole distinction.** The drop
 * gesture moves; this is the separate action somebody has to choose. Calling it
 * requires supplying `newId` rather than deriving one, so a caller cannot
 * duplicate by accident — the cost of a copy is naming it.
 */
export function duplicateNote<T extends { id: string } & Anchored>(
  note: T,
  newId: string,
  to: NoteAnchor,
): Moved<T> {
  return moveNote({ ...note, id: newId }, to);
}

/** Does this note sit on the given block? Reads either field. */
export function isOnBlock(note: Anchored, label: string): boolean {
  const a = anchorOf(note);
  return a.kind === "block" && a.label === label;
}

/** Is this note page-global for the given page? Never true of an unattached one. */
export function isPageGlobal(note: Anchored, page: string): boolean {
  const a = anchorOf(note);
  return a.kind === "page" && a.page === page;
}

/**
 * Content nodes a note is ALSO about, without being attached to them.
 *
 * ## The ruling, 2026-09-20 (CRDM Q1)
 *
 * The ask carried two features in one sentence — *"be attached to nothing or
 * show attachment to content node**s** based on relationships"*, plural — and
 * the owner settled which one it is:
 *
 * > **One primary + declared secondaries.**
 *
 * So {@link anchorOf} is unchanged and still answers *where is this note
 * attached*, one place or none. Everything a consumer of `targetLabel` does
 * keeps working untouched, which was the point of choosing this over making
 * the block anchor a list.
 *
 * ## The badge counts PRIMARIES, and that is what keeps R6 true
 *
 * R6: *the badge's count SHALL be the cardinality of the query the panel
 * renders.* {@link notesAt} returns both sets from one pass so the count and
 * the panel cannot be computed from different things — and the badge is
 * `attached.length`, because the panel is *"the notes attached here"*. A badge
 * that silently included secondaries would be a number disagreeing with the
 * list under it, which is the exact defect the owner asked to design out.
 *
 * ## A secondary is a LINE, not an attachment
 *
 * What it buys on the board is the edge the ask asked for: a note placed at
 * its own position, with a line drawn to each node it is also about. It does
 * not move the note, it does not appear in that node's panel, and it does not
 * make the note belong anywhere.
 */
export const AlsoAboutSchema = z.array(BlockAnchorSchema);
export type AlsoAbout = z.infer<typeof AlsoAboutSchema>;

/** Anything that may carry secondary references, alongside its anchor. */
export type Related = Anchored & { alsoAbout?: AlsoAbout };

/**
 * The labels a note is also about — `[]` when it is about nothing else.
 *
 * A reader rather than a field access, for the same reason {@link anchorOf}
 * is one: every note written before this existed carries nothing, and an
 * absent list and an empty list mean the same thing to every caller. Returning
 * `undefined` would make each of them decide that again.
 */
export function alsoAboutLabels(note: Related): string[] {
  return (note.alsoAbout ?? []).map((a) => a.label);
}

/**
 * The notes at one content node, split into the two relations, from ONE pass.
 *
 * `attached` is the panel and its count is the badge (R6). `alsoAbout` is the
 * lines. They are returned together rather than by two functions so a caller
 * cannot compute the badge from one query and render the panel from another —
 * the only way for the two to disagree is for somebody to build them apart.
 *
 * A note that is both attached here and also-about here is counted **once, as
 * attached**: the stronger relation wins, so a self-referential declaration
 * cannot inflate a badge past the length of the list it labels.
 */
export function notesAt<T extends Related>(
  notes: readonly T[],
  label: string,
): { attached: T[]; alsoAbout: T[] } {
  const attached: T[] = [];
  const alsoAbout: T[] = [];
  for (const n of notes) {
    const a = anchorOf(n);
    if (a.kind === "block" && a.label === label) attached.push(n);
    else if (alsoAboutLabels(n).includes(label)) alsoAbout.push(n);
  }
  return { attached, alsoAbout };
}

/**
 * What the badge shows at a node: the count, and whether to show one at all.
 *
 * R5: *a badge SHALL show a count only when more than one note is attached* —
 * the owner's *"badge of # if > 1"*. The exact number is kept alongside
 * regardless, because the threshold is a DENSITY decision about the visual and
 * a screen-reader user should not be told less; `aria-label` takes `count`
 * while the rendered chip takes `showCount`.
 */
export function badgeAt<T extends Related>(
  notes: readonly T[],
  label: string,
): { count: number; showCount: boolean } {
  const count = notesAt(notes, label).attached.length;
  return { count, showCount: count > 1 };
}
