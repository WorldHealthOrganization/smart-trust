/**
 * One parser for the `uses:` field of a block's `.ts` source.
 *
 * `uses[]` is the **editorial** relation — what a reader must have read
 * to follow a block — and AGENTS.md makes it the signal every ordering
 * metric is computed from. It was being extracted from source text by
 * four independent hand-rolled parsers, two of which could return a
 * *different field's* array as the block's dependencies:
 *
 * - `conditional-class-banner-audit` (a CI gate) and
 *   `conjectural-propagation-audit` shared a verbatim copy built on
 *   `text.indexOf("uses:")` with no word boundary, so a field named
 *   `causes:` matched — and the following `indexOf("[")` then walked to
 *   whatever array came next.
 * - `prune-transitive-deps` matched `/uses:\s*\[[\s\S]*?\]/`, also
 *   without a boundary, on its **write** path.
 * - `qa-checkers-extended` had the boundary but still stopped at the
 *   first `]`.
 *
 * Two failure shapes, both silent. Stopping at the first `]` drops an
 * entry containing one and yields `[]` — a block with no dependencies.
 * Matching the wrong field yields a plausible-looking list of labels
 * that were never dependencies at all.
 *
 * Parsing TypeScript source with a scanner is not ideal; the blocks are
 * modules and could be imported. That is a larger change than the bug
 * warrants, and every existing caller already works on text — so this
 * consolidates the scanning rather than replacing it. See bean `jwd9`.
 *
 * @module pipeline/uses-field
 */

/** Identifier characters, for deciding what is a whole field name. */
const IDENT = /[A-Za-z0-9_$]/;

/**
 * Blank out `//` and `/* *\/` comments, **keeping string contents intact**.
 *
 * Index-preserving: comment characters become spaces, newlines survive, so
 * offsets computed on the result are valid in the original.
 *
 * String-aware, which is the whole difficulty: a `"https://example.com"` entry
 * must not have its second half eaten as a line comment. Conversely a label
 * quoted *inside* a comment must not be read as an entry — that is the `mcp1`
 * defect, where a slug mentioned in a note became a phantom dependency and
 * shifted every later position in its chapter.
 *
 * Distinct from `maskStringsAndComments`, which blanks string *contents* too —
 * right for locating field names, useless for reading the entries out of one.
 */
/**
 * Blank out string-literal CONTENTS and comment bodies, preserving every index
 * so offsets into the result are valid offsets into the original.
 *
 * Used to **locate** manifest array fields without being fooled by text that
 * merely looks like one — a `uses: ["def:ghost"]` written inside an
 * `authorNotes` body must not win over the block's real field.
 *
 * Lives here rather than in the checkers because both the checkers and the
 * content graph need it, and a second copy is how the parsers diverged in the
 * first place.
 */
export function maskStringsAndComments(src: string): string {
  const out = src.split("");
  let i = 0;
  const n = src.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const end = src.indexOf("\n", i);
      blank(i, end === -1 ? n : end);
      i = end === -1 ? n : end;
      continue;
    }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      blank(i, end === -1 ? n : end + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      blank(i + 1, j); // keep the quotes, blank the contents
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

export function maskComments(src: string): string {
  const out = src.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < src.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      // Skip the literal whole, honouring backslash escapes.
      let k = i + 1;
      while (k < src.length && src[k] !== c) k += src[k] === "\\" ? 2 : 1;
      i = k + 1;
      continue;
    }
    if (c === "/" && d === "/") {
      const end = src.indexOf("\n", i);
      blank(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      blank(i, end === -1 ? src.length : end + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    i++;
  }
  return out.join("");
}

export interface UsesField {
  /** Offset of the `u` in `uses:`. */
  fieldStart: number;
  /** Offset of the opening `[`. */
  arrayStart: number;
  /** Offset just past the matching `]`. */
  arrayEnd: number;
  /** String entries, in source order. */
  entries: string[];
}

/**
 * Offset of the `uses` **field** — a `uses` not preceded by an
 * identifier character, followed by optional space and a `:`.
 *
 * The boundary is what keeps `causes:`, `misuses:` and `reuses:` out.
 * JS `\b` is not enough on its own here because the old code used a
 * bare `indexOf`, and `\b` would also accept `$uses`.
 */
function findFieldStart(text: string, name: string, from = 0): number {
  let i = from;
  for (;;) {
    i = text.indexOf(name, i);
    if (i < 0) return -1;
    const before = i > 0 ? text[i - 1] : " ";
    if (!IDENT.test(before)) {
      // Allow whitespace between the name and its colon.
      let j = i + name.length;
      while (j < text.length && (text[j] === " " || text[j] === "\t")) j++;
      if (text[j] === ":") return i;
    }
    i += name.length;
  }
}

/**
 * Offset just past the `]` matching the `[` at `open`, or -1.
 *
 * Depth-counting and string-aware: an entry may legitimately contain a
 * bracket (`"def:family[0]"`), and stopping at the first `]` turns that
 * block into one with no dependencies.
 */
function matchingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Locate the `uses: [...]` field, or `undefined` when there is none.
 *
 * Returns `undefined` rather than an empty result when the field is
 * absent, so a caller can tell "no `uses` field" from "`uses: []`".
 * Writers depend on that: rewriting a field that is not there would
 * append one.
 */
export function findArrayField(text: string, name: string): UsesField | undefined {
  // LOCATE on a string- and comment-masked copy. Masking is index-preserving,
  // so every offset found here is valid in `text`. Without it the scan is
  // fooled by a `uses: [...]` written inside an `authorNotes` body, and it
  // reads that block's phantom dependencies instead of the real ones.
  const scan = maskStringsAndComments(text);
  let from = 0;
  for (;;) {
    const fieldStart = findFieldStart(scan, name, from);
    if (fieldStart < 0) return undefined;
    // Skip past the name + optional spaces + `:` to the value.
    let i = fieldStart + name.length;
    while (i < scan.length && scan[i] !== ":") i++;
    i++;
    while (i < scan.length && /\s/.test(scan[i])) i++;
    if (scan[i] !== "[") {
      // A field that is not an array literal — a spread, a variable.
      // Not something this scanner can read; keep looking rather than
      // silently reporting the next array along.
      from = fieldStart + name.length;
      continue;
    }
    const arrayEnd = matchingBracket(scan, i);
    if (arrayEnd < 0) return undefined;
    // Mask comments before reading entries: a label quoted inside a note is
    // not a dependency, and counting it invents one (the `mcp1` defect).
    // Masking is index-preserving, so entries are still sliced from `text`.
    const inner = text.slice(i + 1, arrayEnd - 1);
    const masked = maskComments(inner);
    const entries = [...masked.matchAll(/"([^"]*)"|'([^']*)'/g)].map(
      (m) => (m[1] ?? m[2]) && inner.slice(m.index! + 1, m.index! + 1 + (m[1] ?? m[2]).length),
    );
    return { fieldStart, arrayStart: i, arrayEnd, entries };
  }
}

/** Locate the `uses: [...]` field specifically. */
export function findUsesField(text: string): UsesField | undefined {
  return findArrayField(text, "uses");
}

/**
 * A string field nested inside an object field: `lean: { ref: "qou:X" }`.
 *
 * Scoped to `outer`'s braces, so a `ref:` belonging to a *different* field
 * cannot answer. Manifests carry several: `lean.ref`, `simulator.ref`,
 * `computation.ref`. An unscoped `/\bref\s*:\s*"([^"]+)"/` returns whichever
 * appears first in the file, which for a block with `simulator: { ref: … }` and
 * no `lean:` block at all is a simulator id reported as a Lean declaration.
 *
 * Returns `undefined` when `outer` is absent, is not an object, or holds no
 * such key — never a value from elsewhere in the file.
 */
export function parseNestedStringField(
  text: string,
  outer: string,
  inner: string,
): string | undefined {
  const scan = maskStringsAndComments(text);
  let from = 0;
  for (;;) {
    const start = findFieldStart(scan, outer, from);
    if (start < 0) return undefined;
    let i = start + outer.length;
    while (i < scan.length && scan[i] !== ":") i++;
    i++;
    while (i < scan.length && /\s/.test(scan[i])) i++;
    if (scan[i] !== "{") {
      from = start + outer.length;
      continue;
    }
    // Depth-scan the object so a nested `{}` cannot end it early.
    let depth = 0;
    let end = -1;
    for (let k = i; k < scan.length; k++) {
      if (scan[k] === "{") depth++;
      else if (scan[k] === "}") {
        depth--;
        if (depth === 0) { end = k; break; }
      }
    }
    if (end < 0) return undefined;
    // Search only within the object, and slice the value from the original.
    const innerStart = findFieldStart(scan.slice(i, end), inner, 0);
    if (innerStart < 0) {
      from = start + outer.length;
      continue;
    }
    let j = i + innerStart + inner.length;
    while (j < scan.length && scan[j] !== ":") j++;
    j++;
    while (j < scan.length && /\s/.test(scan[j])) j++;
    const q = scan[j];
    if (q !== '"' && q !== "'") return undefined;
    const close = scan.indexOf(q, j + 1);
    if (close < 0) return undefined;
    return text.slice(j + 1, close);
  }
}

/**
 * A scalar string field's value — `interprets: "def:x"` — or `undefined`.
 *
 * Same masked locate as `findArrayField`, for the same reasons: a `//` note
 * between the previous field and this one must not hide it, and the field name
 * quoted inside a string must not win. A plain
 * `/interprets:\s*"([^"]+)"/` would fall to both, and the second is not
 * hypothetical — prose in this corpus discusses `interprets:` by name.
 */
export function parseStringField(text: string, name: string): string | undefined {
  const scan = maskStringsAndComments(text);
  let from = 0;
  for (;;) {
    const fieldStart = findFieldStart(scan, name, from);
    if (fieldStart < 0) return undefined;
    let i = fieldStart + name.length;
    while (i < scan.length && scan[i] !== ":") i++;
    i++;
    while (i < scan.length && /\s/.test(scan[i])) i++;
    const quote = scan[i];
    if (quote !== '"' && quote !== "'") {
      // Not a string literal — a template, a variable, a nested object.
      from = fieldStart + name.length;
      continue;
    }
    // The masked copy keeps quote positions, so the end is findable there and
    // the value is sliced from the original.
    const end = scan.indexOf(quote, i + 1);
    if (end < 0) return undefined;
    return text.slice(i + 1, end);
  }
}

/**
 * Remove an array field's `name: [...]` text entirely, leaving the rest
 * intact. Used to blank downstream-reference fields before scanning the
 * remaining source for evidence about the block itself.
 */
export function stripArrayField(text: string, name: string): string {
  for (;;) {
    const f = findArrayField(text, name);
    if (!f) return text;
    text = text.slice(0, f.fieldStart) + text.slice(f.arrayEnd);
  }
}

/** The block's `uses[]` entries; `[]` when the field is absent. */
export function parseUsesField(text: string): string[] {
  return findUsesField(text)?.entries ?? [];
}

/**
 * Replace the `uses: [...]` field's array literal with `replacement`.
 *
 * Returns the text unchanged when there is no `uses` field — callers
 * that must know use `findUsesField` first.
 */
export function replaceUsesArray(text: string, replacement: string): string {
  const f = findUsesField(text);
  if (!f) return text;
  return text.slice(0, f.arrayStart) + replacement + text.slice(f.arrayEnd);
}

/**
 * Remove the whole `uses: [...]` field, plus a trailing comma and the
 * whitespace that would otherwise be left behind.
 */
export function removeUsesField(text: string): string {
  const f = findUsesField(text);
  if (!f) return text;
  let end = f.arrayEnd;
  if (text[end] === ",") end++;
  // Take the preceding indentation with it, so the field's line does
  // not survive as a blank one.
  let start = f.fieldStart;
  while (start > 0 && (text[start - 1] === " " || text[start - 1] === "\t")) start--;
  if (text[end] === "\n") end++;
  else if (start > 0 && text[start - 1] === "\n") start--;
  return text.slice(0, start) + text.slice(end);
}
