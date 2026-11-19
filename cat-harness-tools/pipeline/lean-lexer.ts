/**
 * The Lean source LEXER — comment stripping and declaration splitting.
 *
 * @module pipeline/lean-lexer
 *
 * ## Why this is core and not the science layer
 *
 * Same test as `schemas/lean-packages.ts`, which holds the `lean.ref` grammar
 * for the same reason: would core function without the science layer
 * installed? It would not. `BlockBase` carries an optional `lean` field,
 * `QaCriterionDefinition` carries `lean_granularity: "statement"`, and
 * `qa-utils` consults the statement hash on EVERY freshness check — on a
 * document folio as much as a paper one, because the field is on shared block
 * kinds by design and the document profile forbids its USE rather than its
 * existence.
 *
 * So the grammar belongs wherever the field does. What is genuinely the
 * science layer's is what you DO with a parsed declaration — Atlas ingestion,
 * triviality probing, coverage tables — not how to find one in a file.
 *
 * ## Six copies of this existed
 *
 * `stripLeanComments` was reimplemented, independently, in
 * `qa-checkers-extended.ts`, `qa-checkers-vacuity.ts`,
 * `conditional-class-banner-audit.ts`, `qa-checkers-q-usage.ts` and
 * `scripts/lean-coverage.ts`, beside this canonical one. Six places to get
 * nested `/- … -/` wrong, and six that must independently remember the two
 * invariants stated below — that byte offsets are preserved, and that doc
 * comments are comments. A copy is unlikely to preserve either.
 *
 * This module is the one home they should converge on. Converging them is NOT
 * done here: each copy has to be read against this one first, because a
 * checker whose verdicts change means a corpus-wide re-sweep and some of the
 * differences may be deliberate. Tracked as its own bean.
 */

// ── Lean source lexing (comment-stripped) ───────────────────────

/**
 * Strip Lean comments: `--` to end of line, and nestable `/- … -/`.
 *
 * Replaces comment bodies with equal-length whitespace so byte offsets
 * are preserved — the declaration splitter below indexes into the
 * result and must stay aligned with the original source.
 *
 * ## TWO invariants, and only the first was held until 2026-09-27
 *
 * **Length is preserved**, so byte offsets stay aligned. That one always held
 * and is what the module was tested on.
 *
 * **Line count is preserved too**, so a line number taken from the stripped
 * text is the SOURCE line number. That one did NOT hold: a newline inside a
 * block comment was overwritten with a space like any other character, so an
 * N-line comment collapsed to one line and everything below it moved up.
 * Bean `vrfx`. Measured over the qou corpus: **3,931 of 3,971 files** shifted
 * (99.0 %), 281,234 lines lost, worst file −3,199. A `/-! … -/` module header
 * shifted an entire file — reproduced here as 6 source lines reporting as 2.
 *
 * The fix is to write the newline back rather than a space. Length is still
 * one character for one, and the comment's CONTENT is still blanked, so a
 * restored newline only ever yields a line of spaces that no declaration
 * pattern can match. Both invariants are asserted in
 * `lean-lexer-is-the-only-stripper.test.ts`; asserting only length is why this
 * survived.
 *
 * Doc comments (`/-- … -/`) are comments too: a decl name mentioned
 * only in prose is not a dependency. Skipping this step is how a
 * scanner invents edges out of documentation.
 */
export function stripLeanComments(src: string): string {
  const out = src.split("");
  let i = 0;
  let depth = 0;
  while (i < src.length) {
    if (depth === 0 && src[i] === "-" && src[i + 1] === "-") {
      while (i < src.length && src[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "-") {
      depth++;
      out[i++] = " ";
      out[i++] = " ";
      continue;
    }
    if (depth > 0 && src[i] === "-" && src[i + 1] === "/") {
      depth--;
      out[i++] = " ";
      out[i++] = " ";
      continue;
    }
    // The newline is written BACK, not blanked: blanking it collapsed an
    // N-line block comment to one line, so every line number below it was
    // wrong (bean `vrfx`). The three other writes above cannot reach a
    // newline — the `--` loop stops at one, and `/-` and `-/` are two
    // non-newline characters each — so this is the only place it mattered.
    if (depth > 0) out[i] = src[i] === "\n" ? "\n" : " ";
    i++;
  }
  return out.join("");
}

/**
 * What a declaration LOOKS like, lexically.
 *
 * EXPORTED so that the one other regex in this repository asking the same
 * question — `LEAN_DECL_RE` in `qa-checkers-q-usage.ts` — can be compared
 * against it by a test rather than by eye.
 *
 * ## They disagree, measured 2026-09-20 (bean `bqrg`)
 *
 * `stripLeanComments` was converged onto this module and is gated by
 * `lean-lexer-is-the-only-stripper.test.ts`. The DECLARATION SPLITTER was the
 * half left over, and it is not one duplicate but two functions answering
 * different questions off two different regexes:
 *
 * - `splitDeclarations` here returns byte offsets and a signature/body split;
 * - `leanDeclSpans` there returns 1-indexed inclusive LINE ranges, so a caller
 *   can blank everything outside a declaration while preserving line numbers.
 *
 * Those are genuinely different projections and neither replaces the other.
 * What IS duplicated is the pattern below, and the two copies have drifted in
 * four ways — three of which are defects HERE:
 *
 * | source | `axiom` | `opaque` | `unsafe` | dotted name |
 * |---|---|---|---|---|
 * | this | ✗ missed | ✗ missed | ✗ missed | ✓ `Foo.bar` |
 * | `LEAN_DECL_RE` | ✓ | ✓ | ✓ | ✗ truncates to `Foo` |
 *
 * **`axiom` is the sharp one.** `splitDeclarations` feeds `lean-signature.ts`
 * and `lean-triviality-probe.ts`, and in a formal corpus an axiom is the
 * declaration whose presence most changes what a proof is worth. A triviality
 * probe that cannot see one is blind to exactly what it exists to find.
 *
 * ## The sweep the pin was waiting for — run 2026-09-25
 *
 * The analysis above is right in every part, and this paragraph replaces only
 * its last inference. It read:
 *
 * > **This repository holds 0 `.lean` files**, so the sweep cannot be run here
 * > at all; it has to happen in a folio that carries a Lean corpus.
 *
 * The first clause is true and still asserted by a test. The conclusion does
 * not follow: the corpus is a SIBLING CHECKOUT, not a file in this tree, and
 * `lean-lexer-is-the-only-stripper.test.ts` in this same directory already
 * records a **3,954-file** sweep run from a container exactly like this one.
 * The repository contained its own counter-example.
 *
 * Re-run over **3,971 `.lean` files**, **52,144 declarations**:
 *
 *     union (below)          52,144
 *     DECL_RE, before        51,901   missed 243 in 105 files
 *                                     axiom 113, opaque 130; no `unsafe` in this corpus
 *     LEAN_DECL_RE           52,144   every name, 990 of them (1.9%) truncated at the dot
 *
 * **A missed keyword is not a skipped declaration.** `splitDeclarations`
 * slices from one start to the NEXT, so unrecognised text is absorbed into the
 * body of whatever precedes it. Those 243 were reported as part of another
 * declaration's body, in authored content:
 * `vertex-algebra-relations.lean` alone absorbed **9**. The triviality probe
 * splices bodies, so it would rewrite a neighbour's axiom.
 *
 * So the divergence is CONVERGED rather than pinned, and the pattern below is
 * the union: both keyword sets, both modifier sets, and the dotted name class.
 * `declarationStarts` is the single answer, with the two projections over it.
 *
 * `[^\S\n]*` rather than `\s*`, deliberately: `\s` matches a newline, so
 * `^\s*` under `/m` can begin a match on a blank line above the declaration
 * and put the offset on the wrong line. Harmless for the byte spans here, a
 * wrong answer for `leanDeclSpans`, which converts these offsets to line
 * numbers. Spans are unaffected — `bodyAt` is `from + cut`, both relative to
 * the same slice.
 */
export const DECL_RE =
  /^[^\S\n]*(?:@\[[^\]]*\][^\S\n]*)?(?:private\s+|protected\s+|noncomputable\s+|partial\s+|unsafe\s+)*(theorem|lemma|def|abbrev|structure|inductive|instance|class|example|axiom|opaque)\s+([A-Za-z_][A-Za-z0-9_'.!?]*)/gm;

/** A declaration's name and the absolute offset at which its span begins. */
export interface DeclStart {
  name: string;
  /** Absolute offset into the comment-stripped source. */
  at: number;
}

/**
 * Every declaration start in comment-stripped Lean source, in order.
 *
 * The shared half of two splitters that answer different questions:
 * `splitDeclarations` projects these to CHARACTER spans cut into signature and
 * body, for callers that splice source; `leanDeclSpans` in
 * `qa-checkers-q-usage.ts` projects them to 1-indexed inclusive LINE ranges,
 * for a caller that blanks around a declaration while preserving line numbers.
 *
 * Those projections are genuinely different and neither replaces the other —
 * that part of the earlier analysis stands unchanged. Finding the starts is
 * what was being done twice, with two answers.
 */
export function declarationStarts(stripped: string): DeclStart[] {
  const starts: DeclStart[] = [];
  // A fresh regex per call: `DECL_RE` carries the `g` flag, so `lastIndex`
  // would leak between callers.
  const re = new RegExp(DECL_RE.source, "gm");
  for (const m of stripped.matchAll(re)) {
    starts.push({ name: m[2], at: m.index ?? 0 });
  }
  return starts;
}

export interface DeclSpan {
  name: string;
  /** Signature text (before `:=` / `where`). */
  signature: string;
  /** Body text (after `:=` / `where`), empty when there is none. */
  body: string;
  /**
   * Absolute offset of `body` within the stripped source, or -1 when the
   * declaration has no body.
   *
   * Callers that need to splice the body (the triviality probe) must not
   * re-find it with `indexOf`: bodies repeat verbatim across a file
   * (`:= by rfl` is not distinctive), so a search can land on the wrong
   * one and rewrite a different declaration than the one requested.
   */
  bodyAt: number;
}

/** Bracket pairs that can nest a `:=` inside a statement. */
const OPEN = "([{⟨⦃";
const CLOSE = ")]}⟩⦄";
/** Lean identifier characters, for the `where` word boundary. */
const IDENT = /[A-Za-z0-9_'.!?]/;

/**
 * Offset of the first **top-level** `:=` or `where` in `text`, or -1.
 *
 * Top-level means outside every bracket pair and outside string
 * literals. A theorem *statement* may legitimately contain `:=` — a
 * `let` (`(let x := 5; x) = 5`), a structure instance (`{ a := 1 }`), an
 * anonymous constructor — and cutting at the first one anywhere puts
 * statement text into the body. Measured consequences of getting this
 * wrong, all three of which read as a clean result rather than an error:
 *
 * - `lean-signature` hashes only the truncated signature, so
 *   `(let x := 5; x) = 5` and `... = 6` hash identically and a changed
 *   statement never invalidates its QA sidecar;
 * - `lean-triviality-probe` splices its tactic over the tail of the
 *   statement, the file stops elaborating, every ladder rung fails, and
 *   the declaration is recorded `closed: false` — "not machine-trivial";
 * - scan mode files the statement's own text under `value_deps`.
 *
 * Char literals are deliberately NOT tracked: `'` is far more often a
 * prime in an identifier (`h'`, `ih'`) than a delimiter, so treating it
 * as a quote would miscut far more declarations than it rescues.
 */
export function topLevelCut(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (OPEN.includes(c)) {
      depth++;
      continue;
    }
    if (CLOSE.includes(c)) {
      // Clamp: a stray closer (the span boundary can chop mid-term) must
      // not drive depth negative and mask every later top-level cut.
      if (depth > 0) depth--;
      continue;
    }
    if (depth !== 0) continue;
    if (c === ":" && text[i + 1] === "=") return i;
    if (
      c === "w" &&
      text.startsWith("where", i) &&
      !IDENT.test(text[i - 1] ?? " ") &&
      !IDENT.test(text[i + 5] ?? " ")
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Split comment-stripped Lean source into per-declaration spans, each
 * separated into signature and body at the first top-level `:=` or
 * `where`.
 *
 * This is what lets scan mode emit a type/value split at all. It is a
 * lexical approximation — no elaboration, no scope tracking — hence
 * `source: "scan"` on everything it produces.
 */
export function splitDeclarations(stripped: string): DeclSpan[] {
  const starts = declarationStarts(stripped);
  const spans: DeclSpan[] = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i].at;
    const to = i + 1 < starts.length ? starts[i + 1].at : stripped.length;
    const text = stripped.slice(from, to);
    const cut = topLevelCut(text);
    spans.push({
      name: starts[i].name,
      signature: cut === -1 ? text : text.slice(0, cut),
      body: cut === -1 ? "" : text.slice(cut),
      bodyAt: cut === -1 ? -1 : from + cut,
    });
  }
  return spans;
}


import { readFileSync } from "fs";

/**
 * Does `file` textually declare a top-level `name` (theorem/def/...)?
 *
 * Used to reject import-only aggregators when resolving a declaration to a
 * module file.
 */
export function fileDeclaresName(file: string, name: string): boolean {
  let body: string;
  try {
    body = readFileSync(file, "utf-8");
  } catch {
    return false;
  }
  const short = name.includes(".") ? name.split(".").pop()! : name;
  const esc = short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\b(?:theorem|lemma|def|abbrev|instance|structure|class|inductive|opaque|axiom)\\s+(?:[\\w'.\\u00C0-\\uFFFF]*\\.)?${esc}\\b`,
    "u",
  ).test(body);
}
