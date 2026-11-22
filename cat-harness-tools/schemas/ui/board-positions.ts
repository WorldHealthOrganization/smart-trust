/**
 * Where a note sits on a board — a layer ON TOP of the notes, never inside them.
 *
 * ## Notes sit below the folio
 *
 * A note gains no `x`, no `y`, no `board`, no `order`. This layer names notes
 * BY ID and the relation points one way:
 *
 *     folio  ──▶  board  ──▶  position  ──▶  note        allowed
 *     note   ──▶  position / board / folio                REFUSED
 *
 * So:
 *
 * 1. **A note is complete with no board.** `readTodoFiles`, the todo index,
 *    the sticky board and the QA sidecars are untouched, and a folio that
 *    never opens a board has nothing extra in its work plan. The layer is
 *    ADDITIVE and REMOVABLE: delete this file and every note is what it was.
 * 2. **One note may sit on several boards**, at different places, without the
 *    note arbitrating between them.
 * 3. **The layers stay clean.** This is `state`, written by a running process;
 *    a coordinate on a `content` note would make it carry `state`, which
 *    `content-context-and-state-graphs` refuses.
 * 4. **An orphan is swept from the LAYER**: one file, one pass, and nothing
 *    edited out of a note a person owns.
 *
 * ## ONE committed file, with the board as a key
 *
 * The board is a key inside this document, so a new board adds lines rather
 * than a file.
 *
 * ## Mergeability
 *
 * Two sessions moving two notes is the ordinary case, and git merges by line,
 * so a minified one-line file conflicts on every concurrent change. So:
 * **indented, one position per line, sorted by board then note id.** Two
 * sessions moving DIFFERENT notes merge untouched. Two notes that sort
 * ADJACENT can still conflict: this removes the guaranteed conflict, not
 * every conflict.
 *
 * The ordering must be deterministic, or a writer would reshuffle on every
 * save; {@link sortPositions} guarantees it, and it is tested.
 *
 * @graphNode schema
 * @module schemas/board-positions
 *
 * ## ONE position per note per board, in the TYPE
 *
 * Positions are keyed by note id: `boards[board][note]` is one position or
 * none, so no file — hand-written, merged, or from a writer that bypassed
 * `place()` — can hold a note twice on one board. Each note still occupies
 * its own lines under an indented write, so a move edits one line-block in
 * situ.
 */
import { z } from "zod";

/** The document's own declaration of what it is, inside the file. */
export const BOARD_POSITIONS_SCHEMA_TAG = "folio-board-positions/v1";

/**
 * Where one note sits, in BOARD UNITS rather than pixels.
 *
 * Pixels would bake in the viewport that happened to be open when somebody
 * dragged a note, so the same board would read differently on a phone and be
 * unreproducible from the file. Board units are the board's own coordinate
 * space; the renderer maps them to the viewport it has.
 *
 * There is deliberately no `z` and no `width`. A note's size is its content's
 * business — the sticky sizes to what it holds, which is the property
 * `theme-artefacts` records — and stacking order is a rendering decision the
 * board makes from the document, not a value a person edits into a file.
 *
 * **And no `note`**: the note is the KEY this sits under. Carrying it here as
 * well would be one fact in two places, free to disagree the moment somebody
 * edits the file by hand.
 */
export const BoardPositionSchema = z
  .object({
    /** Horizontal position in board units. */
    x: z.number().finite(),
    /** Vertical position in board units. */
    y: z.number().finite(),
  })
  .strict();
export type BoardPosition = z.infer<typeof BoardPositionSchema>;

/** A position together with the note it places — what the readers hand back. */
export type PlacedNote = BoardPosition & { note: string };

/**
 * Every board's positions, in one document.
 *
 * Two levels of map, and each one removes a state rather than saving a
 * keystroke: `boards` is keyed by board id, so "two entries for one board" is
 * unrepresentable; each board is keyed by note id, so "two positions for one
 * note" is too. See the module docs for why the second one is the owner's
 * ruling rather than a preference.
 */
export const BoardPositionsSchema = z.object({
  $schema: z.literal(BOARD_POSITIONS_SCHEMA_TAG),
  boards: z.record(z.string().min(1), z.record(z.string().min(1), BoardPositionSchema)),
});
export type BoardPositions = z.infer<typeof BoardPositionsSchema>;

/** The file's name inside the graph directory it is declared in. */
export const BOARD_POSITIONS_FILE = "board-positions.json";

/**
 * The canonical order: by board id, then by note id, both ascending.
 *
 * **This is the mergeability guarantee, not a tidiness pass.** See the module
 * docs: an indented file merges cleanly only while its line order is a
 * function of its contents rather than of the writer's iteration order. A JSON
 * object has no inherent order, but `JSON.stringify` emits insertion order —
 * so the document is rebuilt with sorted keys rather than merely read in a
 * sorted pass, which would leave the written order to whoever built the object.
 *
 * `localeCompare` is deliberately NOT used — it is locale-dependent, so two
 * machines could sort the same ids differently and each rewrite the other's
 * file. Plain `<` on the code units is the same everywhere.
 */
export function sortPositions(doc: BoardPositions): BoardPositions {
  const boards: Record<string, Record<string, BoardPosition>> = {};
  for (const id of Object.keys(doc.boards).sort()) {
    const notes: Record<string, BoardPosition> = {};
    for (const note of Object.keys(doc.boards[id]!).sort()) notes[note] = doc.boards[id]![note]!;
    boards[id] = notes;
  }
  return { $schema: doc.$schema, boards };
}

/**
 * Serialise, sorted and indented, with a trailing newline.
 *
 * One function so the writer and the staleness check cannot disagree about
 * what "current" means — the same reason `themeCssVars` is one function.
 */
export function renderPositions(doc: BoardPositions): string {
  return JSON.stringify(sortPositions(doc), null, 2) + "\n";
}

/** An empty document, which is a real state: a folio with no board yet. */
export function emptyPositions(): BoardPositions {
  return { $schema: BOARD_POSITIONS_SCHEMA_TAG, boards: {} };
}

/**
 * One board's notes, in canonical order, each carrying the id it is keyed by.
 *
 * The reader every consumer wants: a map is the right STORAGE because it makes
 * a duplicate unrepresentable, and a list is the right thing to RENDER. This
 * is the one place that converts, so no caller re-implements the join between
 * a key and its value — and an unknown board is an empty board rather than an
 * exception, because a folio that has not placed anything yet is a real state.
 */
export function positionsOn(doc: BoardPositions, board: string): PlacedNote[] {
  const notes = doc.boards[board];
  if (notes === undefined) return [];
  return Object.keys(notes)
    .sort()
    .map((note) => ({ note, ...notes[note]! }));
}

/** Where one note sits on one board, or `undefined` if it has not been placed. */
export function positionOf(
  doc: BoardPositions,
  board: string,
  note: string,
): BoardPosition | undefined {
  return doc.boards[board]?.[note];
}

/**
 * Positions whose note is not in `liveNotes` — the orphans.
 *
 * REPORTED rather than removed, because `deletion-requires-confirmation`
 * applies to this file like any other durable artefact: a note id that does
 * not resolve may mean the note was deleted, or that this board was written
 * against a folio whose notes have not been fetched yet. Those are opposite
 * facts and only a caller with more context can tell them apart.
 *
 * The direction matters and is the easy one: an orphan lives in the LAYER, so
 * clearing it is one edit to one file rather than a sweep across notes a
 * person owns.
 */
export function orphanPositions(
  doc: BoardPositions,
  liveNotes: ReadonlySet<string>,
): Array<{ board: string; note: string }> {
  const out: Array<{ board: string; note: string }> = [];
  for (const board of Object.keys(doc.boards).sort()) {
    for (const note of Object.keys(doc.boards[board]!).sort()) {
      if (!liveNotes.has(note)) out.push({ board, note });
    }
  }
  return out;
}

/**
 * Place a note, replacing any position it already had on that board.
 *
 * Returns a NEW document rather than mutating, so a caller cannot half-apply a
 * move and write the result. The replacement is now the MAP's, not this
 * function's: assigning a key overwrites, so "two entries for one note" is
 * unrepresentable through every path rather than merely unreachable through
 * this one. That difference is the owner's Q2 ruling — see the module docs.
 */
export function place(
  doc: BoardPositions,
  board: string,
  note: string,
  pos: BoardPosition,
): BoardPositions {
  const existing = doc.boards[board] ?? {};
  return sortPositions({
    ...doc,
    boards: { ...doc.boards, [board]: { ...existing, [note]: pos } },
  });
}

/**
 * Remove a note's position from a board, if it had one.
 *
 * A note with no position is a REAL state — `note-anchor.ts` already declares
 * "attached to nothing", and the owner's ask says a note may be attached to
 * nothing. So this is not a delete of content; it is the note returning to the
 * state it is in before anybody places it.
 */
export function unplace(doc: BoardPositions, board: string, note: string): BoardPositions {
  const existing = doc.boards[board];
  if (existing === undefined || !(note in existing)) return doc;
  const next = { ...existing };
  delete next[note];
  return sortPositions({ ...doc, boards: { ...doc.boards, [board]: next } });
}

/**
 * Move a note that is already placed, by a delta.
 *
 * ## Why a delta rather than a new absolute position
 *
 * Because the gesture is a move, and `place(doc, board, note, {x: was.x + dx,
 * …})` makes every caller read the current position first. A caller that reads
 * and writes is a caller that can be wrong about which document it read from —
 * and this one already carries the rule that a note appears at most once per
 * board, which is easier to keep when nobody outside this module composes
 * coordinates.
 *
 * ## A note that is NOT placed is not moved
 *
 * `undefined` rather than a throw, and rather than placing it at the delta as
 * though the origin were its position. "Move it from where it is" has no
 * answer for a note that is nowhere, and answering anyway would put it
 * somewhere nobody chose. A caller that wants it placed calls {@link place},
 * which is a different act with a different name.
 *
 * ## It touches the LAYER and nothing else
 *
 * The same one-way arrow the module opens with: `folio → board → position →
 * note`. Moving a note edits where it was drawn and cannot edit what it says —
 * structurally, because this module imports nothing from the content graph and
 * has no note to reach.
 */
export function moveBy(
  doc: BoardPositions,
  board: string,
  note: string,
  dx: number,
  dy: number,
): BoardPositions | undefined {
  const was = positionOf(doc, board, note);
  if (was === undefined) return undefined;
  return place(doc, board, note, { x: was.x + dx, y: was.y + dy });
}
