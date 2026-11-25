/**
 * One answer to *"is this position inside an HTML comment?"*
 *
 * A `<body>` written as an example inside a template comment once caught a
 * `search(/<body/i)`, and the banner landed inside the comment while every
 * "did the string land" check still passed. `staging-banner`'s
 * `bodyInsertionPoint` and `folio-mount`'s `hasMount` (a marker inside a
 * comment is not a mount) share this scan and differ only in what they look
 * for.
 *
 * ## What it does NOT do
 *
 * It does not parse HTML. A `<!--` inside a `<script>` string literal or an
 * attribute value would be counted as a comment here and is not one. The
 * error is in the safe direction: a marker wrongly judged commented-out fails
 * a gate loudly; a marker wrongly judged live would pass silently.
 *
 * @module scripts/html-comments
 */

/** Half-open `[start, end)` ranges of every HTML or Liquid template comment in `html`. */
export function commentRanges(html: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g)) {
    out.push([m.index!, m.index! + m[0].length]);
  }
  return out;
}

/**
 * A predicate over one document's comments, built once.
 *
 * Returned as a closure rather than as `isInComment(html, i)` because every
 * caller asks about many positions in one document, and re-scanning per
 * position is how an O(n) check becomes O(n²) on a 670-page tree.
 */
export function commentGuard(html: string): (index: number) => boolean {
  const ranges = commentRanges(html);
  return (index: number) => ranges.some(([a, b]) => index >= a && index < b);
}
