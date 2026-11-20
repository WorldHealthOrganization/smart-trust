/**
 * The three states are distinguishable, a move keeps identity, and a drop never
 * duplicates.
 *
 * Each of those is a property somebody could break without any test noticing,
 * because the broken version still renders a sticky in a plausible place.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { TOOLS_ROOT } from "../scripts/lib/roots.ts";

import {
  alsoAboutLabels,
  anchorOf,
  badgeAt,
  duplicateNote,
  isOnBlock,
  isPageGlobal,
  moveNote,
  NO_ANCHOR,
  NoteAnchorSchema,
  notesAt,
  type Related,
} from "./ui/note-anchor.js";

const NOTE = { id: "t1", summary: "s" };

describe("the three states are actually three", () => {
  test("page-global and unattached are NOT the same value", () => {
    // The whole reason this module exists. With an optional string both are
    // `undefined`, so a sticky somebody deliberately floated to the top of a
    // page reads identically to one that fell off a block — and the second is
    // a defect while the first is a choice.
    const page = anchorOf({ anchor: { kind: "page", page: "index" } });
    expect(page).not.toEqual(NO_ANCHOR);
    expect(page.kind).toBe("page");
    expect(anchorOf({}).kind).toBe("none");
  });

  test("page-global carries its page — global is global TO A PAGE", () => {
    // Otherwise a sticky on the landing page surfaces on every other one.
    expect(NoteAnchorSchema.safeParse({ kind: "page" }).success).toBe(false);
    expect(NoteAnchorSchema.safeParse({ kind: "page", page: "index" }).success).toBe(true);
  });

  test("an unknown kind is refused rather than silently ignored", () => {
    expect(NoteAnchorSchema.safeParse({ kind: "chapter", label: "x" }).success).toBe(false);
  });

  test("a block anchor needs a label", () => {
    expect(NoteAnchorSchema.safeParse({ kind: "block" }).success).toBe(false);
    expect(NoteAnchorSchema.safeParse({ kind: "block", label: "" }).success).toBe(false);
  });
});

describe("existing notes keep working — the old field is read, not replaced", () => {
  test("a note with only targetLabel reads as block-attached", () => {
    // Every todo in the corpus predates `anchor`, and the e2e fixtures use
    // targetLabel directly. Deriving is EXACT rather than a guess: before
    // `anchor` existed, page-global had no representation, so a note with a
    // label is block-attached and one without is unattached.
    expect(anchorOf({ targetLabel: "sec:page-one" })).toEqual({ kind: "block", label: "sec:page-one" });
  });

  test("an explicit anchor wins over the derived one", () => {
    const n = { targetLabel: "sec:old", anchor: { kind: "page" as const, page: "index" } };
    expect(anchorOf(n)).toEqual({ kind: "page", page: "index" });
  });

  test("isOnBlock answers from either field", () => {
    expect(isOnBlock({ targetLabel: "sec:a" }, "sec:a")).toBe(true);
    expect(isOnBlock({ anchor: { kind: "block", label: "sec:a" } }, "sec:a")).toBe(true);
    expect(isOnBlock({ anchor: { kind: "page", page: "sec:a" } }, "sec:a")).toBe(false);
  });

  test("an unattached note is never page-global for any page", () => {
    expect(isPageGlobal({}, "index")).toBe(false);
  });
});

describe("a move re-anchors — it does not re-create", () => {
  test("the id survives", () => {
    // The assertion the bean exists for. A bean id is referenced from commits,
    // issues and other beans; a "move" that mints a new one breaks every one of
    // those references while looking, from the board, exactly like a move that
    // worked.
    const moved = moveNote(NOTE, { kind: "block", label: "sec:b" });
    expect(moved.id).toBe("t1");
  });

  test("targetLabel is kept in step, so an older reader still sees the truth", () => {
    expect(moveNote(NOTE, { kind: "block", label: "sec:b" }).targetLabel).toBe("sec:b");
  });

  test("moving to a page or to nothing CLEARS the stale label", () => {
    // A stale label is worse than no label: it points somewhere the note is not,
    // and an older reader would render the sticky on a block it has left.
    const onBlock = moveNote(NOTE, { kind: "block", label: "sec:a" });
    expect(moveNote(onBlock, { kind: "page", page: "index" }).targetLabel).toBeUndefined();
    expect(moveNote(onBlock, NO_ANCHOR).targetLabel).toBeUndefined();
  });

  test("a move between pages leaves one owner, not two", () => {
    const a = moveNote(NOTE, { kind: "page", page: "one" });
    const b = moveNote(a, { kind: "page", page: "two" });
    expect(isPageGlobal(b, "one")).toBe(false);
    expect(isPageGlobal(b, "two")).toBe(true);
  });
});

describe("a drop never implicitly duplicates", () => {
  test("duplicating REQUIRES a new id, so it cannot happen by accident", () => {
    // The owner's rule: a drop is always a move; duplication is a separate
    // explicit action. Requiring the caller to name the copy is what makes the
    // two impossible to confuse at a call site.
    const copy = duplicateNote(NOTE, "t2", { kind: "block", label: "sec:b" });
    expect(copy.id).toBe("t2");
    expect(NOTE.id).toBe("t1");
  });

  test("the original is untouched by either operation", () => {
    // Both return new objects. A mutating move would leave the board showing a
    // sticky in two places until a reload, which reads as a duplicate.
    const original = { id: "t1", summary: "s", targetLabel: "sec:a" };
    moveNote(original, { kind: "page", page: "index" });
    duplicateNote(original, "t2", NO_ANCHOR);
    expect(original).toEqual({ id: "t1", summary: "s", targetLabel: "sec:a" });
  });

  test("a duplicate is a separate note at a separate anchor", () => {
    const a = moveNote(NOTE, { kind: "block", label: "sec:a" });
    const b = duplicateNote(a, "t2", { kind: "block", label: "sec:b" });
    expect([isOnBlock(a, "sec:a"), isOnBlock(b, "sec:b"), isOnBlock(b, "sec:a")]).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("beans carry no anchor — the owner's rule, guarded", () => {
  // "beans no anchor. no change bean schema. RULE." — owner, 2026-09-19.
  //
  // A rule recorded only in prose is a rule the next agent does not find, and
  // this is exactly the shape somebody "finishes" in good faith: the ask says
  // "same behaviour applies to beans", and anchoring them looks like the
  // obvious completion. It is not — see the module docs for why a bean RECORDS
  // a move rather than undergoing one.
  //
  // Deliberately NOT a count of anything. A number here would make "the rule
  // still holds" indistinguishable from "somebody renamed the file", which is
  // the mistake this session already made twice with coverage counts.
  const BEAN_MODULES = ["schemas/sdlc/bean-graph.ts", "src/workflow/bean-link.ts"];

  test.each(BEAN_MODULES)("%s does not reach for an anchor", async (rel) => {
    const file = Bun.file(join(TOOLS_ROOT, rel));

    // Absent is NOT clean. A moved or renamed module would otherwise pass this
    // silently, reporting a rule as guarded when nothing was read at all.
    expect(await file.exists()).toBe(true);

    const src = await file.text();
    expect(src).not.toMatch(/NoteAnchor|\banchor\b/i);
  });
});

describe("one primary, declared secondaries — the owner's CRDM Q1 ruling", () => {
  const note = (id: string, label?: string, also: string[] = []) => ({
    id,
    ...(label ? { targetLabel: label } : {}),
    ...(also.length ? { alsoAbout: also.map((l) => ({ kind: "block" as const, label: l })) } : {}),
  });

  test("a secondary reference does not change where the note is attached", () => {
    // The whole reason this shape was chosen over making the block anchor a
    // list: every consumer of `targetLabel` keeps working untouched.
    const n = note("a", "sec:page-one", ["sec:page-two"]);
    expect(anchorOf(n)).toEqual({ kind: "block", label: "sec:page-one" });
  });

  test("a note with no list reads as [] rather than undefined", () => {
    expect(alsoAboutLabels(note("a"))).toEqual([]);
    expect(alsoAboutLabels(note("a", "sec:x", ["sec:y"]))).toEqual(["sec:y"]);
  });

  test("the two relations come back split, from one pass", () => {
    const notes = [note("a", "sec:here"), note("b", "sec:elsewhere", ["sec:here"]), note("c", "sec:elsewhere")];
    const at = notesAt(notes, "sec:here");
    expect(at.attached.map((n) => n.id)).toEqual(["a"]);
    expect(at.alsoAbout.map((n) => n.id)).toEqual(["b"]);
  });

  test("a note attached AND also-about the same node counts once, as attached", () => {
    // Otherwise a self-referential declaration inflates a badge past the
    // length of the list it labels — the disagreement R6 exists to prevent.
    const at = notesAt([note("a", "sec:here", ["sec:here"])], "sec:here");
    expect(at.attached.map((n) => n.id)).toEqual(["a"]);
    expect(at.alsoAbout).toEqual([]);
  });

  test("the badge counts PRIMARIES — R6 stays true with secondaries in play", () => {
    const notes = [note("a", "sec:here"), note("b", "sec:elsewhere", ["sec:here"])];
    expect(badgeAt(notes, "sec:here")).toEqual({ count: 1, showCount: false });
  });

  test("the badge shows a count only above one, and keeps the exact number", () => {
    // R5, the owner's "badge of # if > 1". `count` is what `aria-label` says;
    // `showCount` is what the chip renders. A screen-reader user is not told
    // less because the visual got denser.
    const at = [
      { id: "a", targetLabel: "sec:here" },
      { id: "b", targetLabel: "sec:here" },
    ];
    expect(badgeAt(at, "sec:here")).toEqual({ count: 2, showCount: true });
    expect(badgeAt([], "sec:here")).toEqual({ count: 0, showCount: false });
  });

  test("a page-global or unattached note is at no block", () => {
    // The third state, carried through the new reader rather than re-derived.
    const global = { id: "g", anchor: { kind: "page" as const, page: "index" } };
    expect(notesAt([global], "sec:here").attached).toEqual([]);
    // Typed, because `Related`'s fields are all optional: an untyped literal
    // has nothing in common with it and TypeScript refuses the call rather
    // than inferring a note out of a bare id.
    const unattached: Related & { id: string } = { id: "n" };
    expect(notesAt([unattached], "sec:here")).toEqual({ attached: [], alsoAbout: [] });
  });
});
