/**
 * The window stack, and the zoom it must stay separate from.
 *
 * @module schemas/window-stack.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EMPTY_STACK,
  closeWindow,
  isOpen,
  openWindow,
  raise,
  topmost,
  zIndexOf,
} from "./window-stack.js";
import { SemanticZoomSchema, rendersAvatar, zoomThresholdFor } from "../kg/semantic-zoom.js";

describe("a board starts with nothing open", () => {
  test("`start everyrting in avatar` is the initial state, not a first render", () => {
    expect(EMPTY_STACK.open).toEqual([]);
    expect(topmost(EMPTY_STACK)).toBeUndefined();
    expect(isOpen(EMPTY_STACK, "anything")).toBe(false);
  });
});

describe("open, close, raise", () => {
  test("opening puts a card on top", () => {
    const s = openWindow(openWindow(EMPTY_STACK, "a"), "b");
    expect(s.open).toEqual(["a", "b"]);
    expect(topmost(s)).toBe("b");
  });

  test("selecting any part raises it — the owner's words", () => {
    const s = raise(openWindow(openWindow(EMPTY_STACK, "a"), "b"), "a");
    expect(s.open).toEqual(["b", "a"]);
    expect(topmost(s)).toBe("a");
  });

  test("opening an already-open card RAISES it rather than adding a second entry", () => {
    // A card twice in the array is a card with two z-indices, and no caller
    // could tell an accidental double-open from a deliberate one.
    const s = openWindow(openWindow(openWindow(EMPTY_STACK, "a"), "b"), "a");
    expect(s.open).toEqual(["b", "a"]);
    expect(s.open.filter((o) => o === "a").length).toBe(1);
  });

  test("raising a card that is not open does NOT open it", () => {
    // Selection and opening are different gestures. A raise that could open
    // would make a stray click on the board's background spawn a window.
    const s = raise(EMPTY_STACK, "a");
    expect(s.open).toEqual([]);
    expect(isOpen(s, "a")).toBe(false);
  });

  test("`[x]` closes back to the avatar and leaves the rest of the stack in order", () => {
    let s = EMPTY_STACK;
    for (const id of ["a", "b", "c"]) s = openWindow(s, id);
    s = closeWindow(s, "b");
    expect(s.open).toEqual(["a", "c"]);
    expect(isOpen(s, "b")).toBe(false);
  });

  test("closing something that is not open is a no-op, not an error", () => {
    // A stale click on a card another gesture already closed is not a defect,
    // and throwing would turn it into one.
    expect(closeWindow(EMPTY_STACK, "gone").open).toEqual([]);
  });

  test("every operation returns a NEW stack — the input is never mutated", () => {
    const before = openWindow(EMPTY_STACK, "a");
    const snapshot = [...before.open];
    const opened = openWindow(before, "b");
    const closed = closeWindow(before, "a");
    const raised = raise(before, "a");
    for (const after of [opened, closed, raised]) {
      expect(after).not.toBe(before);
      expect(after.open).not.toBe(before.open);
    }
    expect(opened.open).toEqual(["a", "b"]);
    expect(closed.open).toEqual([]);
    expect(raised.open).toEqual(["a"]);
    expect(before.open).toEqual(snapshot);
  });
});

describe("zIndexOf derives the number and never stores it", () => {
  test("bottom to top, one-based", () => {
    const s = openWindow(openWindow(EMPTY_STACK, "a"), "b");
    expect(zIndexOf(s, "a")).toBe(1);
    expect(zIndexOf(s, "b")).toBe(2);
  });

  test("a closed card gets `undefined`, not 0", () => {
    // A renderer handed `0` could not tell "bottom of the stack" from "not on
    // it" — two facts a stacking context must keep apart.
    expect(zIndexOf(EMPTY_STACK, "a")).toBeUndefined();
    expect(zIndexOf(openWindow(EMPTY_STACK, "a"), "b")).toBeUndefined();
  });

  test("no two open cards share an index", () => {
    let s = EMPTY_STACK;
    for (const id of ["a", "b", "c", "d"]) s = openWindow(s, id);
    const zs = s.open.map((id) => zIndexOf(s, id));
    expect(new Set(zs).size).toBe(zs.length);
  });
});

describe("the two mechanisms stay separate, and that is checked rather than intended", () => {
  const zoom = SemanticZoomSchema.parse({
    $schema: "folio-semantic-zoom/v1",
    belowPx: 200,
    byKind: { note: { belowPx: 320, because: "a note's words are longer than a chip's" } },
  });

  test("zoom is falsified in BOTH directions", () => {
    // The Done-when line this pins: "a test that only checks the shrunk case
    // passes for a board that is always avatars." So each threshold is
    // asserted on both sides of itself.
    expect(rendersAvatar(zoom, "chip", 199)).toBe(true);
    expect(rendersAvatar(zoom, "chip", 201)).toBe(false);
    expect(rendersAvatar(zoom, "note", 319)).toBe(true);
    expect(rendersAvatar(zoom, "note", 321)).toBe(false);
  });

  test("the threshold is exclusive at the boundary, and the boundary is stated", () => {
    // `widthPx < belowPx`. Pinned because an off-by-one here is invisible on a
    // page and changes which card flips.
    expect(rendersAvatar(zoom, "chip", 200)).toBe(false);
  });

  test("an override is TRACEABLE — the resolver says where the number came from", () => {
    expect(zoomThresholdFor(zoom, "note").source).toBe("kind");
    expect(zoomThresholdFor(zoom, "chip").source).toBe("folio");
  });

  test("the zoom path takes no window state at all", () => {
    // The separation, asserted on the SIGNATURE rather than on behaviour: if
    // `rendersAvatar` ever needed to know what is open, the two mechanisms
    // would have been conflated and this arity would have changed.
    expect(rendersAvatar.length).toBe(3);
  });

  test("an open window is unaffected by the card's zoom answer", () => {
    // The card goes on becoming its avatar as the board shrinks; the window it
    // spawned is a different object and simply stays. Nothing in the stack
    // changes when the width does, because the width is not an input to it.
    const s = openWindow(openWindow(EMPTY_STACK, "note-0"), "note-1");
    const snapshot = [...s.open];
    // The card's zoom answer flips across the threshold...
    expect(rendersAvatar(zoom, "note", 100)).toBe(true);
    expect(rendersAvatar(zoom, "note", 400)).toBe(false);
    // ...and the stack reads the same on either side of it.
    for (const width of [100, 400]) {
      rendersAvatar(zoom, "note", width);
      expect(s.open).toEqual(snapshot);
      expect(isOpen(s, "note-1")).toBe(true);
      expect(topmost(s)).toBe("note-1");
      expect(zIndexOf(s, "note-1")).toBe(2);
    }
    // No width can reach the stack: the stack module imports nothing, so not
    // the zoom module either.
    const src = readFileSync(join(import.meta.dir, "window-stack.ts"), "utf-8");
    expect(src).not.toMatch(/^import /m);
  });
});
