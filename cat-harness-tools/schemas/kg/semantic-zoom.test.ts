/**
 * The threshold is declared, inherited, and traceable.
 *
 * The owner's CRDM Q4 ruling — *folio default, a kind may override* — is this
 * repository's inheritance rule applied unchanged, so the tests are the ones
 * that rule's own failure modes call for: a variant states only what it
 * changes, requiredness is checked AFTER resolution, and an inherited value is
 * still a fact somebody can trace.
 *
 * @module schemas/semantic-zoom.test
 */
import { describe, expect, test } from "bun:test";

import {
  SEMANTIC_ZOOM_SCHEMA_TAG,
  SemanticZoomSchema,
  rendersAvatar,
  zoomThresholdFor,
  type SemanticZoom,
} from "./semantic-zoom.js";

const zoom = (): SemanticZoom => ({
  $schema: SEMANTIC_ZOOM_SCHEMA_TAG,
  belowPx: 120,
  byKind: { table: { belowPx: 260, because: "a dense table is noise long before a title is" } },
});

describe("inherit everything, override anything", () => {
  test("a kind that states nothing takes the folio's number", () => {
    expect(zoomThresholdFor(zoom(), "prose")).toEqual({ belowPx: 120, source: "folio" });
  });

  test("a kind that states one takes its own", () => {
    expect(zoomThresholdFor(zoom(), "table").belowPx).toBe(260);
  });

  test("a declaration with NO overrides is complete, not incomplete", () => {
    // Requiredness after resolution, never on the declaration — the failure
    // mode where inheritance turns into optionality by accident.
    const bare: SemanticZoom = { $schema: SEMANTIC_ZOOM_SCHEMA_TAG, belowPx: 100, byKind: {} };
    expect(SemanticZoomSchema.safeParse(bare).success).toBe(true);
    expect(zoomThresholdFor(bare, "anything").belowPx).toBe(100);
  });

  test("an UNKNOWN kind resolves rather than throwing", () => {
    // `avatars.ts` keeps an open registry with GENERIC as its fallback; a
    // threshold that threw on a kind the avatar layer happily renders would
    // make the two disagree about what exists.
    expect(zoomThresholdFor(zoom(), "kind-nobody-declared").source).toBe("folio");
  });
});

describe("an inherited value is still a fact somebody must be able to trace", () => {
  test("the resolver says WHERE the number came from", () => {
    expect(zoomThresholdFor(zoom(), "prose").source).toBe("folio");
    expect(zoomThresholdFor(zoom(), "table").source).toBe("kind");
  });

  test("an override carries its reason, and the default carries none", () => {
    // A card that flips too early is a different bug depending on which of
    // these it is: somebody decided that, or the folio's default landed
    // somewhere it does not fit.
    expect(zoomThresholdFor(zoom(), "table").because).toBe(
      "a dense table is noise long before a title is",
    );
    expect(zoomThresholdFor(zoom(), "prose").because).toBeUndefined();
  });

  test("an override WITHOUT a reason does not validate", () => {
    const bad = {
      $schema: SEMANTIC_ZOOM_SCHEMA_TAG,
      belowPx: 120,
      byKind: { table: { belowPx: 260 } },
    };
    expect(SemanticZoomSchema.safeParse(bad).success).toBe(false);
  });

  test("an empty reason is no reason", () => {
    const bad = {
      $schema: SEMANTIC_ZOOM_SCHEMA_TAG,
      belowPx: 120,
      byKind: { table: { belowPx: 260, because: "" } },
    };
    expect(SemanticZoomSchema.safeParse(bad).success).toBe(false);
  });
});

describe("the boundary is stated once", () => {
  test("strictly below — the declared number still shows words", () => {
    // A boundary stated one way in a comment and the other way in the renderer
    // is the disagreement nobody notices until a card flickers.
    expect(rendersAvatar(zoom(), "prose", 119)).toBe(true);
    expect(rendersAvatar(zoom(), "prose", 120)).toBe(false);
    expect(rendersAvatar(zoom(), "prose", 121)).toBe(false);
  });

  test("a kind's override moves the boundary, not just the number", () => {
    // Falsified in BOTH directions: a test that only checked the shrunk case
    // would pass for a board that is always avatars.
    expect(rendersAvatar(zoom(), "table", 200)).toBe(true);
    expect(rendersAvatar(zoom(), "prose", 200)).toBe(false);
  });
});

describe("the document declares what it is", () => {
  test("no tag, no document", () => {
    expect(SemanticZoomSchema.safeParse({ belowPx: 120 }).success).toBe(false);
  });

  test("the folio default is REQUIRED — nothing is ever unstated", () => {
    expect(SemanticZoomSchema.safeParse({ $schema: SEMANTIC_ZOOM_SCHEMA_TAG, byKind: {} }).success).toBe(
      false,
    );
  });

  test("a zero or negative threshold is refused", () => {
    // Zero means "never an avatar" spelled as a number, which is a state
    // somebody would have to know to read; absent semantics belong in a field,
    // not in a magic value.
    for (const belowPx of [0, -1]) {
      expect(SemanticZoomSchema.safeParse({ $schema: SEMANTIC_ZOOM_SCHEMA_TAG, belowPx }).success).toBe(
        false,
      );
    }
  });

  test("byKind defaults to empty, so a minimal declaration parses", () => {
    const parsed = SemanticZoomSchema.parse({ $schema: SEMANTIC_ZOOM_SCHEMA_TAG, belowPx: 90 });
    expect(parsed.byKind).toEqual({});
  });
});
