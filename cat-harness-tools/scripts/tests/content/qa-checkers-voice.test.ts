/**
 * Unit tests for the voice QA checkers' false-positive fixes
 * (litlfred/folio-assistant #41):
 *
 *   1. `checkEditorializing` — the "naturally occurring" domain-phrase
 *      exemption must be a STRIP (not a whole-line skip), so a genuine
 *      editorializing term elsewhere on the same line is still caught.
 *   2. `checkWallSide`'s tests moved with the checker to
 *      https://github.com/litlfred/folio-assistant-sci/blob/main/scripts/tests/qa-checkers-wall.test.ts
 *      (bean saqd, row 9).
 *
 * Run via `bun test`.
 *
 * The tests here whose subject is folio-assistant-sci's contribution (the
 * `milnorlink` entry in this layer's library) live in
 * `folio-assistant-sci/scripts/tests/qa-checkers-voice.test.ts` (bean `ho66`):
 * standing alone, cat-harness has no such contribution to read.
 */
import { describe, test, expect } from "bun:test";
import { writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  checkEditorializing,
  checkScholarlyDefault,
} from "../../../pipeline/qa-checkers-voice.ts";

const DIR = mkdtempSync(join(tmpdir(), "qa-voice-"));
let seq = 0;
function tmp(name: string, contents: string): string {
  const p = join(DIR, `${seq++}-${name}`);
  writeFileSync(p, contents);
  return p;
}
const ed = (line: string) =>
  checkEditorializing(tmp("t.md", line)).result;

describe("checkEditorializing — `merely` in a contrast is a degree marker", () => {
  // Bean `nwus`. All four `voice-editorializing` findings in this repo's own
  // docs/source/ were the bare word `merely` inside an explicit contrast, and
  // all four were false. The criterion is after the author commenting on
  // quality; a comparative marks the WEAKER alternative, which is the opposite
  // move. Same shape as bean `fl5m` mechanism #2.
  test("'rather than merely cited' passes — the contrast IS the claim", () => {
    expect(
      ed("what makes a source authoritative rather than merely cited."),
    ).toBe("pass");
  });
  test("'rather than merely compile' passes", () => {
    expect(ed("Rules that make this work rather than merely compile:")).toBe(
      "pass",
    );
  });
  test("'not merely a relabelling' passes", () => {
    expect(ed("This is not merely a relabelling.")).toBe("pass");
  });
  test("bare 'merely a formality' still FAILS — the exemption is the contrast, not the word", () => {
    expect(ed("The proof is merely a formality.")).toBe("fail");
  });
  test("bare 'merely the shadow' still FAILS", () => {
    expect(ed("This is merely the shadow of the real result.")).toBe("fail");
  });
  test("a comparative line carrying a SECOND hit still FAILS (strip, not mask)", () => {
    // Same invariant the domain-phrase exemption has: removing the exempt
    // construction must not hide editorializing elsewhere on the line.
    expect(
      ed("authoritative rather than merely cited, and surprisingly so."),
    ).toBe("fail");
  });

  // Bean `fl5m` mechanism #5, in the editorializing rule: the negator lands on
  // the previous line when prose is hard-wrapped, and a line-based scan cannot
  // see it. One of the four findings was exactly this.
  test("hard-wrapped 'does not' / 'merely go unread' passes", () => {
    const p = tmp(
      "wrap.md",
      "so a paper still sitting in `uploads/` does not\nmerely go unread, it makes a clean grep lie\n",
    );
    expect(checkEditorializing(p).result).toBe("pass");
  });
  test("a line OPENING with 'merely' after a non-negated line still FAILS", () => {
    // The lookback must require the comparative or the negator, or it would
    // exempt every wrapped `merely` in the corpus.
    const p = tmp(
      "wrap-no-negator.md",
      "The argument is short.\nmerely a formality, in the end\n",
    );
    expect(checkEditorializing(p).result).toBe("fail");
  });
});

describe("checkEditorializing — domain-phrase exemption is a strip, not a mask", () => {
  test("'naturally occurring' alone passes (domain term, not opinion)", () => {
    expect(ed("These are naturally occurring elements.")).toBe("pass");
  });
  test("editorializing elsewhere on a 'naturally occurring' line still FAILS", () => {
    // The strip must not hide the second hit — regression for #41 comment.
    expect(
      ed("naturally occurring elements are, surprisingly, abundant"),
    ).toBe("fail");
  });
  test("'simply is' still fails (genuine intensifier)", () => {
    expect(ed("the universe simply is the structure")).toBe("fail");
  });
  test("'naturally beautiful' still fails (exemption is narrow)", () => {
    expect(ed("a naturally beautiful result")).toBe("fail");
  });
});

describe("checkScholarlyDefault — 'Right' is a technical adjective, not an interjection", () => {
  const md = (line: string) =>
    checkScholarlyDefault(tmp("t.md", line), undefined).result;
  const leanDoc = (line: string) =>
    checkScholarlyDefault(undefined, tmp("t.lean", `/-- ${line} -/\ndef f := 0\n`))
      .result;

  // The bare `Right\b` this pattern used to carry hit 22 Lean docstring
  // lines in the qou corpus (2026-08-24) and was wrong on 21 of them.
  test("'Right multiplication by a generator' passes", () => {
    expect(md("Right multiplication by a generator preserves the parabolic.")).toBe("pass");
  });
  test("'Right action of the Hecke generator' passes", () => {
    expect(md("Right action of the Hecke generator on the module.")).toBe("pass");
  });
  test("'Right gauge action' passes inside a Lean docstring", () => {
    expect(leanDoc("Right gauge action `SU(2)_R`.")).toBe("pass");
  });
  test("'Right, so ...' still fails (genuine interjection)", () => {
    expect(md("Right, so the bracket closes.")).toBe("fail");
  });
  test("'Right now we encode ...' still fails (lecturer cadence)", () => {
    expect(md("Right now we encode the real-part magnitude.")).toBe("fail");
  });
  test("neighbouring bare-comma openers are untouched", () => {
    expect(md("Alright the construction proceeds.")).toBe("fail");
    expect(md("Okay so the map is defined.")).toBe("fail");
  });
});

describe("checkScholarlyDefault — 'So the' is conclusion-drawing, not lecture cadence", () => {
  const md = (line: string) =>
    checkScholarlyDefault(tmp("t.md", line), undefined).result;

  // 246 of the 261 corpus-wide hits came from the bare `So (?:...|the)`
  // alternative, and none of them was the draft narration it was written for.
  test("'So the sum is well-defined' passes", () => {
    expect(md("So the sum is well-defined and independent of the choice.")).toBe("pass");
  });
  test("'So the two sides line up' passes", () => {
    expect(md("So the two sides line up under the pairing.")).toBe("pass");
  });
  test("'So the plan is ...' still fails (the narration it was for)", () => {
    expect(md("So the plan is to reduce to the abelian case.")).toBe("fail");
  });
  test("'So the idea is ...' still fails", () => {
    expect(md("So the idea is to push the estimate through.")).toBe("fail");
  });
  test("'So now we turn to' still fails", () => {
    expect(md("So now we turn to the second factor.")).toBe("fail");
  });
});

describe("checkScholarlyDefault — bare-word alternatives do not glue to the next word", () => {
  const md = (line: string) =>
    checkScholarlyDefault(tmp("t.md", line), undefined).result;

  // Without `\b`, `the` matched through the prefix of there/they/these.
  test("'So there is no inverse' passes", () => {
    expect(md("So there is no inverse to apply here.")).toBe("pass");
  });
  test("'So they are stated over the same ring' passes", () => {
    expect(md("So they are stated over the same generic ring.")).toBe("pass");
  });
  test("'So these two agree' passes", () => {
    expect(md("So these two agree on the overlap.")).toBe("pass");
  });
  // Under the /i flag, `(?:we|I)` matched the lowercase i of "is".
  test("'So what is proved here is the reduction' passes", () => {
    expect(md("So what is proved here is the reduction.")).toBe("pass");
  });
  test("'So what we do next' still fails", () => {
    expect(md("So what we do next is bound the tail.")).toBe("fail");
  });
});

describe("checkScholarlyDefault — a wrap continuation is not a sentence start", () => {
  test("'right, since ...' as a continuation line passes", () => {
    // The sentence began on the previous line and wrapped mid-clause.
    const p = tmp(
      "wrap.md",
      "The action is on the\nright, since the ring need not be commutative.\n",
    );
    expect(checkScholarlyDefault(p, undefined).result).toBe("pass");
  });
  test("the same opener after a full stop still fails", () => {
    const p = tmp(
      "start.md",
      "The action is on one side.\nRight, so the ring need not be commutative.\n",
    );
    expect(checkScholarlyDefault(p, undefined).result).toBe("fail");
  });
  test("an opener at the very first line still fails", () => {
    expect(
      checkScholarlyDefault(tmp("first.md", "Okay so the map is defined.\n"), undefined).result,
    ).toBe("fail");
  });
  test("an opener after a blank line still fails", () => {
    const p = tmp("para.md", "A closing sentence\n\nBasically, the map is defined.\n");
    expect(checkScholarlyDefault(p, undefined).result).toBe("fail");
  });
});

// ── b7yo: the two false positives that survived the profile axis ────
//
// Both were found by running the real sweep over `docs/source/`
// (a document-profile corpus) after PR #256 made the profile gate fire.
// Neither is a scoping problem, so no gate change clears them — the
// criteria themselves over-match.

import {
  checkStatusLeak,
  checkAuthorNotesPollution,
} from "../../../pipeline/qa-checkers-voice.ts";

const leak = (line: string) => checkStatusLeak(tmp("leak.md", line)).result;
const notes = (line: string) => checkAuthorNotesPollution(tmp("notes.md", line)).result;

describe("checkAuthorNotesPollution — a measurement's date is provenance, not pollution", () => {
  test("the AGENTS.md-mandated form passes", () => {
    // AGENTS.md: "a number without its date and command is a claim, not
    // evidence". P4 was firing on the house style it must coexist with.
    expect(notes("**precision 71%** — measured 2026-09-18 on main.")).toBe("pass");
    expect(notes("Re-measured 2026-09-18: the arc is 274 to 195.")).toBe("pass");
  });

  test("a bare status date still FAILS", () => {
    // The exemption is bound to `measured`, not to dates generally.
    expect(notes("As of 2026-05-28 this remains open.")).toBe("fail");
    expect(notes("Blocked since 2026-05-28.")).toBe("fail");
  });

  test("the exemption cannot reach across a sentence boundary", () => {
    // Bounded by [^.\n] so a nearby `measured` cannot launder an
    // unrelated date in the next sentence.
    expect(notes("We measured throughput. As of 2026-05-28 it is unfixed.")).toBe("fail");
  });

  test("other author-notes patterns on a measured line are unaffected", () => {
    // The strip must not hide a second, genuine hit on the same line.
    expect(notes("Measured 2026-09-18 by Claude on main.")).toBe("fail");
  });
});

describe("checkStatusLeak — a definition table's label cell names a term", () => {
  test("a checkpoint name in a label cell passes", () => {
    // `roles.md:46` — a row in a table OF CHECKPOINT NAMES.
    expect(
      leak("| **Needs review** (Phase 1) | Confirm the BA's needs statement |"),
    ).toBe("pass");
  });

  test("a status marker in the DEFINITION half still FAILS", () => {
    // Only the first cell is masked.
    expect(leak("| **Phase 1** | (TODO) write the needs statement |")).toBe("fail");
  });

  test("a label cell that is not purely a label still FAILS", () => {
    // The cell must be a bolded term plus an optional parenthetical.
    // Prose in a table is still prose.
    expect(leak("| **Pending.** the proof is stalled | see below |")).toBe("fail");
  });

  test("the same text outside a table still FAILS", () => {
    // The exemption is about table structure, not about the phrase.
    expect(leak("**Needs review** before we ship.")).toBe("fail");
  });
});

describe("checkEditorializing — proof economy is not an opinion (bean 2t41)", () => {
  // `voice-editorializing` failed the paper the `expo-milnor-clarity` strict gate
  // is NAMED after: 26 hits across 11 of the 20 pages of Milnor's "Link Groups"
  // (Annals of Mathematics 59(2), 1954), ingested as `library/milnorlink/`.
  //
  // The bean recorded 14, having counted only `clearly`. Measured in full the 26
  // split three ways, and only the third is a defect:
  //   ~20  proof economy — routing the reader away from a routine verification
  //     4  terms of art — `naturally isomorphic`, where the adverb is the name
  //     1  genuine — "Unfortunately these invariants are not strong enough" (p194)
  //
  // Editorializing spends the reader's attention on the author's opinion. Proof
  // economy spends none and saves some. They are opposite moves that share a
  // vocabulary.

  test("sentence-initial: the exemplar's own opening case passes", () => {
    expect(
      ed("Clearly the relation of homotopy is reflexive, symmetric and transitive."),
    ).toBe("pass");
  });

  test("predicative `is clearly` and bare `is clear` pass", () => {
    expect(ed("The inclusion map is clearly a homotopy equivalence.")).toBe("pass");
    expect(ed("This is clear for the case n = 0.")).toBe("pass");
  });

  test("the `it is easy to see` frame passes", () => {
    expect(ed("it is easy to see that ai is unique and well-defined")).toBe("pass");
  });

  test("adverb and verb pass in EITHER order, with auxiliaries between", () => {
    // Both directions occur in the exemplar; neither is the author's opinion.
    expect(ed("The parallel can clearly be represented by a loop.")).toBe("pass");
    expect(ed("it follows easily that L is trivial.")).toBe("pass");
    expect(ed("It clearly maps JG onto S.")).toBe("pass");
    expect(ed("It is easily verified that the kernel is [A].")).toBe("pass");
  });

  test("`naturally isomorphic` passes — the adverb IS the name", () => {
    // A *natural* isomorphism is a specific thing in category theory, not an
    // isomorphism the author happens to admire. `MATH_IDIOM_EXEMPT` covers
    // adverb + article + noun; this is adverb + adjective, which it does not.
    expect(ed("The group is naturally isomorphic to G(Lt).")).toBe("pass");
    expect(ed("The action is properly discontinuous.")).toBe("pass");
  });

  test("THE EXEMPTION IS THE CONSTRUCTION, NOT THE WORD", () => {
    // The bean's own stated test case, and the reason this is a strip rather
    // than a whole-line skip: the `Clearly` is removed and the value judgement
    // in the same clause still fails. `clearly` before a claim the reader cannot
    // check in their head is the real defect, and no phrase list separates the
    // two — this invariant is what stands in for that.
    expect(ed("Clearly this is the most important result in the field.")).toBe(
      "fail",
    );
  });

  test("the genuine set still fails", () => {
    expect(ed("Unfortunately these invariants are not strong enough.")).toBe("fail");
    expect(ed("Surprisingly, the two constructions agree.")).toBe("fail");
    expect(ed("This is a beautiful result.")).toBe("fail");
    expect(ed("It is worth noting that the map is injective.")).toBe("fail");
  });

  test("a bare superlative now fails — it did not before", () => {
    // Found while fixing this: the criterion's description says "Results speak
    // for themselves", but the regex only matched `perhaps the most …`, so a
    // plain superlative passed. Adding it is what lets the proof-economy strip
    // be safe, because the surviving hit is what fails the bean's test case.
    expect(ed("This is the most important result in the field.")).toBe("fail");
    expect(ed("The single most striking consequence follows.")).toBe("fail");
  });

  test("a hard wrap cuts the idiom BOTH ways", () => {
    // Measured: p178 "…is just the" / "commutator subgroup [A]…" and p193
    // "…Wi,ri clearly" / "represents the ith parallel…". In both, the line holds
    // only the head and the rest is on the next — the mirror of the comparative
    // lookback, which handles the head being on the line before.
    expect(
      checkEditorializing(
        tmp("wrap-head.md", "the subgroup E of G is just the\ncommutator subgroup [A] of the kernel\n"),
      ).result,
    ).toBe("pass");
    expect(
      checkEditorializing(
        tmp("wrap-adv.md", "as = a' and Wi = WiJ ... Wi,ri clearly\nrepresents the ith parallel\n"),
      ).result,
    ).toBe("pass");
  });
});
